import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { handlePaymentSuccess, formatAmount } from '@/lib/services/stripe';
import { getDb, withTransaction } from '@/db';
import { payments, leads, clients, subscriptions, plans, billingEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { getStripeClient } from '@/lib/clients/stripe';
import { syncInvoiceFromStripe } from '@/lib/services/subscription-invoices';
import { addPaymentMethod } from '@/lib/services/payment-methods';
import { sendEmail } from '@/lib/services/resend';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { provisionSubscriptionFromCheckout } from '@/lib/services/subscription';

/** POST /api/webhooks/stripe */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logSanitizedConsoleError(
      '[Billing][stripe-webhook.config]',
      new Error('STRIPE_WEBHOOK_SECRET is not configured')
    );
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
    return safeErrorResponse(
      '[Billing][stripe-webhook.signature]',
      err,
      'Invalid signature',
      400
    );
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

      // Handle subscription checkout (from /api/client/billing/checkout)
      if (session.mode === 'subscription' && session.subscription) {
        const stripeSubId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
        const clientId = session.metadata?.clientId;
        const planId = session.metadata?.planId;

        if (clientId && planId) {
          try {
            await provisionSubscriptionFromCheckout(stripeSubId, clientId, planId, event.id);
          } catch (err) {
            logSanitizedConsoleError('[Billing][checkout.subscription-provision]', err, {
              stripeSubId,
              clientId,
              planId,
              stripeEventId: event.id,
            });
          }
        } else {
          // Missing metadata — Stripe charged the customer but we cannot auto-provision.
          // Alert the operator for manual intervention. Do NOT throw (Stripe would retry).
          const missingFields = [
            !clientId && 'clientId',
            !planId && 'planId',
          ].filter(Boolean).join(', ');

          logSanitizedConsoleError(
            '[Billing][checkout.missing-metadata]',
            new Error(`checkout.session.completed missing required metadata: ${missingFields}`),
            {
              stripeSubId,
              stripeEventId: event.id,
              sessionId: session.id,
              availableMetadata: session.metadata,
            }
          );

          const adminEmail = process.env.ADMIN_EMAIL;
          if (adminEmail) {
            await sendEmail({
              to: adminEmail,
              subject: `ACTION REQUIRED: Stripe checkout completed but subscription not provisioned`,
              html: `<p>A Stripe checkout session completed but the subscription could not be auto-provisioned because required metadata fields are missing.</p>
<p><strong>Missing fields:</strong> ${missingFields}</p>
<p><strong>Stripe Subscription ID:</strong> ${stripeSubId}</p>
<p><strong>Stripe Event ID:</strong> ${event.id}</p>
<p><strong>Stripe Session ID:</strong> ${session.id}</p>
<p><strong>Available metadata:</strong> ${JSON.stringify(session.metadata || {})}</p>
<p>Please manually provision the subscription in the admin dashboard or contact support.</p>`,
            });
          }
        }
        break;
      }

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

            await sendCompliantMessage({
              clientId: client.id,
              to: lead.phone,
              from: client.twilioNumber,
              body: `Payment of ${amount} received! Thank you for your business. - ${client.businessName}`,
              messageClassification: 'inbound_reply',
              messageCategory: 'transactional',
              consentBasis: { type: 'existing_customer' },
              leadId: lead.id,
              queueOnQuietHours: false,
              metadata: { source: 'payment_confirmation', stripeEventId: event.id },
            });
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
      // Dedup — prevents setting status to 'cancelled' twice on Stripe retry
      const [existingExpiredEvent] = await db
        .select({ id: billingEvents.id })
        .from(billingEvents)
        .where(eq(billingEvents.stripeEventId, event.id))
        .limit(1);
      if (existingExpiredEvent) break;

      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_link) {
        await db
          .update(payments)
          .set({ status: 'cancelled' })
          .where(eq(payments.stripePaymentLinkId, session.payment_link as string));

        // Persist event.id as the dedup key for future retries
        const clientId = session.metadata?.clientId;
        if (clientId) {
          await db.insert(billingEvents).values({
            clientId,
            eventType: event.type.replace(/\./g, '_'),
            description: 'Checkout session expired',
            stripeEventId: event.id,
            stripeEventType: event.type,
            rawData: event.data.object as unknown as Record<string, unknown>,
          });
        }
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
      if (!clientId) break;

      // Dedup — prevents duplicate trial-end notifications on Stripe retry
      const [existingTrialEvent] = await db
        .select({ id: billingEvents.id })
        .from(billingEvents)
        .where(eq(billingEvents.stripeEventId, event.id))
        .limit(1);
      if (existingTrialEvent) break;

      await logBillingEvent(db, clientId, event, 'Trial ending in 3 days');

      // Fetch client record to get contact details
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (!client) break;

      // SMS notification — use admin Twilio number as from (client.twilioNumber is for lead outreach)
      const adminNumber = process.env.TWILIO_PHONE_NUMBER;
      if (client.phone && adminNumber) {
        await sendSMS(
          client.phone,
          `Hi ${client.ownerName || client.businessName} — your ConversionSurgery trial ends in 3 days. Your card on file will be charged automatically. Questions? Reply to this message or call us.`,
          adminNumber
        );
      }

      // Email notification — more detail + card update link
      if (client.email) {
        const [plan] = client.stripeSubscriptionId
          ? await db
              .select({ name: plans.name, stripePriceIdMonthly: plans.stripePriceIdMonthly })
              .from(plans)
              .innerJoin(
                subscriptions,
                eq(subscriptions.planId, plans.id)
              )
              .where(eq(subscriptions.clientId, clientId))
              .limit(1)
          : [];

        const planName = plan?.name || 'your current plan';
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/portal/billing`
          : 'your client portal';

        await sendEmail({
          to: client.email,
          subject: `Your ConversionSurgery trial ends in 3 days`,
          html: `<p>Hi ${client.ownerName || client.businessName},</p>
<p>Your free trial of ConversionSurgery ends in <strong>3 days</strong>. After that, you&rsquo;ll be automatically billed for <strong>${planName}</strong> using the card on file.</p>
<p>If you&rsquo;d like to update your payment method before billing starts, you can do so in your <a href="${portalUrl}">client portal</a>.</p>
<p>If you have any questions about your plan or billing, simply reply to this email or reach out to your account manager.</p>
<p>Thank you for trying ConversionSurgery &mdash; we&rsquo;re excited to keep working with you.</p>`,
        });
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
    logSanitizedConsoleError(
      '[Billing][subscription-update.missing-client-id]',
      new Error('No clientId in subscription metadata'),
      { stripeSubscriptionId: sub.id, stripeEventId: event.id }
    );
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
  await withTransaction(async (tx) => {
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

  // Guard: without clientId we cannot update the client record atomically.
  // Proceeding would leave client.status = 'active' while subscription.status = 'canceled'.
  // Alert the operator and bail out — they must reconcile manually.
  if (!clientId) {
    logSanitizedConsoleError(
      '[Billing][subscription-deleted.missing-client-id]',
      new Error('No clientId in subscription metadata — cannot update client status'),
      { stripeSubscriptionId: sub.id, stripeEventId: event.id }
    );

    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `ACTION REQUIRED: Subscription deleted in Stripe with no client mapping`,
        html: `<p>Stripe fired a <code>customer.subscription.deleted</code> event but the subscription has no <code>clientId</code> in its metadata. The client record has <strong>not</strong> been updated.</p>
<p><strong>Stripe Subscription ID:</strong> ${sub.id}</p>
<p><strong>Stripe Event ID:</strong> ${event.id}</p>
<p>Please locate the client in the admin dashboard, cancel their subscription record manually, and update their status to cancelled.</p>`,
      });
    }
    return;
  }

  // Wrap all DB writes in transaction — ensures subscription + client status update are atomic
  await withTransaction(async (tx) => {
    await tx.update(subscriptions).set({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

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
  });
}

async function handleInvoiceEvent(db: DB, invoice: Stripe.Invoice, event: Stripe.Event) {
  // Dedup — prevent double sync + double billing event on Stripe retry
  const [existingInvoiceEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingInvoiceEvent) return;

  try {
    await syncInvoiceFromStripe(invoice.id);
  } catch (err) {
    logSanitizedConsoleError('[Billing][invoice.sync-failed]', err, {
      invoiceId: invoice.id,
      stripeEventId: event.id,
    });
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

    // XDOM-03: Notify contractor on payment failure
    if (event.type === 'invoice.payment_failed') {
      const [client] = await db
        .select({
          phone: clients.phone,
          businessName: clients.businessName,
        })
        .from(clients)
        .where(eq(clients.id, subscription.clientId))
        .limit(1);

      if (client?.phone) {
        const adminNumber = process.env.TWILIO_PHONE_NUMBER;
        const portalUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.conversionsurgery.com';

        if (adminNumber) {
          try {
            await sendSMS(
              client.phone,
              `Your payment for ConversionSurgery did not go through. Please update your payment method at ${portalUrl}/client/billing to keep your leads protected. - ConversionSurgery`,
              adminNumber
            );
          } catch (smsErr) {
            logSanitizedConsoleError('[Billing][payment-failed.sms]', smsErr, {
              clientId: subscription.clientId,
              invoiceId: invoice.id,
            });
          }
        }
      }

      // Also notify admin
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        try {
          const amountStr = `$${((invoice.amount_due || 0) / 100).toFixed(2)}`;
          const [clientForEmail] = await db
            .select({ businessName: clients.businessName })
            .from(clients)
            .where(eq(clients.id, subscription.clientId))
            .limit(1);
          await sendEmail({
            to: adminEmail,
            subject: `Payment failed — ${clientForEmail?.businessName || subscription.clientId}`,
            html: `<p>Payment of <strong>${amountStr}</strong> failed for <strong>${clientForEmail?.businessName || subscription.clientId}</strong>.</p><p>Invoice: ${invoice.id}</p><p>The client has been notified via SMS to update their payment method.</p>`,
          });
        } catch (emailErr) {
          logSanitizedConsoleError('[Billing][payment-failed.email]', emailErr, {
            clientId: subscription.clientId,
            invoiceId: invoice.id,
          });
        }
      }
    }
  }
}

async function handlePaymentMethodAttached(db: DB, pm: Stripe.PaymentMethod, event: Stripe.Event) {
  // Dedup — logBillingEvent at the end persists the event.id key
  const [existingPmEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingPmEvent) return;

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

  await withTransaction(async (tx) => {
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

  await withTransaction(async (tx) => {
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

  // Dedup — prevents duplicate admin alert emails on Stripe retry
  const [existingActionEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingActionEvent) return;

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

  // Dedup — prevents duplicate URGENT email on Stripe retry
  const [existingDisputeEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingDisputeEvent) return;

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

  // Dedup — prevents duplicate billing event + admin email on Stripe retry
  const [existingClosedEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingClosedEvent) return;

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
