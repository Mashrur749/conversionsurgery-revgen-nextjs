# Feature Gaps — Execution Reference

Gaps where code is partially built but missing a key piece to work end-to-end.
Discovered via full codebase audit (Feb 2026), updated Feb 14 with post-fix audit.
This document contains exact file paths, function signatures, and schema references
so execution requires zero re-research.

**Status**: 14 of 20 gaps FIXED, 2 FALSE POSITIVES, 4 OPEN (GAP-17, 18, 19, 20)

---

## CRITICAL

### ~~GAP-01: 10 Cron Jobs Never Triggered~~ [FIXED]

The master orchestrator at `src/app/api/cron/route.ts` (POST handler, authenticated via `cf-cron` header from Cloudflare) dispatches 7 jobs based on time conditions. `wrangler.toml` only has 2 cron triggers:

```toml
[triggers]
crons = [
  "*/5 * * * *",   # Every 5 minutes → POST /api/cron
  "0 7 * * 1"      # Monday 7am UTC → POST /api/cron
]
```

**Jobs the orchestrator DOES dispatch:**

| Job | Function | Import | Condition |
|-----|----------|--------|-----------|
| Process scheduled | `fetch('/api/cron/process-scheduled')` | via HTTP | Every 5 min (always) |
| Usage tracking | `updateMonthlySummaries()` + `checkAllClientAlerts()` | `@/lib/services/usage-tracking` + `usage-alerts` | Hourly (minute < 10) |
| SLA breach check | `checkSlaBreaches()` | `@/lib/services/escalation` | Hourly (minute < 10) |
| Review sync | `syncAllReviews()` + `checkAndAlertNegativeReviews()` | `@/lib/services/review-monitoring` | Hourly (minute < 10) |
| Lead scoring | `scoreClientLeads()` | `@/lib/services/lead-scoring` | Daily (hour=0, minute < 10) |
| Analytics | `runDailyAnalyticsJob()` | `@/lib/services/analytics-aggregation` | Daily (hour=0, minute < 10) |
| Weekly summary | `fetch('/api/cron/weekly-summary')` | via HTTP | Monday (day=1, hour=7, minute < 10) |

**10 cron endpoints that NOTHING calls:**

| # | Endpoint | Method | Function | Import | Auth | Ideal Frequency |
|---|----------|--------|----------|--------|------|-----------------|
| 1 | `/api/cron/trial-reminders` | POST | `processTrialReminders()` | `@/lib/services/trial-reminders` | `verifyCronSecret()` | Daily |
| 2 | `/api/cron/send-nps` | POST | `sendPendingNpsSurveys()` | `@/lib/services/nps-survey` | `verifyCronSecret()` | Every 4 hours |
| 3 | `/api/cron/auto-review-response` | POST | `autoGenerateReviewDrafts()` + `autoPostApprovedResponses()` | `@/lib/automations/auto-review-response` | `verifyCronSecret()` | Every 30 min |
| 4 | `/api/cron/daily-summary` | GET | `processDailySummaries()` | `@/lib/services/daily-summary` | `verifyCronSecret()` | Daily 7am |
| 5 | `/api/cron/daily` | GET | `runDailyAnalyticsJob()` | `@/lib/services/analytics-aggregation` | `verifyCronSecret()` | Daily (DUPLICATE of orchestrator job) |
| 6 | `/api/cron/agency-digest` | GET | `processAgencyWeeklyDigests()` | `@/lib/services/agency-communication` | `verifyCronSecret()` | Weekly |
| 7 | `/api/cron/check-missed-calls` | GET | `handleMissedCall()` | `@/lib/automations/missed-call` | `verifyCronSecret()` | Every 10 min |
| 8 | `/api/cron/no-show-recovery` | GET | `processNoShows()` | `@/lib/automations/no-show-recovery` | Manual Bearer check | Daily |
| 9 | `/api/cron/win-back` | GET | `processWinBacks()` | `@/lib/automations/win-back` | Manual Bearer check | Daily 10am |
| 10 | `/api/cron/expire-prompts` | GET | `expirePendingPrompts()` | `@/lib/services/agency-communication` | `verifyCronSecret()` | Every hour |

**Additional issues found:**
- `/api/cron/daily` (#5) is a duplicate — the orchestrator already calls `runDailyAnalyticsJob()` directly
- `/api/cron/calendar-sync` and `/api/cron/agent-check` (GET) also exist and aren't in the orchestrator, but calendar-sync is called from the master via the hourly block and agent-check runs on its own schedule
- Auth is inconsistent: routes 8-9 use manual Bearer check instead of `verifyCronSecret()`

**Fix approach**: Add time-based dispatch to the master orchestrator for all 10 orphaned endpoints. Group by frequency:
- Every 5 min: auto-review-response, check-missed-calls
- Hourly: expire-prompts, send-nps
- Daily (hour=0): trial-reminders, no-show-recovery
- Daily (hour=7): daily-summary
- Daily (hour=10): win-back
- Weekly (day=1): agency-digest
- Remove `/api/cron/daily` (duplicate)

**Effort**: S — edit `src/app/api/cron/route.ts` only, add fetch calls with time conditions

---

## HIGH

### ~~GAP-02: Overage Pricing Not Operationalized~~ [FIXED]

**What exists:**

Schema — `src/db/schema/plans.ts` lines 33-43:
```typescript
features: jsonb('features').$type<{
  maxLeadsPerMonth: number | null;
  maxTeamMembers: number | null;
  maxPhoneNumbers: number;
  // ... boolean feature flags
}>()
```

Schema — `src/db/schema/subscriptions.ts`:
- `additionalLeadsCents: integer('additional_leads_cents').default(0)`
- `additionalSmsCents: integer('additional_sms_cents').default(0)`

Detection — `src/lib/billing/queries.ts` line 167:
```typescript
const leadsOverage = features.maxLeadsPerMonth
  ? Math.max(0, usage.totalLeads - features.maxLeadsPerMonth)
  : 0;
```

UI — `src/components/billing/UsageDisplay.tsx` lines 47-51:
```typescript
{usage.leads.overage > 0 && (
  <Alert variant="destructive">
    You have {usage.leads.overage} overage leads this period.
    Consider upgrading your plan for more capacity.
  </Alert>
)}
```

Admin form — `src/app/(dashboard)/admin/billing/plans/plan-list.tsx` lines 88-98:
Only submits `maxLeadsPerMonth`, `maxTeamMembers`, `maxPhoneNumbers` — no overage pricing fields.

**What's missing:**
1. No overage price fields on plans (e.g., `overagePerLeadCents`, `overagePerSmsCents`)
2. No hard cap vs soft cap toggle (should system block at limit or allow + charge?)
3. No billing logic to calculate overage charges on invoices
4. No admin UI fields for overage pricing in plan-list.tsx

**Fix approach:**
- Extend `plans.features` JSONB type with: `overagePerLeadCents?: number`, `overagePerSmsCents?: number`, `allowOverages?: boolean`
- Add form fields to `plan-list.tsx`
- Add overage charge calculation in billing queries or invoice generation
- Wire `checkUsageLimit()` (GAP-10) to enforce hard caps when `allowOverages=false`

**Effort**: M — schema type change + UI + billing logic

---

### ~~GAP-03: Coupons System Non-Functional~~ [FIXED]

**What exists:**

Schema — `src/db/schema/coupons.ts`:
```
coupons table: id, code (unique), name, discountType (varchar 20),
discountValue (int), duration ('once' default), durationMonths,
maxRedemptions, timesRedeemed (default 0), validFrom, validUntil,
applicablePlans (jsonb string[]), minAmountCents, firstTimeOnly (bool),
stripeCouponId (varchar 100), isActive (bool, default true), createdAt
```

Schema — `src/db/schema/subscriptions.ts`:
- `discountPercent: integer('discount_percent')`
- `discountEndsAt: timestamp('discount_ends_at')`
- `couponCode: varchar('coupon_code', { length: 50 })`

Service — `src/lib/services/subscription.ts`:
`createSubscription(clientId, planId, interval?, couponCode?)` accepts a coupon code parameter.

**What's missing:**
1. No admin API routes for coupon CRUD
2. No admin UI to create/manage coupons
3. No coupon validation logic (check code exists, not expired, max redemptions, applicable plans)
4. No Stripe coupon sync
5. No way to apply coupon during subscription creation from UI

**Fix approach:**
- API: `GET/POST /api/admin/coupons`, `PATCH/DELETE /api/admin/coupons/[id]`
- UI: `/admin/billing/coupons` page with CRUD
- Validation service: `validateCoupon(code, planId, clientId)` checking all constraints
- Wire into subscription creation flow and billing upgrade page

**Effort**: M — CRUD page + validation service + Stripe sync

---

### ~~GAP-04: Client Cohort Analysis Never Populated~~ [FIXED]

**What exists:**

Schema — `src/db/schema/client-cohorts.ts`:
```
client_cohorts table: id, clientId (unique FK), cohortMonth (varchar 7,
e.g. "2024-01"), month1Active, month2Active, month3Active, month6Active,
month12Active (all boolean), month1RevenueCents, month3RevenueCents,
month6RevenueCents, month12RevenueCents, lifetimeRevenueCents (default 0),
createdAt
```
Index on `cohortMonth`.

**What's missing:**
1. No cron job to populate monthly retention flags
2. No query service to aggregate cohort data
3. No admin UI to display cohort retention matrix
4. Table is empty — never written to

**Fix approach:**
- Cron: monthly job to scan all clients, set cohortMonth from client.createdAt, update retention flags based on activity
- Service: `updateCohortMetrics()` — check if client had activity in month N
- UI: `/admin/platform-analytics` — add cohort retention matrix (signup month rows × retention month columns)

**Effort**: M — cron job + query service + analytics UI component

---

### ~~GAP-05: Google Business OAuth — No Admin Management~~ [FIXED]

**What exists:**

Schema — `src/db/schema/clients.ts`:
- `googleAccessToken: varchar('google_access_token', { length: 500 })`
- `googleRefreshToken: varchar('google_refresh_token', { length: 500 })`
- `googleTokenExpiresAt: timestamp('google_token_expires_at')`
- `googleBusinessAccountId: varchar('google_business_account_id', { length: 100 })`
- `googleLocationId: varchar('google_location_id', { length: 100 })`

Service — `src/lib/services/google-business.ts`:
- `postResponseToGoogle(responseId)` — fetches review response + client, checks token, calls `refreshGoogleToken()` if expired, POSTs to `https://mybusiness.googleapis.com/v4/{reviewName}/reply`, updates response status
- `refreshGoogleToken(clientId, refreshToken)` (private) — POSTs to `https://oauth2.googleapis.com/token` using `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars, updates client record with new token

Service — `src/lib/services/google-places.ts`:
- `findGooglePlaceId(businessName, address?)` — calls Google Maps `/place/findplacefromtext/json`, returns Place ID string or null
- `syncGoogleReviews(clientId)` — fetches review sources for client, calls `fetchGooglePlaceDetails(placeId)`, upserts new reviews with sentiment mapping

**What's missing:**
1. No OAuth initiation endpoint (redirect to Google consent screen)
2. No OAuth callback handler (receive auth code, exchange for tokens, store on client)
3. No admin UI to show connection status per client (connected/expired/not connected)
4. No admin UI to disconnect or reconnect
5. `findGooglePlaceId()` exists but no API route exposes it (see GAP-13)

**Fix approach:**
- OAuth endpoints: `GET /api/admin/clients/[id]/google/connect` (redirect) + `GET /api/auth/callback/google-business` (callback)
- Admin UI: connection status badge on client detail, "Connect Google" button, "Disconnect" button
- Token health: add status indicator on `/admin/reputation` showing which clients have valid vs expired tokens

**Effort**: M — OAuth flow + admin UI components

**Dependencies**: `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars already referenced in code

---

### ~~GAP-06: Client Webhook Config — Schema Only~~ [FIXED]

**What exists:**

Schema — `src/db/schema/clients.ts`:
- `webhookUrl: varchar('webhook_url', { length: 500 })`
- `webhookEvents: jsonb('webhook_events')` default `["lead.created", "lead.qualified", "appointment.booked"]`

**What's missing:**
1. No admin UI to configure webhookUrl/webhookEvents per client
2. No webhook dispatch service (`dispatchWebhook(clientId, event, payload)`)
3. No calls to dispatch anywhere in automations (lead creation, qualification, booking, etc.)
4. No retry logic, no delivery tracking, no signature verification

**Fix approach:**
- Admin UI: add webhook config section to client edit form (URL input + event checkboxes)
- Service: `src/lib/services/webhook-dispatch.ts` — `dispatchWebhook(clientId, eventType, payload)` with retry (3 attempts), HMAC signature, timeout
- Wire into: `handleFormSubmission()`, `handleMissedCall()`, `bookAppointment()`, lead status changes
- Optional: log deliveries to `webhook_log` table (already exists)

**Effort**: M — service + UI + wiring into 4-5 automation points

---

## MEDIUM

### ~~GAP-07: Subscription Pause/Resume — No UI~~ [FALSE POSITIVE — Already wired in SubscriptionCard]

**What exists:**

Service — `src/lib/services/subscription.ts`:
- `pauseSubscription(subscriptionId, resumeDate?)` — pauses in Stripe, sets `pausedAt`/`resumesAt`, status='paused'
- `resumeSubscription(subscriptionId)` — resumes in Stripe, clears pause fields

Server actions — `src/lib/billing/actions.ts`:
- `pauseSubscription(clientId, resumeDate)` — wraps service, revalidates `/client/billing`
- `resumeSubscription(clientId)` — wraps service, revalidates `/client/billing`

Schema — `src/db/schema/subscriptions.ts`:
- `pausedAt: timestamp('paused_at')`
- `resumesAt: timestamp('resumes_at')`

**What's missing:** No UI button calls the server actions. Neither admin nor client billing pages have pause/resume buttons.

**Fix approach:**
- Add "Pause Subscription" button to `/client/billing` (with date picker for resume date)
- Add "Resume" button when status=paused
- Admin: add pause/resume buttons on `/admin/billing` subscription list

**Effort**: S — UI buttons calling existing server actions

---

### ~~GAP-08: Review Metrics — Collected but Not Displayed~~ [FIXED]

**What exists:**

Schema — `src/db/schema/review-metrics.ts`:
```
review_metrics table: id, clientId (FK), period ('daily'|'weekly'|'monthly'),
periodStart (date), periodEnd (date), totalReviews, averageRating (real),
fiveStarCount, fourStarCount, threeStarCount, twoStarCount, oneStarCount,
googleCount, yelpCount, positiveCount, neutralCount, negativeCount,
respondedCount, avgResponseTimeHours (real), createdAt
```
Unique constraint on `(clientId, period, periodStart)`.

Populated by `src/lib/services/review-monitoring.ts`.

**What's missing:** No UI anywhere displays this data. No charts, trends, or breakdowns.

**Fix approach:**
- Add metrics cards to `/admin/reputation` page: avg rating trend, response rate, star distribution chart
- Add per-client review metrics on `/admin/clients/[id]/reviews`
- Query: `SELECT * FROM review_metrics WHERE clientId = ? AND period = 'weekly' ORDER BY periodStart DESC LIMIT 12`

**Effort**: S — query + UI components on existing pages

---

### ~~GAP-09: Funnel Analytics — Events Tracked, No Visualization~~ [FIXED]

**What exists:**

Schema — `src/db/schema/funnel-events.ts`:
```
funnel_events table: id, clientId (FK), leadId (FK), eventType (varchar 50),
eventData (jsonb), valueCents (int), source (varchar 50), campaign (varchar 100),
createdAt
```
Indexes on `clientId`, `leadId`, `eventType`, `createdAt`.

Service — `src/lib/services/funnel-tracking.ts`:
- `trackFunnelEvent(params)` — base insert function
- `trackLeadCreated(clientId, leadId, source?)` → eventType: 'lead_created'
- `trackFirstResponse(clientId, leadId, responseTimeSeconds)` → eventType: 'first_response'
- `trackAppointmentBooked(clientId, leadId, appointmentDate?)` → eventType: 'appointment_booked'
- `trackJobWon(clientId, leadId, valueCents)` → eventType: 'job_won'
- `trackPaymentReceived(clientId, leadId, amountCents)` → eventType: 'payment_received'
- `trackReviewReceived(clientId, leadId, rating, platform)` → eventType: 'review_received'

Event types defined: `lead_created`, `first_response`, `qualified`, `appointment_booked`, `quote_requested`, `quote_sent`, `quote_accepted`, `job_won`, `job_lost`, `payment_received`, `review_requested`, `review_received`

**What's missing:** No UI to visualize the funnel. No conversion rate queries.

**Fix approach:**
- Query service: `getFunnelMetrics(clientId, dateRange)` — count events per type, calculate conversion rates between stages
- UI: horizontal funnel chart on `/analytics` and `/admin/platform-analytics` showing: Leads → Contacted → Appointment → Won with conversion % at each step
- Filter by date range, source, campaign

**Effort**: M — query service + funnel visualization component

---

### ~~GAP-10: Feature Access Gating — Never Enforced~~ [FIXED]

**What exists:**

Service — `src/lib/services/subscription.ts`:

```typescript
// lines 336-352
export async function hasFeatureAccess(
  clientId: string,
  feature: keyof PlanFeatures
): Promise<boolean>
// Checks subscription status is 'trialing' or 'active', then returns plan.features[feature]

// lines 357-382
export async function checkUsageLimit(
  clientId: string,
  usageType: 'leads' | 'team_members' | 'phone_numbers',
  currentCount: number
): Promise<{ allowed: boolean; limit: number | null; current: number }>
// Maps usageType to plan feature field, returns { allowed: limit === null || current < limit }
```

Plan features include: `includesVoiceAi`, `includesCalendarSync`, `includesAdvancedAnalytics`, `includesWhiteLabel`, `apiAccess`

**What's missing:** Neither function is called from any route. All clients get all features regardless of plan.

**Fix approach:**
- Gate premium features: add `hasFeatureAccess()` checks to:
  - Voice AI routes (`/api/webhooks/twilio/voice/ai/*`)
  - Calendar integration routes (`/api/calendar/*`)
  - API key routes (`/api/admin/api-keys`)
- Gate usage limits: add `checkUsageLimit()` to:
  - Lead creation (`POST /api/leads`)
  - Team member creation (`POST /api/team-members`)
  - Phone number purchase (`POST /api/admin/twilio/purchase`)
- Return 403 with upgrade prompt when access denied

**Effort**: S — add checks to ~8 route handlers

---

### ~~GAP-11: Invoice Operations — Service Functions Without Routes~~ [FIXED]

**What exists:**

Service — `src/lib/services/subscription-invoices.ts`:
- `syncInvoiceFromStripe(stripeInvoiceId)` — ✅ called from Stripe webhook
- `getClientSubscriptionInvoices(clientId, options?)` — query invoices with filters (status, date range, limit)
- `retryInvoicePayment(invoiceId)` — retries via Stripe API, then syncs updated invoice
- `getUpcomingInvoice(clientId)` — calls `stripe.invoices.createPreview()` for next invoice preview

**What's missing:**
- `retryInvoicePayment()` — no API route, no "Retry" button on billing UI
- `getUpcomingInvoice()` — no API route, no upcoming invoice display

**Fix approach:**
- API: `POST /api/client/billing/invoices/[id]/retry` calling `retryInvoicePayment()`
- API: `GET /api/client/billing/upcoming` calling `getUpcomingInvoice()`
- UI: add "Retry Payment" button on failed invoices in billing page
- UI: add "Upcoming Invoice" card showing next bill amount and date

**Effort**: S — 2 routes + 2 UI elements

---

### ~~GAP-12: Subscription Creation — No Entry Point~~ [FIXED]

**What exists:**

Service — `src/lib/services/subscription.ts`:
- `createSubscription(clientId, planId, interval?, couponCode?)` — creates Stripe subscription + local DB record

Stripe webhook — `src/app/api/webhooks/stripe/route.ts`:
- Handles `customer.subscription.created` → calls `handleSubscriptionUpdate()` which upserts to subscriptions table
- But `createSubscription()` is the intended entry point for NEW subscriptions

**What's missing:** No API route or admin action calls `createSubscription()`. New subscriptions may only be created if the Stripe webhook fires from an external Stripe Checkout session.

**Fix approach:**
- Determine flow: does admin create subscriptions for clients, or do clients self-subscribe?
- Admin flow: add "Create Subscription" on client detail page → calls `createSubscription()` → Stripe handles billing
- Client flow: billing upgrade page at `/client/billing/upgrade` should call `createSubscription()` for new subscriptions (vs `changePlan()` for existing)

**Effort**: S — wire existing function to upgrade page or admin action

---

### ~~GAP-13: Google Place ID Search — No Setup Flow~~ [FIXED]

**What exists:**

Service — `src/lib/services/google-places.ts`:
```typescript
findGooglePlaceId(businessName: string, address?: string): Promise<string | null>
// Calls Google Maps /place/findplacefromtext/json
// Returns Place ID or null
```

Currently review source setup at `/admin/clients/[id]/reviews` requires manually entering a Google Place ID.

**What's missing:** No API route to search for Place IDs. Admin must find the ID externally.

**Fix approach:**
- API: `GET /api/admin/clients/[id]/reviews/google-search?q=businessName` calling `findGooglePlaceId()`
- UI: add search input on review source creation form — type business name, get suggestions, select to auto-fill Place ID

**Effort**: S — 1 route + search input component

---

## LOW

### ~~GAP-14: Message Counter Possibly Stale~~ [FALSE POSITIVE — Compliance gateway increments, process-scheduled resets monthly]

**Where**: `src/db/schema/clients.ts` — `messagesSentThisMonth: integer('messages_sent_this_month').default(0)`

**Issue**: Daily stats use the `daily_stats` table instead. This field may not be consistently incremented. Usage tracking in `src/lib/billing/queries.ts` reads from `usage_records` table, not this field.

**Fix**: Either wire counter into SMS send path, or remove the field and rely exclusively on `usage_records` / `daily_stats`.

### ~~GAP-15: isTest Flag — Defined, Never Enforced~~ [FIXED]

**Where**: `src/db/schema/clients.ts` — `isTest: boolean('is_test').default(false)`

**Issue**: No code checks this flag. Test clients send real SMS, consume real API credits, appear in aggregate metrics.

**Fix**: Add `isTest` check to SMS sending (skip Twilio for test clients) and analytics aggregation (exclude from platform metrics).

### ~~GAP-16: Cancellation Reason — Partially Captured~~ [FALSE POSITIVE — subscription.ts:167 stores cancelReason]

**Where**: `src/db/schema/subscriptions.ts` — `cancelReason: text('cancel_reason')`

**Flow**: `src/app/(client)/client/cancel/cancellation-flow.tsx` collects `reason` (from predefined list) and `feedback` (free text), POSTs to `/api/client/cancel`.

**Issue**: Need to verify that the cancel API route stores `reason` in `subscriptions.cancelReason`. The field exists and the UI collects it — the wiring may or may not be complete.

### GAP-17: Orphaned Utility Functions [OPEN — cleanup or wire]

These functions exist but are never called from anywhere:

| Function | File | Verdict |
|----------|------|---------|
| `getStepMessage()` | `src/lib/services/flow-resolution.ts` | Dead code — delete |
| `formatDelay()` | `src/lib/services/flow-resolution.ts` | Dead code — separate copy in `sequence-view.tsx` is used instead. Delete. |
| `getSignedDownloadUrl()` | `src/lib/services/storage.ts` | Dead code — rest of storage.ts IS used by media.ts, but this function is not. Delete. |
| `createSetupIntent()` | `src/lib/services/payment-methods.ts` | Needed for "Add Payment Method" flow, but requires Stripe Elements frontend (not built). Keep if Stripe Elements planned, otherwise delete. |

**Fix**: Delete `getStepMessage`, `formatDelay`, `getSignedDownloadUrl`. Keep `createSetupIntent` only if Stripe Elements frontend is planned.

**Effort**: S — delete dead functions

---

### GAP-18: Coupon Validation Not Wired to Checkout [OPEN]

**What exists:**

- Service — `src/lib/services/coupon-validation.ts`:
  - `validateCoupon(code, planId, clientId)` — checks coupon exists, is active, not expired, within redemption limit, applicable to plan, first-time-only constraint
- Schema — `src/db/schema/coupons.ts` — full coupon table with all fields
- Admin UI — `/admin/billing/coupons` — full CRUD for creating/managing coupons
- Service — `src/lib/services/subscription.ts`:
  - `createSubscription(clientId, planId, interval?, couponCode?)` — accepts coupon param but **never validates it**

**What's missing:**
1. `createSubscription()` accepts `couponCode` but never calls `validateCoupon()` — invalid/expired codes are silently accepted
2. No coupon code input field on any checkout/upgrade UI
3. No Stripe coupon sync — `stripeCouponId` field is never populated

**Fix approach:**
- Call `validateCoupon()` inside `createSubscription()` before Stripe API call
- Add coupon code input to client billing upgrade page
- Create Stripe coupon when admin creates a local coupon (or sync on first use)

**Severity**: HIGH — coupons can be created but never validated or applied correctly
**Effort**: S — wire validation + add UI input

---

### GAP-19: Webhook Dispatch — `lead.qualified` Event Never Fired [OPEN]

**What exists:**

- Client schema defaults support 3 events: `["lead.created", "lead.qualified", "appointment.booked"]`
- `dispatchWebhook()` is called from:
  - `form-response.ts` → `lead.created` ✅
  - `missed-call.ts` → `lead.created` ✅
  - `appointment-booking.ts` → `appointment.booked` ✅

**What's missing:**
- `lead.qualified` event is never dispatched — no code calls `dispatchWebhook(*, 'lead.qualified', *)`
- Lead qualification happens in `src/lib/services/lead-scoring.ts` but doesn't trigger webhook

**Fix approach:**
- In `scoreClientLeads()` or wherever lead temperature changes to "hot", dispatch `lead.qualified` webhook

**Severity**: LOW — 2 of 3 default events work; this is a nice-to-have
**Effort**: S — add one `dispatchWebhook()` call in lead scoring

---

### GAP-20: Analytics Aggregation — Churn + MRR Hardcoded to Zero [OPEN]

**What exists:**

- `src/lib/services/analytics-aggregation.ts` — `runDailyAnalyticsJob()` runs daily from master cron
- Line 516-517:
  ```typescript
  churnedClients: 0, // TODO: Calculate from subscription events
  mrrCents: 0, // TODO: Calculate from subscriptions table
  ```
- These values feed into the admin platform analytics dashboard — churn and MRR always display as $0

**Fix approach:**
- Query `subscriptions` table: `SUM(plan.priceCents) WHERE status IN ('active', 'trialing')` for MRR
- Query `subscriptions` table: `COUNT WHERE status = 'canceled' AND canceledAt > periodStart` for churned
- Both queries are straightforward

**Severity**: MEDIUM — platform analytics dashboard shows wrong financial data
**Effort**: S — 2 SQL queries replacing hardcoded zeros

---

## Summary

| ID | Severity | Gap | Effort | Key Files |
|----|----------|-----|--------|-----------|
| 01 | ~~CRITICAL~~ | ~~10 cron jobs never triggered~~ FIXED | S | `src/app/api/cron/route.ts` |
| 02 | ~~HIGH~~ | ~~Overage pricing not operationalized~~ FIXED | M | `plans.ts`, `plan-list.tsx`, `UsageDisplay.tsx`, `queries.ts` |
| 03 | ~~HIGH~~ | ~~Coupons system non-functional~~ FIXED | M | `coupons.ts`, `subscription.ts` |
| 04 | ~~HIGH~~ | ~~Client cohort analysis never populated~~ FIXED | M | `client-cohorts.ts` |
| 05 | ~~HIGH~~ | ~~Google OAuth no admin management~~ FIXED | M | `google-business.ts`, `clients.ts` |
| 06 | ~~HIGH~~ | ~~Client webhook config schema only~~ FIXED | M | `clients.ts` |
| 07 | ~~MEDIUM~~ | ~~Subscription pause/resume no UI~~ FALSE POSITIVE | S | Already wired in SubscriptionCard |
| 08 | ~~MEDIUM~~ | ~~Review metrics not displayed~~ FIXED | S | `review-metrics.ts`, `review-monitoring.ts` |
| 09 | ~~MEDIUM~~ | ~~Funnel analytics no visualization~~ FIXED | M | `funnel-events.ts`, `funnel-tracking.ts` |
| 10 | ~~MEDIUM~~ | ~~Feature access gating never enforced~~ FIXED | S | `subscription.ts` |
| 11 | ~~MEDIUM~~ | ~~Invoice operations no routes~~ FIXED | S | `subscription-invoices.ts` |
| 12 | ~~MEDIUM~~ | ~~Subscription creation no entry point~~ FIXED | S | `subscription.ts` |
| 13 | ~~MEDIUM~~ | ~~Google Place ID search no setup flow~~ FIXED | S | `google-places.ts` |
| 14 | ~~LOW~~ | ~~Message counter stale~~ FALSE POSITIVE | S | Wired in compliance-gateway |
| 15 | ~~LOW~~ | ~~isTest flag never enforced~~ FIXED | S | `clients.ts` |
| 16 | ~~LOW~~ | ~~Cancellation reason wiring unclear~~ FALSE POSITIVE | S | Wired at subscription.ts:167 |
| 17 | LOW | Orphaned utility functions | S | Various |
| 18 | **HIGH** | **Coupon validation not wired to checkout** | S | `coupon-validation.ts`, `subscription.ts` |
| 19 | LOW | Webhook `lead.qualified` event never fired | S | `lead-scoring.ts`, `webhook-dispatch.ts` |
| 20 | **MEDIUM** | **Analytics churn + MRR hardcoded to 0** | S | `analytics-aggregation.ts` |
