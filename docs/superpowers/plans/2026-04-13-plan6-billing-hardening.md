# Plan 6: Billing Hardening (First 30 Days)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Stripe webhook pipeline against duplicate processing, silent failures, missing metadata, and timezone errors before the first client onboards.

**Architecture:** Surgical fixes to 4 existing files. No new tables or services. No schema migrations.

**Tech Stack:** TypeScript, Drizzle ORM, Stripe, Resend, `date-fns-tz` (already installed)

**Source specs:**
- `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` — XDOM-05 through XDOM-12

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/app/api/webhooks/stripe/route.ts` | XDOM-05, 06, 07, 11: dedup, metadata alert, deletion guard, trial notification |
| Modify | `src/lib/services/subscription.ts` | XDOM-08: compensating cancel alert |
| Modify | `src/lib/automations/payment-reminder.ts` | XDOM-09, 10: link retry + timezone scheduling |
| Modify | `src/lib/services/cancellation-reminders.ts` | XDOM-12: grace-period status query fix |

---

## Task 1 — Add dedup to 5 webhook handlers (XDOM-05)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Context:** `handleSubscriptionUpdate`, `handleSubscriptionPaused`, and `handleSubscriptionResumed` already use the dedup pattern. Five handlers do not: `handleInvoiceEvent`, `handlePaymentMethodAttached`, `handlePaymentActionRequired`, `handleDisputeCreated`, `handleDisputeClosed`, and the `checkout.session.expired` case.

The existing dedup pattern (from `handleSubscriptionPaused`, line 399):
```typescript
const [existingEvent] = await db
  .select({ id: billingEvents.id })
  .from(billingEvents)
  .where(eq(billingEvents.stripeEventId, event.id))
  .limit(1);
if (existingEvent) return;
```

- [ ] **Step 1: Fix `handleInvoiceEvent` — add dedup before `syncInvoiceFromStripe`**

Current code (lines 345-377):
```typescript
async function handleInvoiceEvent(db: DB, invoice: Stripe.Invoice, event: Stripe.Event) {
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
  }
}
```

Replace with:
```typescript
async function handleInvoiceEvent(db: DB, invoice: Stripe.Invoice, event: Stripe.Event) {
  // Dedup — prevent double sync + double billing event on Stripe retry
  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

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
  }
}
```

- [ ] **Step 2: Fix `handlePaymentMethodAttached` — add dedup before `addPaymentMethod`**

Current code (lines 379-393):
```typescript
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
```

Replace with:
```typescript
async function handlePaymentMethodAttached(db: DB, pm: Stripe.PaymentMethod, event: Stripe.Event) {
  // Dedup — logBillingEvent at the end persists the event.id key
  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

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
```

- [ ] **Step 3: Fix `handlePaymentActionRequired` — add dedup before `logBillingEvent`**

Current code (lines 454-487):
```typescript
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
```

Replace with:
```typescript
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
  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

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
```

- [ ] **Step 4: Fix `handleDisputeCreated` — add dedup before `logBillingEvent`**

Current code (lines 516-541):
```typescript
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
```

Replace with:
```typescript
async function handleDisputeCreated(db: DB, dispute: Stripe.Dispute, event: Stripe.Event) {
  const clientId = await resolveClientFromDispute(db, dispute);
  if (!clientId) return;

  // Dedup — prevents duplicate URGENT email on Stripe retry
  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

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
```

- [ ] **Step 5: Fix `handleDisputeClosed` — add dedup before `logBillingEvent`**

Current code (lines 543-565):
```typescript
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
```

Replace with:
```typescript
async function handleDisputeClosed(db: DB, dispute: Stripe.Dispute, event: Stripe.Event) {
  const clientId = await resolveClientFromDispute(db, dispute);
  if (!clientId) return;

  // Dedup — prevents duplicate billing event + admin email on Stripe retry
  const [existingEvent] = await db
    .select({ id: billingEvents.id })
    .from(billingEvents)
    .where(eq(billingEvents.stripeEventId, event.id))
    .limit(1);
  if (existingEvent) return;

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
```

- [ ] **Step 6: Fix `checkout.session.expired` case — add dedup before the `payments` update**

Current code (lines 158-168):
```typescript
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
```

Replace with:
```typescript
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
```

- [ ] **Step 7: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS (no new errors)

- [ ] **Step 8: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 9: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "fix: add dedup to 5 webhook handlers — invoice, payment-method, action-required, disputes, checkout-expired (XDOM-05)"
```

---

## Task 2 — Alert on missing checkout metadata (XDOM-06)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Context:** At lines 74-87, when `clientId` or `planId` is absent in checkout session metadata, the code silently breaks. Stripe has already charged the customer, but no subscription is provisioned. The operator has no way to know.

- [ ] **Step 1: Replace the silent break with an alert**

Current code (lines 74-88):
```typescript
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
        }
        break;
      }
```

Replace with:
```typescript
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
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "fix: alert on missing checkout session metadata instead of silent break (XDOM-06)"
```

---

## Task 3 — Guard subscription deletion without clientId (XDOM-07)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Context:** `handleSubscriptionDeleted` (lines 307-343) currently: deduplicates (good), then runs a transaction. Inside the transaction, the subscription row is always updated to `canceled`, but `clients.status = 'cancelled'` only runs `if (clientId)`. This means if `clientId` is missing, the subscription is canceled locally but the client record stays `active` — a permanent split-brain.

- [ ] **Step 1: Add early-return guard when `clientId` is missing**

Current code (lines 307-343):
```typescript
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
  await withTransaction(async (tx) => {
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
```

Replace with:
```typescript
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
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "fix: guard subscription deletion against missing clientId — alert + early return (XDOM-07)"
```

---

## Task 4 — Alert on compensating cancel failure (XDOM-08)

**Files:**
- Modify: `src/lib/services/subscription.ts`

**Context:** Lines 197-208 — when the DB transaction after Stripe subscription creation fails, a compensating cancel is attempted. If the cancel also fails, it is silently `console.error`d. This leaves an orphaned Stripe subscription that continues billing indefinitely with no operator alert.

Note: `subscription.ts` does not currently import `logSanitizedConsoleError` or `sendEmail`. Both imports must be added.

- [ ] **Step 1: Add missing imports at the top of `subscription.ts`**

Current imports (lines 1-14):
```typescript
import { getDb, withTransaction } from '@/db';
import { subscriptions, plans, clients, billingEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import { validateAndRedeemCoupon } from '@/lib/services/coupon-validation';
import {
  resolveClientUsagePolicy,
  type ClientUsagePolicy,
  type PlanFeatures,
} from '@/lib/services/usage-policy';
import { buildInitialGuaranteeWindowState } from '@/lib/services/guarantee-v2/state-machine';
import type Stripe from 'stripe';
import type { Subscription } from '@/db/schema/subscriptions';
import type { Plan } from '@/db/schema/plans';
```

Replace with:
```typescript
import { getDb, withTransaction } from '@/db';
import { subscriptions, plans, clients, billingEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getStripeClient } from '@/lib/clients/stripe';
import { validateAndRedeemCoupon } from '@/lib/services/coupon-validation';
import {
  resolveClientUsagePolicy,
  type ClientUsagePolicy,
  type PlanFeatures,
} from '@/lib/services/usage-policy';
import { buildInitialGuaranteeWindowState } from '@/lib/services/guarantee-v2/state-machine';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { sendEmail } from '@/lib/services/resend';
import type Stripe from 'stripe';
import type { Subscription } from '@/db/schema/subscriptions';
import type { Plan } from '@/db/schema/plans';
```

- [ ] **Step 2: Replace the silent `console.error` catch blocks with structured logging and admin alert**

Current code (lines 197-208):
```typescript
  } catch (error) {
    // Transaction failed — attempt to cancel the Stripe subscription
    // to prevent orphaned billing
    console.error('[Subscription] DB transaction failed after Stripe create, attempting compensation:', error);
    try {
      await stripe.subscriptions.cancel(stripeSubscription.id);
      console.log('[Subscription] Compensating Stripe cancel succeeded');
    } catch (cancelError) {
      console.error('[Subscription] Compensating Stripe cancel FAILED — manual reconciliation needed:', cancelError);
    }
    throw error;
  }
```

Replace with:
```typescript
  } catch (error) {
    // Transaction failed — attempt to cancel the Stripe subscription
    // to prevent orphaned billing
    logSanitizedConsoleError(
      '[Subscription] DB transaction failed after Stripe create, attempting compensation',
      error instanceof Error ? error : new Error(String(error)),
      { stripeSubscriptionId: stripeSubscription.id, clientId, planId }
    );

    try {
      await stripe.subscriptions.cancel(stripeSubscription.id);
    } catch (cancelError) {
      // Compensating cancel also failed — subscription is orphaned and will continue billing.
      // Alert the operator immediately so they can cancel manually in Stripe.
      logSanitizedConsoleError(
        '[Subscription] Compensating Stripe cancel FAILED — orphaned subscription requires manual cancellation',
        cancelError instanceof Error ? cancelError : new Error(String(cancelError)),
        { stripeSubscriptionId: stripeSubscription.id, clientId, planId }
      );

      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `CRITICAL: Orphaned Stripe subscription — manual cancellation required`,
          html: `<p>A Stripe subscription was created but the local database transaction failed. The compensating cancellation also failed, leaving an <strong>active subscription that will continue billing</strong>.</p>
<p><strong>Stripe Subscription ID:</strong> ${stripeSubscription.id}</p>
<p><strong>Client ID:</strong> ${clientId}</p>
<p><strong>Plan ID:</strong> ${planId}</p>
<p>Please cancel this subscription immediately in the <a href="https://dashboard.stripe.com/subscriptions/${stripeSubscription.id}">Stripe Dashboard</a> to stop the customer from being charged.</p>`,
        }).catch(() => {
          // Email failure must not swallow the original error
        });
      }
    }

    throw error;
  }
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/subscription.ts
git commit -m "fix: alert on compensating cancel failure — orphaned Stripe subscription (XDOM-08)"
```

---

## Task 5 — Payment link retry on Stripe outage (XDOM-09)

**Files:**
- Modify: `src/lib/automations/payment-reminder.ts`

**Context:** Lines 87-109 — `createPaymentLink` is called once with no retry. If Stripe is down or returns a transient error, the entire reminder sequence runs with the fallback string `'Contact us to arrange payment'` instead of an actual link. The operator is not notified.

**Note:** `payment-reminder.ts` already imports `console.error`. We need to add `logSanitizedConsoleError` and `sendEmail` imports.

- [ ] **Step 1: Add missing imports**

Current imports (lines 1-6):
```typescript
import { getDb } from '@/db';
import { clients, leads, invoices, scheduledMessages, payments, paymentReminders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays, isFuture, isToday } from 'date-fns';
import { createPaymentLink } from '@/lib/services/stripe';
```

Replace with:
```typescript
import { getDb } from '@/db';
import { clients, leads, invoices, scheduledMessages, payments, paymentReminders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { renderTemplate } from '@/lib/utils/templates';
import { addDays, isFuture, isToday } from 'date-fns';
import { createPaymentLink } from '@/lib/services/stripe';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { sendEmail } from '@/lib/services/resend';
```

- [ ] **Step 2: Replace the single-attempt `createPaymentLink` call with a retry loop**

Current code (lines 87-109):
```typescript
  // 3. Auto-create Stripe payment link if not provided and amount is set
  let resolvedPaymentLink = paymentLink;
  let paymentLinkFailed = false;
  if (!resolvedPaymentLink && amountCents && amountCents > 0) {
    try {
      const result = await createPaymentLink({
        clientId,
        leadId,
        invoiceId: invoice.id,
        amount: amountCents,
        description: `Invoice ${invoice.invoiceNumber || ''} - ${client.businessName}`.trim(),
        type: 'full',
      } as CreatePaymentLinkParams) as CreatePaymentLinkResult;
      resolvedPaymentLink = result.paymentLinkUrl;

      // Update invoice with the payment link
      await db
        .update(invoices)
        .set({ paymentLink: resolvedPaymentLink })
        .where(eq(invoices.id, invoice.id));
    } catch (err) {
      console.error('[Payments] Failed to create Stripe payment link:', err);
      paymentLinkFailed = true;
      // Continue without a payment link
    }
  }
```

Replace with:
```typescript
  // 3. Auto-create Stripe payment link if not provided and amount is set
  // Retry up to 3 times with exponential backoff (500ms, 1000ms) on transient Stripe errors.
  let resolvedPaymentLink = paymentLink;
  let paymentLinkFailed = false;
  if (!resolvedPaymentLink && amountCents && amountCents > 0) {
    const MAX_ATTEMPTS = 3;
    const RETRY_DELAYS_MS = [500, 1000];
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await createPaymentLink({
          clientId,
          leadId,
          invoiceId: invoice.id,
          amount: amountCents,
          description: `Invoice ${invoice.invoiceNumber || ''} - ${client.businessName}`.trim(),
          type: 'full',
        } as CreatePaymentLinkParams) as CreatePaymentLinkResult;
        resolvedPaymentLink = result.paymentLinkUrl;

        // Update invoice with the payment link
        await db
          .update(invoices)
          .set({ paymentLink: resolvedPaymentLink })
          .where(eq(invoices.id, invoice.id));

        lastError = undefined;
        break; // success — exit retry loop
      } catch (err) {
        lastError = err;
        if (attempt < MAX_ATTEMPTS) {
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt - 1]));
        }
      }
    }

    if (lastError !== undefined) {
      logSanitizedConsoleError(
        '[Payments] Failed to create Stripe payment link after 3 attempts',
        lastError instanceof Error ? lastError : new Error(String(lastError)),
        { invoiceNumber: invoice.invoiceNumber, clientId, leadId }
      );
      paymentLinkFailed = true;

      // Alert operator so they can share the payment link manually
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        await sendEmail({
          to: adminEmail,
          subject: `Payment link creation failed — invoice ${invoice.invoiceNumber || invoice.id} for ${client.businessName}`,
          html: `<p>Stripe payment link creation failed after 3 attempts for the following invoice. The payment reminder sequence has started using a fallback message (&ldquo;Contact us to arrange payment&rdquo;).</p>
<p><strong>Invoice:</strong> ${invoice.invoiceNumber || invoice.id}</p>
<p><strong>Client:</strong> ${client.businessName}</p>
<p><strong>Amount:</strong> $${(amountCents / 100).toFixed(2)}</p>
<p><strong>Lead ID:</strong> ${leadId}</p>
<p>Please create a payment link manually in Stripe and share it with the customer directly, or update the invoice record in the admin dashboard.</p>`,
        }).catch(() => {
          // Email failure must not block the reminder sequence
        });
      }
    }
  }
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All existing tests pass

---

## Task 6 — Timezone-aware payment reminders (XDOM-10)

**Files:**
- Modify: `src/lib/automations/payment-reminder.ts` (same file as Task 5 — implement together)

**Context:** Line 132 — `sendAt.setHours(10, 0, 0, 0)` sets 10am in the server's UTC timezone. In production, this delivers at 3-4am for clients in `America/Edmonton`. The project already uses `getTimezoneOffset` from `date-fns-tz` for compliance scheduling (see `compliance-gateway.ts`). The no-show recovery automation uses a `tenAmLocalTime()` pattern via the `Intl` API. We use the same `Intl`-based approach to avoid adding another dependency.

The fix uses the same algorithm already proven in `src/lib/automations/no-show-recovery.ts` (lines 34-62).

- [ ] **Step 1: Add timezone-aware helper function above `startPaymentReminder`**

After the `PAYMENT_SCHEDULE` constant (after line 38), add:

```typescript
/**
 * Returns a UTC Date representing 10:00am in the client's local timezone
 * on the given calendar date.
 *
 * Uses the Intl API (no external dependency) — same approach as no-show-recovery.ts.
 */
function tenAmInTimezone(date: Date, timezone: string): Date {
  // Get the calendar date string in the client's timezone (YYYY-MM-DD)
  const localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const [year, month, day] = localDateStr.split('-').map(Number);

  // Candidate: 10:00 UTC on that calendar date
  const candidateUtc = new Date(Date.UTC(year, month - 1, day, 10, 0, 0, 0));

  // Determine what local hour that candidate falls on
  const localHourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(candidateUtc);
  const localHour = Number(localHourStr);

  // Shift to align candidate with 10:00 local
  const offsetMs = (10 - localHour) * 60 * 60 * 1000;
  return new Date(candidateUtc.getTime() + offsetMs);
}
```

- [ ] **Step 2: Replace the UTC `setHours` call with timezone-aware scheduling**

Current code (lines 130-133):
```typescript
  for (const item of PAYMENT_SCHEDULE) {
    const sendAt = addDays(dueDateObj, item.daysFromDue);
    sendAt.setHours(10, 0, 0, 0);
```

Replace with:
```typescript
  // Use client's timezone for scheduling — fall back to Alberta default if not set
  const clientTimezone = client.timezone || 'America/Edmonton';

  for (const item of PAYMENT_SCHEDULE) {
    const targetDate = addDays(dueDateObj, item.daysFromDue);
    const sendAt = tenAmInTimezone(targetDate, clientTimezone);
```

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 5: Commit (Tasks 5 and 6 together — same file)**

```bash
git add src/lib/automations/payment-reminder.ts
git commit -m "fix: payment link retry (3 attempts + alert) and timezone-aware scheduling (XDOM-09, XDOM-10)"
```

---

## Task 7 — Contractor notification on `trial_will_end` (XDOM-11)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Context:** Lines 214-221 — the `customer.subscription.trial_will_end` case logs a billing event but sends nothing to the contractor. The contractor has no warning that their card will be charged in 3 days.

Per the overview plan: send SMS from the admin Twilio number (not the client&rsquo;s `twilioNumber` which is their outbound lead line) and a companion email with more detail. `sendSMS` and `sendEmail` are already imported in this file.

- [ ] **Step 1: Replace the minimal handler with a full notification**

Current code (lines 214-221):
```typescript
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription;
      const clientId = sub.metadata?.clientId;
      if (clientId) {
        await logBillingEvent(db, clientId, event, 'Trial ending in 3 days');
      }
      break;
    }
```

Replace with:
```typescript
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
        const [plan] = client.subscriptionId
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
```

Note: The `plans` table is already imported at the top of `route.ts`. Confirm `subscriptions` is also imported — it is (line 5).

- [ ] **Step 2: Verify `subscriptions` and `plans` are both imported**

Check the import line at the top of `route.ts`:
```typescript
import { payments, leads, clients, subscriptions, plans, billingEvents } from '@/db/schema';
```

If `plans` is not yet in the destructured import, add it.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "feat: notify contractor via SMS and email 3 days before trial ends (XDOM-11)"
```

---

## Task 8 — Fix grace-period reminder status query (XDOM-12)

**Files:**
- Modify: `src/lib/services/cancellation-reminders.ts`

**Context:** Schema investigation (confirmed in `src/db/schema/cancellation-requests.ts` line 19):

```typescript
status: varchar('status', { length: 20 }).default('pending'), // pending, scheduled_call, saved, cancelled
```

The full status lifecycle comment shows: `pending`, `scheduled_call`, `saved`, `cancelled`.

The grace-period reminders query at line 81 filters `eq(cancellationRequests.status, 'pending')`. The `gracePeriodEnds` field is set when a cancellation request is created. The `status` column does NOT have a `'confirmed'` value — it stays `'pending'` until the operator resolves it (`'saved'` = retained, `'cancelled'` = confirmed gone).

**Finding:** The query is correct as written — `'pending'` is the right status for &ldquo;grace period active.&rdquo; However, the query will ALSO match `scheduled_call` rows (where the operator has scheduled a save call but the request hasn&rsquo;t been resolved yet) — these should also receive grace-period reminders.

The current query misses `'scheduled_call'` rows that still have a future `gracePeriodEnds`. The fix: use `inArray` to include both `'pending'` and `'scheduled_call'` statuses, and add a clarifying comment.

- [ ] **Step 1: Update the `activeCancellations` query**

Current code (lines 68-85):
```typescript
  const activeCancellations = await db
    .select({
      requestId: cancellationRequests.id,
      clientId: cancellationRequests.clientId,
      gracePeriodEnds: cancellationRequests.gracePeriodEnds,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      email: clients.email,
    })
    .from(cancellationRequests)
    .innerJoin(clients, eq(cancellationRequests.clientId, clients.id))
    .where(
      and(
        eq(cancellationRequests.status, 'pending'),
        isNotNull(cancellationRequests.gracePeriodEnds),
        gt(cancellationRequests.gracePeriodEnds, now)
      )
    );
```

Replace with:
```typescript
  // Status lifecycle: pending → scheduled_call (save call booked) → saved (retained) | cancelled (gone)
  // Grace-period reminders apply while the request is unresolved — both 'pending' and 'scheduled_call'
  // statuses represent an active grace window. 'saved' and 'cancelled' are terminal and excluded.
  const activeCancellations = await db
    .select({
      requestId: cancellationRequests.id,
      clientId: cancellationRequests.clientId,
      gracePeriodEnds: cancellationRequests.gracePeriodEnds,
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      email: clients.email,
    })
    .from(cancellationRequests)
    .innerJoin(clients, eq(cancellationRequests.clientId, clients.id))
    .where(
      and(
        inArray(cancellationRequests.status, ['pending', 'scheduled_call']),
        isNotNull(cancellationRequests.gracePeriodEnds),
        gt(cancellationRequests.gracePeriodEnds, now)
      )
    );
```

Note: `inArray` is already imported at line 25 of `cancellation-reminders.ts`.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/cancellation-reminders.ts
git commit -m "fix: include scheduled_call status in grace-period reminder query (XDOM-12)"
```

---

## Parallelization Guide

These 8 tasks split into two parallel waves. If running multiple agents, follow file-conflict rules from CLAUDE.md.

**Wave 1 — all in `route.ts` (assign to ONE agent to avoid file conflicts):**
- Task 1 (XDOM-05): webhook dedup — 5 handlers
- Task 2 (XDOM-06): missing checkout metadata alert
- Task 3 (XDOM-07): subscription deletion guard
- Task 7 (XDOM-11): trial_will_end notification

**Wave 2 — separate files (can run in parallel as separate agents):**
- Task 4 (XDOM-08): compensating cancel alert — `subscription.ts`
- Tasks 5+6 (XDOM-09+10): payment link retry + timezone scheduling — `payment-reminder.ts` (same agent, same file)
- Task 8 (XDOM-12): grace-period status query — `cancellation-reminders.ts`

---

## Doc Update Requirements

Per CLAUDE.md Change→Doc mapping:

| Change | Doc to update |
|--------|---------------|
| Trial notification added (Task 7) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 8: Billing — add trial_will_end SMS+email notification |
| Payment link retry behavior (Task 5) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 8: Billing — document retry behavior |
| Timezone-aware payment reminders (Task 6) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 8: Billing |
| Cancellation reminder fix (Task 8) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 8: Billing |
| New admin alert behaviors (Tasks 2, 3, 4, 5) | `docs/engineering/01-TESTING-GUIDE.md` — add manual test steps for each alert path |

---

## Verification Checklist

After all tasks are complete:

- [ ] **Gate 1 — Fast check:**
  ```bash
  npm run ms:gate
  ```
  Expected: green

- [ ] **Gate 2 — Logging guard:**
  ```bash
  npm run quality:logging-guard
  ```
  Expected: green (no `error.message` leaks in API responses)

- [ ] **Gate 3 — Full regression:**
  ```bash
  npm run quality:no-regressions
  ```
  Expected: green

- [ ] **Manual test: Webhook dedup** — Replay any Stripe webhook event twice using the same `event.id`. Confirm only one `billingEvents` row is created.

- [ ] **Manual test: Missing metadata alert** — Simulate a `checkout.session.completed` webhook with `session.mode === 'subscription'` and empty `metadata`. Confirm admin email is sent and the handler returns 200.

- [ ] **Manual test: Subscription deleted, no clientId** — Simulate `customer.subscription.deleted` with no `clientId` in metadata. Confirm admin email is sent, `clients.status` is NOT changed to `'cancelled'`, and handler returns 200.

- [ ] **Manual test: Compensating cancel failure** — Simulate `createSubscription()` where the DB transaction throws and the compensating cancel also throws. Confirm admin email arrives with the Stripe subscription ID.

- [ ] **Manual test: Payment link retry** — Mock `createPaymentLink` to fail 3 times in test environment. Confirm the admin alert email is sent and the sequence continues with the fallback message.

- [ ] **Manual test: Timezone scheduling** — Call `startPaymentReminder` for a client with `timezone: 'America/Edmonton'` and a `dueDate` of today. Inspect the created `scheduledMessages.sendAt` column — it should be 10:00am Mountain time (not 10:00am UTC).

- [ ] **Manual test: Trial notification** — Simulate `customer.subscription.trial_will_end` via Stripe CLI (`stripe trigger customer.subscription.trial_will_end`). Confirm SMS and email are sent to the client.

- [ ] **Manual test: Grace-period reminders for scheduled_call** — Create a `cancellation_request` row with `status = 'scheduled_call'` and a future `gracePeriodEnds`. Run `processCancellationReminders()`. Confirm the row is included and reminders are sent.
