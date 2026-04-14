# Cross-Domain System Audit — Complete Issue Register

**Date:** 2026-04-13
**Method:** Pattern-based failure analysis — applied the same failure categories found in AI domains (timezone errors, stale state, race conditions, missing feedback loops, silent failures, state divergence, missing validation, missing acknowledgments) across ALL non-AI domains.
**Companion:** `2026-04-13-ai-audit-issues.md` (13 AI issues), `2026-04-13-scenario-simulation.md` (10 simulation issues)

---

## Summary

| Domain | Issues Found | Critical | High | Medium | Low |
|--------|-------------|----------|------|--------|-----|
| Billing & Stripe | 34 | 3 | 8 | 14 | 9 |
| Calendar | 8 | 0 | 5 | 2 | 1 |
| Onboarding | 5 | 1 | 1 | 2 | 1 |
| Review Monitoring | 7 | 0 | 2 | 4 | 1 |
| Reporting | 6 | 0 | 0 | 3 | 3 |
| Team & Escalation | 8 | 0 | 3 | 3 | 2 |
| Cron Orchestrator | 6 | 0 | 0 | 4 | 2 |
| Lead Import | 4 | 0 | 1 | 2 | 1 |
| Security | 3 | 0 | 1 | 1 | 1 |
| **Total** | **81** | **4** | **21** | **35** | **21** |

---

## Critical Issues (Fix Before First Client)

### XDOM-01: Stripe Idempotency Keys Defeated by Date.now() (B5)

**Domain:** Billing
**File:** `src/lib/services/subscription.ts:118,355,361,429,485,519`
**Impact:** Retried API calls (network timeout, server restart) create DUPLICATE Stripe subscriptions. Client gets billed twice.

Idempotency keys include `Date.now()`, making them unique on every call:
```typescript
idempotencyKey: `sub_create_${clientId}_${planId}_${interval}_${Date.now()}`
```
Same pattern at 6 locations across the file.

**Fix:** Remove `Date.now()` from all idempotency keys. Use deterministic keys: `sub_create_${clientId}_${planId}_${interval}`.

---

### XDOM-02: No Service Degradation on Payment Failure (B33)

**Domain:** Billing
**File:** `src/lib/compliance/compliance-gateway.ts` + all automations
**Impact:** Client with `past_due` subscription receives FULL service — all automations run, all AI responds, all messages send. Free service for weeks until Stripe exhausts retries and cancels.

No automation or gateway checks subscription status before operating. `hasFeatureAccess()` in `subscription.ts:576` correctly blocks `past_due`, but is NOT called by compliance gateway or any automation.

**Fix:** Add subscription status check to compliance gateway's critical path. When `past_due`: allow inbound replies (don't ghost homeowners), block proactive outreach (don't send automations at no cost).

---

### XDOM-03: No Contractor Notification on Payment Failure (B34)

**Domain:** Billing
**File:** `src/app/api/webhooks/stripe/route.ts:202`
**Impact:** When `invoice.payment_failed` fires, only an invoice record is synced. No SMS, email, or in-app notification to the contractor. They don't know their payment failed until service eventually stops.

**Fix:** On `invoice.payment_failed`: SMS contractor with "Your payment for ConversionSurgery didn't go through. Please update your card at [portal link] to keep your leads protected."

---

### XDOM-04: Autonomous AI with Empty KB After Onboarding (B3-Onboarding)

**Domain:** Onboarding
**File:** `src/lib/automations/ai-mode-progression.ts:131-165`
**Impact:** Quality gates only checked for `off → assist` transition. `assist → autonomous` transition only checks flagged conversations, NOT quality gates. A contractor who deletes all KB entries after reaching `assist` mode gets promoted to `autonomous` with zero knowledge. AI then hallucinates or gives generic responses to every homeowner.

**Fix:** Re-evaluate quality gates on EVERY progression check, not just `off → assist`. Add regression detection: if KB entries drop below threshold while in `autonomous`, regress to `assist` and alert operator.

---

## High-Severity Issues (Fix in First 30 Days)

### Billing Domain

| ID | Issue | File | Description |
|----|-------|------|-------------|
| XDOM-05 | B2 | `route.ts:345,379,454,516,543` | 5 webhook handlers lack dedup — duplicate billing events/emails on Stripe retries |
| XDOM-06 | B3 | `route.ts:75` | Missing checkout metadata silently skips subscription provisioning — Stripe charges but no local record |
| XDOM-07 | B4 | `route.ts:317-342` | Missing clientId on subscription deletion leaves client `active` after cancellation |
| XDOM-08 | B8 | `subscription.ts:197-208` | Compensating Stripe cancel failure only logs to console — orphaned subscription charges client |
| XDOM-09 | B10 | `payment-reminder.ts:87-109` | Stripe outage sends reminders with no payment link, no retry, no notification |
| XDOM-10 | B11 | `payment-reminder.ts:127,133` | Payment reminders scheduled in server timezone — 2am delivery for PST clients |
| XDOM-11 | B23 | `route.ts:214-220` | `trial_will_end` webhook only logs — no contractor notification before billing starts |
| XDOM-12 | B25 | `cancellation-reminders.ts:81` | Grace-period reminders query wrong status — confirmed cancellations get zero reminders |

### Calendar Domain

| ID | Issue | File | Description |
|----|-------|------|-------------|
| XDOM-13 | A2 | `calendar/index.ts:35, google-calendar.ts:193` | Hardcoded `America/New_York` timezone fallback — events shifted 1-3 hours for Alberta clients |
| XDOM-14 | A3 | `appointment-booking.ts:81,157-197` | Slot generation ignores client timezone — available slots truncated for later timezones |
| XDOM-15 | A4/A5 | `calendar/index.ts:150,239` | Calendar sync errors swallowed — events silently lost with no retry or notification |
| XDOM-16 | A7 | `google-calendar.ts:353-459` | Google Calendar event changes (cancel/move) never notify homeowner |
| XDOM-17 | A5 | `appointment-booking.ts:561-573` | Calendar event creation on booking is fire-and-forget — empty catch block |

### Team & Escalation Domain

| ID | Issue | File | Description |
|----|-------|------|-------------|
| XDOM-18 | E-RACE-01/02 | `escalation.ts:334-339,365-371` | Escalation assignment/takeover has no atomic guard — concurrent claims silently overwrite |
| XDOM-19 | E-STATE-01 | `client/team/[id]/route.ts:221-225` | Team member removal orphans active escalations — SLA clock ticks with no one to act |
| XDOM-20 | E-FEEDBACK-01 | `ring-group.ts:64` | `ring-status` callback URL references non-existent route — Twilio 404s on status updates |

### Other Domains

| ID | Issue | File | Description |
|----|-------|------|-------------|
| XDOM-21 | C1 | `auto-review-response.ts:9,71` | 3-star reviews auto-approved — neutral/negative reviews get canned "thank you" posted publicly |
| XDOM-22 | C4 | `review-monitoring.ts:64-130` | Negative review alerts are batch-based, not triggered on sync — 1-star reviews can sit unnoticed for hours |
| XDOM-23 | G-VALID-01 | `leads/import/route.ts:143-155` | CASL consent attestation not persisted to database — no record that imported leads have consent |
| XDOM-24 | H-VALID-01 | `webhooks/jobber/route.ts:84` | Webhook signature check is conditional — no secret key = no auth = accepts arbitrary payloads |

---

## Medium-Severity Issues

### Billing (14 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-25 | B1 | Missing webhook handlers: invoice.finalized, invoice.voided, payment_method.detached |
| XDOM-26 | B6 | Plan downgrade doesn't reset message counter — immediately blocks client |
| XDOM-27 | B7 | Plan change races with subscription.updated webhook |
| XDOM-28 | B9 | Pause/resume not transactional between Stripe and local DB |
| XDOM-29 | B12 | No protection against concurrent duplicate payment reminder sequences |
| XDOM-30 | B13 | Guarantee monitor has no locking — concurrent runs create duplicate events |
| XDOM-31 | B14 | Backfill overwrites previously-applied extension adjustments |
| XDOM-32 | B15 | Guarantee progresses for past_due subscriptions |
| XDOM-33 | B18 | Monthly message reset uses UTC calendar month, not billing cycle |
| XDOM-34 | B19 | Message limit check and increment are not atomic — concurrent requests can exceed limit |
| XDOM-35 | B21 | Trial reminders use createdAt, not trialStart from Stripe |
| XDOM-36 | B22 | Trial reminder day calculation uses server timezone |
| XDOM-37 | B27 | Overage billing uses UTC months, not subscription billing periods |
| XDOM-38 | B28 | Overage charges applied to past_due subscriptions |

### Calendar (2 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-39 | A6 | 15-min sync interval creates staleness window for double-bookings |
| XDOM-40 | A8 | No circuit breaker for revoked Google Calendar tokens — fails every 15 min forever |

### Onboarding (2 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-41 | B2-Onb | AI progression is one-directional with no regression path |
| XDOM-42 | B4-Onb | Notification gap during onboarding — contractor doesn't know what steps remain |

### Review (4 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-43 | C2 | Review sync and auto-response can create duplicate draft responses |
| XDOM-44 | C3 | Google API errors return zero counts silently — broken sync looks like "no new reviews" |
| XDOM-45 | C5 | No locking on auto-post pipeline — concurrent runs can post duplicate Google responses |
| XDOM-46 | C7 | Google My Business v4 API deprecation will silently break review posting |

### Reporting (3 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-47 | D4 | Pre-delivery-record failures invisible to retry/alert system |
| XDOM-48 | D5 | Report period boundary uses UTC, not client timezone |
| XDOM-49 | D3 | Report data can become stale between generation and delivery |

### Team & Escalation (3 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-50 | E-RACE-03 | Re-notification `reNotifiedAt` written after SMS — cron overlap sends duplicates |
| XDOM-51 | E-STATE-02 | Deactivated member keeps escalation assignments with no reassignment |
| XDOM-52 | E-SILENT-01 | Ring group API failure notifies team of call that never rings |

### Cron (4 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-53 | F-RACE-01 | No concurrency guard on cron orchestrator — overlapping runs execute simultaneously |
| XDOM-54 | F-IDEMP-01 | SLA breach emails can duplicate on concurrent cron runs |
| XDOM-55 | F-CATCH-01 | Missed daily jobs (midnight cron) have no catch-up mechanism |
| XDOM-56 | F-STALE-01 | Embedding backfill has no claim lock — concurrent runs waste Voyage API calls |

### Lead Import (2 items)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-57 | G-VALID-02 | Imported estimate_sent leads trigger automation without consent check |
| XDOM-58 | G-VALID-03 | No import cooldown — automations fire immediately on freshly imported contacts |

### Security (1 item)

| ID | Issue | Description |
|----|-------|-------------|
| XDOM-59 | H-SEC-01 | Legacy portal sessions get full permissions with no person-level audit trail |

---

## Low-Severity Issues (21 items)

| ID | Domain | Description |
|----|--------|-------------|
| XDOM-60 | Billing | B1 — Missing payment_method.detached webhook |
| XDOM-61 | Billing | B16 — In-memory status update not reflected in sub object for downstream transitions |
| XDOM-62 | Billing | B17 — Guarantee extension factor only grows, never shrinks |
| XDOM-63 | Billing | B20 — Trial clients subject to same message limits as paying clients |
| XDOM-64 | Billing | B24 — Cancellation grace period uses server-local time |
| XDOM-65 | Billing | B26 — No guard against duplicate cancellation requests |
| XDOM-66 | Billing | B29 — No retry mechanism for any Stripe API calls |
| XDOM-67 | Billing | B30 — Payment link creation has no idempotency keys |
| XDOM-68 | Billing | B31 — Reconciliation is one-directional (local→Stripe only) |
| XDOM-69 | Billing | B32 — Reconciliation only checks status, not pricing/plan data |
| XDOM-70 | Calendar | A1 — Concurrent booking race (mitigated by DB unique index) |
| XDOM-71 | Onboarding | B1-Onb — Quality gates flip-flop with no hysteresis |
| XDOM-72 | Onboarding | B5-Onb — Quality snapshots stale between daily evaluations |
| XDOM-73 | Review | C6 — AI response generation can return empty string on failure |
| XDOM-74 | Reporting | D1 — Report generation has no transactional atomicity (well-designed fallback) |
| XDOM-75 | Reporting | D6 — Retry system well-designed (noted as positive) |
| XDOM-76 | Team | E-SILENT-02 — Infinite retry loop for orphaned escalation claims |
| XDOM-77 | Team | E-RACE-03 — Re-notification stage overlap at exactly 60 minutes |
| XDOM-78 | Cron | F-FEEDBACK-01 — Sequential dispatch where parallel possible |
| XDOM-79 | Cron | F-IDEMP-02 — Review alerts may duplicate on overlap |
| XDOM-80 | Security | H-SEC-02 — Unauthenticated claim endpoint (mitigated by 256-bit token) |
| XDOM-81 | Import | G3 — Well-handled (phone validation, noted as positive) |

---

## Well-Designed Systems (Positive Findings)

These areas were found to be well-engineered during the audit:

1. **Report retry system** (D6) — Exponential backoff, 3-attempt max, terminal alerting, dedup
2. **Lead import dedup** (G1) — In-batch Set dedup + DB existence check + unique constraint
3. **Phone normalization** (G3) — Try/catch with graceful skip on malformed numbers
4. **OTP security** (H5) — Rate limiting, constant-time comparison, atomic verification, anti-enumeration
5. **Admin route protection** (H1) — 100% coverage with auth wrappers
6. **Twilio webhook verification** (H2) — Consistent signature validation across all endpoints
7. **SQL injection prevention** (H3) — Drizzle ORM parameterization throughout
8. **Portal session security** (H4) — HMAC-signed cookies, session versioning, client scoping
9. **Cron error isolation** (F4) — Per-job try/catch, failures don't block other jobs
10. **Escalation claiming** (E1) — Atomic UPDATE with status check for team-escalation claims

---

## Priority Execution Recommendation

### Pre-Launch (Critical)

| ID | Effort | Issue |
|----|--------|-------|
| XDOM-01 | Small | Remove Date.now() from 6 idempotency keys |
| XDOM-02 | Medium | Add subscription status check to compliance gateway |
| XDOM-03 | Small | Add contractor SMS on payment failure webhook |
| XDOM-04 | Medium | Re-evaluate quality gates on every AI progression check |

### First 30 Days (High)

| ID | Effort | Issue |
|----|--------|-------|
| XDOM-05 | Small | Add dedup to 5 webhook handlers |
| XDOM-06 | Small | Alert on missing checkout metadata |
| XDOM-07 | Small | Guard subscription deletion without clientId |
| XDOM-10 | Small | Timezone-aware payment reminders |
| XDOM-11 | Small | Contractor notification on trial_will_end |
| XDOM-13/14 | Medium | Calendar timezone fixes (remove New York default) |
| XDOM-15/17 | Medium | Calendar error handling + retry |
| XDOM-16 | Medium | Notify homeowner on Google Calendar changes |
| XDOM-18 | Small | Atomic guard on escalation assignment/takeover |
| XDOM-19 | Medium | Reassign escalations on team member removal |
| XDOM-21 | Small | Change positive threshold from 3 to 4 |
| XDOM-23 | Medium | Persist CASL consent for imported leads |
| XDOM-24 | Small | Make Jobber webhook signature required |

### Post-Launch (Medium)

All XDOM-25 through XDOM-59.

---

## Cross-Reference to Existing Plans

| Issue | Belongs In |
|-------|-----------|
| XDOM-01 through XDOM-03 | **New Plan 5: Billing Critical Fixes** |
| XDOM-04 | **Plan 3: Scenario Gaps** (extend onboarding task) |
| XDOM-05 through XDOM-12 | **New Plan 6: Billing Hardening** |
| XDOM-13 through XDOM-17 | **New Plan 7: Calendar Reliability** |
| XDOM-18 through XDOM-20 | **New Plan 8: Team & Escalation Fixes** |
| XDOM-21 through XDOM-22 | **New Plan 9: Review Monitoring Fixes** |
| XDOM-23 through XDOM-24 | **New Plan 10: Security & Compliance Fixes** |
| XDOM-25+ | Backlog — address as encountered |
