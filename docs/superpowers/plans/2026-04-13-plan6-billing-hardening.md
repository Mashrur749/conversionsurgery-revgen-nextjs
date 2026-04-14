# Plan 6: Billing Hardening (First 30 Days)

**Source:** `docs/superpowers/specs/2026-04-13-cross-domain-audit.md` — XDOM-05 through XDOM-12
**Target:** `src/app/api/webhooks/stripe/route.ts`, `src/lib/automations/payment-reminder.ts`, `src/lib/services/subscription.ts`, `src/lib/services/cancellation-reminders.ts`

---

## Context

The Stripe webhook handler has uneven dedup coverage: `checkout.session.completed` and the `subscription.created/updated/paused/resumed` handlers all use `billingEvents` dedup correctly. However, five other handlers are exposed to silent duplicate processing on Stripe retry. Beyond dedup, five smaller issues (missing-metadata alert, subscription-deletion guard, compensating-cancel alert, timezone-naive scheduling, trial notification gap) each represent either data loss or silent billing failure.

---

## Task Breakdown

### Task 1 — Add dedup to 5 webhook handlers (XDOM-05)

**Severity:** High — duplicate billing events on Stripe retry  
**Files:**
- `src/app/api/webhooks/stripe/route.ts`

**Current state:** The following handlers do NOT dedup before writing:
- `handleInvoiceEvent` (line ~345) — calls `logBillingEvent` without checking for existing `stripeEventId`
- `handlePaymentMethodAttached` (line ~379) — calls `addPaymentMethod` without dedup
- `handlePaymentActionRequired` (line ~454) — calls `logBillingEvent` without dedup
- `handleDisputeCreated` (line ~516) — calls `logBillingEvent` without dedup
- `handleDisputeClosed` (line ~543) — calls `logBillingEvent` without dedup
- `checkout.session.expired` case (line ~158) — updates payment status without dedup

**Approach:** Add a `billingEvents` dedup check at the top of each handler, matching the pattern already used in `handleSubscriptionUpdate` and `handleSubscriptionPaused`:

```typescript
const [existingEvent] = await db
  .select({ id: billingEvents.id })
  .from(billingEvents)
  .where(eq(billingEvents.stripeEventId, event.id))
  .limit(1);
if (existingEvent) return;
```

For `checkout.session.expired`, add the check before the `payments` update. For `handlePaymentMethodAttached`, dedup guards against calling `addPaymentMethod` twice; check the `billingEvents` table using `event.id` since no billing event is logged there yet — add a `logBillingEvent` call after `addPaymentMethod` so the dedup key persists.

**Note:** `logBillingEvent` itself does NOT dedup — it is a raw insert helper. The guard must always be added in the calling handler, not inside `logBillingEvent`.

**Dependencies:** None — each handler is independent.

---

### Task 2 — Alert on missing checkout metadata (XDOM-06)

**Severity:** High — Stripe charges client but no subscription is provisioned  
**Files:**
- `src/app/api/webhooks/stripe/route.ts`

**Current state:** Lines 74-87 — if `clientId` or `planId` is absent in `session.metadata`, the block silently `break`s. No alert fires.

**Approach:** When `session.mode === 'subscription'` and `session.subscription` is present but either `clientId` or `planId` is missing, send an admin email alert before breaking. Use the existing `sendEmail` import. Include `session.id`, `stripeSubId`, and all available metadata in the email body so the operator can manually provision.

The check should use `logSanitizedConsoleError` in addition to the email so the internal error log captures it. Do not throw — break after alerting so Stripe receives a 200 and stops retrying.

**Dependencies:** None.

---

### Task 3 — Guard subscription deletion without clientId (XDOM-07)

**Severity:** High — subscription canceled in Stripe but client remains `active` locally  
**Files:**
- `src/app/api/webhooks/stripe/route.ts`

**Current state:** `handleSubscriptionDeleted` (line ~307) deduplicates correctly, then proceeds to `withTransaction`. Inside the transaction, the `clients.status = 'cancelled'` update is inside `if (clientId)`, but the subscription row is updated to `status: 'canceled'` regardless. If `clientId` is missing, the subscription is marked canceled but the client record stays `active`.

**Approach:** Mirror the pattern from `handleSubscriptionUpdate` — add an explicit check for missing `clientId` at the top of `handleSubscriptionDeleted`. When `clientId` is absent, log via `logSanitizedConsoleError` with the `stripeSubscriptionId` and `stripeEventId`, send an admin alert email ("Subscription deleted in Stripe but no client mapping found — manual review needed"), and return early. This prevents partial state while surfacing the problem to the operator.

**Dependencies:** None.

---

### Task 4 — Alert on compensating cancel failure (XDOM-08)

**Severity:** High — orphaned Stripe subscription continues charging after DB write failed  
**Files:**
- `src/lib/services/subscription.ts`

**Current state:** Lines 200-205 — when the DB transaction fails after Stripe subscription creation, a compensating cancel is attempted. If that cancel also fails, it is only `console.error`d. No alert reaches the operator.

**Approach:** In the inner `catch (cancelError)` block, after `logSanitizedConsoleError`, send an admin email with subject "CRITICAL: Orphaned Stripe subscription — manual cancellation required" including the Stripe subscription ID. The email gives the operator everything needed to manually cancel via Stripe dashboard. Do not swallow the outer error — re-throw it so the API call fails and the caller is aware.

**Dependencies:** None.

---

### Task 5 — Payment link retry on Stripe outage (XDOM-09)

**Severity:** High — reminders sent without payment link; homeowner has no way to pay  
**Files:**
- `src/lib/automations/payment-reminder.ts`

**Current state:** Lines 87-109 — `createPaymentLink` is called once. If it throws (Stripe outage, transient error), `paymentLinkFailed` is set to `true` and the reminder sequence proceeds using the fallback string `'Contact us to arrange payment'`. No retry is attempted, no operator alert is sent, and the sequence continues with degraded messages.

**Approach:**
1. Wrap the `createPaymentLink` call in a simple retry loop — attempt up to 3 times with a 500ms delay between attempts (1s and 2s backoff are fine here since this is invoked by the operator, not in a hot path).
2. If all 3 attempts fail, send an admin alert email ("Payment link creation failed after 3 attempts — invoice `{invoiceNumber}` for `{businessName}`") so the operator can share the link manually.
3. The sequence continues with the `'Contact us to arrange payment'` fallback. Do not block the sequence on link failure — the alert handles the human loop.

**Note:** Avoid import of a sleep utility if one doesn't exist — a simple `await new Promise(r => setTimeout(r, ms))` inline is acceptable here.

**Dependencies:** None.

---

### Task 6 — Timezone-aware payment reminders (XDOM-10)

**Severity:** High — reminders scheduled at 10:00 UTC, arriving at 2am PST  
**Files:**
- `src/lib/automations/payment-reminder.ts`

**Current state:** Line 132 — `sendAt.setHours(10, 0, 0, 0)` sets the hour in the server's local timezone (UTC in production). For clients in `America/Edmonton` (UTC-6/7), this means 3am or 4am delivery.

**Approach:**
1. After the `client` record is fetched (already in the function), read `client.timezone` (IANA string, e.g. `'America/Edmonton'`). Fall back to `'America/Edmonton'` (Alberta default) rather than `'America/New_York'`.
2. Use the `Intl` API or `date-fns-tz` (check which is already imported in the project) to construct a datetime that represents 10:00am in the client's timezone.
3. Replace `sendAt.setHours(10, 0, 0, 0)` with the timezone-aware equivalent.

Check for `date-fns-tz` in `package.json` before importing. If not present, use `Intl.DateTimeFormat` to compute the UTC offset for the target date and adjust accordingly — do not add a new dependency without confirming it's available.

**Dependencies:** None. Can run in parallel with Task 5.

---

### Task 7 — Contractor notification on trial_will_end (XDOM-11)

**Severity:** High — contractor has no warning before billing starts  
**Files:**
- `src/app/api/webhooks/stripe/route.ts`

**Current state:** Lines 214-220 — `customer.subscription.trial_will_end` case only calls `logBillingEvent`. No notification is sent to the contractor.

**Approach:** After `logBillingEvent`, fetch the client record using `clientId`. Then:
1. If `client.phone` and a Twilio number are available, send an SMS via `sendSMS`: "Your ConversionSurgery trial ends in 3 days. Your card on file will be charged automatically. Questions? Reply or call [support contact]."
2. If `client.email` is available, send a companion email via `sendEmail` with a more detailed breakdown of what they are paying for and a link to update their card if needed.

Use the admin Twilio number (`process.env.TWILIO_PHONE_NUMBER`) as the from number, since the client's `twilioNumber` is their outbound lead number, not a billing notification channel.

**Dependencies:** None.

---

### Task 8 — Fix grace-period reminder status query (XDOM-12)

**Severity:** High — confirmed cancellations receive zero grace-period reminders  
**Files:**
- `src/lib/services/cancellation-reminders.ts`

**Current state:** Line 81 — the query for `activeCancellations` filters `eq(cancellationRequests.status, 'pending')`. This is the correct status for cancellations that have been requested but are still in their grace window. However, verify what status a "confirmed cancellation" has — if the status transitions to `'confirmed'` or similar when the grace period starts, the query would miss all confirmed-cancellation rows.

**Approach:**
1. Read `src/db/schema/cancellation-requests.ts` to find the full status enum.
2. If confirmed cancellations use a different status value (e.g. `'confirmed'`), change the `where` condition to use `inArray(cancellationRequests.status, ['pending', 'confirmed'])` or whichever statuses correspond to "grace period active."
3. Add a comment explaining the status lifecycle so future maintainers don't repeat the mistake.

**Dependencies:** Must read schema before implementing. Otherwise independent.

---

## Parallelization

These 8 tasks split into two parallel waves:

**Wave 1 (can all run simultaneously — same file but isolated sections):**
- Task 1 (XDOM-05): webhook dedup — `route.ts` handlers
- Task 2 (XDOM-06): missing checkout metadata alert — `route.ts`
- Task 3 (XDOM-07): subscription deletion guard — `route.ts`
- Task 7 (XDOM-11): trial_will_end notification — `route.ts`

> These are all in `route.ts`. If running parallel agents, assign all four to a single agent to avoid file conflicts.

**Wave 2 (can all run simultaneously — separate files):**
- Task 4 (XDOM-08): compensating cancel alert — `subscription.ts`
- Task 5 (XDOM-09): payment link retry — `payment-reminder.ts`
- Task 6 (XDOM-10): timezone-aware scheduling — `payment-reminder.ts`
- Task 8 (XDOM-12): grace-period status query — `cancellation-reminders.ts`

> Tasks 5 and 6 touch the same file. Assign to a single agent.

---

## Doc Update Requirements

Per CLAUDE.md Change→Doc mapping:

| Change | Doc to update |
|--------|---------------|
| Trial notification, payment failure notification (Tasks 4, 7) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 8: Billing |
| Trial reminder, payment reminder behavior (Tasks 6, 7) | `docs/business-intel/OFFER-APPROVED-COPY.md` — flag to user if claims change (do not edit directly) |
| Cancellation reminder fix (Task 8) | `docs/product/PLATFORM-CAPABILITIES.md` — Section 8: Billing |
| New admin alert behaviors (Tasks 2, 3, 4, 5) | `docs/engineering/01-TESTING-GUIDE.md` — add manual test steps for each alert path |

---

## Verification Gate

After implementation:
1. `npm run ms:gate` (fast check during development)
2. `npm run quality:no-regressions` (completion gate)

Key test vectors to verify manually:
- Stripe webhook retry with same `event.id` produces no duplicate billing events
- Missing checkout metadata triggers admin email
- Subscription deleted with no `clientId` triggers admin alert, does not update client status
- `startPaymentReminder` called with Stripe down: retries 3 times, sends alert, falls back gracefully
- Payment reminder `sendAt` for a client in `America/Edmonton` lands at 10am local time
