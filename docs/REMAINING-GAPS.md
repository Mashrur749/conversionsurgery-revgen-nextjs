# Remaining Gaps

Last updated: 2026-02-21
Scope: Open items after security + access hardening wave

## P1 (Must complete before scale-up)
1. None.

## P2 (High priority)
1. Overage charging automation for invoices needs completion.
2. Bi-weekly managed-service performance reports require stronger automation and delivery traceability.
3. Appointment reminder parity (homeowner + contractor) must be re-verified with tests.
4. Quiet-hours durable replay should be extended to non-lead system messages (lead-linked messages are now durable).

## P3 (Near-term)
1. Access review automation for agency/client memberships.
2. Self-serve onboarding completion beyond signup baseline (guided setup, provisioning workflow).
3. Formal customer tutorial system (planned for SaaS launch phase).

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

## Tracking Rule
Use this file as the live gap list. Historical resolved blocker inventories were collapsed into `SYSTEM-BLOCKERS.md` archive form.
