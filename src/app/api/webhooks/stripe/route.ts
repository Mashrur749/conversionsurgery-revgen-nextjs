import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handlePaymentSuccess, formatAmount } from '@/lib/services/stripe';
import { getDb } from '@/db';
import { payments, leads, clients, subscriptions, billingEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { getStripeClient } from '@/lib/clients/stripe';
import { syncInvoiceFromStripe } from '@/lib/services/subscription-invoices';
import { addPaymentMethod } from '@/lib/services/payment-methods';

/** POST /api/webhooks/stripe */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[Billing] STRIPE_WEBHOOK_SECRET is not configured — cannot verify webhook signatures');
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
  }

  const stripe = getStripeClient();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );
  } catch (err) {
    console.error('[Billing] Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = getDb();

  switch (event.type) {
    case 'checkout.session.completed': {
      // Dedup check — prevent duplicate processing on webhook retry
      const [existingCheckoutEvent] = await db
        .select({ id: billingEvents.id })
        .from(billingEvents)
        .where(eq(billingEvents.stripeEventId, event.id))
        .limit(1);
      if (existingCheckoutEvent) break;

      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_link && session.payment_intent) {
        await handlePaymentSuccess(
          session.payment_link as string,
          session.payment_intent as string,
          session.amount_total || 0
        );

        // Send confirmation to lead
        const leadId = session.metadata?.leadId;
        const clientId = session.metadata?.clientId;

        if (leadId && clientId) {
          const [lead] = await db
            .select()
            .from(leads)
            .where(eq(leads.id, leadId))
            .limit(1);

          const [client] = await db
            .select()
            .from(clients)
            .where(eq(clients.id, clientId))
            .limit(1);

          if (lead && client && client.twilioNumber) {
            const amount = formatAmount(session.amount_total || 0);

            await sendSMS(
              lead.phone,
              `Payment of ${amount} received! Thank you for your business. - ${client.businessName}`,
              client.twilioNumber
            );
          }

          // Notify client owner
          if (client?.phone) {
            const amount = formatAmount(session.amount_total || 0);
            const adminNumber = process.env.TWILIO_PHONE_NUMBER;

            if (adminNumber) {
              await sendSMS(
                client.phone,
                `Payment received: ${amount} from ${session.customer_details?.name || 'customer'}`,
                adminNumber
              );
            }
          }

          // Log billing event for dedup
          await logBillingEvent(
            db,
            clientId,
            event,
            `Payment received: ${formatAmount(session.amount_total || 0)}`,
            session.amount_total || undefined
          );
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_link) {
        await db
          .update(payments)
          .set({ status: 'cancelled' })
          .where(eq(payments.stripePaymentLinkId, session.payment_link as string));
      }
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;

      if (charge.payment_intent) {
        await db
          .update(payments)
          .set({ status: 'refunded' })
          .where(eq(payments.stripePaymentIntentId, charge.payment_intent as string));
      }
      break;
    }

    // ============================================
    // SUBSCRIPTION BILLING EVENTS
    // ============================================

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdate(db, sub, event);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(db, sub, event);
      break;
    }

    case 'invoice.created':
    case 'invoice.updated':
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoiceEvent(db, invoice, event);
      break;
    }

    case 'payment_method.attached': {
      const pm = event.data.object as Stripe.PaymentMethod;
      await handlePaymentMethodAttached(db, pm, event);
      break;
    }

    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.metadata?.clientId;
      if (clientId) {
        await logBillingEvent(db, clientId, event, 'Trial ending in 3 days');
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

// ============================================
// SUBSCRIPTION BILLING HANDLERS
// ============================================

type DB = ReturnType<typeof getDb>;

async function handleSubscriptionUpdate(db: DB, sub: Stripe.Subscription, event: Stripe.Event) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) {
    console.error('[Billing] No clientId in subscription metadata');
    return;
  }

  // Check for duplicate billing event
  const [existingEvent] = await db
    .select()
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

  // In Stripe v20, current_period is on subscription items
  const firstItem = sub.items.data[0];

  // Wrap in transaction to ensure subscription update and billing event are atomic
  await db.transaction(async (tx) => {
    await tx.update(subscriptions).set({
      status: sub.status as 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused',
      currentPeriodStart: firstItem ? new Date(firstItem.current_period_start * 1000) : undefined,
      currentPeriodEnd: firstItem ? new Date(firstItem.current_period_end * 1000) : undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      updatedAt: new Date(),
    }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

    await tx.insert(billingEvents).values({
      clientId,
      eventType: event.type.replace(/\./g, '_'),
      description: `Subscription ${event.type.split('.')[2]}`,
      stripeEventId: event.id,
      stripeEventType: event.type,
      rawData: event.data.object as unknown as Record<string, unknown>,
    });
  });
}

async function handleSubscriptionDeleted(db: DB, sub: Stripe.Subscription, event: Stripe.Event) {
  // Check for duplicate billing event
  const [existingEvent] = await db
    .select()
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

  const clientId = sub.metadata?.clientId;

  // Wrap all DB writes in transaction — prevents partial state where
  // subscription is canceled but client status stays active
  await db.transaction(async (tx) => {
    await tx.update(subscriptions).set({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

    if (clientId) {
      await tx.insert(billingEvents).values({
        clientId,
        eventType: event.type.replace(/\./g, '_'),
        description: 'Subscription canceled',
        stripeEventId: event.id,
        stripeEventType: event.type,
        rawData: event.data.object as unknown as Record<string, unknown>,
      });

      await tx.update(clients).set({
        status: 'cancelled',
        updatedAt: new Date(),
      }).where(eq(clients.id, clientId));
    }
  });
}

async function handleInvoiceEvent(db: DB, invoice: Stripe.Invoice, event: Stripe.Event) {
  try {
    await syncInvoiceFromStripe(invoice.id);
  } catch (err) {
    console.error('[Billing] Failed to sync invoice:', err);
  }

  // In Stripe v20, subscription is in parent.subscription_details
  const stripeSubId = typeof invoice.parent?.subscription_details?.subscription === 'string'
    ? invoice.parent.subscription_details.subscription
    : invoice.parent?.subscription_details?.subscription?.id;

  if (!stripeSubId) return;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
    .limit(1);

  if (subscription) {
    await logBillingEvent(
      db,
      subscription.clientId,
      event,
      `Invoice ${event.type.split('.')[1]}`,
      invoice.amount_due
    );
  }
}

async function handlePaymentMethodAttached(db: DB, pm: Stripe.PaymentMethod, event: Stripe.Event) {
  const customerStr = typeof pm.customer === 'string' ? pm.customer : pm.customer?.id;
  if (!customerStr) return;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.stripeCustomerId, customerStr))
    .limit(1);

  if (client) {
    await addPaymentMethod(client.id, pm.id, false);
    await logBillingEvent(db, client.id, event, 'Payment method added');
  }
}

async function logBillingEvent(
  db: DB,
  clientId: string,
  event: Stripe.Event,
  description: string,
  amountCents?: number
) {
  await db.insert(billingEvents).values({
    clientId,
    eventType: event.type.replace(/\./g, '_'),
    description,
    stripeEventId: event.id,
    stripeEventType: event.type,
    amountCents,
    rawData: event.data.object as unknown as Record<string, unknown>,
  });
}
