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
**Revenue impact:** Primary scaling engine — $1,497/mo + $997 setup per agency

### Context

ConversionSurgery is currently single-agency: the platform owner is also the only agency operator. The long-term model is a multi-tenant platform where independent agencies subscribe, configure their own services, and sell to their own contractors.

### Current behavior

- One agency (platform owner) manages all clients directly
- Contractor Stripe payments go to a single Stripe account
- Twilio numbers, branding, and config are global (not per-agency)
- Admin dashboard assumes a single operator

### Desired behavior

1. **Agency subscription tier**: Agencies subscribe to the platform ($1,497/mo + $997 setup). Self-serve signup or sales-assisted onboarding.
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

## Recently Implemented (SPEC-07 through SPEC-12, April 2026)

These items were shipped and are no longer backlog. Documented here for traceability.

| SPEC | Feature | Status |
|------|---------|--------|
| SPEC-07 | Pre-Sale Revenue Leak Audit — operator process + template at `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` | **Implemented** |
| SPEC-08 | Weekly Activity Digest — Monday SMS with adaptive cadence (weekly/biweekly/monthly based on activity). Contractor-friendly format, not pipeline math. Includes jobs to close out for review engine. | **Implemented** (redesigned 2026-04-09) |
| SPEC-09 | Voice AI Default-On — `voiceEnabled` defaults to `true` for new clients; per-minute billing unchanged | **Implemented** |
| SPEC-10 | Revenue Floor Guarantee — 90-day guarantee now passes with $5,000+ probable pipeline OR 1 attributed opportunity | **Implemented** |
| SPEC-11 | ROI Calculator API — `POST /api/public/roi-calculator` for pre-sale revenue-at-risk calculations | **Implemented** |
| SPEC-12 | Jobber Integration — basic webhook: outbound `appointment_booked` events + inbound `job_completed` triggers review generation | **Implemented** |

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

Note: The Jobber/FSM auto-detect integration referenced in COMPONENT 1 of the offer doc (auto-detect when estimate is created in Jobber) remains a future enhancement. SPEC-12 covers review and appointment sync; estimate auto-detection is still a roadmap item.
