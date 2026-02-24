# Remaining Gaps

Last updated: 2026-02-24
Scope: Open items after security + access hardening wave

## Status Tags
- `P1: DONE`
- `P2: DONE`
- `P3: DONE`
- `REMAINING: []`
- `LAST_VERIFIED_COMMIT: 48740fa`

## Scope Note
This file tracks the earlier launch-hardening wave (security/access/platform baseline), which is closed.

Offer parity gaps against the reviewed v2.1 offer architecture are tracked separately in:
- `docs/10-OFFER-PARITY-GAPS.md`

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
- Billing seed + subscription-tier message limit consistency improvements.
- 30-day guarantee lifecycle automation with refund-review flagging.
- Overage billing line-item automation in monthly cycle.
- Deterministic bi-weekly report generation and delivery.
- Appointment reminder parity for homeowner + contractor plus regression tests.
- Non-lead quiet-hours durable replay automation.
- Monthly access-review automation.
- Self-serve onboarding checklist and managed setup request path.

## Tracking Rule
Use this file as the live gap list. Historical resolved blocker inventories were collapsed into `99-ARCHIVE-SYSTEM-BLOCKERS.md` archive form.
