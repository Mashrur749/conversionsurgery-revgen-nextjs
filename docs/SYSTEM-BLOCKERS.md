# System-Wide Operational Blockers — ConversionSurgery RevGen

**Audit date:** 2026-02-19
**Last updated:** 2026-02-19
**Scope:** Data integrity, external API resilience, legacy migration, business logic gaps
**Companion doc:** `docs/SECURITY-AUDIT.md` (auth/access control findings — separate)

---

## Executive Summary

Beyond security (auth, permissions, IDOR), the application has **system-wide operational blockers** that will cause data loss, billing inconsistencies, and degraded customer experience — especially under load or during external API outages. These fall into five categories:

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Data Integrity | 4 | 3 | 5 | 2 |
| External API Resilience | 3 | 5 | 4 | 2 |
| Legacy Migration | 0 | 2 | 2 | 0 |
| Business Logic | 1 | 1 | 4 | 2 |
| Scaling & Config | 2 | 1 | 1 | 0 |
| **Total** | **10** | **12** | **16** | **6** |

### Phase 1 Remediation — COMPLETE (2026-02-19)

All 10 critical items resolved across 7 commits:

| ID | Fix | Commit |
|----|-----|--------|
| D1 | `db.transaction()` on subscription create/cancel/change + webhook handlers, saga pattern for compensating Stripe cancel | `0fd5f3c` |
| D2 | `validateAndRedeemCoupon()` — atomic UPDATE...WHERE prevents max_redemptions race | `1542309` |
| D3 | Atomic escalation claim — UPDATE...WHERE status='pending' RETURNING | `1542309` |
| D4 | Atomic OTP verification — UPDATE...WHERE verified_at IS NULL RETURNING | `1542309` |
| E1 | Stripe idempotency keys on all mutation calls (create, cancel, update, pause, resume) | `015d6e5` |
| E2 | Stripe reconciliation cron at `/api/cron/stripe-reconciliation` — daily status comparison | `fad895d` |
| E3 | `sendSMS()` retry — 3 attempts with exponential backoff (1s, 2s, 4s) for transient failures | `015d6e5` |
| B1 | Plan deactivation guard — 409 Conflict if active subscriptions exist | `1542309` |
| S1 | Batch processing for win-back/no-show — eliminates N+1, concurrency-limited to 5 | `3b032c8` |
| S2 | `src/lib/env.ts` — startup env validation with clear error messages, skips build phase | `1542309`, `f0feb3b` |

### Phase 2 Remediation — COMPLETE (2026-02-19)

All 13 high-priority items resolved across 5 commits:

| ID | Fix | Commit |
|----|-----|--------|
| D5 | `onDelete: 'restrict'` on subscriptions.planId FK | `668f677` |
| D6 | `onDelete: 'set null'` on usage records FKs | `668f677` |
| D7 | Plan `isActive` check on subscription create, opt-in/out flow for START/UNSTOP | `f93a952` |
| E4 | Stripe checkout webhook dedup via billingEvents.stripeEventId | `668f677` |
| E5 | OpenAI 15s timeout, 2 retries with exponential backoff for 429/5xx | `f93a952` |
| E6 | Google token refresh: 3 retries, permanent failure detection + admin email | `f93a952` |
| E7 | SMS webhook dedup via conversations.twilioSid | `668f677` |
| E8 | Atomic claim pattern for scheduled messages — prevents duplicate sends | `0a9befc` |
| E9 | Missing Stripe webhook handlers: pause/resume, disputes, payment action required | `7b5779a` |
| L1 | All teamMembers queries migrated to clientMemberships + people via bridge layer (17 files) | `04ef05f` |
| L2 | business-hours route migrated to `requireAgencyPermission()` + transaction wrap | `668f677` |
| S3 | Webhook secret fail-fast — removed empty-string fallbacks, explicit 500 on missing | `668f677` |
| B2 | Phone number release blocked if conversations exist in last 30 days | `668f677` |

### Phase 3 Remediation — COMPLETE (2026-02-19)

All 16 medium-priority items resolved across 3 commits:

| ID | Fix | Commit |
|----|-----|--------|
| D8 | Daily coupon redemption count reconciliation cron | `fd63f62` |
| D9 | Dedicated monthly message counter reset cron (moved from process-scheduled) | `f73bd89` |
| D10 | Not needed — atomic UPDATE...WHERE (Phase 1) + unique clientId index already prevent races | N/A |
| D11 | Missing updatedAt added to leads update in member-answered webhook | `fd63f62` |
| D12 | Already done in Phase 2 as part of L2 | `668f677` |
| E10 | 100ms inter-message throttle in process-scheduled to avoid carrier filtering | `fd63f62` |
| E11 | Already done in E5 — OpenAI 429 retry + 15s timeout | `f93a952` |
| E12 | sendEmail() retry (2 attempts, 1s delay between) | `f73bd89` |
| E13 | ElevenLabs TTS retry (2 attempts) + fail-fast on missing API key | `fd63f62` |
| B3 | Cancel active Stripe subscriptions + pending scheduled messages on client soft-delete | `fd63f62` |
| B4 | Skip trial_period_days for clients with prior subscriptions | `f73bd89` |
| B5 | Stripe subscription cancellation at period end when cancellation confirmed | `fd63f62` |
| B6 | ROI uses actual conversion rate, avg job value from jobs table, monthly cost from subscription | `f73bd89` |
| L3 | Admin users route queries people/agencyMemberships alongside legacy fields | `1e7eb4f` |
| L4 | Stale TODOs replaced with explicit "not implemented" warnings | `1e7eb4f` |
| S4 | Default pagination (50/page, max 100) on reports/ab-tests; safety limit (200) on templates/coupons | `fd63f62` |

### Phase 4 Remediation — COMPLETE (2026-02-19)

All 6 low-priority items resolved in 1 commit:

| ID | Fix | Commit |
|----|-----|--------|
| D13 | `logDeleteAudit()` utility + audit logging on 6 hard-delete routes (email-templates, help-articles, flow-templates, system-settings, review-responses, coupons) | `2d9ddb3` |
| D14 | Non-issue — all tables use `defaultNow()` for createdAt. 5 tables lack `updatedAt` columns (conversations, coupons, reviews, voiceCalls, supportMessages) — documented, schema changes deferred | N/A |
| E14 | Daily summary idempotency via `system_settings.last_daily_summary_date` — prevents duplicate sends on double cron trigger | `2d9ddb3` |
| E15 | Global OTP rate limit (100/minute across all identifiers) prevents distributed abuse | `2d9ddb3` |
| B7 | Team member soft-delete now releases open escalation claims and queue items assigned to the deactivated member | `2d9ddb3` |
| B8 | Redeemed coupons (timesRedeemed > 0) are soft-deleted (isActive=false) instead of hard-deleted; unredeemed coupons still allow hard-delete | `2d9ddb3` |

---

## 1. DATA INTEGRITY

### D1 — Zero transactional boundaries [CRITICAL]

**Impact:** Partial failures leave inconsistent state across tables — billing, subscription, and client records diverge.

The codebase has **zero** uses of `db.transaction()`. Every multi-step database operation is vulnerable to partial failure. Drizzle ORM fully supports transactions via `db.transaction(async (tx) => { ... })` but the pattern is never used anywhere.

**Primary affected operation — subscription creation** (`src/lib/services/subscription.ts:27-153`):

This function performs 6+ sequential operations without any transactional wrapper:

```typescript
// Step 1 (line 46): Create Stripe customer (external API)
const customer = await stripe.customers.create({ ... });

// Step 2 (line 55): Update client with stripeCustomerId (DB write #1)
await db.update(clients).set({ stripeCustomerId, updatedAt: new Date() })
  .where(eq(clients.id, clientId));

// Step 3 (line 87): Validate coupon (DB read)
const couponResult = await validateCoupon(couponCode, planId, clientId);

// Step 4 (line 99): Create Stripe subscription (external API — charges customer)
const stripeSubscription = await stripe.subscriptions.create(stripeSubParams);

// Step 5 (line 119): Insert subscription record (DB write #2)
const [subscription] = await db.insert(subscriptions).values({ ... }).returning();

// Step 6 (line 139): Redeem coupon — increment counter (DB write #3)
await redeemCoupon(couponCode);

// Step 7 (line 144): Log billing event (DB write #4)
await db.insert(billingEvents).values({ ... });
```

**Failure scenario — worst case:**
1. Steps 1-4 succeed: Stripe subscription is created, customer is billed
2. Step 5 fails (DB timeout, connection drop, constraint violation)
3. Result: Customer is charged in Stripe but has no local subscription record
4. Stripe continues billing monthly; local system shows no subscription
5. Requires manual Stripe dashboard reconciliation to discover and fix
6. **Direct revenue impact:** customer support tickets, refund requests, trust erosion

**Other affected operations:**

| Operation | File:Lines | DB Operations | Failure Mode |
|-----------|-----------|---------------|-------------|
| Subscription cancel | `subscription.ts:158-202` | Stripe cancel + DB update + billing event log | Cancelled in Stripe, local DB still shows active |
| Plan change | `subscription.ts:207-263` | Stripe retrieve + Stripe update + DB update + billing event | Plan changed in Stripe, local DB on old plan |
| Subscription pause | `subscription.ts:268-301` | Stripe update + DB update | Paused in Stripe, local DB shows active |
| Stripe webhook: sub deleted | `webhooks/stripe/route.ts:198-221` | 3 separate DB writes (see below) | Sub cancelled but client status stays active |
| Coupon redemption | `subscription.ts:119-141` | Insert sub + increment counter | Counter drifts from actual subscription count |

The webhook handler for `customer.subscription.deleted` is particularly dangerous (`webhooks/stripe/route.ts:207-221`):

```typescript
// Three separate DB operations — if any fail, state is inconsistent
await db.update(subscriptions).set({
  status: 'canceled', canceledAt: new Date(), updatedAt: new Date(),
}).where(eq(subscriptions.stripeSubscriptionId, sub.id));

await logBillingEvent(db, clientId, event, 'Subscription canceled');

await db.update(clients).set({
  status: 'cancelled', updatedAt: new Date(),
}).where(eq(clients.id, clientId));
```

If the third write fails, the subscription is marked canceled but the client status remains `active` — the client continues to access the platform with no active subscription.

**Recommended fix:** Wrap all multi-step DB operations in `db.transaction()`. For operations that mix external API calls with DB writes, use the saga pattern: make the external API call first, then perform all DB writes atomically inside a transaction. If the transaction fails, call the compensating Stripe API (e.g., cancel the subscription that was just created).

---

### D2 — Coupon redemption race condition [CRITICAL]

**Files:** `src/lib/services/coupon-validation.ts` + `src/lib/services/subscription.ts`

Validation and redemption are two separate read-then-write operations with no atomicity:

**Step 1 — Validation** (`coupon-validation.ts:47-50`):
```typescript
// Read current redemption count
if (coupon.maxRedemptions && (coupon.timesRedeemed ?? 0) >= coupon.maxRedemptions) {
  return { valid: false, error: 'This coupon has reached its maximum number of uses' };
}
```

**Step 2 — Redemption** (`coupon-validation.ts:87-93`, called from `subscription.ts:140`):
```typescript
export async function redeemCoupon(code: string): Promise<void> {
  const db = getDb();
  await db
    .update(coupons)
    .set({ timesRedeemed: sql`coalesce(${coupons.timesRedeemed}, 0) + 1` })
    .where(eq(coupons.code, code.toUpperCase()));
}
```

**Failure scenario:**
1. Coupon `SAVE20` has `maxRedemptions: 100`, `timesRedeemed: 99`
2. Request A calls `validateCoupon()` — reads `timesRedeemed = 99`, passes validation (99 < 100)
3. Request B calls `validateCoupon()` — reads `timesRedeemed = 99`, passes validation (99 < 100)
4. Request A calls `redeemCoupon()` — increments to 100
5. Request B calls `redeemCoupon()` — increments to 101
6. Result: Coupon redeemed 101 times despite `maxRedemptions: 100`
7. **Business impact:** Revenue loss from unauthorized discounts

**Recommended fix:** Single atomic SQL statement:
```sql
UPDATE coupons
SET times_redeemed = COALESCE(times_redeemed, 0) + 1
WHERE code = $1
  AND (max_redemptions IS NULL OR COALESCE(times_redeemed, 0) < max_redemptions)
  AND is_active = true
RETURNING *;
```
Check if any rows were returned — if 0, the coupon was already at max or inactive.

---

### D3 — Escalation claim race condition [CRITICAL]

**File:** `src/lib/services/team-escalation.ts:142-270`

Classic read-then-check-then-update TOCTOU vulnerability:

```typescript
// Step 1 (line 147): READ — fetch escalation
const [escalation] = await db
  .select()
  .from(escalationClaims)
  .where(eq(escalationClaims.claimToken, token))
  .limit(1);

// Step 2 (line 158): CHECK — verify still pending
if (escalation.status !== 'pending') {
  // ... return "already claimed"
}

// ... 38 lines of team member verification ...

// Step 3 (line 196): UPDATE — claim the escalation
await db
  .update(escalationClaims)
  .set({
    claimedBy: teamMemberId,
    claimedAt: new Date(),
    status: 'claimed',
  })
  .where(eq(escalationClaims.id, escalation.id));
```

**Failure scenario:**
1. Escalation for lead "Mike" arrives, SMS sent to 3 team members with claim link
2. Team member Alice clicks claim link — reads `status = 'pending'`, passes check
3. Team member Bob clicks claim link 200ms later — reads `status = 'pending'` (Alice hasn't written yet), passes check
4. Alice's UPDATE runs — sets `claimed_by = Alice`
5. Bob's UPDATE runs — overwrites to `claimed_by = Bob`
6. Alice believes she owns the lead, Bob also believes he owns it
7. Both members call the lead, confusing the customer
8. **Business impact:** Duplicate outreach, customer confusion, wasted team time

The notification SMS (lines 241-256) compounds this: both Alice and Bob would receive "you claimed it" confirmations, while other team members get conflicting "Alice is handling it" / "Bob is handling it" messages.

**Recommended fix:** Atomic UPDATE with WHERE:
```sql
UPDATE escalation_claims
SET claimed_by = $1, claimed_at = NOW(), status = 'claimed'
WHERE id = $2 AND status = 'pending'
RETURNING *;
```
Check returned row count — if 0, someone else claimed it first.

---

### D4 — OTP verification race condition [CRITICAL]

**File:** `src/lib/services/otp.ts:242-342`

Four separate sequential database operations for what should be a single atomic verify:

```typescript
// Step 1 (line 258): READ — find unverified OTP
const [otp] = await db
  .select()
  .from(otpCodes)
  .where(and(
    eq(identifierColumn, normalizedIdentifier),
    gt(otpCodes.expiresAt, now),
    isNull(otpCodes.verifiedAt)
  ))
  .orderBy(desc(otpCodes.createdAt))
  .limit(1);

// Step 2 (line 276): CHECK — verify attempts not exhausted
if (otp.attempts >= otp.maxAttempts) {
  return { success: false, attemptsRemaining: 0, error: 'max_attempts' };
}

// Step 3 (line 281): INCREMENT — bump attempt count (DB write #1)
await db
  .update(otpCodes)
  .set({ attempts: otp.attempts + 1 })
  .where(eq(otpCodes.id, otp.id));

// ... timing-safe comparison ...

// Step 4 (line 300): VERIFY — mark as verified (DB write #2)
await db
  .update(otpCodes)
  .set({ verifiedAt: now })
  .where(eq(otpCodes.id, otp.id));
```

**Failure scenario:**
1. User enters correct OTP code
2. Request A reads OTP (unverified), passes attempt check, increments attempts
3. Request B reads OTP (still unverified — Step 4 hasn't run yet), passes attempt check, increments attempts
4. Both requests pass the timing-safe comparison (same correct code)
5. Both requests mark OTP as verified
6. Both requests return `{ success: true }` with valid session data
7. **Security impact:** Two concurrent requests can both establish valid sessions from a single OTP, bypassing single-use protection

**Recommended fix:** Single atomic UPDATE:
```sql
UPDATE otp_codes
SET verified_at = NOW(), attempts = attempts + 1
WHERE id = $1
  AND verified_at IS NULL
  AND attempts < max_attempts
  AND expires_at > NOW()
RETURNING *;
```
Then compare the code in application logic. If 0 rows returned, the OTP was already used or expired.

---

### D5 — Subscriptions.planId missing onDelete clause [HIGH]

**File:** `src/db/schema/subscriptions.ts:24-26`

```typescript
planId: uuid('plan_id')
  .references(() => plans.id)    // <-- No onDelete clause
  .notNull(),
```

Postgres defaults to `RESTRICT` when no `onDelete` is specified, but the intent is not explicit in the code. Compare with `clientId` on line 20-23 which correctly specifies `{ onDelete: 'cascade' }`.

**Impact:** Cannot hard-delete or archive deprecated plans if any subscription (including cancelled ones) references them. The `plans.isActive` soft-delete flag exists but queries don't consistently filter by it (see D7).

**Recommended fix:** Add explicit `{ onDelete: 'restrict' }` to make the intent clear, and ensure all plan listing queries filter by `isActive`.

---

### D6 — Usage records missing onDelete clauses [HIGH]

**File:** `src/db/schema/usage-records.ts`

```typescript
// Line 21: No onDelete — defaults to RESTRICT
subscriptionId: uuid('subscription_id').references(() => subscriptions.id),

// Line 39: No onDelete — defaults to RESTRICT
billedOnInvoiceId: uuid('billed_on_invoice_id').references(() => subscriptionInvoices.id),
```

Compare with `clientId` on line 18-20 which correctly has `{ onDelete: 'cascade' }`.

**Impact:** If a subscription is deleted (rather than soft-deleted), all usage records referencing it become orphaned or the delete is blocked by RESTRICT. Same for invoice deletion. The `clientId` cascade means deleting a client cascades to usage records, but the subscription FK prevents deleting the subscription itself.

**Recommended fix:** Add `{ onDelete: 'set null' }` to both FKs (usage records should be preserved for billing history even if the parent subscription/invoice is removed).

---

### D7 — Soft-delete filtering inconsistencies [HIGH]

**Files:** Multiple

Three distinct soft-delete filtering gaps:

1. **Plans:** `plans.isActive` flag exists but the Stripe subscription creation flow (`subscription.ts:40`) does not filter by it:
   ```typescript
   const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
   // No check for plan.isActive — inactive plans can be subscribed to
   ```

2. **Stripe webhooks:** The webhook handler (`webhooks/stripe/route.ts`) processes events for cancelled clients without checking `clients.status`. A `customer.subscription.updated` event for a cancelled client still updates the local subscription record.

3. **Lead opt-out:** `leads.optedOut` flag exists but `handleIncomingSMS` and other automation entry points don't consistently check it before processing.

**Business impact:** Inactive plans appearing in selection UIs, ghost subscription updates for cancelled clients, messages sent to opted-out leads (TCPA compliance risk).

**Recommended fix:** Add `isActive` filter to all plan queries used in subscription creation. Add `clients.status = 'active'` check in webhook handlers. Audit all message-sending code paths for opt-out checks.

---

### D8 — Denormalized coupon counter drift [MEDIUM]

**File:** `src/db/schema/coupons.ts:30`

```typescript
timesRedeemed: integer('times_redeemed').default(0),
```

The `timesRedeemed` counter is incremented by `redeemCoupon()` but can diverge from reality through:
- Transaction failures between subscription creation and coupon increment (D1)
- Race conditions allowing over-redemption (D2)
- Manual subscription deletions in Stripe dashboard (no corresponding decrement)
- `redeemCoupon()` does not set `updatedAt` (no audit trail for counter changes)

No reconciliation cron exists to compare `timesRedeemed` against actual `subscriptions` rows with that `couponCode`.

**Business impact:** Coupons may appear exhausted when they aren't (lost sales), or allow more uses than intended (revenue loss).

**Recommended fix:** Add a daily reconciliation cron that counts `SELECT COUNT(*) FROM subscriptions WHERE coupon_code = X` and updates `timesRedeemed` to match.

---

### D9 — messagesSentThisMonth reset is incomplete [MEDIUM]

**File:** `src/db/schema/clients.ts:72`

```typescript
messagesSentThisMonth: integer('messages_sent_this_month').default(0),
```

The reset logic in `process-scheduled/route.ts:22-28`:

```typescript
const now = new Date();
if (now.getDate() === 1 && now.getHours() < 1) {
  await db
    .update(clients)
    .set({ messagesSentThisMonth: 0 });
  // No WHERE clause — resets ALL clients
  console.log('Reset monthly message counts');
}
```

**Issues:**
1. Reset only triggers when the `process-scheduled` cron runs on the 1st of the month before 1am. If the cron doesn't run during that window (server down, deployment in progress), the reset is missed entirely for the month.
2. The reset blanket-updates ALL clients, not just active ones.
3. There's no idempotency — if the cron runs twice in the 1-hour window, the second run resets counters again (harmless but wasteful).
4. Messages sent outside the `process-scheduled` flow (direct SMS via `sendSMS()`, agency messages) may not be counted in `messagesSentThisMonth` at all.

**Business impact:** Clients who hit their monthly message limit may be blocked for the rest of the month if the reset is missed. Or the counter may never reach the limit if some message paths don't increment it.

**Recommended fix:** Separate cron job that runs on the 1st with idempotency (check `DATE_TRUNC('month', NOW()) != last_reset_month`).

---

### D10 — No row-level locking anywhere [MEDIUM]

Zero uses of `SELECT ... FOR UPDATE` or `SELECT ... FOR SHARE` in the entire codebase. All concurrent operations rely on application-level checks that are vulnerable to TOCTOU races (see D2, D3, D4).

Even with transactions (once D1 is fixed), concurrent transactions reading the same row can both pass validation checks before either writes. Row-level locking prevents this by serializing access to the contested row.

**Affected operations:**
- Coupon redemption (D2)
- Escalation claims (D3)
- OTP verification (D4)
- Subscription creation (preventing duplicate subscriptions for same client)

**Recommended fix:** Use `SELECT ... FOR UPDATE` within transactions for any read-then-check-then-write pattern. The atomic SQL approach (recommended for D2/D3/D4) eliminates the need for explicit locking in those specific cases.

---

### D11 — updatedAt not consistently set [MEDIUM]

Some update operations skip `updatedAt`:
- `redeemCoupon()` in `coupon-validation.ts:87-93` — only sets `timesRedeemed`, no `updatedAt`
- Stripe webhook handlers: `handleSubscriptionUpdate` sets `updatedAt` (line 192) but `handleInvoiceEvent` does not set it on subscription records
- `claimEscalation()` in `team-escalation.ts:196-203` — sets `claimedAt` but no `updatedAt` on the escalation_claims table (though the table may not have an `updatedAt` column)

**Business impact:** Inconsistent audit trails. Cannot reliably determine when a record was last modified for debugging or data reconciliation.

**Recommended fix:** Add `updatedAt: new Date()` to all `.set()` calls that modify mutable tables. Consider a database trigger that auto-sets `updatedAt` on UPDATE for all tables.

---

### D12 — Delete + re-insert pattern (business hours) [MEDIUM]

**File:** `src/app/api/business-hours/route.ts:70-85`

```typescript
// Line 71: Delete ALL existing hours
await db.delete(businessHours).where(eq(businessHours.clientId, validated.clientId));

// Line 74-85: Insert new hours
const result = await db
  .insert(businessHours)
  .values(
    validated.hours.map(hour => ({
      clientId: validated.clientId,
      dayOfWeek: hour.dayOfWeek,
      openTime: hour.openTime,
      closeTime: hour.closeTime,
      isOpen: hour.isOpen,
    }))
  )
  .returning();
```

**Failure scenario:**
1. Delete succeeds — all 7 business hour records removed
2. Insert fails (DB timeout, constraint violation, connection drop)
3. Result: Client has zero business hours configured
4. Voice AI routing (`voiceMode: 'after_hours'`) treats all hours as after-hours
5. All calls go to voicemail or AI, no calls ring through to the business
6. **Business impact:** Client's phone stops working as expected during business hours

**Recommended fix:** Wrap in `db.transaction()`, or use upsert pattern (`ON CONFLICT ... DO UPDATE`).

---

### D13 — No database audit trail for deletes [LOW]

Hard deletes on the following tables have no audit trail:
- `businessHours` — deleted and re-inserted on every save (D12)
- `teamMembers` — hard deleted via `team-members/route.ts` and `team-members/[id]/route.ts`
- `activeCalls` — hard deleted when call ends

For compliance and debugging, there's no way to answer "what business hours were configured last Tuesday?" or "which team members were removed?"

**Recommended fix:** Add soft-delete flags, or log delete events to the `audit_log` table (already exists from SPEC-04).

---

### D14 — Timestamps not always set on creation [LOW]

Most tables have `defaultNow()` for `createdAt`, but a few update paths create records without explicit timestamps. This is a minor consistency issue since Postgres default handles it, but explicit timestamps in the application code make the behavior more visible and testable.

---

## 2. EXTERNAL API RESILIENCE

### E1 — No Stripe idempotency keys [CRITICAL]

**File:** `src/lib/services/subscription.ts`

All Stripe mutation calls lack idempotency keys:

**Subscription creation** (line 99):
```typescript
const stripeSubscription = await stripe.subscriptions.create(
  stripeSubParams as unknown as Stripe.SubscriptionCreateParams
);
// No idempotencyKey parameter
```

**Subscription cancellation** (line 177):
```typescript
await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
// No idempotencyKey
```

**Subscription update** (line 238):
```typescript
await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
  items: [{ id: stripeSub.items.data[0].id, price: priceId }],
  proration_behavior: 'create_prorations',
});
// No idempotencyKey
```

**Subscription pause** (line 285):
```typescript
await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
  pause_collection: { behavior: 'mark_uncollectible', ... },
});
// No idempotencyKey
```

**Failure scenario:**
1. Admin clicks "Create Subscription" for client
2. `stripe.subscriptions.create()` sends request to Stripe
3. Stripe creates the subscription and returns response
4. Network timeout before response reaches our server
5. Our code throws an error, admin sees "failed" message
6. Admin clicks "Create Subscription" again
7. Second `stripe.subscriptions.create()` creates a DUPLICATE subscription
8. Client is now billed twice per month
9. **Direct revenue impact:** Double charges, refund requests, potential chargeback fees ($15-$25 each)

Stripe idempotency keys prevent this: passing the same key with the same parameters returns the original response instead of creating a duplicate.

**Recommended fix:** Add `idempotencyKey` to all Stripe mutation calls. Derive from deterministic inputs:
```typescript
const idempotencyKey = `create_sub_${clientId}_${planId}_${Date.now()}`;
const stripeSubscription = await stripe.subscriptions.create(
  stripeSubParams,
  { idempotencyKey }
);
```

---

### E2 — No Stripe subscription reconciliation [CRITICAL]

**Files:** No cron exists for this

If a Stripe webhook fails delivery (our server is down during a deployment, Cloudflare edge timeout, etc.), the local DB permanently diverges from Stripe. Stripe retries webhooks for up to 72 hours, but if all retries fail, the event is lost forever.

**Failure scenario:**
1. Client cancels subscription directly in Stripe dashboard
2. `customer.subscription.deleted` webhook fires
3. Our server is deploying — returns 503 for 45 seconds
4. Stripe retries 3 times over 72 hours — all fail (bad luck with deploy timing)
5. Local DB still shows `status: 'active'`
6. Client continues accessing the platform for free
7. MRR reports overcount by the client's plan amount
8. **Business impact:** Revenue leakage (client gets free access), inaccurate financial reporting

The inverse is also possible: a webhook creates a subscription record locally, but the Stripe subscription is later voided — local DB shows a subscription that doesn't exist in Stripe.

**Recommended fix:** Daily reconciliation cron:
1. Fetch all Stripe subscriptions via `stripe.subscriptions.list()`
2. Compare with local `subscriptions` table
3. Log discrepancies to a `billing_discrepancies` table
4. Auto-fix status mismatches, alert on missing records

---

### E3 — No Twilio SMS retry logic [CRITICAL]

**File:** `src/lib/services/twilio.ts:15-40`

```typescript
export async function sendSMS(
  to: string, body: string, from: string,
  options?: { mediaUrl?: string[] }
): Promise<string> {
  try {
    const message = await client.messages.create({
      to, from, body, statusCallback,
      ...(options?.mediaUrl?.length ? { mediaUrl: options.mediaUrl } : {}),
    });
    console.log('[Messaging] SMS sent:', message.sid);
    return message.sid;
  } catch (error) {
    console.error('[Messaging] Twilio SMS error:', error);
    throw error;    // <-- No retry. Message permanently lost.
  }
}
```

`sendSMS()` is used across 10+ critical automation paths:
- Missed call auto-response (first contact with lead)
- Incoming SMS AI response (ongoing conversation)
- Form submission response (speed-to-lead)
- Payment reminders
- Appointment reminders
- Escalation notifications to team members
- Win-back sequences
- No-show recovery

**Failure scenario:**
1. Twilio has a transient outage (happens ~2-3x/year for 5-15 minutes)
2. During the outage, 50 missed calls come in across all clients
3. All 50 auto-response SMS attempts fail with Twilio 503
4. Error is logged but messages are permanently lost
5. 50 leads receive no response — speed-to-lead advantage is gone
6. **Business impact:** Core value proposition ("never miss a lead") fails. Each lost lead represents potential $3,000+ in revenue for the client.

A retry pattern already exists in the codebase — `webhook-dispatch.ts:54-86` implements 3-attempt retry with exponential backoff (1s, 2s delays). This same pattern should be applied to `sendSMS()`.

**Recommended fix:** Add retry wrapper with 3 attempts and exponential backoff:
```typescript
for (let attempt = 1; attempt <= 3; attempt++) {
  try {
    const message = await client.messages.create({ to, from, body, ... });
    return message.sid;
  } catch (error) {
    if (attempt === 3) throw error;
    await new Promise(r => setTimeout(r, attempt * 1000));
  }
}
```

---

### E4 — Stripe payment webhook no deduplication [HIGH]

**File:** `src/app/api/webhooks/stripe/route.ts:38-90`

Subscription events correctly check for duplicates (lines 176-181):
```typescript
// Dedup check present for subscription events:
const [existingEvent] = await db
  .select()
  .from(billingEvents)
  .where(eq(billingEvents.stripeEventId, event.id))
  .limit(1);
if (existingEvent) return;
```

But `checkout.session.completed` (lines 38-90) has **no dedup check**:
```typescript
case 'checkout.session.completed': {
  const session = event.data.object as Stripe.Checkout.Session;
  // No dedup check — jumps straight to processing
  if (session.payment_link && session.payment_intent) {
    await handlePaymentSuccess(...);
    // ... sends SMS to lead AND to client owner
  }
  break;
}
```

**Failure scenario:**
1. Lead pays via payment link
2. `checkout.session.completed` webhook fires
3. Our server returns 200 but Stripe doesn't receive the ACK (network issue)
4. Stripe retries the webhook
5. Second processing: `handlePaymentSuccess()` runs again, duplicate SMS sent
6. Customer receives two "Payment of $3,000 received!" texts
7. **Business impact:** Unprofessional duplicate messages, potential duplicate payment records

**Recommended fix:** Add the same `billingEvents.stripeEventId` dedup check that subscription events use.

---

### E5 — OpenAI no timeout or retry [HIGH]

**File:** `src/lib/services/openai.ts:139-148`

```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: 'user', content: incomingMessage },
  ],
  max_tokens: 200,
  temperature: 0.7,
});
// No timeout parameter
// No retry on transient failure
// No rate limit (429) handling
```

This function is called on every inbound SMS via `handleIncomingSMS` → `generateAIResponse()`. OpenAI's rate limits for `gpt-4o-mini` are 60 RPM / 150K TPM on most tiers.

**Failure scenario:**
1. Client receives 20 inbound SMS in 1 minute (marketing campaign response surge)
2. Each triggers `generateAIResponse()`
3. OpenAI rate limit hit at request #15
4. Requests 15-20 fail with 429 error
5. AI falls through to escalation path (`shouldEscalate: true, escalationReason: 'AI generation failed'`)
6. 5 leads that could have been auto-handled now require manual team member intervention
7. **Business impact:** Overwhelmed team members, delayed responses, lost leads

Additionally, OpenAI API calls can hang for 30+ seconds during service degradation. No timeout means the serverless function may hit Cloudflare's execution timeout first (30s on Workers), leaving the lead with no response at all.

**Recommended fix:** Add timeout (10s) and retry (2 attempts with 429 backoff):
```typescript
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [...],
  max_tokens: 200,
  temperature: 0.7,
}, { timeout: 10000 });
```

---

### E6 — Google token refresh failure unhandled [HIGH]

**File:** `src/lib/services/google-business.ts:147-179`

```typescript
async function refreshGoogleToken(clientId: string, refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = (await res.json()) as GoogleTokenResponse;

  if (!data.access_token) {
    throw new Error(`[Reputation] Failed to refresh Google token for client ${clientId}`);
    // No retry, no fallback, no notification to client or admin
  }

  // ... saves new token
  return data.access_token;
}
```

**Failure scenario:**
1. Client's Google OAuth refresh token is revoked (user changed Google password, or token expired after 6 months of non-use)
2. `refreshGoogleToken()` throws
3. All Google Business Profile features silently stop working: review monitoring, auto-review responses
4. No notification sent to client or admin about the failure
5. Client doesn't notice for weeks until they check their reviews
6. **Business impact:** Reputation management feature silently degrades, client loses trust

**Recommended fix:** Retry 2x on transient failures. On permanent failure (invalid_grant), mark the client's Google integration as `needs_reauth`, send notification email to client owner.

---

### E7 — Twilio SMS webhook no deduplication [HIGH]

**File:** `src/app/api/webhooks/twilio/sms/route.ts:12-82`

```typescript
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // No deduplication check on payload.MessageSid

    // ... webhook logging ...

    await handleIncomingSMS({
      To: payload.To,
      From: payload.From,
      Body: payload.Body || '',
      MessageSid: payload.MessageSid,
      // ...
    });
```

Contrast with the existing dedup pattern in `missed-call.ts:54-68` which checks `CallSid` before processing.

**Failure scenario:**
1. Lead sends "Yes, I'm interested in a quote" via SMS
2. Twilio webhook fires, our server returns 200
3. Network issue — Twilio doesn't receive the ACK, retries the webhook
4. `handleIncomingSMS()` runs again: generates a second AI response, inserts duplicate conversation record
5. Lead receives two nearly-identical AI responses
6. **Business impact:** Looks unprofessional, confuses the lead, inflates message count metrics

**Recommended fix:** Check `MessageSid` against recently processed messages before calling `handleIncomingSMS()`:
```typescript
const [existing] = await db.select({ id: conversations.id })
  .from(conversations)
  .where(eq(conversations.twilioSid, payload.MessageSid))
  .limit(1);
if (existing) return; // Already processed
```

---

### E8 — Process-scheduled marks sent before delivery confirmed [HIGH]

**File:** `src/app/api/cron/process-scheduled/route.ts`

The cron processes scheduled messages by calling `sendCompliantMessage()` and immediately marking as sent:

```typescript
// Conceptual flow (actual code spans lines 50-150):
const result = await sendCompliantMessage({ ... });
// If sendCompliantMessage succeeds (returns {sent: true})...
await db.update(scheduledMessages).set({
  sent: true,
  sentAt: new Date()
}).where(eq(scheduledMessages.id, message.id));
```

**Issue:** `sendCompliantMessage()` internally calls `sendSMS()` which calls `client.messages.create()`. If the Twilio API accepts the message but delivery fails (invalid number, carrier rejection), the message is still marked as `sent: true` locally. There's no delivery confirmation check.

Additionally, if `sendCompliantMessage()` throws (Twilio timeout), the message stays `sent: false` and will be retried on the next cron run — potentially sending the same message multiple times if the first attempt actually succeeded but the response was lost.

**Business impact:** Inaccurate delivery metrics. Messages shown as "sent" that were never delivered. Or duplicate messages if retry occurs after a timeout.

**Recommended fix:** Use Twilio's `statusCallback` URL to track actual delivery status. Mark messages as `pending_delivery` initially, then update to `delivered` or `failed` when the status callback arrives.

---

### E9 — Missing Stripe webhook events [HIGH]

**File:** `src/app/api/webhooks/stripe/route.ts:37-157`

The webhook handler only processes these events:
- `checkout.session.completed` / `expired`
- `charge.refunded`
- `customer.subscription.created` / `updated` / `deleted` / `trial_will_end`
- `invoice.created` / `updated` / `paid` / `payment_failed`
- `payment_method.attached`

**Not handled:**

| Missing Event | Impact |
|---------------|--------|
| `invoice.payment_action_required` | 3D Secure / SCA challenges not tracked — client sees "active" subscription but payment is actually pending authentication |
| `customer.subscription.paused` / `resumed` | Subscription pauses initiated from Stripe dashboard not reflected locally |
| `charge.dispute.created` / `closed` | Chargebacks not tracked — no alert to admins, no automatic service suspension |
| `customer.updated` | Email/name changes in Stripe not synced to local records |
| `invoice.finalization_failed` | Invoice generation failures not tracked |

**Business impact:** Chargebacks cost $15-25 each in fees. Not tracking disputes means no proactive response (evidence submission deadline is 7-21 days). 3D Secure failures mean clients appear active but aren't paying.

**Recommended fix:** Add handlers for at minimum `invoice.payment_action_required`, `charge.dispute.created`, and `charge.dispute.closed`. Alert admins on disputes.

---

### E10 — No Twilio rate limit handling [MEDIUM]

**File:** `src/lib/services/twilio.ts:27-33`

No detection of HTTP 429 status codes from Twilio. The `process-scheduled` cron processes up to 50 messages in rapid succession (`route.ts:45: .limit(50)`) without throttling.

Twilio's API rate limit is 100 messages/second for most accounts, but carrier-specific limits (T-Mobile, AT&T) are lower. Burst-sending 50 messages can trigger carrier filtering, causing messages to be silently dropped.

**Business impact:** Messages silently dropped by carrier filters. No error from Twilio API, but messages never reach the recipient.

**Recommended fix:** Add 100ms delay between messages in the cron loop, and handle 429 responses with exponential backoff.

---

### E11 — No OpenAI rate limit handling [MEDIUM]

**File:** `src/lib/services/openai.ts:139-148`

No catch for HTTP 429 errors from OpenAI. Additionally, the OpenAI client is instantiated at module level:

```typescript
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
```

High-traffic clients (10+ inbound SMS/minute during business hours) can exhaust the rate limit. The `gpt-4o-mini` model has a 60 RPM limit on lower tiers.

**Business impact:** All AI responses fail across ALL clients when one client exhausts the rate limit, since the API key is shared.

**Recommended fix:** Catch 429 errors specifically, implement per-client request queuing, add `Retry-After` header handling.

---

### E12 — Resend email no retry [MEDIUM]

**File:** `src/lib/services/resend.ts:20-46`

```typescript
export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<SendEmailResult> {
  // ...
  try {
    const result = await resend.emails.send({ from, to, subject, html });
    if (result.error) {
      console.error('[Resend] API error:', result.error);
      return { success: false, error: result.error };  // No retry
    }
    return { success: true, id: result.data?.id };
  } catch (error) {
    console.error('[Resend] Send failed:', error);
    return { success: false, error };  // No retry
  }
}
```

Used for:
- Magic link login emails (auth flow — user can't sign in)
- Daily summary emails (client loses daily insights)
- Escalation alert emails
- Verification emails

**Business impact:** A transient Resend outage means admins can't log in (magic links), clients miss daily summaries, and escalation emails are lost.

**Recommended fix:** Add 2-attempt retry with 1s delay between attempts.

---

### E13 — ElevenLabs TTS no error recovery [MEDIUM]

**File:** `src/lib/services/elevenlabs.ts:70-104`

```typescript
export async function synthesizeSpeech(voiceId: string, text: string, ...): Promise<ArrayBuffer> {
  const res = await fetch(`${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`, { ... });
  if (!res.ok) {
    throw new Error(`ElevenLabs TTS error: ${res.status}`);
    // No retry, no fallback to text-only
  }
  return res.arrayBuffer();
}
```

Also, the API key has an empty-string fallback:
```typescript
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
```

If the env var is missing, all TTS requests go out with an empty API key — ElevenLabs returns 401, the error is thrown, and voice features break with no clear indication of why.

**Business impact:** Voice AI features (hot transfer greetings, voicemail) completely break with no graceful degradation. Could use a text-to-speech fallback or text-only fallback.

**Recommended fix:** Add retry (2 attempts), fallback to built-in TTS or text-only mode, and fail-fast on missing API key.

---

### E14 — Cron daily summary no partial failure recovery [LOW]

**File:** `src/lib/services/daily-summary.ts:167-193`

```typescript
export async function processDailySummaries(): Promise<number> {
  const db = getDb();
  const eligibleClients = await db.select({ clientId: ... }).from(notificationPreferences)...;

  let sent = 0;
  for (const { clientId } of eligibleClients) {
    try {
      await sendDailySummary(clientId);
      sent++;
    } catch (error) {
      console.error(`[DailySummary] Failed for client ${clientId}:`, error);
      // No record of which clients failed
      // No resume mechanism if cron crashes
    }
  }
  return sent;
}
```

**Failure scenario:**
1. 200 clients are eligible for daily summaries
2. Cron starts processing sequentially
3. After processing 120 clients, the serverless function hits execution timeout (30s on Cloudflare Workers)
4. Function is killed — 80 clients don't receive their daily summary
5. No record of which 120 were processed vs which 80 weren't
6. If the cron retries, it starts from scratch — 120 clients get duplicate summaries

**Business impact:** Inconsistent daily summary delivery. Some clients get duplicates, others get none.

**Recommended fix:** Track `lastDailySummaryAt` per client. Process in batches of 20. Skip clients where `lastDailySummaryAt` is today.

---

### E15 — No global OTP rate limit [LOW]

**File:** `src/lib/services/otp.ts:344-372`

```typescript
async function checkRateLimit(
  db: ReturnType<typeof getDb>,
  method: 'phone' | 'email',
  identifier: string
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  // Only checks per-identifier: max 3 OTPs per 15-minute window for THIS identifier
  // No global rate limit across all identifiers
}
```

**Failure scenario:**
1. Attacker scripts OTP requests to 10,000 different phone numbers
2. Each number gets 3 OTPs (within per-identifier limit)
3. 30,000 SMS sent via Twilio
4. At ~$0.0079/SMS, that's ~$237 in SMS costs per attack
5. **Business impact:** SMS cost abuse. Twilio account could be flagged for spam.

**Recommended fix:** Add global rate limit: max 100 OTP sends per minute across all identifiers. Implement via a simple counter in the database or in-memory cache.

---

## 3. LEGACY MIGRATION BLOCKERS

### L1 — Legacy teamMembers table still actively used [HIGH]

**Status:** 8 files still reference `teamMembers` table

The new access management system (SPEC-01 through SPEC-06) introduced `people`, `clientMemberships`, and `agencyMemberships` tables. But the legacy `teamMembers` table is still actively used:

| File | Usage | Lines |
|------|-------|-------|
| `src/app/api/team-members/route.ts` | Full CRUD (GET, POST, DELETE) | 1-131 |
| `src/app/api/team-members/[id]/route.ts` | PATCH, DELETE | 1-79 |
| `src/app/api/escalations/[id]/route.ts` | Assignee lookup | 47-52 |
| `src/app/api/claims/claim/route.ts` | Claim assignment | — |
| `src/app/api/webhooks/twilio/ring-connect/route.ts` | Call routing | — |
| `src/app/api/webhooks/twilio/member-answered/route.ts` | Call answered | — |
| `src/app/api/admin/clients/[id]/stats/route.ts` | Team member count | — |
| `src/app/api/admin/reports/route.ts` | Team metrics (lines 115-118) | 115-118 |

These routes use `auth()` + basic session checks (not the new `requireAgencyPermission()` system). **Team member management bypasses the new RBAC system entirely.**

The `team-escalation.ts` service (lines 147-270) reads from `teamMembers` for escalation claims, call routing, and member notifications. This is the most critical dependency — real-time call routing depends on the legacy table.

**Business impact:** Dual team management systems create confusion. Changes made in the new system (SPEC-04/05) aren't reflected in call routing and escalation. Admins must maintain team members in both places. Bugs where a team member is active in one system but not the other go undetected.

**Recommended fix:** Either:
1. **Bridge:** Add a compatibility layer that reads from `people`/`clientMemberships` in the legacy routes
2. **Migrate:** Replace all `teamMembers` references with new table queries (requires schema mapping: `teamMembers.phone` → `people.phone`, `teamMembers.clientId` → `clientMemberships.clientId`, etc.)

---

### L2 — business-hours route uses old auth pattern [HIGH]

**File:** `src/app/api/business-hours/route.ts:50-54`

```typescript
export async function PUT(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {    // <-- Legacy auth check
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }
```

This is the **only remaining admin-level API route** that uses the old `session?.user?.isAdmin` pattern instead of `requireAgencyPermission()`. All other ~80 admin routes were migrated in commit 6d04ee4.

Additionally, this route has the delete-then-insert vulnerability documented in D12.

**Business impact:** This route bypasses the permission system, audit logging, and client scope checks. Any user with `isAdmin = true` can modify business hours for any client without being assigned to that client.

**Recommended fix:** Replace with `requireAgencyClientPermission(validated.clientId, AGENCY_PERMISSIONS.SETTINGS_MANAGE)`.

---

### L3 — Legacy `users.isAdmin` and `users.clientId` still queried [MEDIUM]

**Files:** `src/app/api/admin/users/route.ts`, `src/auth.ts`

The admin users list endpoint (`users/route.ts:19-33`) still queries legacy fields:

```typescript
const allUsers = await db
  .select({
    id: users.id,
    name: users.name,
    email: users.email,
    isAdmin: users.isAdmin,      // <-- Legacy field
    clientId: users.clientId,    // <-- Legacy field
    clientName: clients.businessName,
    createdAt: users.createdAt,
  })
  .from(users)
  .leftJoin(clients, eq(users.clientId, clients.id))
  .orderBy(desc(users.createdAt));
```

The auth callback (`auth.ts:22-28`) also reads these fields:

```typescript
const [dbUser] = await db
  .select({
    id: users.id,
    clientId: users.clientId,    // <-- Legacy field
    isAdmin: users.isAdmin,      // <-- Legacy field
    personId: users.personId,
  })
  .from(users)
  .where(eq(users.email, user.email!))
  .limit(1);
```

The auth callback has a dual-path design: if `personId` exists, it uses the new system; otherwise falls back to legacy `isAdmin`/`clientId`. This is intentional for migration compatibility, but the `users.isAdmin` and `users.clientId` columns cannot be dropped until:
1. All existing users have `personId` set
2. The migration script (`migrate-identities.ts`) has been run
3. The auth callback's legacy fallback is removed
4. The `users/route.ts` endpoint is updated to query from `people`/`agencyMemberships`

**Business impact:** Maintaining two auth paths increases complexity and the surface area for bugs. A user could have `isAdmin: true` but no `agencyMembership`, or vice versa, leading to inconsistent access.

---

### L4 — TODOs indicating incomplete features [MEDIUM]

**Files:**

| File | TODO | Business Impact |
|------|------|-----------------|
| `src/lib/services/review-monitoring.ts:54` | "Add Yelp, Facebook, etc." | Review monitoring only works for Google — clients on Yelp/Facebook get no monitoring |
| `src/lib/services/agency-communication.ts:427` | "Trigger follow-up sequences for specified leadIds" | Action prompts sent to clients are visual-only — clicking "trigger follow-ups" does nothing |
| `src/lib/services/agency-communication.ts:431` | "Create escalation entry for callback" | Callback scheduling in agency messages is a no-op — the button exists but doesn't create an escalation |

**Business impact:** Features appear functional in the UI but are partially or completely unimplemented. The agency communication action prompts are particularly problematic — admins think they're triggering follow-ups or scheduling callbacks, but nothing happens.

---

## 4. BUSINESS LOGIC GAPS

### B1 — Plan deactivation allows active subscriptions [CRITICAL]

**File:** `src/app/api/admin/plans/[id]/route.ts:106-135`

```typescript
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ... permission check ...
  const { id } = await params;
  const db = getDb();

  // No check for active subscriptions!
  const [updated] = await db
    .update(plans)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(plans.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
```

**Failure scenario:**
1. "Pro Plan" has 15 active subscribers billing $997/month
2. Admin deactivates "Pro Plan" (soft-delete sets `isActive: false`)
3. Stripe webhooks continue processing for those 15 subscriptions
4. Next billing cycle: `handleSubscriptionUpdate` updates subscription status, but `getSubscriptionWithPlan()` joins on `plans.id` and the plan still exists (just inactive)
5. However, if any code filters by `plans.isActive`, these subscriptions become invisible
6. New subscribers can't select the plan, but existing subscribers are in limbo
7. **Business impact:** 15 clients on $997/month ($14,955 MRR) may have inconsistent access — features gated by plan capabilities may stop working if any check includes `isActive` filter

**Recommended fix:** Before deactivation, check for active subscriptions:
```typescript
const activeCount = await db.select({ count: sql`count(*)` })
  .from(subscriptions)
  .where(and(
    eq(subscriptions.planId, id),
    inArray(subscriptions.status, ['active', 'trialing'])
  ));
if (Number(activeCount[0].count) > 0) {
  return NextResponse.json({ error: 'Cannot deactivate plan with active subscriptions' }, { status: 409 });
}
```

---

### B2 — Phone number release without conversation check [HIGH]

**File:** `src/lib/services/twilio-provisioning.ts:333-375`

```typescript
export async function releaseNumber(clientId: string): Promise<OperationResult> {
  try {
    const db = getDb();
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!client?.twilioNumber) {
      return { success: false, error: "No number assigned to this client" };
    }

    // No check for active conversations!

    // Clear Twilio webhooks
    const numbers = await twilioClient.incomingPhoneNumbers.list({ phoneNumber: client.twilioNumber });
    if (numbers.length > 0) {
      await twilioClient.incomingPhoneNumbers(numbers[0].sid).update({
        voiceUrl: "", smsUrl: "", friendlyName: "Released",
      });
    }

    // Remove number from client
    await db.update(clients).set({
      twilioNumber: null, status: "paused", updatedAt: new Date(),
    }).where(eq(clients.id, clientId));
```

**Failure scenario:**
1. Client has 30 leads in active conversations (responded in last 7 days)
2. Admin releases the phone number
3. Twilio webhooks cleared — incoming SMS to that number goes nowhere
4. Leads who reply to the business receive no response
5. If another client is assigned the same number later, leads' replies go to the wrong business
6. **Business impact:** 30 active conversations permanently broken. Leads who were close to converting are lost. No way to resume without a new number (leads have the old number saved).

**Recommended fix:** Check for recent conversations before allowing release:
```typescript
const recentConversations = await db.select({ count: sql`count(*)` })
  .from(conversations)
  .where(and(
    eq(conversations.clientId, clientId),
    gte(conversations.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
  ));
if (Number(recentConversations[0].count) > 0) {
  return { success: false, error: 'Cannot release number with active conversations in the last 30 days' };
}
```

---

### B3 — Client soft-delete without subscription cleanup [MEDIUM]

**File:** `src/app/api/admin/clients/[id]/route.ts:149-181`

```typescript
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ... permission check ...
  const db = getDb();

  // Soft delete — only sets status
  const [updated] = await db
    .update(clients)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();

  // No Stripe subscription cancellation!
  // No Twilio number release!
  // No scheduled message cancellation!

  return NextResponse.json({ success: true });
}
```

**Failure scenario:**
1. Admin "deletes" (soft-deletes) a client
2. Client status set to `cancelled` in local DB
3. Stripe subscription continues billing — `stripe.subscriptions.cancel()` never called
4. Client is charged next month despite being "deleted"
5. MRR reports show cancelled client's plan amount
6. Twilio number remains assigned — messages to that number still processed, creating conversations for a cancelled client
7. **Business impact:** Continued billing of deleted clients (revenue liability), wasted Twilio number inventory, ghost data in analytics

**Recommended fix:** On client deletion:
1. Cancel active Stripe subscription
2. Release Twilio number (with conversation check per B2)
3. Cancel all pending scheduled messages
4. Mark all active leads as `lost`

---

### B4 — Trial period can be bypassed via re-subscription [MEDIUM]

**File:** `src/lib/services/subscription.ts:68-72`

```typescript
const stripeSubParams: Record<string, unknown> = {
  customer: stripeCustomerId,
  items: [{ price: priceId }],
  trial_period_days: plan.trialDays || undefined,  // <-- Always applied
  // ...
};
```

**Failure scenario:**
1. Client signs up for "Pro Plan" with 14-day free trial
2. Enjoys 14 days of free access
3. Before trial converts to paid, client cancels subscription
4. Client immediately re-subscribes to the same plan
5. `createSubscription()` applies `plan.trialDays` again — another 14-day free trial
6. Repeat indefinitely for unlimited free access
7. **Business impact:** Revenue loss from trial abuse. The `subscriptions.clientId` UNIQUE constraint prevents concurrent subscriptions, but not sequential.

The `coupon-validation.ts:60-72` has a `firstTimeOnly` check for coupons, but no equivalent exists for trial periods.

**Recommended fix:** Check for prior subscriptions before applying trial:
```typescript
const [priorSub] = await db.select({ id: subscriptions.id })
  .from(subscriptions)
  .where(eq(subscriptions.clientId, clientId))
  .limit(1);
if (priorSub) {
  delete stripeSubParams.trial_period_days;
}
```

---

### B5 — Cancellation flow has no Stripe integration [MEDIUM]

**File:** `src/lib/services/cancellation.ts`

The cancellation flow manages local state across 4 statuses (`pending` → `scheduled_call` → `saved` | `cancelled`) but never touches Stripe:

```typescript
// confirmCancellation (lines 120-136):
export async function confirmCancellation(requestId: string, gracePeriodDays: number = 7): Promise<void> {
  const db = getDb();
  const gracePeriodEnds = new Date();
  gracePeriodEnds.setDate(gracePeriodEnds.getDate() + gracePeriodDays);

  await db.update(cancellationRequests).set({
    status: 'cancelled',
    gracePeriodEnds,
    processedAt: new Date(),
  }).where(eq(cancellationRequests.id, requestId));

  // No stripe.subscriptions.cancel() call!
  // No stripe.subscriptions.update({ cancel_at_period_end: true })!
}
```

**Failure scenario:**
1. Client initiates cancellation through the portal
2. Retention call happens, client confirms they want to cancel
3. `confirmCancellation()` marks the request as `cancelled` with 7-day grace period
4. Grace period ends — but Stripe subscription is still active
5. Client is billed on the next billing cycle
6. Client contacts support: "I cancelled but was still charged!"
7. **Business impact:** Customer trust violation, refund required, potential chargeback

**Recommended fix:** After marking the cancellation request, call `cancelSubscription()` from `subscription.ts` (which handles Stripe cancellation) with `cancelImmediately: false` to cancel at period end.

---

### B6 — ROI calculation uses hardcoded assumptions [MEDIUM]

**File:** `src/lib/services/cancellation.ts:44-47`

```typescript
// Estimate: 10% of leads convert, average job value $3000
const estimatedRevenue = Math.round(totalLeads * 0.1 * 3000);
const monthlyCost = 997;
```

**Issues:**
1. `0.1` (10%) conversion rate is hardcoded — varies wildly by industry (plumbing: 15-25%, roofing: 5-10%)
2. `3000` average job value is hardcoded — ranges from $500 (handyman) to $50,000 (remodeling)
3. `997` monthly cost is hardcoded — plans range from $497 to $1,997
4. These values are shown to clients in the cancellation flow as "your ROI" — inaccurate numbers undermine credibility

**Business impact:** ROI shown during retention call may be wildly inaccurate. If overstated, client loses trust. If understated, it fails to retain a client who is actually getting great value.

**Recommended fix:** Pull conversion rate from client's actual lead data (`leads WHERE status = 'won'` / total leads), average job value from client settings or industry default, and monthly cost from the active subscription/plan.

---

### B7 — Team member deletion has no cascading cleanup [LOW]

**Files:** `src/app/api/team-members/route.ts:108-130`, `src/app/api/team-members/[id]/route.ts:58-78`

Deleting a team member is a hard delete with no cleanup:

```typescript
// team-members/[id]/route.ts DELETE handler:
await db.delete(teamMembers).where(eq(teamMembers.id, id));
```

**Not cleaned up:**
- Open escalation claims where `claimedBy = deletedMemberId` — `claimEscalation()` (team-escalation.ts:161-167) will return `null` when looking up the claimer's name
- Call routing priorities — if the deleted member was in the rotation, their slot is just skipped
- No notification to the client about the removed team member

**Business impact:** Orphaned escalation references. If someone queries "who claimed this escalation?", the answer is a UUID that resolves to nothing.

**Recommended fix:** Before deleting, reassign open escalation claims to another team member (or unclaim them). Notify the client that a team member was removed.

---

### B8 — Coupon hard-delete without checking usage [LOW]

**File:** `src/app/api/admin/coupons/[id]/route.ts:57-81`

```typescript
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // ... permission check ...
  const { id } = await params;
  const db = getDb();

  // Hard delete — no usage check!
  const [deleted] = await db.delete(coupons).where(eq(coupons.id, id)).returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Coupon not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

**Issue:** The `subscriptions.couponCode` column stores the coupon code as a string (not FK), so this won't cause a constraint violation. But deleting a coupon removes:
- The redemption count history (`timesRedeemed`)
- The discount configuration (needed for Stripe reconciliation)
- Any audit trail of which coupons were used

**Business impact:** Cannot audit which subscriptions used which coupons. If a billing dispute arises ("I was promised 20% off"), the coupon record is gone.

**Recommended fix:** Use soft-delete (`isActive: false`) instead of hard delete, or check if any active subscription uses this coupon code before allowing deletion.

---

## 5. SCALING & CONFIGURATION

### S1 — N+1 queries in win-back and no-show automations [CRITICAL]

**Files:** `src/lib/automations/win-back.ts:81-185`, `src/lib/automations/no-show-recovery.ts:52-133`

Both automations process leads in a sequential loop, making 3-5 database queries + 1 OpenAI call + 1 SMS per lead:

**Win-back** (`win-back.ts:81-185`):
```typescript
for (const { lead, client } of staleLeads) {
  // Query 1: Check for existing win-back (lines 90-101)
  const existingWinBack = await db.select().from(scheduledMessages)
    .where(and(eq(scheduledMessages.leadId, lead.id), ...)).limit(1);

  // Query 2: Build AI context (line 104, internally makes 2-3 queries)
  const message = await generateWinBackMessage(client.id, lead.id, ...);
    // Inside: buildAIContext() queries conversations, knowledge base, agent settings
    // Plus: openai.chat.completions.create() — external API call

  // Query 3: Send SMS (line 118)
  const result = await sendCompliantMessage({ ... });
    // Inside: consent check, DNC check, quiet hours check, then sendSMS()

  // Query 4: Insert conversation record (line 137)
  await db.insert(conversations).values({ ... });

  // Query 5: Insert scheduled message for follow-up (line 154)
  await db.insert(scheduledMessages).values({ ... });

  // Query 6: Insert record for first win-back (line 164)
  await db.insert(scheduledMessages).values({ ... });
}
```

**No-show** (`no-show-recovery.ts:52-133`) has an identical pattern.

**Scaling analysis:**

| Leads | DB Queries | OpenAI Calls | SMS Calls | Est. Duration |
|-------|-----------|-------------|-----------|---------------|
| 10 | 60 | 10 | 10 | ~30 seconds |
| 100 | 600 | 100 | 100 | ~5 minutes |
| 1,000 | 6,000 | 1,000 | 1,000 | ~50 minutes |

At 1,000 stale leads:
- **DB:** 6,000 sequential round-trips to Neon (each ~5-10ms over HTTP) = 30-60 seconds of DB time alone
- **OpenAI:** 1,000 sequential calls to `gpt-4o-mini` (each ~500ms-2s) = 8-33 minutes
- **Twilio:** 1,000 sequential SMS sends (each ~200-500ms) = 3-8 minutes
- **Total:** 11-41 minutes for a single cron run
- Cloudflare Workers execution limit: 30 seconds (free) / 6 minutes (paid)
- **Result:** Cron times out. Leads processed before timeout get messages; the rest are retried next run but may now fall outside the win-back window.

**Recommended fix:**
1. Batch leads into chunks of 10
2. Process each chunk with `Promise.allSettled()` for parallel processing
3. Add circuit breaker: pause if error rate exceeds 10%
4. Pre-fetch conversation history and AI context in bulk queries before the loop

---

### S2 — No startup environment validation [CRITICAL]

**Files:** 23+ files use `process.env.X!` non-null assertions

Critical services instantiate API clients at module level with non-null assertions:

```typescript
// src/lib/services/twilio.ts:3-6
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

// src/lib/services/openai.ts (module level)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// src/lib/automations/win-back.ts:17
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// src/lib/automations/no-show-recovery.ts:17
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// src/app/api/webhooks/stripe/route.ts:28
process.env.STRIPE_WEBHOOK_SECRET!

// src/lib/services/google-business.ts:155-156
client_id: process.env.GOOGLE_CLIENT_ID!,
client_secret: process.env.GOOGLE_CLIENT_SECRET!,
```

If any of these env vars is missing at deploy time, the app starts successfully but crashes at runtime when the specific code path is hit. This can be hours or days after deployment.

**Failure scenario:**
1. New deployment omits `TWILIO_AUTH_TOKEN` from Cloudflare Workers secrets
2. App deploys and starts serving requests normally
3. First missed call triggers `sendSMS()`
4. Twilio client was instantiated with `undefined` as auth token
5. Every SMS send fails with authentication error
6. All auto-responses, escalations, and notifications stop working
7. No one notices for hours until a client complains about missed leads

**Recommended fix:** Create `src/lib/config-validation.ts`:
```typescript
const REQUIRED_ENV = [
  'DATABASE_URL', 'AUTH_SECRET', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN',
  'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'OPENAI_API_KEY',
  'RESEND_API_KEY', 'CRON_SECRET',
];
export function validateEnvironment() {
  const missing = REQUIRED_ENV.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```
Call from `instrumentation.ts` to fail at startup.

---

### S3 — Webhook secrets fall back to empty string [HIGH]

**File:** `src/lib/clients/stripe.ts:17`

```typescript
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
```

**File:** `src/lib/services/webhook-dispatch.ts:47`

```typescript
const signature = createHmac('sha256', process.env.FORM_WEBHOOK_SECRET || 'webhook-secret')
  .update(body)
  .digest('hex');
```

**Issue with Stripe (`stripe.ts:17`):** If `STRIPE_WEBHOOK_SECRET` is empty, `stripe.webhooks.constructEvent()` in the webhook route (`webhooks/stripe/route.ts:25-29`) will **always fail** signature verification — every webhook will be rejected with "Invalid signature". This is a fail-closed behavior (good), but the failure message is misleading and hard to debug.

**Issue with webhook dispatch (`webhook-dispatch.ts:47`):** If `FORM_WEBHOOK_SECRET` is missing, the HMAC is signed with the literal string `'webhook-secret'`. An attacker who discovers this default can forge webhook signatures for all client webhook deliveries.

**Recommended fix:**
- `stripe.ts`: Remove the `|| ''` fallback. Let it be `undefined` and throw a clear error in the webhook route if not set.
- `webhook-dispatch.ts`: Remove the `|| 'webhook-secret'` fallback. Throw if not set, or skip webhook dispatch if the secret is not configured.

---

### S4 — Unbounded admin list queries [MEDIUM]

**File:** `src/app/api/admin/reports/route.ts:34-41`

```typescript
let query = db.select().from(reports);
if (clientId) {
  query = query.where(eq(reports.clientId, clientId)) as any;
}
const allReports = await (query as any).orderBy(reports.createdAt);
// No LIMIT! Returns ALL reports across ALL clients
```

Other affected routes:
- `ab-tests/route.ts` — returns all A/B tests
- `email-templates/route.ts` — returns all email templates
- `coupons/route.ts` — returns all coupons

**Failure scenario:**
1. Platform grows to 500 clients, each with 24 bi-weekly reports per year
2. That's 12,000 report records
3. Admin opens the reports page without filtering by client
4. Query returns 12,000 full report objects (each with JSON `metrics`, `performanceData`, `testResults` columns)
5. Response payload is 50+ MB
6. Serverless function hits memory limit, returns 502
7. **Business impact:** Admin tools become unusable at scale

**Recommended fix:** Add default `LIMIT 50` and pagination to all list endpoints:
```typescript
const page = parseInt(searchParams.get('page') || '1');
const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
const offset = (page - 1) * limit;
// ... .limit(limit).offset(offset)
```

---

## Prioritized Remediation Plan

### Phase 1: Critical — Revenue and Data Integrity (1-2 weeks)

| ID | Fix | Effort |
|----|-----|--------|
| D1 | Add `db.transaction()` to subscription create/cancel/change + Stripe webhook handlers | 2 days |
| D2 | Atomic coupon redemption with SQL WHERE clause | 2 hours |
| D3 | Atomic escalation claim with SQL WHERE clause | 2 hours |
| D4 | Atomic OTP verification | 2 hours |
| E1 | Add Stripe idempotency keys to all mutation calls | 4 hours |
| E2 | Build Stripe subscription reconciliation cron | 1 day |
| E3 | Add retry logic to `sendSMS()` (3 attempts, exponential backoff) | 4 hours |
| B1 | Add active-subscription check before plan deactivation | 2 hours |
| S1 | Batch processing for win-back and no-show automations | 4 hours |
| S2 | Add startup environment variable validation | 2 hours |

### Phase 2: High — Reliability and Correctness (2-4 weeks)

| ID | Fix | Effort |
|----|-----|--------|
| E4 | Add dedup to Stripe payment webhook events | 2 hours |
| E5 | Add timeout + retry to OpenAI calls | 4 hours |
| E6 | Add retry to Google token refresh, notify on permanent failure | 4 hours |
| E7 | Add SMS webhook dedup via MessageSid check | 2 hours |
| E8 | Fix process-scheduled to confirm delivery before marking sent | 4 hours |
| E9 | Add missing Stripe webhook event handlers | 1 day |
| D5 | Add explicit onDelete to subscriptions.planId FK | 1 hour |
| D6 | Add onDelete to usage records FKs | 1 hour |
| D7 | Audit and fix soft-delete filtering gaps | 4 hours |
| L1 | Migrate legacy teamMembers routes to new system (or bridge) | 2 days |
| L2 | Migrate business-hours route to permission system | 1 hour |
| B2 | Add conversation check before phone number release | 2 hours |
| S3 | Remove fallback values for webhook secrets (fail-fast) | 1 hour |

### Phase 3: Medium — Operational Polish (1-2 months)

| ID | Fix | Effort |
|----|-----|--------|
| D8 | Add coupon count reconciliation cron | 4 hours |
| D9 | Add monthly messagesSentThisMonth reset for all clients | 2 hours |
| D10 | Add row-level locking for critical concurrent operations | 1 day |
| D11 | Ensure updatedAt set on all UPDATE operations | 4 hours |
| D12 | Wrap business hours PUT in transaction | 1 hour |
| E10 | Add Twilio rate limit detection and backoff | 4 hours |
| E11 | Add OpenAI rate limit handling | 4 hours |
| E12 | Add Resend email retry (3 attempts) | 2 hours |
| E13 | Add ElevenLabs TTS fallback | 2 hours |
| B3 | Cancel Stripe subscription when soft-deleting client | 2 hours |
| B4 | Prevent trial period abuse via re-subscription | 2 hours |
| B5 | Integrate Stripe cancellation into cancellation flow | 4 hours |
| B6 | Pull ROI assumptions from client/plan settings | 2 hours |
| L3 | Update auth flow to use personId instead of isAdmin/clientId | 4 hours |
| L4 | Address or remove stale TODOs | 4 hours |
| S4 | Add default pagination to unbounded admin list endpoints | 4 hours |

### Phase 4: Low — Hardening (as time permits)

| ID | Fix | Effort |
|----|-----|--------|
| D13 | Add audit trail for hard deletes | 1 day |
| D14 | Audit all creation paths for timestamp consistency | 2 hours |
| E14 | Add cron idempotency (skip already-processed clients) | 4 hours |
| E15 | Add global OTP rate limit | 2 hours |
| B7 | Add cascading cleanup on team member deletion | 4 hours |
| B8 | Soft-delete coupons or prevent deletion if redeemed | 2 hours |

---

## Positive Findings

These patterns are already well-implemented:

1. **Webhook retry dispatch** (`webhook-dispatch.ts:54-86`) — 3-attempt retry with exponential backoff for client webhooks. This is the reference pattern for E3/E5/E6/E12/E13.
2. **Stripe subscription event dedup** (`stripe/route.ts:176-181`) — checks `stripeEventId` before processing. This is the reference pattern for E4/E7.
3. **Missed call dedup** (`missed-call.ts:54-68`) — checks `CallSid` before sending SMS. Prevents duplicate auto-responses.
4. **Compliance gateway** (`compliance-gateway.ts`) — opt-out checks, DNC list, consent verification, quiet hours enforcement. All automated messages go through this gateway.
5. **Client soft-delete** — uses `status = 'cancelled'` instead of hard delete (though it needs Stripe cleanup per B3).
6. **Cascading FKs** — 73 of 76 foreign keys have proper `onDelete` clauses. Only 3 are missing (D5, D6).
7. **Zod validation** — all API routes validate input with Zod schemas (with `.strict()` on most).
8. **Monthly message reset** — `process-scheduled` cron resets on 1st of month (though imperfect per D9).
9. **Twilio webhook signature validation** — `validateAndParseTwilioWebhook()` is used consistently on SMS webhooks.
10. **Timing-safe OTP comparison** — Already implemented in `otp.ts:286-297` to prevent timing attacks.

---

## Testing Recommendations

1. **Concurrency testing:** Simulate concurrent coupon redemptions, escalation claims, OTP verifications — verify only one succeeds
2. **Chaos testing:** Kill server mid-subscription-creation, verify Stripe state matches DB state
3. **Webhook replay:** Send duplicate Stripe/Twilio webhooks, verify dedup prevents double-processing
4. **Rate limit testing:** Burst 100 SMS in 10 seconds, verify Twilio 429 handling and backoff
5. **Token expiry:** Force Google OAuth token expiry, verify retry + admin notification
6. **Cron crash recovery:** Kill daily-summary mid-run, verify idempotent resume (no duplicate emails)
7. **Plan deactivation:** Attempt to deactivate plan with active subscription (should fail 409)
8. **Phone release:** Create conversation, attempt to release number (should fail with error)
9. **N+1 at scale:** Run win-back with 100 leads, assert <50 DB queries total (batched)
10. **Env validation:** Start app with missing `OPENAI_API_KEY` (should crash immediately at startup)
11. **Webhook secret fallback:** Start app with missing `STRIPE_WEBHOOK_SECRET` (should fail-fast, not use empty string)
12. **Trial abuse:** Cancel subscription and re-subscribe (should not get free trial again)
