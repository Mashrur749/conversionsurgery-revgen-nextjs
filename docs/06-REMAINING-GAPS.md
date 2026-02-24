# Remaining Gaps

Last updated: 2026-02-24
Scope: Open items after security + access hardening wave

## Status Tags
- `P1: DONE`
- `P2: DONE`
- `P3: DONE`
- `REMAINING: []`
- `LAST_VERIFIED_COMMIT: MS-12 Milestone D working tree`

## Scope Note
This file tracks the earlier launch-hardening wave (security/access/platform baseline), which is closed.

Offer parity gaps against the reviewed v2.1 offer architecture are tracked separately in:
- `docs/10-OFFER-PARITY-GAPS.md`

Current offer-parity note:
- `GAP-103` (add-on billing transparency) is complete with `MS-10` Milestones A-D implemented.
- `GAP-104` (report delivery observability) is complete with `MS-11` Milestones A-D implemented.
- `GAP-105` (cron catch-up guarantees) is complete with `MS-12` Milestones A-D implemented.

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

## Tracking Rule
Use this file as the live gap list. Historical resolved blocker inventories were collapsed into `99-ARCHIVE-SYSTEM-BLOCKERS.md` archive form.
