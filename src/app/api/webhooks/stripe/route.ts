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
import { sendEmail } from '@/lib/services/resend';

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

    case 'customer.subscription.paused': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionPaused(db, sub, event);
      break;
    }

    case 'customer.subscription.resumed': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionResumed(db, sub, event);
      break;
    }

    case 'invoice.payment_action_required': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentActionRequired(db, invoice, event);
      break;
    }

    case 'charge.dispute.created': {
      const dispute = event.data.object as Stripe.Dispute;
      await handleDisputeCreated(db, dispute, event);
      break;
    }

    case 'charge.dispute.closed': {
      const dispute = event.data.object as Stripe.Dispute;
      await handleDisputeClosed(db, dispute, event);
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

async function handleSubscriptionPaused(db: DB, sub: Stripe.Subscription, event: Stripe.Event) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) return;

  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

  await db.transaction(async (tx) => {
    await tx.update(subscriptions).set({
      status: 'paused',
      pausedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

    await tx.insert(billingEvents).values({
      clientId,
      eventType: 'subscription_paused',
      description: 'Subscription paused',
      stripeEventId: event.id,
      stripeEventType: event.type,
      rawData: event.data.object as unknown as Record<string, unknown>,
    });
  });
}

async function handleSubscriptionResumed(db: DB, sub: Stripe.Subscription, event: Stripe.Event) {
  const clientId = sub.metadata?.clientId;
  if (!clientId) return;

  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

  await db.transaction(async (tx) => {
    await tx.update(subscriptions).set({
      status: 'active',
      pausedAt: null,
      resumesAt: null,
      updatedAt: new Date(),
    }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

    await tx.insert(billingEvents).values({
      clientId,
      eventType: 'subscription_resumed',
      description: 'Subscription resumed',
      stripeEventId: event.id,
      stripeEventType: event.type,
      rawData: event.data.object as unknown as Record<string, unknown>,
    });
  });
}

async function handlePaymentActionRequired(db: DB, invoice: Stripe.Invoice, event: Stripe.Event) {
  const stripeSubId = typeof invoice.parent?.subscription_details?.subscription === 'string'
    ? invoice.parent.subscription_details.subscription
    : invoice.parent?.subscription_details?.subscription?.id;

  if (!stripeSubId) return;

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubId))
    .limit(1);

  if (!subscription) return;

  await logBillingEvent(
    db,
    subscription.clientId,
    event,
    'Payment requires customer action (3D Secure or additional verification)',
    invoice.amount_due
  );

  // Notify admin so they can follow up with the client
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const [client] = await db.select().from(clients).where(eq(clients.id, subscription.clientId)).limit(1);
    await sendEmail({
      to: adminEmail,
      subject: `Payment action required — ${client?.businessName || subscription.clientId}`,
      html: `<p>A payment for <strong>${client?.businessName || subscription.clientId}</strong> requires customer action (e.g., 3D Secure authentication).</p><p>Invoice amount: $${((invoice.amount_due || 0) / 100).toFixed(2)}</p><p>The customer needs to complete authentication to process this payment. Check the Stripe dashboard for details.</p>`,
    });
  }
}

async function resolveClientFromDispute(db: DB, dispute: Stripe.Dispute): Promise<string | undefined> {
  // Try to find client via the charge's customer
  const charge = typeof dispute.charge === 'object' && dispute.charge ? dispute.charge : null;
  let customerStr: string | undefined;

  if (charge) {
    customerStr = typeof charge.customer === 'string' ? charge.customer : charge.customer?.id;
  } else {
    // Charge is just a string ID — retrieve it from Stripe to get the customer
    const chargeId = typeof dispute.charge === 'string' ? dispute.charge : undefined;
    if (chargeId) {
      try {
        const stripe = getStripeClient();
        const fullCharge = await stripe.charges.retrieve(chargeId);
        customerStr = typeof fullCharge.customer === 'string' ? fullCharge.customer : fullCharge.customer?.id;
      } catch {
        // If we can't retrieve the charge, we can't resolve the client
      }
    }
  }

  if (!customerStr) return undefined;

  const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.stripeCustomerId, customerStr)).limit(1);
  return client?.id;
}

async function handleDisputeCreated(db: DB, dispute: Stripe.Dispute, event: Stripe.Event) {
  const clientId = await resolveClientFromDispute(db, dispute);
  if (!clientId) return;

  await logBillingEvent(
    db,
    clientId,
    event,
    `Dispute opened: ${dispute.reason || 'unknown reason'} — $${((dispute.amount || 0) / 100).toFixed(2)}`,
    dispute.amount
  );

  // Notify admin immediately — disputes have strict response deadlines
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    const dueBy = dispute.evidence_details?.due_by
      ? new Date(dispute.evidence_details.due_by * 1000).toLocaleDateString()
      : 'unknown';
    await sendEmail({
      to: adminEmail,
      subject: `URGENT: Dispute opened — ${client?.businessName || clientId}`,
      html: `<p>A payment dispute has been opened for <strong>${client?.businessName || clientId}</strong>.</p><p><strong>Amount:</strong> $${((dispute.amount || 0) / 100).toFixed(2)}<br/><strong>Reason:</strong> ${dispute.reason || 'Not specified'}<br/><strong>Evidence due by:</strong> ${dueBy}</p><p>Respond in the <a href="https://dashboard.stripe.com/disputes/${dispute.id}">Stripe Dashboard</a> before the deadline.</p>`,
    });
  }
}

async function handleDisputeClosed(db: DB, dispute: Stripe.Dispute, event: Stripe.Event) {
  const clientId = await resolveClientFromDispute(db, dispute);
  if (!clientId) return;

  const won = dispute.status === 'won';
  await logBillingEvent(
    db,
    clientId,
    event,
    `Dispute ${won ? 'won' : 'lost'}: $${((dispute.amount || 0) / 100).toFixed(2)}`,
    dispute.amount
  );

  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    await sendEmail({
      to: adminEmail,
      subject: `Dispute ${won ? 'won' : 'lost'} — ${client?.businessName || clientId}`,
      html: `<p>A dispute for <strong>${client?.businessName || clientId}</strong> has been closed.</p><p><strong>Outcome:</strong> ${won ? 'Won (funds returned)' : 'Lost (funds deducted)'}<br/><strong>Amount:</strong> $${((dispute.amount || 0) / 100).toFixed(2)}</p>`,
    });
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
