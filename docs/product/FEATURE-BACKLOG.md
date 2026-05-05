# Feature Backlog

Planned features not yet implemented. Each entry includes context, current behavior, and desired behavior so implementation can start without re-discovery.

---

## FB-01: Owner/team call rejection → SMS fallback

**Priority:** Medium
**Area:** Voice / Escalation

### Context

When a lead triggers a hot transfer (via Voice AI or ring group), the system dials team members. If nobody answers, the existing `handleNoAnswer()` path in `ring-group.ts` sends an SMS to team members ("Missed hot transfer!") and an SMS to the lead ("Sorry we missed you!").

However, this only fires when the **dial times out** (30s). If the owner or team member **actively rejects** the call (presses decline while busy with other work), the Twilio `DialCallStatus` returns `busy` — and the current code treats it the same as a generic no-answer: plays a TwiML message to the lead and hangs up. No SMS notification is sent to the person who rejected.

### Current behavior

| Scenario | What happens |
|---|---|
| Ring group — no answer (timeout) | `ring-result` webhook → `handleNoAnswer()` → SMS to team + SMS to lead |
| Ring group — actively rejected | `ring-result` webhook → call marked `no-answer` → `handleNoAnswer()` fires (same as timeout) |
| Voice AI transfer — no answer/busy | `dial-complete` webhook → call marked `dropped` → TwiML "We&apos;ll call you back" → hangup. **No SMS sent.** |
| Voice AI transfer — actively rejected | Same as above — no SMS sent |

### Desired behavior

1. When a transfer is **rejected** (`busy`) or **unanswered** (`no-answer`), send an SMS to the person who missed it:
   - "You missed a call from [lead name/phone]. They were asking about: [last message context]. Call them back or reply here for details."
   - Send via the agency number (#5), not the business line.

2. If **all** team members reject/miss, escalate:
   - Create an escalation queue entry (existing `notifyTeamForEscalation()` path).
   - Send the lead an SMS: "We&apos;re finding someone to help you right now. You&apos;ll hear back within [SLA window]."

3. Log a `call_rejected` or `call_missed_with_sms` event in `audit_log` for ops visibility.

### Key files

- `src/lib/services/ring-group.ts` — `handleNoAnswer()` (ring group path)
- `src/app/api/webhooks/twilio/voice/ai/dial-complete/route.ts` — Voice AI transfer completion
- `src/app/api/webhooks/twilio/ring-result/route.ts` — ring group dial result
- `src/lib/services/hot-transfer.ts` — routing logic
- `src/lib/services/agency-communication.ts` — `sendAgencySMS()` for owner/team notifications
- `src/lib/services/team-escalation.ts` — `notifyTeamForEscalation()`

### Notes

- The `ring-status` statusCallback URL referenced in `ring-group.ts:64` points to `/api/webhooks/twilio/ring-status` which does not exist. This should be created or consolidated with `ring-result` as part of this work.

---

## FB-02: Multi-Agency Platform (Agency Licensing Infrastructure)

**Priority:** High (post-validation — build after 5 paying clients prove the model)
**Area:** Platform Architecture / Billing / Multi-Tenancy
**Revenue impact:** Primary scaling engine — pricing TBD per agency (current direct model: Pilot $1,500/mo, Standard $2,000/mo, Premium $3,500/mo)

### Context

ConversionSurgery is currently single-agency: the platform owner is also the only agency operator. The long-term model is a multi-tenant platform where independent agencies subscribe, configure their own services, and sell to their own contractors.

### Current behavior

- One agency (platform owner) manages all clients directly
- Contractor Stripe payments go to a single Stripe account
- Twilio numbers, branding, and config are global (not per-agency)
- Admin dashboard assumes a single operator

### Desired behavior

1. **Agency subscription tier**: Agencies subscribe to the platform (pricing TBD — post-validation). Sales-assisted onboarding.
2. **Stripe Connect**: Each agency connects their own Stripe account. Contractors pay the agency, platform takes a revenue share (percentage or flat fee per client).
3. **Per-agency configuration**: Each agency gets their own Twilio numbers, business branding, custom domain (optional), email sender identity, and AI knowledge base defaults.
4. **Tenant isolation**: Agencies only see their own clients, leads, conversations, reports. Platform owner sees aggregate metrics across all agencies.
5. **Agency onboarding flow**: Guided setup — connect Stripe, buy/port Twilio numbers, configure branding, create first client.
6. **Admin-side subscription management**: Agency operator can create subscriptions on behalf of contractors (managed service UX — contractor doesn&apos;t need to self-checkout).
7. **Platform admin dashboard**: Cross-agency MRR, churn, usage, and health metrics for the platform owner.

### Key architectural decisions (to resolve when building)

- Tenant isolation strategy: schema-level (separate schemas per agency) vs row-level (agency_id FK on all tables)
- Stripe Connect type: Standard (agencies manage own Stripe) vs Express (platform-controlled)
- Domain strategy: subdomains (agency1.conversionsurgery.io) vs custom domains
- Twilio strategy: single Twilio account with sub-accounts vs agencies bring their own

### Prerequisites

- 5+ paying clients proving the single-agency model works
- At least 1 inbound inquiry from a potential agency operator
- Legal review of platform terms, agency agreements, revenue share structure

### Notes

- Do NOT build any multi-agency infrastructure until prerequisites are met
- Current single-agency architecture is intentionally simple — resist premature abstraction
- The existing permission system (roles, templates, overrides) was designed with multi-tenancy in mind and should extend cleanly
- Twilio `statusCallbackEvent` already includes `['initiated', 'ringing', 'answered', 'completed']` — may need to add `busy` and `no-answer` explicitly depending on Twilio&apos;s default behavior for `<Dial>` vs outbound calls.
- Consider debounce: if the same lead triggers multiple transfers in quick succession, avoid spamming the owner with duplicate SMS.

---

## FB-03: Google Business Auto-Resolve via Places API

**Priority:** Medium (becomes High when self-serve signup launches)
**Area:** Onboarding / Review Monitoring

### Context

The onboarding wizard and edit client form ask for the Google Review URL (`g.page/r/.../review`). Most contractors don't know where to find it. Currently the field has helper text with step-by-step instructions — adequate for managed-service onboarding where the operator fills the form, but a friction point for self-serve.

### Current behavior

- Text input with placeholder showing expected format (`g.page/r/XXXXX/review`)
- Helper text links to business.google.com with instructions to find the review share link
- Operator (admin) fills this in during managed-service onboarding

### Desired behavior

1. **Typeahead search** using Google Places Autocomplete API. Contractor types their business name, UI shows matching businesses in a dropdown.
2. On selection, auto-populate: Google place ID, review URL, current rating, review count.
3. Pre-populates everything needed for the review monitoring lifecycle (request &rarr; sync &rarr; alert &rarr; auto-respond &rarr; report) in one click.
4. Fallback: manual URL entry still available if the business isn't found.

### Key files

- `src/app/(dashboard)/admin/clients/new/wizard/steps/step-business-info.tsx` — wizard field
- `src/app/(dashboard)/admin/clients/[id]/edit-client-form.tsx` — edit client field
- `src/lib/services/google-places.ts` — existing Places API service
- `src/db/schema/clients.ts` — `googleBusinessUrl` column

### Prerequisites

- Google Places API key provisioned and billing enabled
- Self-serve signup flow built (Phase 3) — this is when the ROI of auto-resolve justifies the API cost

### Notes

- `google-places.ts` already exists — check what's implemented before building
- API cost: Places Autocomplete is ~$2.83/1000 requests (session-based pricing). Negligible at current scale.
- Referenced in PRODUCT-STRATEGY.md Section 3 (Agency Onboarding Gaps)

---

## FB-04: Channel-level lead source capture

**Priority:** High (P0 if selling Standard with source-visibility promise; otherwise P1)
**Area:** Lead Capture / Reporting
**Parity ID:** `PG-002`, `PG-101`
**Gap register:** `W5-01`

### Context

The Business Reference promises a "Lead-source map across website forms, calls, texts, Google Business Profile, Houzz, referrals, and paid lead sources" at Pilot and Standard tiers (§6.2, §6.3). The platform has `leads.source` as `varchar(50)` but only writes `missed_call`, `form`, or `manual`. No code path captures or reports channel (Google / Houzz / LSA / Meta / referral / organic / direct).

### Current behavior

- `leads.source` set at creation by inbound channel (call vs. form vs. manual entry)
- `funnel_events.source` mirrors the same shallow set
- Source-aware AI opening strategy uses entry channel only
- No analytics aggregation by channel; no portal filter; no report dimension

### Desired behavior

1. Define channel enum: `google_organic`, `google_ads`, `google_lsa`, `houzz`, `meta_ads`, `referral`, `direct`, `webform`, `phone`, `other`
2. Capture path:
   - Web forms: parse `utm_source`, `utm_medium`, `gclid`, `referrer` → derive channel
   - Calls: tracking-number lookup (depends on FB-05) or manual operator tag at first response
   - Manual entry: dropdown in admin "Add Lead" form
3. Reporting:
   - Revenue-by-source row in bi-weekly report
   - Channel breakdown card on client portal dashboard
   - Filter on lead list page

### Key files

- `src/db/schema/leads.ts` — extend or replace `source` column
- `src/db/schema/funnel-events.ts` — same
- `src/app/api/public/leads/route.ts` — inbound web form capture
- `src/lib/services/lead-creation.ts` (verify path) — channel derivation logic
- `src/app/(dashboard)/admin/leads/new/` — admin form dropdown
- `src/lib/services/reports/biweekly.ts` (verify path) — add channel dimension

---

## FB-05: Ad attribution capture (GCLID / GBRAID / WBRAID / UTM)

**Priority:** Medium (Premium tier only)
**Area:** Lead Capture / Premium Reporting
**Parity ID:** `PG-102`
**Gap register:** `W5-02`

### Context

Booked Estimate OS (Premium, $9,500 + $3,500/mo) promises "GCLID / GBRAID / WBRAID capture where paid ad traffic and site access support it" (§6.4). Required for offline conversion upload (FB-06). Not built.

### Desired behavior

1. Capture `gclid`, `gbraid`, `wbraid`, `fbclid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` from inbound web form submissions
2. Persist to a new `lead_ad_attribution` table keyed to `lead_id`
3. Surface ad-platform identifiers in lead detail (admin and portal)
4. Feed offline conversion export pipeline (FB-06)

### Notes

- Do not build until 1+ Premium-tier prospect signed
- Microsite builder is out of scope (`OFFER-APPROVED-COPY` §8) so capture path is on contractor's existing landing pages — confirm scoping before promising

---

## FB-06: Offline conversion export to ad platforms

**Priority:** Medium (Premium tier only)
**Area:** Premium Reporting
**Parity ID:** `PG-104`
**Gap register:** `W5-04`, `OUT-08`

### Context

Premium tier promises "Offline conversion export/upload to ad platforms where feasible" (§6.4). Closes the loop for paid-ad clients: when a lead becomes a booked consult or won job, push the conversion back to Google Ads / Meta with the captured GCLID/FBCLID.

### Desired behavior

1. Daily cron exports won-job and booked-consult events with attribution payload
2. Google Ads Offline Conversions API integration (per-client OAuth)
3. Meta Conversions API integration (per-client pixel + access token)
4. Operator dashboard for export status and failures

### Prerequisites

- FB-05 (attribution capture) shipped
- Per-client ad-platform credentials onboarding flow

---

## FB-07: Channel-aware reporting (revenue-by-source dashboard)

**Priority:** Medium
**Area:** Reporting
**Parity ID:** `PG-105`
**Gap register:** `W5-05`, `BL-11`

### Context

Premium tier promises "Revenue-by-source dashboard" (§6.4). Even Standard-tier buyers ask "which source produced this revenue?" — current reports show aggregate only. Depends on FB-04 (channel-level source capture) shipping first.

### Desired behavior

1. Bi-weekly report adds channel breakdown table: leads / appointments / probable pipeline / confirmed revenue per channel
2. Client portal dashboard adds channel breakdown card
3. Admin client detail page surfaces same breakdown

### Prerequisites

- FB-04 (channel-level source) shipped

---

## FB-08: Service-line segmentation and dashboard

**Priority:** Low (Premium add-on)
**Area:** Reporting
**Parity ID:** `PG-106`, `PG-203`
**Gap register:** `W5-06`

### Context

Add-on offer §6.5: "Extra Service-Line Dashboard ($500-$1,500 setup) — additional dashboard segment and reporting views" for kitchens/baths/basements/additions. Currently `leads.projectType` is free-text varchar(255) with no taxonomy.

### Desired behavior

1. Define service-line taxonomy per client (each contractor configures their own services, e.g., kitchen-remodel, basement-finish, addition, whole-home)
2. Add `service_line_id` FK on leads; AI extracts service-line from conversation
3. Per-service-line filter and reporting card on dashboard

### Notes

- Skill `client-services.ts` schema already exists — use as taxonomy host
- Defer until Premium tier has 2+ paying clients with multiple service lines

---

## FB-09: Estimator-level reporting

**Priority:** Medium (Premium-tier deliverable; useful at Standard for multi-estimator firms)
**Area:** Reporting / Booking
**Parity ID:** `PG-004`
**Gap register:** `W5-08`

### Context

Premium tier promises "Estimator-level reporting and pipeline visibility" (§6.4). Standard tier mentions "improved routing rules by project type or estimator" (§6.3). Estimator-specific briefing on appointment reminder is built, but no `assignedEstimatorId` FK on `leads` or `appointments` — pipeline cannot be filtered by estimator.

### Desired behavior

1. Add `assignedEstimatorId` (FK to `team_members`) on `leads` and `appointments`
2. Auto-assign on appointment booking when one estimator owns the time slot
3. Manual reassign in admin and portal
4. Pipeline filter and per-estimator scoreboard in reports

---

## FB-10: Won/lost reason capture on leads

**Priority:** Medium
**Area:** Reporting / Lead
**Parity ID:** `PG-003`
**Gap register:** `W5-07`, `BL-14`

### Context

KPI list (§12) calls for "Won/lost reasons logged." `lostReason` exists on `jobs` table (varchar 255) but not on `leads`. WON/LOST SMS commands set status but don't capture reason. Win-back AI uses conversation history but doesn't classify objections.

### Desired behavior

1. Add `lostReason` (enum + free text) and `wonNotes` to `leads`
2. WON/LOST SMS commands prompt for one-line reason after status update ("LOST 4A — pricing too high")
3. Structured objection categories: `price`, `timeline`, `chose_competitor`, `scope_changed`, `unresponsive`, `other`
4. Reason breakdown in bi-weekly report and admin lead-list

---

## Recently Implemented (Wave 6, April 2026)

These items were shipped and are no longer backlog. Documented here for traceability.

| Feature | Status |
|---------|--------|
| Pre-Sale Revenue Leak Audit — operator process + template at `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` | **Implemented** |
| Weekly Activity Digest — Monday SMS with adaptive cadence (weekly/biweekly/monthly based on activity). Contractor-friendly format, not pipeline math. Includes jobs to close out for review engine. | **Implemented** (redesigned 2026-04-09) |
| Voice AI Default-On — `voiceEnabled` defaults to `true` for new clients; per-minute billing unchanged | **Implemented** |
| Revenue Floor Guarantee — 90-day guarantee now passes with $5,000+ probable pipeline OR 1 attributed opportunity | **Implemented** |
| ROI Calculator API — `POST /api/public/roi-calculator` for pre-sale revenue-at-risk calculations | **Implemented** |
| Jobber Integration — basic webhook: outbound `appointment_booked` events + inbound `job_completed` triggers review generation | **Implemented** |

## Recently Implemented (GAP-1 through GAP-6, April 2026)

Six admin UI tools shipped as part of the operator tooling gap closure. All are on the admin client detail page.

| GAP | Feature | Status |
|-----|---------|--------|
| GAP-1 | DNC/Exclusion List Management — per-client excluded numbers on Configuration tab; API: GET/POST/DELETE `/api/admin/clients/[id]/dnc` | **Implemented** |
| GAP-2 | Smart Assist Pending Drafts Admin View — Campaigns tab with 15-second polling, approve/edit/cancel; API: GET `/api/admin/clients/[id]/smart-assist`, POST `.../smart-assist/[messageId]` | **Implemented** |
| GAP-3 | Guarantee Status Dashboard — server component on Overview tab showing phase, QLE progress, pipeline value, days remaining, status badge | **Implemented** |
| GAP-4 | Engagement Health Badge — server component on Overview tab showing `at_risk`/`disengaged` status with signal bullets | **Implemented** |
| GAP-5 | Integration Webhook Config UI — Configuration tab for Jobber/ServiceTitan/Housecall Pro/Zapier/generic webhooks with CRUD; API: `/api/admin/clients/[id]/integrations` | **Implemented** |
| GAP-6 | Admin Data Export Trigger — Export Data button in client detail page header (Actions card removed) with AlertDialog confirmation; API: POST `/api/admin/clients/[id]/export` | **Implemented** |

Note: The Jobber/FSM auto-detect integration referenced in COMPONENT 1 of the offer doc (auto-detect when estimate is created in Jobber) remains a future enhancement. The Jobber integration covers review and appointment sync; Jobber estimate webhook auto-detection is still a roadmap item. However, **conversation-based estimate auto-detection is now implemented** — the AI detects when a lead's message implies a quote was sent ("waiting on the quote", "comparing prices") and auto-starts the follow-up sequence without contractor action. This closes the trigger gap for the majority of cases where the contractor forgets to send the EST keyword.

## Recently Implemented (FMA Wave 1, April 2026)

Eight failure-mode-analysis items shipped to reduce notification fatigue, close coverage gaps, and add proactive operator alerting.

| Item | Feature | Status |
|------|---------|--------|
| FMA-W1-1 | Feature Flag Infrastructure — `resolveFeatureFlag(clientId, flag)` with system defaults + per-client overrides. 8 flags: `dailyDigestEnabled`, `billingReminderEnabled`, `engagementSignalsEnabled`, `autoResolveEnabled`, `forwardingVerificationEnabled`, `opsHealthMonitorEnabled`, `callPrepEnabled`, `capacityTrackingEnabled`. Emergency `globalAutomationPause` via `system_settings`. | **Implemented** |
| FMA-W1-2 | Notification Priority Tiers — P0 (critical/always), P1 (time-sensitive, max 2/day), P2 (daily digest batch), P3 (weekly). Prevents alert fatigue; P2 items held for digest. | **Implemented** |
| FMA-W1-3 | Daily Contractor Digest — batches P2 items (KB gaps, stale estimates, WON/LOST prompts) into single 10am local-time SMS with numbered-reply disambiguation. Flag: `dailyDigestEnabled`. Cron: `daily-digest` (hourly). | **Implemented** |
| FMA-W1-4 | Day 25 Billing Reminder — SMS 5 days before trial ends via agency channel. Flag: `billingReminderEnabled`. Cron: `billing-reminder` (daily midnight UTC). | **Implemented** |
| FMA-W1-5 | Pre-Guarantee Day 80 Operator Alert — SMS to operator when client approaching Day 90 guarantee deadline with insufficient pipeline. Always-on. Cron: `guarantee-alert` (daily midnight UTC). | **Implemented** |
| FMA-W1-6 | Onboarding Call Reminder — SMS 2 hours before scheduled onboarding call. Cron: `onboarding-reminder` (every 30 min). | **Implemented** |
| FMA-W1-7 | Pre-Onboarding Priming SMS — &ldquo;Think of 5 dead quotes&rdquo; text 24-48h after signup. Cron: `onboarding-priming` (daily 7am UTC). | **Implemented** |
| FMA-W1-8 | Probable-Wins Extension — nudge now includes `estimate_sent` leads 14+ days stale alongside post-appointment leads. No new cron; extends existing `probable-wins-nudge`. | **Implemented** |

## Recently Implemented (FMA Wave 2, April 2026)

Five failure-mode-analysis items shipped to enforce onboarding quality gates and prevent silent setup failures.

| Item | Feature | Status |
|------|---------|--------|
| FMA-W2-1 | Exclusion List Gate — blocks autonomous mode until operator confirms exclusion list reviewed with contractor. One-way latch on `clients.exclusionListReviewed`. Returns 409 on blocked transition. Audit-logged. | **Implemented** |
| FMA-W2-2 | Autonomous Readiness Checklist — 6-item checklist (KB &ge; 10, pricing set, 30+ Smart Assist reviews, escalation rate &lt; 20%, exclusion list reviewed, business hours configured). Shown inline when autonomous mode selected. Critical items block; warnings don&apos;t. API: `GET /api/admin/clients/{id}/readiness`. | **Implemented** |
| FMA-W2-3 | ICP Qualification Fields — required on client creation wizard: estimated monthly lead volume, average project value, dead quote count. Sub-15 volume triggers mandatory disclosure. | **Implemented** |
| FMA-W2-4 | Onboarding Checklist — 10-item platform-enforced checklist on client detail page. Items block Smart Assist or Autonomous mode. Progress card with green/gray/lock icons. API: `GET /api/admin/clients/{id}/onboarding-checklist`. | **Implemented** |
| FMA-W2-5 | Forwarding Verification — daily Twilio outbound call to contractor&apos;s business number for first 7 days. AMD detects voicemail intercept. Operator alert on detection. Feature flag: `forwardingVerificationEnabled`. Cron: `forwarding-verification` (daily). Cost: ~$0.14/client. | **Implemented** |

## Recently Implemented (FMA Wave 3: Operator Cockpit, April 2026)

Five operator-cockpit items shipped to give the solo operator a single daily starting point, deterministic engagement visibility, and semi-automated KB gap resolution.

| Item | Feature | Status |
|------|---------|--------|
| FMA-W3-1 | Operator Actions Queue — aggregation service collecting 7 action types (`escalation_pending`, `onboarding_gate_pending`, `forwarding_failed`, `kb_gaps_accumulating`, `guarantee_approaching`, `engagement_flagged`, `call_prep_due`) into a single urgency-sorted list. Triage dashboard enhanced with KPI cards (open escalations, pending drafts, at-risk clients, high-priority KB gaps) and an actions panel with per-client &ldquo;Prep Call&rdquo; links. API: `GET /api/admin/operator-actions`. | **Implemented** |
| FMA-W3-2 | Engagement Signals — 5 deterministic indicators per client (estimate recency, WON/LOST recency, KB gap response rate, nudge response rate, contractor contact recency). Each green/yellow/red. Client flagged when 4/5 are yellow/red. Feature flag: `engagementSignals`. API: `GET /api/admin/clients/{id}/engagement-signals`. | **Implemented** |
| FMA-W3-3 | Call Prep links on triage — triage dashboard now surfaces &ldquo;Prep Call&rdquo; buttons per client, linking directly to the existing `/admin/clients/{id}/call-prep/` page. No new page; triage surfaces the existing feature. | **Implemented** |
| FMA-W3-4 | Auto-Resolve KB Gaps — semantic search suggests KB-entry answers for unanswered questions. First 5 per client require contractor confirmation before the gap resolves. Feature flag: `autoResolve`. API: `GET /api/admin/clients/{id}/auto-resolve/{gapId}` (get suggestion), `POST /api/admin/clients/{id}/auto-resolve/{gapId}` (accept/reject). UI on escalations page deferred — service and API are ready. | **Implemented (service + API only; escalations-page UI deferred)** |
| FMA-W3-5 | SMS-Reply KB Entry — daily digest KB gap selections (numbered reply) are now handled in `executeNumberedReply()`. Estimate prompts trigger the follow-up sequence; WON/LOST prompts update lead status; KB gap number selections mark the gap as `in_review`. Part of `dailyDigestEnabled`. | **Implemented** |

### Deferred: Auto-Resolve UI on escalations page

The service (`auto-resolve KB gaps`) and API endpoints are complete. The UI panel on the escalations page — where operators and contractors can review and accept/reject suggestions inline — is deferred to a future enhancement. The current workflow requires navigating to the gap queue and using the API directly.

## Recently Implemented (FMA Wave 4: System Health, April 2026)

Four system-health items shipped to give the solo operator automated failure detection, capacity awareness, and a structured monthly review workflow.

| Item | Feature | Status |
|------|---------|--------|
| FMA-W4-1 | Ops Health Monitor — per-client health badge (green/yellow/red), per-client circuit breaker (3+ automation errors in 24h → trip), rate anomaly detection (today &gt; 2x 7-day avg). Feature flag: `opsHealthMonitorEnabled`. `circuit_breaker_tripped` action type added to operator actions queue. | **Implemented** |
| FMA-W4-2 | Heartbeat Check Cron (`heartbeat-check`, daily) — verifies all cron jobs fired within their expected window by checking `cron_cursors`. Sends operator SMS alert for any missed cron. Catches silent cron failures the standard failure-alert path misses. | **Implemented** |
| FMA-W4-3 | Capacity Tracking &mdash; simplified to raw metrics snapshot: client counts by phase (onboarding/assist/autonomous/manual), open escalations, open KB gaps, Smart Assist queue depth. Utilization percentage and alert-level formula removed. &ldquo;Operator Capacity&rdquo; KPI card on triage dashboard shows raw counts. API: `GET /api/admin/capacity` returns `CapacitySnapshot`. Feature flag: `capacityTrackingEnabled`. | **Implemented** |
| FMA-W4-4 | Monthly Health Digest — system health page at `/admin/system-health` with 5 sections: client overview (active/paused/cancelled/new/churned), capacity utilization, automation health (cron job status table), guarantee tracker, key metrics (messages/leads/revenue). API: `GET /api/admin/system-health`. | **Implemented** |
| FMA-W4-5 | Quiet Hours Inbound-Reply Classification — `inboundReplyExemptionEnabled` feature flag. When enabled, direct inbound-reply messages bypass quiet-hours queuing. When disabled (default), all outbound messages subject to quiet hours. All 34 call sites audited and classified; flag wired in compliance gateway. | **Implemented** |
