# Billing Critical Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3 critical billing issues — idempotency key defeat, missing subscription enforcement, missing contractor notification — before first client onboards.

**Architecture:** Surgical fixes to existing files. No new services or tables. No schema migrations.

**Tech Stack:** TypeScript, Drizzle ORM, Vitest, Stripe v20

**Source specs:**
- `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` (XDOM-01, XDOM-02, XDOM-03)

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/lib/services/subscription.ts` | XDOM-01: Remove Date.now() from 6 idempotency keys |
| Modify | `src/lib/compliance/compliance-gateway.ts` | XDOM-02: Add subscription status check to compliance pipeline |
| Modify | `src/app/api/webhooks/stripe/route.ts` | XDOM-03: SMS contractor on payment failure |

---

### Task 1: Remove Date.now() from Stripe Idempotency Keys (XDOM-01)

**Files:**
- Modify: `src/lib/services/subscription.ts`

**Problem:** Idempotency keys include `_${Date.now()}`, making them unique on every retry. If a network timeout causes a retry, Stripe creates a DUPLICATE subscription. Client gets billed twice.

**Fix:** Remove `_${Date.now()}` from all 6 locations. The remaining key components (`clientId`, `planId`, `interval`, `subscriptionId`) are already deterministic and sufficient.

- [ ] **Step 1: Read the file to confirm all 6 locations**

Run: Read `src/lib/services/subscription.ts` full file.

Confirmed locations:
- Line 118: `sub_create_${clientId}_${planId}_${interval}_${Date.now()}`
- Line 355: `sub_cancel_${subscriptionId}_${Date.now()}`
- Line 361: `sub_cancel_eop_${subscriptionId}_${Date.now()}`
- Line 429: `sub_change_${subscriptionId}_${newPlanId}_${interval}_${Date.now()}`
- Line 485: `sub_pause_${subscriptionId}_${Date.now()}`
- Line 519: `sub_resume_${subscriptionId}_${Date.now()}`

- [ ] **Step 2: Fix line 118 — createSubscription**

```typescript
// Old (line 118):
    { idempotencyKey: `sub_create_${clientId}_${planId}_${interval}_${Date.now()}` }

// New:
    { idempotencyKey: `sub_create_${clientId}_${planId}_${interval}` }
```

- [ ] **Step 3: Fix line 355 — cancelSubscription (immediate)**

```typescript
// Old (line 355):
      idempotencyKey: `sub_cancel_${subscriptionId}_${Date.now()}`,

// New:
      idempotencyKey: `sub_cancel_${subscriptionId}`,
```

- [ ] **Step 4: Fix line 361 — cancelSubscription (end of period)**

```typescript
// Old (line 361):
      idempotencyKey: `sub_cancel_eop_${subscriptionId}_${Date.now()}`,

// New:
      idempotencyKey: `sub_cancel_eop_${subscriptionId}`,
```

- [ ] **Step 5: Fix line 429 — changePlan**

```typescript
// Old (line 429):
    idempotencyKey: `sub_change_${subscriptionId}_${newPlanId}_${interval}_${Date.now()}`,

// New:
    idempotencyKey: `sub_change_${subscriptionId}_${newPlanId}_${interval}`,
```

- [ ] **Step 6: Fix line 485 — pauseSubscription**

```typescript
// Old (line 485):
    idempotencyKey: `sub_pause_${subscriptionId}_${Date.now()}`,

// New:
    idempotencyKey: `sub_pause_${subscriptionId}`,
```

- [ ] **Step 7: Fix line 519 — resumeSubscription**

```typescript
// Old (line 519):
    idempotencyKey: `sub_resume_${subscriptionId}_${Date.now()}`,

// New:
    idempotencyKey: `sub_resume_${subscriptionId}`,
```

- [ ] **Step 8: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS — this is a pure string change, no type impact

- [ ] **Step 9: Commit**

```bash
git add src/lib/services/subscription.ts
git commit -m "fix: remove Date.now() from Stripe idempotency keys to prevent duplicate charges (XDOM-01)"
```

---

### Task 2: Add Subscription Status Check to Compliance Gateway (XDOM-02)

**Files:**
- Modify: `src/lib/compliance/compliance-gateway.ts`

**Problem:** When a client's subscription is `past_due`, all automations continue running at full service. The compliance gateway — which every outbound message passes through — has no subscription status check. Free service for weeks until Stripe cancels.

**Fix:** After the client status check (which blocks `paused`/`cancelled` clients), add a subscription status check. When `past_due`:
- Allow `inbound_reply` classification (don't ghost homeowners who are actively in conversation)
- Block `proactive_outreach` classification (don't send automations at no cost)

The check uses `getSubscriptionWithPlan()` from `subscription.ts`, which is already imported via `getClientUsagePolicy`. We import `getSubscriptionWithPlan` directly for the status check.

- [ ] **Step 1: Read the compliance gateway to confirm insertion point**

Run: Read `src/lib/compliance/compliance-gateway.ts` lines 1-20 (imports) and lines 110-140 (after client status check).

The client status check is at lines 113-133 (checks `clientRow.status === 'paused' || 'cancelled'`). The subscription check goes immediately after this block, before the kill switch check at line 136.

- [ ] **Step 2: Add import for getSubscriptionWithPlan**

```typescript
// Old (line 3):
import { getClientUsagePolicy } from '@/lib/services/subscription';

// New:
import { getClientUsagePolicy, getSubscriptionWithPlan } from '@/lib/services/subscription';
```

- [ ] **Step 3: Add subscription status check after client status check**

Insert after line 133 (closing brace of the client status check block), before the kill switch check (line 136):

```typescript
  // Subscription enforcement: block proactive outreach when subscription is past_due (XDOM-02)
  // Allow inbound replies so homeowners don't get ghosted during billing issues.
  const subResult = await getSubscriptionWithPlan(clientId);
  if (subResult && subResult.subscription.status === 'past_due') {
    if (messageClassification !== 'inbound_reply') {
      return blocked(
        `Subscription past_due — blocking ${messageClassification} (only inbound replies allowed)`,
        normalizedPhone,
        phoneHash,
        clientId,
        {
          messageCategory,
          messageClassification,
          leadId,
          subscriptionStatus: 'past_due',
          ...metadata,
        }
      );
    }
    // past_due + inbound_reply: allow through with warning
    warnings.push('Subscription past_due — allowing inbound reply only');
  }
```

**Insertion point detail:** This goes between lines 133 and 136 of the current file. The exact location is:

```typescript
  // ... end of client status check (line 133) ...
  }  // <-- closing brace of: if (clientRow && (clientRow.status === 'paused' || ...))

  // INSERT NEW CODE HERE (XDOM-02)

  // Platform-wide kill switch (line 136)
  const outboundKillSwitchEnabled = await isOpsKillSwitchEnabled(
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — `getSubscriptionWithPlan` returns `{ subscription, plan } | null`. The `subscription.status` field includes `'past_due'`. The `messageClassification` parameter is already destructured on line 97. The `warnings` array is defined on line 107.

- [ ] **Step 5: Run full tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/compliance/compliance-gateway.ts
git commit -m "fix: block proactive outreach when subscription past_due, allow inbound replies (XDOM-02)"
```

---

### Task 3: Contractor SMS Notification on Payment Failure (XDOM-03)

**Files:**
- Modify: `src/app/api/webhooks/stripe/route.ts`

**Problem:** When `invoice.payment_failed` fires, only the invoice is synced to the local DB. No SMS, email, or notification goes to the contractor. They don't know their payment failed until service stops.

**Fix:** In the `handleInvoiceEvent` function, after syncing the invoice, detect `payment_failed` events and send the contractor an SMS via `sendSMS` (using the admin Twilio number, not their client number — this is a platform-to-contractor notification, not a lead message).

We use `sendSMS` directly (already imported at line 7) rather than `sendCompliantMessage` because:
1. The recipient is the contractor (platform operator), not a homeowner lead
2. Compliance gateway checks (consent, CASL, quiet hours) don't apply to operator notifications
3. `sendSMS` is already imported and used elsewhere in this file (line 137-140)

- [ ] **Step 1: Read the handleInvoiceEvent function**

Run: Read `src/app/api/webhooks/stripe/route.ts` lines 345-377.

The current function:
1. Calls `syncInvoiceFromStripe(invoice.id)` (line 347)
2. Resolves `stripeSubId` from `invoice.parent.subscription_details` (lines 356-358)
3. Finds the local subscription (lines 362-366)
4. Logs a billing event (lines 369-376)

The contractor SMS should go after the billing event logging, only for `payment_failed` events.

- [ ] **Step 2: Expand handleInvoiceEvent to send contractor SMS on payment failure**

Replace the entire `handleInvoiceEvent` function:

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
              `Your payment for ConversionSurgery didn't go through. Please update your payment method at ${portalUrl}/client/billing to keep your leads protected. - ConversionSurgery`,
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
          await sendEmail({
            to: adminEmail,
            subject: `Payment failed — ${client?.businessName || subscription.clientId}`,
            html: `<p>Payment of <strong>${amountStr}</strong> failed for <strong>${client?.businessName || subscription.clientId}</strong>.</p><p>Invoice: ${invoice.id}</p><p>The client has been notified via SMS to update their payment method.</p>`,
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
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — `sendSMS` is already imported (line 7). `sendEmail` is already imported (line 12). `clients` is already imported (line 5). `logSanitizedConsoleError` is already imported (line 13).

- [ ] **Step 4: Run full tests**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/webhooks/stripe/route.ts
git commit -m "fix: send contractor SMS + admin email on payment failure (XDOM-03)"
```

---

## Post-Implementation Verification

- [ ] **Run full quality gate**

```bash
npm run quality:no-regressions
```

Expected: All green.

- [ ] **Manual verification checklist**

| Check | Expected |
|-------|----------|
| `grep -n "Date.now()" src/lib/services/subscription.ts` | Only in `stripeEventId: \`manual_${Date.now()}\`` (billing event, NOT an idempotency key) |
| `grep -n "idempotencyKey" src/lib/services/subscription.ts` | 6 keys, none contain `Date.now()` |
| `grep -n "past_due" src/lib/compliance/compliance-gateway.ts` | Subscription status check present |
| `grep -n "payment_failed" src/app/api/webhooks/stripe/route.ts` | SMS + email notification code present |

---

## Doc Updates Required

Per CLAUDE.md Change-to-Doc mapping:

| Change | Doc to Update | What to Add |
|--------|--------------|-------------|
| Compliance gateway now checks subscription status | `docs/product/PLATFORM-CAPABILITIES.md` (Section 6: Compliance) | Add: "Subscription enforcement: proactive outreach blocked when subscription is past_due; inbound replies allowed to prevent ghosting homeowners" |
| Contractor notification on payment failure | `docs/product/PLATFORM-CAPABILITIES.md` (Section 8: Billing) | Add: "Contractor receives SMS notification when payment fails, with link to update payment method in portal" |
| Idempotency key fix | `docs/engineering/01-TESTING-GUIDE.md` | No test step change needed — this is invisible to manual testing |
