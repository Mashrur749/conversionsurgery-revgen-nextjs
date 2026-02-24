# Offer Parity Gaps (v2.1)

Last updated: 2026-02-24
Scope: Gap register against the reviewed offer architecture ("ConversionSurgery Grand Slam Offer v2.1")
Objective: Ensure paying-client delivery matches every sold promise.

## Status Tags
- `P0: OPEN`
- `P1: OPEN`
- `P2: OPEN`
- `SOURCE_OFFER: GRAND-SLAM-v2.1 (2026-02-23)`
- `LAST_VERIFIED_COMMIT: c94dad6`

## Executive Summary
The current platform is launch-ready for the earlier managed-service baseline, but it is not yet promise-parity complete for the reviewed v2.1 offer.

Highest-risk mismatches for paying clients are:
- Unlimited messaging/no caps/no overages is not implemented.
- 30-day + 90-day guarantee model (with low-volume extension formula) is not implemented.
- Smart assist auto-send behavior is not implemented.
- Low-friction estimate trigger stack is incomplete.
- Quarterly Growth Blitz operations are not productized.
- Cancellation/data-export contract terms are not fully implemented in product workflows.

## Spec Mapping (One Spec Per Gap)

| Gap ID | Priority | Spec | Status |
|---|---|---|---|
| GAP-001 | P0 | `docs/specs/MS-01-UNLIMITED-MESSAGING-PARITY.md` | Done |
| GAP-002 | P0 | `docs/specs/MS-02-GUARANTEE-V2-PARITY.md` | In Progress (Milestone A Done) |
| GAP-003 | P0 | `docs/specs/MS-03-ESTIMATE-TRIGGER-STACK.md` | Spec Ready |
| GAP-004 | P0 | `docs/specs/MS-04-SMART-ASSIST-AUTO-SEND.md` | Spec Ready |
| GAP-005 | P0 | `docs/specs/MS-05-QUARTERLY-GROWTH-BLITZ.md` | Spec Ready |
| GAP-006 | P0 | `docs/specs/MS-06-BIWEEKLY-WITHOUT-US-MODEL.md` | Spec Ready |
| GAP-007 | P0 | `docs/specs/MS-07-CANCELLATION-EXPORT-PARITY.md` | Spec Ready |
| GAP-101 | P1 | `docs/specs/MS-08-QUIET-HOURS-CLASSIFICATION.md` | Spec Ready |
| GAP-102 | P1 | `docs/specs/MS-09-DAY-ONE-ACTIVATION-TRACKING.md` | Spec Ready |
| GAP-103 | P1 | `docs/specs/MS-10-ADDON-BILLING-TRANSPARENCY.md` | Spec Ready |
| GAP-104 | P1 | `docs/specs/MS-11-REPORT-DELIVERY-OBSERVABILITY.md` | Spec Ready |
| GAP-105 | P1 | `docs/specs/MS-12-CRON-CATCHUP-GUARANTEES.md` | Spec Ready |
| GAP-201 | P2 | `docs/specs/MS-13-KB-GAP-CLOSURE-QUEUE.md` | Spec Ready |
| GAP-202 | P2 | `docs/specs/MS-14-ONBOARDING-QUALITY-GATES.md` | Spec Ready |
| GAP-203 | P2 | `docs/specs/MS-15-REMINDER-ROUTING-FLEXIBILITY.md` | Spec Ready |

## Component Parity Matrix

| Offer component | Current state | Parity |
|---|---|---|
| Revenue Recovery Engine core automations (missed call, follow-up, reminders, re-engagement) | Core automation paths exist | Partial |
| Near-instant response during compliant hours | Implemented with quiet-hours blocking/queue behavior | Partial |
| Estimate Trigger Methods (SMS keyword, quick-reply, dashboard, fallback nudge) | Dashboard/API exists; full low-friction trigger stack missing | Gap |
| Unlimited conversations/messages, no caps/no overages | Message limits + overage billing active | Gap |
| Dedicated number + CRM | Implemented | Ready |
| Additional team/number paid add-ons | Limits enforced; add-on billing workflow not fully productized | Gap |
| Voice AI optional add-on at $0.15/min | Voice AI exists; transparent per-minute billing workflow not fully wired | Gap |
| Day-One Activation package | Number + missed-call path exist; audit/SLA tracking workflow not productized | Partial |
| Smart assist mode (5-minute auto-send window) | Not implemented | Gap |
| KB QA process with gap closure loop | Gap tracking primitives exist; full operational closure loop missing | Partial |
| 30-day proof-of-life + 90-day recovery guarantee | Current guarantee logic is 30-day recovered-lead workflow | Gap |
| Low-volume guarantee extension formula | Not implemented | Gap |
| Quarterly Growth Blitz | No quarterly campaign scheduler/workflow | Gap |
| Bi-weekly scoreboard + "Without Us" line | Bi-weekly reports exist; "Without Us" methodology not implemented | Gap |
| Month-to-month, 30-day cancellation, 5-day export SLA | Current cancellation workflow uses 7-day grace path; full export workflow incomplete | Gap |

## P0 — Must Close Before Selling v2.1 As-Written

1. `GAP-001` Unlimited messaging/no caps/no overage parity
- Offer promise: no message caps, no lead limits, no overage charges.
- Current behavior: `monthlyMessageLimit` checks and overage billing are active.
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
- Current behavior: 30-day recovered-lead evaluator and `refund_review_required` only.
- Progress (2026-02-24): `MS-02` Milestone A completed.
- Added guarantee-v2 state machine domain module (`src/lib/services/guarantee-v2/`).
- Added explicit v2 statuses and legacy->v2 mapping/backfill helpers.
- Added new subscription guarantee window/extension fields required for proof + recovery lifecycle.
- Added safe migration SQL with `IF NOT EXISTS` and backfill mapping/initialization.
- Remaining: Milestones B-E (QLE evaluator, 90-day recovery evaluator, low-volume extension formula, UI visibility).
- Evidence:
  - `src/lib/services/guarantee-monitor.ts`
  - `src/lib/services/subscription.ts`
  - `src/app/api/cron/guarantee-check/route.ts`

3. `GAP-003` Estimate trigger stack incomplete
- Offer promise: SMS keyword trigger, notification quick-reply trigger, dashboard trigger, and fallback nudge.
- Current behavior: dashboard/API trigger exists; action-prompt "YES" path for `start_sequences` is not integrated.
- Evidence:
  - `src/app/api/sequences/estimate/route.ts`
  - `src/lib/automations/estimate-followup.ts`
  - `src/lib/services/agency-communication.ts` (`start_sequences` throws integration error)

4. `GAP-004` Smart assist auto-send window missing
- Offer promise: assist mode with default 5-minute auto-send window and category controls.
- Current behavior: no implemented timed auto-send approval window.
- Evidence:
  - `src/lib/automations/incoming-sms.ts`
  - `src/db/schema/clients.ts` (`aiAgentMode` exists but no smart-assist timing control)

5. `GAP-005` Quarterly Growth Blitz not productized
- Offer promise: quarterly campaign cadence with scheduling/communication expectations.
- Current behavior: no quarterly campaign engine, scheduling workflow, or evidence tracking path.
- Evidence:
  - no quarter/campaign scheduling implementation in `src/app/api/cron/*` and `src/lib/services/*`

6. `GAP-006` Bi-weekly "Without Us" methodology not implemented
- Offer promise: standardized modeled low/base/high risk line in bi-weekly report.
- Current behavior: report generation includes raw metrics/ROI summary but no "Without Us" modeled section.
- Evidence:
  - `src/lib/services/report-generation.ts`

7. `GAP-007` Cancellation/export terms mismatch
- Offer promise: 30 calendar day cancellation notice and full export delivery within 5 business days.
- Current behavior: cancellation confirm path uses 7-day grace argument; no full bundled export workflow (lead + conversation + pipeline) with SLA tracking.
- Evidence:
  - `src/app/api/client/cancel/route.ts`
  - `src/lib/services/cancellation.ts`
  - `src/app/api/leads/export/route.ts` (lead CSV only)

## P1 — High Priority CX Parity (First 30 Days)

1. `GAP-101` Quiet-hours inbound-reply classification decision path
- Offer posture is qualifier-based pending legal review; operational behavior should be explicitly configurable after legal decision.
- Evidence:
  - `src/lib/compliance/compliance-gateway.ts`

2. `GAP-102` Day-One Activation SLA and Revenue Leak Audit workflow tracking
- Offer commits explicit activation/audit timelines; product lacks a dedicated tracked workflow for these deliverables.
- Evidence:
  - onboarding endpoints exist but no audit artifact workflow:
  - `src/app/api/public/onboarding/status/route.ts`
  - `src/app/api/public/onboarding/request-setup/route.ts`

3. `GAP-103` Add-on billing clarity for extra team members/phone numbers/voice
- Offer positions transparent add-ons; system currently emphasizes plan limits and overages but does not fully expose end-to-end add-on invoice transparency.
- Evidence:
  - team/phone limits: `src/app/api/team-members/route.ts`, `src/app/api/admin/twilio/purchase/route.ts`
  - voice usage tracking only: `src/lib/services/usage-tracking.ts`, `src/db/schema/api-usage-monthly.ts`

4. `GAP-104` Report delivery observability and retry UX
- Offer depends on trust through reporting; current docs note delivery visibility is limited.
- Evidence:
  - `src/lib/services/report-generation.ts`
  - `docs/08-UX-AUDIT.md`

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
