# Offer Parity Gaps (v2.1)

Last updated: 2026-02-24
Scope: Gap register against the reviewed offer architecture ("ConversionSurgery Grand Slam Offer v2.1")
Objective: Ensure paying-client delivery matches every sold promise.

## Status Tags
- `P0: DONE`
- `P1: OPEN`
- `P2: OPEN`
- `SOURCE_OFFER: GRAND-SLAM-v2.1 (2026-02-23)`
- `LAST_VERIFIED_COMMIT: MS-11 Milestone B working tree`

## Executive Summary
The current platform is launch-ready for the earlier managed-service baseline, but it is not yet promise-parity complete for the reviewed v2.1 offer.

Highest-risk mismatches for paying clients are now concentrated in:
- Operator/client report-delivery visibility surfaces and cron catch-up guarantees.

## Spec Mapping (One Spec Per Gap)

| Gap ID | Priority | Spec | Status |
|---|---|---|---|
| GAP-001 | P0 | `docs/specs/MS-01-UNLIMITED-MESSAGING-PARITY.md` | Done |
| GAP-002 | P0 | `docs/specs/MS-02-GUARANTEE-V2-PARITY.md` | Done |
| GAP-003 | P0 | `docs/specs/MS-03-ESTIMATE-TRIGGER-STACK.md` | Done |
| GAP-004 | P0 | `docs/specs/MS-04-SMART-ASSIST-AUTO-SEND.md` | Done |
| GAP-005 | P0 | `docs/specs/MS-05-QUARTERLY-GROWTH-BLITZ.md` | Done |
| GAP-006 | P0 | `docs/specs/MS-06-BIWEEKLY-WITHOUT-US-MODEL.md` | Done |
| GAP-007 | P0 | `docs/specs/MS-07-CANCELLATION-EXPORT-PARITY.md` | Done |
| GAP-101 | P1 | `docs/specs/MS-08-QUIET-HOURS-CLASSIFICATION.md` | Done |
| GAP-102 | P1 | `docs/specs/MS-09-DAY-ONE-ACTIVATION-TRACKING.md` | Done |
| GAP-103 | P1 | `docs/specs/MS-10-ADDON-BILLING-TRANSPARENCY.md` | Done |
| GAP-104 | P1 | `docs/specs/MS-11-REPORT-DELIVERY-OBSERVABILITY.md` | In Progress |
| GAP-105 | P1 | `docs/specs/MS-12-CRON-CATCHUP-GUARANTEES.md` | Spec Ready |
| GAP-201 | P2 | `docs/specs/MS-13-KB-GAP-CLOSURE-QUEUE.md` | Spec Ready |
| GAP-202 | P2 | `docs/specs/MS-14-ONBOARDING-QUALITY-GATES.md` | Spec Ready |
| GAP-203 | P2 | `docs/specs/MS-15-REMINDER-ROUTING-FLEXIBILITY.md` | Spec Ready |

## Component Parity Matrix

| Offer component | Current state | Parity |
|---|---|---|
| Revenue Recovery Engine core automations (missed call, follow-up, reminders, re-engagement) | Core automation paths exist | Partial |
| Near-instant response during compliant hours | Quiet-hours classification policy switch implemented (`STRICT_ALL_OUTBOUND_QUEUE` vs `INBOUND_REPLY_ALLOWED`) with auditable decision logs | Ready |
| Estimate Trigger Methods (SMS keyword, quick-reply, dashboard, fallback nudge) | All trigger paths implemented with unified service + cron fallback | Ready |
| Unlimited conversations/messages, no caps/no overages | Unlimited plan policy active in runtime + billing UI paths | Ready |
| Dedicated number + CRM | Implemented | Ready |
| Additional team/number paid add-ons | Pricing visibility, ledger events, invoice itemization, CSV export, and dispute provenance workflow implemented | Ready |
| Voice AI optional add-on at $0.15/min | Voice rollup ledger, invoice linkage, CSV visibility, and dispute workflow implemented | Ready |
| Day-One Activation package | Milestone tracker, audit artifact workflow, SLA alerting, and operator/client visibility implemented | Ready |
| Smart assist mode (5-minute auto-send window) | Smart-assist queue + owner approve/edit/cancel + auto-send lifecycle implemented | Ready |
| KB QA process with gap closure loop | Gap tracking primitives exist; full operational closure loop missing | Partial |
| 30-day proof-of-life + 90-day recovery guarantee | Dual-layer evaluator + low-volume extension + visibility workflows implemented | Ready |
| Low-volume guarantee extension formula | Implemented in guarantee v2 evaluator and persisted windows | Ready |
| Quarterly Growth Blitz | Quarterly campaign ledger + planner + transitions + reporting summary + admin digest/alerts implemented | Ready |
| Bi-weekly scoreboard + "Without Us" line | Modeled low/base/high risk ranges + assumptions + disclaimer are persisted and rendered with insufficient-data safeguards | Ready |
| Month-to-month, 30-day cancellation, 5-day export SLA | 30-day cancellation workflow + tracked export lifecycle + secure expiring download path now implemented | Ready |

## P0 — Must Close Before Selling v2.1 As-Written

1. `GAP-001` Unlimited messaging/no caps/no overage parity
- Offer promise: no message caps, no lead limits, no overage charges.
- Historical pre-fix behavior: `monthlyMessageLimit` checks and overage billing were active.
- Progress (2026-02-24): `MS-01` Milestone A completed.
- Progress (2026-02-24): `MS-01` Milestone B completed.
- `sendCompliantMessage()` now uses shared usage-policy resolver, so unlimited plans are not blocked.
- `process-scheduled` runtime limit checks now use policy helper; direct `monthlyMessageLimit` comparisons removed.
- Message counters remain intact for observability.
- Progress (2026-02-24): `MS-01` Milestone C completed.
- Overage eligibility moved to dedicated billing-policy helper.
- Monthly reset response now reports `skippedByPolicy` for overage runs.
- Progress (2026-02-24): `MS-01` Milestone D completed.
- Client billing usage views now show `Unlimited` when lead caps are disabled.
- Overage warning/estimate copy is suppressed for unlimited lead plans.
- Added plan policy flags (`isUnlimitedMessaging`, `isUnlimitedLeads`, `chargesOverage`).
- Added shared usage policy resolver + `getClientUsagePolicy(clientId)`.
- Updated Professional plan seeds to unlimited + overage-disabled defaults.
- Remaining: none (`MS-01` complete).
- Evidence:
  - `src/lib/compliance/compliance-gateway.ts`
  - `src/lib/services/overage-billing.ts`
  - `src/app/api/cron/monthly-reset/route.ts`
  - `src/lib/services/subscription.ts`

2. `GAP-002` Guarantee architecture mismatch (30-day + 90-day + extension formula)
- Offer promise: dual-layer guarantee with explicit definitions and prorated low-volume extension.
- Historical pre-fix behavior: 30-day recovered-lead evaluator and `refund_review_required` only.
- Progress (2026-02-24): `MS-02` Milestone A completed.
- Added guarantee-v2 state machine domain module (`src/lib/services/guarantee-v2/`).
- Added explicit v2 statuses and legacy->v2 mapping/backfill helpers.
- Added new subscription guarantee window/extension fields required for proof + recovery lifecycle.
- Added safe migration SQL with `IF NOT EXISTS` and backfill mapping/initialization.
- Progress (2026-02-24): `MS-02` Milestone B completed.
- Implemented qualified lead engagement (QLE) proof evaluator (threshold: 5 engagements).
- Extracted reusable guarantee metrics query module for proof window calculations.
- Proof pass/fail transitions now emit explicit billing events and auditable notes.
- Progress (2026-02-24): `MS-02` Milestone C completed.
- Implemented 90-day recovery evaluator with explicit status transitions (`proof_passed` -> `recovery_pending` -> pass/fail).
- Added attributed-opportunity metrics with auditable reason/evidence payloads (job won, appointment booked, resumed conversation).
- Recovery pass/fail transitions now emit billing events with operator action hints for refund review states.
- Progress (2026-02-24): `MS-02` Milestone D completed.
- Implemented low-volume extension formula (15 / observed monthly volume) with deterministic basis-point storage.
- Persisted adjusted proof/recovery windows, observed monthly lead averages, and extension audit events.
- Progress (2026-02-24): `MS-02` Milestone E completed.
- Added admin billing guarantee timeline visibility using shared v2 guarantee summary DTO.
- Added client billing guarantee status endpoint and rendered guarantee summary card in the client billing experience.
- Cancellation workflow now includes guarantee refund-review context for operator/admin handling.
- Remaining: none (`MS-02` complete).
- Evidence:
  - `src/lib/services/guarantee-monitor.ts`
  - `src/lib/services/subscription.ts`
  - `src/app/api/cron/guarantee-check/route.ts`

3. `GAP-003` Estimate trigger stack incomplete
- Offer promise: SMS keyword trigger, notification quick-reply trigger, dashboard trigger, and fallback nudge.
- Historical pre-fix behavior: dashboard/API trigger existed; action-prompt "YES" path for `start_sequences` was not integrated.
- Progress (2026-02-24): `MS-03` Milestone A completed.
- Added unified trigger entrypoint (`triggerEstimateFollowup`) with source tagging and lead/client validation.
- Added idempotency guard to prevent duplicate estimate follow-up sequence starts.
- Routed existing `/api/sequences/estimate` dashboard/API trigger path through the unified service.
- Progress (2026-02-24): `MS-03` Milestone B completed.
- Added standalone SMS command parser for `EST <lead-id|lead-name|phone>` with test coverage.
- Implemented deterministic lead resolution (resolved/not_found/ambiguous) for contractor keyword triggers.
- Wired owner-side inbound SMS keyword handling to trigger estimate follow-up with confirmation/error responses.
- Progress (2026-02-24): `MS-03` Milestone C completed.
- Replaced `start_sequences` throw-path with action dispatch map and working prompt quick-reply execution.
- Wired prompt `YES` handling to unified estimate trigger service with `prompt_quick_reply` source metadata.
- Added expiry-safe fallback behavior and operator notification for expired/missing prompts or execution failures.
- Progress (2026-02-24): `MS-03` Milestone D completed.
- Added fallback nudge cron endpoint for stale `contacted` leads (5+ days) without active estimate sequences.
- Added reusable stale-lead query helper with nudge cooldown enforcement (72h) and eligibility tests.
- Wired orchestrator dispatch for daily execution and one-tap prompt semantics (`YES` to start sequence).
- Remaining: none (`MS-03` complete).
- Evidence:
  - `src/lib/services/estimate-command-parser.ts`
  - `src/lib/services/estimate-triggers.ts`
  - `src/lib/services/estimate-nudge.ts`
  - `src/app/api/sequences/estimate/route.ts`
  - `src/app/api/cron/estimate-fallback-nudges/route.ts`
  - `src/lib/automations/incoming-sms.ts`
  - `src/lib/services/agency-communication.ts`

4. `GAP-004` Smart assist auto-send window missing
- Offer promise: assist mode with default 5-minute auto-send window and category controls.
- Progress (2026-02-24): `MS-04` Milestones A-D completed.
- Added smart-assist client configuration model:
  - `smartAssistEnabled`
  - `smartAssistDelayMinutes` (default `5`)
  - `smartAssistManualCategories`
- Added centralized policy resolver (`resolveAiSendPolicy`) and shared category constants.
- Implemented deferred smart-assist lifecycle:
  - queue draft as pending artifact
  - owner approve/edit/cancel commands via SMS
  - auto-send on due drafts when untouched
- Added manual-only category enforcement and operator visibility in scheduled views.
- Added status transition model + retry-safe claim/send path + assist outcome counters in `daily_stats`.
- Remaining: none (`MS-04` complete).
- Evidence:
  - `src/lib/automations/incoming-sms.ts`
  - `src/lib/services/ai-send-policy.ts`
  - `src/lib/services/smart-assist-lifecycle.ts`
  - `src/lib/services/smart-assist-state.ts`
  - `src/db/schema/clients.ts`
  - `src/db/schema/scheduled-messages.ts`
  - `src/db/schema/daily-stats.ts`
  - `src/app/api/cron/process-scheduled/route.ts`

5. `GAP-005` Quarterly Growth Blitz not productized
- Offer promise: quarterly campaign cadence with scheduling/communication expectations.
- Progress (2026-02-24): `MS-05` Milestones A-D completed.
- Added quarterly campaign data model:
  - `quarterly_campaigns` table
  - campaign type/status enums
  - required assets, completed assets, evidence links, and lifecycle timestamps
- Added campaign service layer (`campaign-service.ts`) for:
  - idempotent planner defaults
  - quarter-level draft creation
  - transition actions (approve, launch, complete) with guard validation
  - asset/evidence tracking and DTO summaries
  - portfolio digest and missed-quarter alert generation
- Added cron workflows:
  - quarterly planner (`/api/cron/quarterly-campaign-planner`)
  - admin digest/alerts (`/api/cron/quarterly-campaign-alerts`)
  - wired into orchestrator (daily and weekly windows)
- Added operator workflow surfaces:
  - admin client quarterly campaign APIs
  - admin client quarterly campaign card with lifecycle actions and checklist tracking
- Added visibility/reporting:
  - client dashboard quarterly campaign status card
  - report context now includes quarterly campaign summary DTO
- Remaining: none (`MS-05` complete).
- Evidence:
  - `src/db/schema/quarterly-campaigns.ts`
  - `src/lib/services/campaign-service.ts`
  - `src/lib/services/quarterly-campaign-rules.ts`
  - `src/lib/services/quarterly-campaign-transition-guard.ts`
  - `src/app/api/cron/quarterly-campaign-planner/route.ts`
  - `src/app/api/cron/quarterly-campaign-alerts/route.ts`
  - `src/app/api/admin/clients/[id]/quarterly-campaigns/route.ts`
  - `src/app/api/admin/clients/[id]/quarterly-campaigns/[campaignId]/route.ts`

6. `GAP-006` Bi-weekly "Without Us" methodology parity
- Offer promise: standardized modeled low/base/high risk line in bi-weekly report.
- Progress (2026-02-24): `MS-06` Milestones A-D completed.
- Added pure deterministic model service with versioned output, assumptions merge, and ready/insufficient-data states.
- Added report input enrichment for:
  - after-hours lead count
  - observed first-response timing from conversation logs
  - delayed estimate follow-up count
- Added system-settings assumption override path (`without_us_model_assumptions`).
- Persisted model payload inside report summary and rendered full "Without Us" section in admin report details.
- Added disclaimer + range summary in bi-weekly report email delivery.
- Added typed report DTO parsers to remove ad hoc JSON casting in report UI paths.
- Added model unit tests covering ready, insufficient-data, and assumptions merge behavior.
- Remaining: none (`MS-06` complete).
- Evidence:
  - `src/lib/services/without-us-model.ts`
  - `src/lib/services/report-generation.ts`
  - `src/lib/services/report-dto.ts`
  - `src/app/(dashboard)/admin/reports/[id]/page.tsx`
  - `src/lib/services/without-us-model.test.ts`

7. `GAP-007` Cancellation/export terms mismatch
- Offer promise: 30 calendar day cancellation notice and full export delivery within 5 business days.
- Progress (2026-02-24): `MS-07` Milestones A-D completed.
- Added cancellation/export policy constants and business-day SLA helper:
  - `CANCELLATION_NOTICE_DAYS = 30`
  - `EXPORT_SLA_BUSINESS_DAYS = 5`
- Added export lifecycle data model and migration:
  - `data_export_requests` table with statuses `requested|processing|ready|delivered|failed`
  - due date tracking, failure tracking, and expiring secure token metadata
- Updated cancellation confirmation workflow:
  - 30-day effective cancellation date persisted on cancellation request
  - automatic export request creation + processing on cancellation confirm
  - effective date + export SLA metadata returned in API response and admin email
- Added full data export bundle assembly:
  - `leads.csv`
  - `conversations.csv`
  - `pipeline_jobs.csv`
- Added secure retrieval endpoint with token expiry:
  - `/api/client/exports/[requestId]/download?token=...`
- Added operator visibility:
  - admin billing page `Data Export SLA Queue` for pending/at-risk/breached tracking
- Added portal export APIs:
  - `GET /api/client/exports` (status visibility)
  - `POST /api/client/exports` (manual request path)
- Deprecated direct billing cancellation path to prevent policy bypass and routed billing cancel CTA to `/client/cancel`.
- Added tests:
  - cancellation policy date/business-day behavior
  - export bundle CSV formatting
  - export SLA state transitions
- Remaining: none (`MS-07` complete).
- Evidence:
  - `src/lib/services/cancellation-policy.ts`
  - `src/lib/services/data-export-requests.ts`
  - `src/lib/services/data-export-bundle.ts`
  - `src/db/schema/data-export-requests.ts`
  - `src/app/api/client/cancel/route.ts`
  - `src/app/api/client/exports/route.ts`
  - `src/app/api/client/exports/[requestId]/download/route.ts`
  - `src/app/(dashboard)/admin/billing/page.tsx`
  - `src/app/(client)/client/cancel/confirmed/page.tsx`
  - `src/lib/services/cancellation.ts`

## P1 — High Priority CX Parity (First 30 Days)

1. `GAP-101` Quiet-hours inbound-reply classification decision path
- Offer posture remains qualifier-based pending legal review, and operational behavior is now policy-switch controlled.
- Progress (2026-02-24): `MS-08` Milestones A-D completed.
- Added quiet-hours policy module with strict default + optional inbound-reply mode:
  - `STRICT_ALL_OUTBOUND_QUEUE`
  - `INBOUND_REPLY_ALLOWED`
- Added required `messageClassification` contract on every compliant outbound send path:
  - `inbound_reply`
  - `proactive_outreach`
- Added fail-closed handling for missing classification at gateway entrypoint.
- Added pure quiet-hours decision function + unit tests for strict/inbound-allowed/missing-classification cases.
- Added policy mode override field (`quiet_hours_config.policy_mode_override`) and migration.
- Added policy diagnostics API + admin dashboard widget for active mode + per-client overrides.
- Added mode-change compliance audit event (`quiet_hours_policy_mode_changed`) for operator visibility.
- Added quiet-hours decision metadata (`policy mode`, `classification`, `decision`) to send/queue/block audit paths.
- Remaining: none (`MS-08` complete).
- Evidence:
  - `src/lib/compliance/quiet-hours-policy.ts`
  - `src/lib/compliance/quiet-hours-policy.test.ts`
  - `src/lib/compliance/compliance-gateway.ts`
  - `src/lib/compliance/compliance-service.ts`
  - `src/app/api/admin/compliance/quiet-hours-policy/route.ts`
  - `src/app/(dashboard)/admin/compliance/page.tsx`
  - `src/components/compliance/ComplianceDashboard.tsx`
  - `drizzle/0026_fair_rocket_racer.sql`

2. `GAP-102` Day-One Activation SLA and Revenue Leak Audit workflow tracking
- Offer commits explicit activation/audit timelines; product now has a dedicated tracked workflow for these deliverables.
- Progress (2026-02-24): `MS-09` Milestones A-D completed.
- Added Day-One activation data model:
  - `onboarding_milestones`
  - `onboarding_milestone_activities`
  - `onboarding_sla_alerts`
  - `revenue_leak_audits`
- Added centralized Day-One policy/service:
  - milestone definitions and SLA timing constants
  - milestone creation/completion + immutable activity writes
  - audit draft/delivery lifecycle
  - SLA breach detection and alert creation
- Added operator workflow APIs:
  - `GET/PATCH /api/admin/clients/[id]/onboarding/day-one`
  - manual milestone completion
  - audit save/deliver actions
  - manual SLA alert resolution
- Added operator UX:
  - Day-One activation card on admin client detail page with progress, milestones, audit delivery proof, alerts, and activity trail
- Added client-facing onboarding visibility:
  - public onboarding status now includes Day-One summary
  - onboarding checklist now shows Day-One milestone statuses and delivered audit summary
- Added cron reliability path:
  - `/api/cron/onboarding-sla-check`
  - orchestrator dispatch in hourly window
- Remaining: none (`MS-09` complete).
- Evidence:
  - `src/db/schema/onboarding-day-one.ts`
  - `drizzle/0027_goofy_vindicator.sql`
  - `src/lib/services/day-one-policy.ts`
  - `src/lib/services/day-one-activation.ts`
  - `src/app/api/admin/clients/[id]/onboarding/day-one/route.ts`
  - `src/app/(dashboard)/admin/clients/[id]/day-one-activation-card.tsx`
  - `src/app/(dashboard)/admin/clients/[id]/page.tsx`
  - `src/app/api/cron/onboarding-sla-check/route.ts`
  - `src/app/api/cron/route.ts`
  - `src/app/api/public/onboarding/status/route.ts`
  - `src/app/signup/next-steps/onboarding-checklist.tsx`

3. `GAP-103` Add-on billing clarity for extra team members/phone numbers/voice
- Offer positions transparent add-ons; system currently enforces limits and usage tracking but does not fully expose end-to-end add-on invoice transparency.
- Progress (2026-02-24): `MS-10` Milestone A completed.
- Added normalized add-on price catalog with effective-date resolver:
  - keys: `extra_team_member`, `extra_number`, `voice_minutes`
  - default CAD pricing and system-settings override hook (`addon_pricing_catalog`)
- Route limit-copy now sources add-on prices from resolver (no hard-coded amounts):
  - team member limit response
  - phone number limit response
- Client billing usage view now shows add-on pricing reference and projected recurring add-on subtotal for extra seats/numbers.
- Progress (2026-02-24): `MS-10` Milestone B completed.
- Added add-on billing ledger table with idempotency keys and period windows.
- Added centralized ledger writer service and routed all new add-on events through it.
- Emission paths now implemented for:
  - team seats over included base (membership create/reactivate)
  - additional number purchases
  - voice usage rollup cron (`/api/cron/voice-usage-rollup`)
- Progress (2026-02-24): `MS-10` Milestone C completed.
- Added shared formatter for add-on labels/units/currency.
- Added add-on ledger to invoice line-item merge for matching billing periods.
- Added client billing cycle add-on breakdown section and CSV export endpoint.
- Progress (2026-02-24): `MS-10` Milestone D completed.
- Added invoice linkage fields and dispute/provenance fields on add-on ledger events.
- Added invoice-to-add-on linking during Stripe invoice sync.
- Added admin add-on provenance/dispute APIs and admin client workflow card.
- Remaining: none (`MS-10` complete).
- Evidence:
  - `src/lib/services/addon-pricing.ts`
  - `src/lib/services/addon-pricing.test.ts`
  - `src/db/schema/addon-billing-events.ts`
  - `drizzle/0028_fancy_smasher.sql`
  - `src/lib/services/addon-billing-ledger.ts`
  - `src/lib/services/addon-billing-ledger.test.ts`
  - `src/lib/services/addon-billing-format.ts`
  - `src/lib/services/addon-billing-format.test.ts`
  - `src/app/api/client/billing/addons/export/route.ts`
  - `src/app/api/admin/clients/[id]/billing/addons/route.ts`
  - `src/app/api/admin/clients/[id]/billing/addons/[eventId]/route.ts`
  - `src/app/(dashboard)/admin/clients/[id]/addon-provenance-card.tsx`
  - `src/lib/services/subscription-invoices.ts`
  - `drizzle/0029_solid_captain_britain.sql`
  - `src/app/api/cron/voice-usage-rollup/route.ts`
  - `src/app/api/cron/route.ts`
  - `src/app/api/team-members/route.ts`
  - `src/app/api/admin/twilio/purchase/route.ts`
  - `src/lib/billing/queries.ts`
  - `src/components/billing/UsageDisplay.tsx`
  - `src/app/(client)/client/billing/billing-client.tsx`

4. `GAP-104` Report delivery observability and retry UX
- Offer depends on trust through reporting; current docs note delivery visibility is limited.
- Progress (2026-02-24): `MS-11` Milestone A completed.
- Added explicit report delivery lifecycle model (`generated`, `queued`, `sent`, `failed`, `retried`) with per-cycle records and transition event audit trail.
- Added centralized lifecycle service and moved bi-weekly cron delivery-state mutation into the service.
- Added latest-delivery query helper for client-scoped status retrieval.
- Progress (2026-02-24): `MS-11` Milestone B completed.
- Added deterministic retry policy (attempt cap + exponential backoff + terminal classification).
- Added idempotent retry claim transition and dedicated retry cron endpoint.
- Refactored report email sending into a shared service used by primary and retry flows.
- Remaining: Milestones C-D (operator dashboard/retry UX, client-facing delivery clarity).
- Evidence:
  - `src/db/schema/report-deliveries.ts`
  - `drizzle/0030_lively_rage.sql`
  - `src/lib/services/report-delivery.ts`
  - `src/lib/services/report-delivery-retry.ts`
  - `src/lib/services/report-email.ts`
  - `src/lib/services/report-delivery.test.ts`
  - `src/lib/services/report-delivery-retry.test.ts`
  - `src/lib/services/report-generation.ts`
  - `src/app/api/cron/report-delivery-retries/route.ts`
  - `src/app/api/cron/route.ts`
  - `docs/specs/MS-11-REPORT-DELIVERY-OBSERVABILITY.md`

5. `GAP-105` Guaranteed operational catch-up when cron windows are missed
- Offer relies on deterministic monthly/biweekly outcomes; current jobs use strict run windows without explicit catch-up semantics.
- Evidence:
  - `src/app/api/cron/monthly-reset/route.ts`
  - `src/lib/services/report-generation.ts`

## P2 — Process/Scale Hardening

1. `GAP-201` Knowledge gap closure workflow UI + ownership
- Tracking primitives exist, but no explicit operator queue for closure and reporting.
- Evidence:
  - `src/db/schema/knowledge-gaps.ts`
  - `src/lib/agent/context-builder.ts`

2. `GAP-202` Onboarding quality gates beyond "presence checks"
- Current checklist uses binary existence; offer assumes production-quality setup.
- Evidence:
  - `src/app/api/public/onboarding/status/route.ts`

3. `GAP-203` Reminder recipient routing flexibility
- Contractor reminders currently target owner phone; offer operations may require routing to assistant/office role by policy.
- Evidence:
  - `src/app/api/cron/process-scheduled/route.ts`
  - `src/lib/automations/appointment-reminder.ts`

## Recommended Execution Order

1. Close all P0 gaps and block sales claims until parity is verified.
2. Close P1 gaps to reduce onboarding friction, trust risk, and support load.
3. Close P2 gaps for scale readiness and operator efficiency.

## Verification Rule

A gap can move to done only when both are true:
1. Functional verification exists (`02-TESTING-GUIDE.md` updated with explicit pass criteria).
2. Client-facing and operations docs are updated to match behavior exactly.

## Documentation Sync Rule (Mandatory)
For every completed MS milestone:
1. Update this file (`10-OFFER-PARITY-GAPS.md`).
2. Update `docs/specs/MS-IMPLEMENTATION-BOARD.md`.
3. Update `docs/specs/MS-CONTEXT-SNAPSHOT.md`.
4. If workflows changed, update:
- `docs/02-TESTING-GUIDE.md`
- `docs/04-OPERATIONS-GUIDE.md`
- `docs/05-USE-CASES.md`
