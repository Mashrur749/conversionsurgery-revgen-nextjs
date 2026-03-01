# Remaining Gaps

Last updated: 2026-02-26
Scope: Open items after security + access hardening wave

## Status Tags
- `P1: DONE`
- `P2: DONE`
- `P3: DONE`
- `REMAINING: []`
- `LAST_VERIFIED_COMMIT: Reliability audit: compliance gateway bypass closure (2026-02-26)`

## Scope Note
This file tracks the earlier launch-hardening wave (security/access/platform baseline), which is closed.

Offer parity gaps against the reviewed v2.1 offer architecture are tracked separately in:
- `docs/product/02-OFFER-PARITY-GAPS.md`

Current offer-parity note:
- `GAP-103` (add-on billing transparency) is complete with `MS-10` Milestones A-D implemented.
- `GAP-104` (report delivery observability) is complete with `MS-11` Milestones A-D implemented.
- `GAP-105` (cron catch-up guarantees) is complete with `MS-12` Milestones A-D implemented.
- `GAP-201` (knowledge-gap closure queue) is complete with `MS-13` Milestones A-D implemented.
- `GAP-202` (onboarding quality gates) is complete with `MS-14` Milestones A-D implemented.
- `GAP-203` (reminder routing flexibility) is complete with `MS-15` Milestones A-D implemented.

## P1 (Must complete before scale-up)
1. None.

## P2 (High priority)
1. None.

## P3 (Near-term)
1. None.

## Recently Closed
- Agency assigned-scope enforcement in dashboard/API paths.
- Portal page-level permission guards.
- Team member plan-limit enforcement.
- Onboarding wizard data persistence/failure blocking.
- Escalation owner fallback behavior.
- Cron orchestrator auth hardening.
- Public signup baseline and owner membership creation.
- Voice AI guardrail injection and SMS history context (lead-linked).
- Quiet-hours queue persistence via `scheduled_messages` (lead-linked).
- Billing-policy alignment for unlimited Professional plan defaults + observability-safe usage tracking.
- Dual-layer guarantee lifecycle automation with refund-review flagging.
- Monthly reset policy gating (`skippedByPolicy`) for unlimited-plan overage paths.
- Deterministic bi-weekly report generation and delivery.
- Bi-weekly "Without Us" directional model parity (ranges + assumptions + disclaimer + insufficient-data safeguards).
- Cancellation/export parity: 30-day cancellation notice and full data export lifecycle with 5-business-day SLA tracking.
- Quiet-hours policy mode switch parity with required message classification, policy diagnostics, and audit-mode change tracking.
- Appointment reminder parity for homeowner + contractor plus regression tests.
- Non-lead quiet-hours durable replay automation.
- Monthly access-review automation.
- Self-serve onboarding checklist and managed setup request path.
- Day-One Activation milestone tracking, SLA breach alerting, and Revenue Leak Audit delivery workflow.
- Cursor-based cron catch-up guarantees for monthly reset and bi-weekly reporting with operator backlog controls.
- Onboarding quality readiness gates with enforce/warn/off policy, transition blocking, and override audit trail.
- Reminder recipient routing policy with owner/assistant/team fallback chain, de-duplication, and delivery audit visibility.
- Twilio webhook observability hardening: centralized internal error telemetry and sanitized logging across webhook + Twilio client service paths.
- Operator containment controls: kill switches for outbound automations, Smart Assist auto-send, and Voice AI via system settings.
- Solo reliability operations hardening: `/admin/settings` reliability dashboard + deterministic replay script + export recovery drill tooling.
- API-wide centralized safe error logging hardening: all `src/app/api` routes now avoid raw `console.error` and route failures through sanitized handlers.
- Reliability audit (2026-02-26): CTIA HELP keyword auto-reply with compliance exempt-send audit logging.
- Reliability audit (2026-02-26): Atomic claim pattern in `check-missed-calls` cron to prevent double-processing on concurrent runs.
- Reliability audit (2026-02-26): Stuck message recovery in `process-scheduled` cron (reclaims messages stuck >5 min within 1-hour lookback).
- Reliability audit (2026-02-26): Schema unique constraints on `conversations.twilio_sid` (partial) and `active_calls.call_sid`; webhook-log indexes.
- Reliability audit (2026-02-26): Max-attempts retry cap on scheduled messages (default 3 attempts before permanent cancellation).
- Reliability audit (2026-02-26): `TwilioAmbiguousError` classification prevents duplicate texts on send timeouts (leaves message claimed for status-callback reconciliation).
- Reliability audit (2026-02-26): All lead-facing outbound SMS (Stripe payment confirmation, ring-group missed transfer) now routed through `sendCompliantMessage()`.

## Tracking Rule
Use this file as the live gap list. Historical resolved blocker inventories were collapsed into `archive/SYSTEM-BLOCKERS.md` archive form.
