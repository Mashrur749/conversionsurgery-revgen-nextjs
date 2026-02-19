# System-Wide Operational Blockers — ConversionSurgery RevGen

**Audit date:** 2026-02-19
**Scope:** Data integrity, external API resilience, legacy migration, business logic gaps
**Companion doc:** `docs/SECURITY-AUDIT.md` (auth/access control findings — separate)

---

## Executive Summary

Beyond security (auth, permissions, IDOR), the application has **system-wide operational blockers** that will cause data loss, billing inconsistencies, and degraded customer experience — especially under load or during external API outages. These fall into four categories:

| Category | Critical | High | Medium | Low |
|----------|----------|------|--------|-----|
| Data Integrity | 4 | 3 | 5 | 2 |
| External API Resilience | 3 | 5 | 4 | 2 |
| Legacy Migration | 0 | 2 | 1 | 0 |
| Business Logic | 0 | 0 | 2 | 1 |
| **Total** | **7** | **10** | **12** | **5** |

---

## 1. DATA INTEGRITY

### D1 — Zero transactional boundaries [CRITICAL]
**Impact:** Partial failures leave inconsistent state across tables

The codebase has **zero** uses of `db.transaction()`. Every multi-step database operation is vulnerable to partial failure. Drizzle ORM supports transactions via `db.transaction()` but it is never used.

**Affected operations:**

| Operation | File | Steps | Failure Mode |
|-----------|------|-------|-------------|
| Subscription creation | `src/lib/services/subscription.ts:27` | 6+ DB ops + 2 Stripe calls | Stripe subscription created, no DB record |
| Subscription cancellation | `subscription.ts:158` | 2 DB ops + Stripe call | Cancelled in Stripe but not in DB |
| Plan change | `subscription.ts:207` | 2 DB ops + Stripe call | Plan changed in Stripe, audit log missing |
| Stripe webhook: sub deleted | `api/webhooks/stripe/route.ts:198` | 3 DB ops | Sub cancelled in DB but client status stays active |
| Coupon redemption | `subscription.ts:119-141` | Insert sub + increment counter | Counter drifts from actual subscription count |

**Worst case:** Stripe creates a subscription (charges customer), but the DB insert fails. Customer is billed with no local record — requires manual Stripe reconciliation.

---

### D2 — Coupon redemption race condition [CRITICAL]
**File:** `src/lib/services/coupon-validation.ts` + `subscription.ts`

Validation and redemption are separate read-then-write operations:
1. `validateCoupon()` reads `timesRedeemed` (line 48)
2. `redeemCoupon()` increments `timesRedeemed` (line 90)

Two concurrent requests both pass validation, both increment — coupon redeemed beyond `maxRedemptions`.

**Fix:** Atomic SQL: `UPDATE coupons SET times_redeemed = times_redeemed + 1 WHERE code = ? AND (max_redemptions IS NULL OR times_redeemed < max_redemptions) RETURNING *;` — check affected rows.

---

### D3 — Escalation claim race condition [CRITICAL]
**File:** `src/lib/services/team-escalation.ts:142-270`

Read-then-check-then-update pattern: two team members click claim simultaneously, both read `status = 'pending'`, both update to `claimed`. Second write wins silently.

**Fix:** Atomic UPDATE with WHERE: `UPDATE escalation_claims SET claimed_by = ?, status = 'claimed' WHERE id = ? AND status = 'pending' RETURNING *;`

---

### D4 — OTP verification race condition [CRITICAL]
**File:** `src/lib/services/otp.ts:242-342`

Fetch OTP → check attempts → increment → mark verified. Two parallel correct-code requests can both verify the same OTP, bypassing single-use protection.

**Fix:** Single atomic UPDATE that checks `verified_at IS NULL` and `attempts < max_attempts` in the WHERE clause.

---

### D5 — Subscriptions.planId missing cascade/restrict [HIGH]
**File:** `src/db/schema/subscriptions.ts:24-26`

```typescript
planId: uuid('plan_id').references(() => plans.id).notNull(),
// No onDelete clause — defaults to RESTRICT silently
```

Cannot archive or delete deprecated plans if any subscription references them. Need explicit `onDelete: 'restrict'` (make intent clear) or soft-delete pattern on plans.

---

### D6 — Usage records missing onDelete [HIGH]
**File:** `src/db/schema/usage-records.ts`

- `subscriptionId` (line 21) — no `onDelete` clause
- `billedOnInvoiceId` (line 39) — no `onDelete` clause

Orphaned records if parent subscription/invoice deleted.

---

### D7 — Soft-delete filtering inconsistencies [HIGH]
**Files:** Multiple

- `plans.isActive` and `flows.isActive` exist but **no queries filter by them** — inactive plans/flows may appear in selection lists
- Stripe webhook handlers don't check `clients.status` — webhook events for cancelled clients still processed
- `leads.optedOut` flag exists but no evidence all message-sending code checks it

---

### D8 — Denormalized coupon counter drift [MEDIUM]
**File:** `src/db/schema/coupons.ts:30`

`timesRedeemed` counter can diverge from actual subscription count through transaction failures, race conditions, or manual subscription deletions. No reconciliation cron exists.

---

### D9 — messagesSentThisMonth not reset [MEDIUM]
**File:** `src/db/schema/clients.ts:72`

No cron job resets this counter monthly. However, `process-scheduled/route.ts:21-28` does reset on 1st of month — **partially addressed** but only for clients with scheduled messages, not all clients.

---

### D10 — No row-level locking anywhere [MEDIUM]
Zero uses of `SELECT ... FOR UPDATE` or `SELECT ... FOR SHARE`. All concurrent operations rely on application-level checks vulnerable to TOCTOU races (see D2, D3, D4).

---

### D11 — updatedAt not consistently set [MEDIUM]
Some update operations skip `updatedAt`:
- `redeemCoupon()` in `coupon-validation.ts:90`
- Various webhook handlers updating subscription state

---

### D12 — Delete + re-insert pattern (business hours) [MEDIUM]
**File:** `src/app/api/business-hours/route.ts:71-85`

PUT handler deletes all business hours then inserts new ones. If insert fails after delete, client has no business hours. Should use transaction.

---

### D13 — No database audit trail for deletes [LOW]
Hard deletes on `businessHours`, `teamMembers`, `activeCalls` have no audit trail. For compliance/debugging, consider soft-delete or audit log entries.

---

### D14 — Timestamps not always set on creation [LOW]
Most tables have `defaultNow()` for `createdAt`, but a few update paths create records without explicit timestamps.

---

## 2. EXTERNAL API RESILIENCE

### E1 — No Stripe idempotency keys [CRITICAL]
**File:** `src/lib/services/subscription.ts`

All Stripe mutations lack idempotency keys:
- `stripe.subscriptions.create()` (line 99)
- `stripe.subscriptions.cancel()` (line 177)
- `stripe.subscriptions.update()` (line 238)
- Pause/resume operations

If a request times out but succeeds on Stripe, retries create duplicate subscriptions or charges. **Direct revenue impact.**

**Fix:** Pass `idempotencyKey: crypto.randomUUID()` or derive from `clientId + planId + timestamp`.

---

### E2 — No Stripe subscription reconciliation [CRITICAL]
**Files:** No cron exists for this

If a Stripe webhook fails (server down during webhook delivery), the local DB diverges from Stripe permanently. No periodic reconciliation job exists to detect discrepancies.

**Scenario:** `customer.subscription.deleted` webhook fails → local DB shows `active` → client gets free access indefinitely.

**Fix:** Daily cron that fetches all Stripe subscriptions and compares with local `subscriptions` table, logging discrepancies.

---

### E3 — No Twilio SMS retry logic [CRITICAL]
**File:** `src/lib/services/twilio.ts:27-39`

`sendSMS()` has a simple try/catch that re-throws on failure. No retry, no exponential backoff. Failed messages are permanently lost.

Used in 10+ automations (missed-call, incoming-sms, form-response, payment-reminder). A Twilio transient error drops all customer communications.

**Fix:** 3-attempt retry with exponential backoff (pattern exists in `webhook-dispatch.ts:54-86`).

---

### E4 — Stripe payment webhook no deduplication [HIGH]
**File:** `src/app/api/webhooks/stripe/route.ts:38-90`

Subscription events check `stripeEventId` for duplicates (lines 176-181). But `checkout.session.completed` has **no dedup check**. Stripe retries → duplicate payment confirmations, duplicate SMS to customers.

**Fix:** Check `billingEvents.stripeEventId` before processing payment events, same pattern as subscription events.

---

### E5 — OpenAI no timeout or retry [HIGH]
**File:** `src/lib/services/openai.ts:139-148`

Direct `await openai.chat.completions.create()` with no timeout, retry, or backoff. OpenAI rate limits (60 RPM for gpt-4o-mini) not handled. Called for every inbound SMS.

**Impact:** AI responses fail silently during outages or rate limit hits. Leads receive no response.

---

### E6 — Google token refresh failure unhandled [HIGH]
**File:** `src/lib/services/google-business.ts:147-178`

`refreshGoogleToken()` throws on failure — no retry, no fallback, no client notification. Review responses silently stop working when token expires.

---

### E7 — Twilio SMS webhook no deduplication [HIGH]
**File:** `src/app/api/webhooks/twilio/sms/route.ts:12-82`

No check for duplicate `MessageSid`. Twilio retries on 5xx → same SMS processed twice → duplicate AI responses, doubled message counts.

---

### E8 — Process-scheduled marks sent before delivery confirmed [HIGH]
**File:** `src/app/api/cron/process-scheduled/route.ts:30-153`

Messages marked `sent: true` in DB before Twilio confirms delivery. If Twilio call times out but succeeds, message sent but DB status wrong. If Twilio fails, message marked sent but never delivered.

---

### E9 — Missing Stripe webhook events [HIGH]
**File:** `src/app/api/webhooks/stripe/route.ts`

Not handled:
- `invoice.payment_action_required` — 3D Secure failures not tracked
- `customer.subscription.paused` / `resumed` — status changes not reflected
- `charge.dispute.created` / `closed` — chargebacks not tracked

---

### E10 — No Twilio rate limit handling [MEDIUM]
No detection of 429 status codes from Twilio. Cron job processes 50 scheduled messages in rapid succession without throttling.

---

### E11 — No OpenAI rate limit handling [MEDIUM]
No catch for 429 errors from OpenAI. High-traffic clients (10+ inbound SMS/minute) can exhaust rate limits.

---

### E12 — Resend email no retry [MEDIUM]
**File:** `src/lib/services/resend.ts:28-34`

Returns `{ success: false }` without retry. Magic link emails, daily summaries, and escalation alerts fail permanently on transient errors.

---

### E13 — ElevenLabs TTS no error recovery [MEDIUM]
**File:** `src/lib/services/elevenlabs.ts:70-104`

Voice AI features (hot transfer greetings, voicemail) break with no graceful degradation to text-only.

---

### E14 — Cron daily summary no partial failure recovery [LOW]
**File:** `src/lib/services/daily-summary.ts:167-193`

Processes clients sequentially. If cron crashes mid-run, no resume mechanism. Rerunning sends duplicates to already-processed clients.

---

### E15 — No global OTP rate limit [LOW]
**File:** `src/lib/services/otp.ts:344-370`

Per-identifier rate limit exists (15 min window), but no global rate limit. Attacker can spam different phone numbers → SMS cost abuse.

---

## 3. LEGACY MIGRATION BLOCKERS

### L1 — Legacy teamMembers table still actively used [HIGH]
**Status:** 8 files still reference `teamMembers` table

The new access management system (SPEC-01 through SPEC-06) introduced `people`, `clientMemberships`, and `agencyMemberships` tables. But the legacy `teamMembers` table is still actively used in:

| File | Usage |
|------|-------|
| `src/app/api/team-members/route.ts` | Full CRUD (GET, POST, DELETE) |
| `src/app/api/team-members/[id]/route.ts` | PATCH, DELETE |
| `src/app/api/escalations/[id]/route.ts` | Assignee lookup |
| `src/app/api/claims/claim/route.ts` | Claim assignment |
| `src/app/api/webhooks/twilio/ring-connect/route.ts` | Call routing |
| `src/app/api/webhooks/twilio/member-answered/route.ts` | Call answered |
| `src/app/api/admin/clients/[id]/stats/route.ts` | Team count |
| `src/app/api/admin/reports/route.ts` | Team metrics |

These routes use `auth()` + basic session checks (not the new permission system). **Team member management bypasses the new RBAC system entirely.**

**Risk:** Dual system creates confusion — changes in one aren't reflected in the other. Call routing and escalation still depend on the legacy table.

---

### L2 — business-hours route uses old auth pattern [HIGH]
**File:** `src/app/api/business-hours/route.ts`

Still uses `session?.user?.isAdmin` (line 53). Not migrated to `requireAgencyPermission()`.

---

### L3 — TODOs indicating incomplete features [MEDIUM]
**Files:**

| File | TODO | Impact |
|------|------|--------|
| `src/lib/services/review-monitoring.ts:54` | "Add Yelp, Facebook, etc." | Review monitoring only works for Google |
| `src/lib/services/agency-communication.ts:427` | "Trigger follow-up sequences for specified leadIds" | Action prompts don't actually trigger follow-ups |
| `src/lib/services/agency-communication.ts:431` | "Create escalation entry for callback" | Callback scheduling is a no-op |

---

## 4. BUSINESS LOGIC GAPS

### B1 — Cancellation flow has no Stripe integration [MEDIUM]
**File:** `src/lib/services/cancellation.ts`

The cancellation flow (initiate → scheduled call → save/cancel) manages DB state but never calls `stripe.subscriptions.cancel()`. The Stripe subscription continues charging even after `confirmCancellation()` marks the request as `cancelled`.

---

### B2 — ROI calculation uses hardcoded assumptions [MEDIUM]
**File:** `src/lib/services/cancellation.ts:45-46`

```typescript
const estimatedRevenue = Math.round(totalLeads * 0.1 * 3000);
const monthlyCost = 997;
```

10% conversion rate, $3000 average job value, and $997/month cost are all hardcoded. Should pull from client settings or plan pricing.

---

### B3 — Team member deletion has no cascading cleanup [LOW]
**File:** `src/app/api/team-members/route.ts:108-130` and `[id]/route.ts:58-78`

Deleting a team member doesn't:
- Reassign their open escalation claims
- Update call routing priorities
- Notify the client

Escalation lookups (escalations/[id]/route.ts:47-52) will return `null` for deleted assignees.

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
| B1 | Integrate Stripe cancellation into cancellation flow | 4 hours |
| B2 | Pull ROI assumptions from client/plan settings | 2 hours |
| L3 | Address or remove stale TODOs | 4 hours |

### Phase 4: Low — Hardening (as time permits)

| ID | Fix | Effort |
|----|-----|--------|
| D13 | Add audit trail for hard deletes | 1 day |
| D14 | Audit all creation paths for timestamp consistency | 2 hours |
| E14 | Add cron idempotency (skip already-processed clients) | 4 hours |
| E15 | Add global OTP rate limit | 2 hours |
| B3 | Add cascading cleanup on team member deletion | 4 hours |

---

## Positive Findings

These patterns are already well-implemented:

1. **Webhook retry dispatch** (`webhook-dispatch.ts:54-86`) — 3-attempt retry with exponential backoff for client webhooks
2. **Stripe subscription event dedup** (`stripe/route.ts:176-181`) — checks `stripeEventId`
3. **Missed call dedup** (`missed-call.ts:54-68`) — checks `CallSid` before sending
4. **Compliance gateway** (`compliance-gateway.ts`) — opt-out, DNC, consent, quiet hours
5. **Client soft-delete** — uses `status = 'cancelled'` instead of hard delete
6. **Cascading FKs** — 73 of 76 foreign keys have proper onDelete clauses
7. **Zod validation** — all API routes validate input with Zod schemas
8. **Monthly message reset** — process-scheduled cron resets on 1st of month

---

## Testing Recommendations

1. **Concurrency testing:** Simulate concurrent coupon redemptions, escalation claims, OTP verifications
2. **Chaos testing:** Kill server mid-subscription-creation, verify cleanup
3. **Webhook replay:** Send duplicate Stripe/Twilio webhooks, verify dedup
4. **Rate limit testing:** Burst 100 SMS in 10 seconds, verify backoff
5. **Token expiry:** Force Google OAuth token expiry, verify refresh + notification
6. **Cron crash recovery:** Kill daily-summary mid-run, verify idempotent resume
