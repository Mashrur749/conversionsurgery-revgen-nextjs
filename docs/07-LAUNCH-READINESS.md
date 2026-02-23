# Launch Readiness

Last updated: 2026-02-23
Scope: Managed service launch now + SaaS-readiness foundation (next ~6 months)

## Scope Note
This document reflects the launch-hardening baseline that was completed in February 2026.

Offer-to-implementation parity for the reviewed v2.1 offer is tracked separately in:
- `docs/10-OFFER-PARITY-GAPS.md`

## Status Tags
- `P1: DONE`
- `P2: DONE`
- `P3: DONE`
- `REMAINING: []`
- `LAST_VERIFIED_COMMIT: 2f4253c`

## Executive Status

| Area | Status | Notes |
|---|---|---|
| Access control + scope isolation | Ready | Assigned-scope enforcement + portal page guards implemented |
| Client onboarding baseline | Ready with caveats | Owner membership auto-created; wizard persistence improved |
| Team operations | Ready with caveats | Team limit enforcement added; escalation fallback added |
| Compliance gateway | Ready | Consent/opt-out/quiet hours enforced; durable replay covers lead + non-lead flows |
| Billing + plan limits | Ready | Team/lead/message controls + overage line-item automation in monthly cycle |
| Cron + reliability | Ready with caveats | Master cron now requires bearer secret; runbook updated |
| Self-serve foundation | Ready | Public signup + guided onboarding checklist + setup request path |
| Reporting | Ready | Deterministic bi-weekly report generation/delivery with idempotency guard |

## What Was Closed Recently
- Agency assigned-scope access enforcement across major APIs and dashboard selection.
- Client portal server-side page permission enforcement.
- Team member plan-limit enforcement in client team API.
- Onboarding wizard persistence and failure handling improvements.
- Escalation owner fallback when no eligible escalation recipients.
- Cron orchestrator auth hardening (`Bearer CRON_SECRET` required).
- Public signup baseline (`/signup`, `/api/public/signup`) with owner membership creation.
- Quiet-hours queue now persists into `scheduled_messages` and replays via cron for lead-linked messages.
- Voice AI gather path now uses guardrails and includes recent SMS context when `leadId` exists.
- Billing seed limits aligned to business plan limits; subscription create/change now sync monthly message limits by tier.
- 30-day guarantee lifecycle automation added: daily guarantee evaluator marks `fulfilled` or `refund_review_required` and logs billing events for review workflow.
- Overage billing line-item automation runs during monthly reset cycle with billing event audit trail.
- Bi-weekly report cron now generates and emails managed-service reports deterministically (idempotent by period).
- Appointment reminders now include both homeowner and contractor reminder scheduling paths.
- Quiet-hours replay now includes non-lead durable queue processing.
- Monthly access-review automation sends stale-access digest to agency owners.
- Self-serve onboarding now includes guided checklist and managed-setup request flow.

## Remaining Launch Blockers (Managed Service)

### P1
1. None.

### P2
1. None.

### P3
1. None.

## Go-Live Gate (Managed Service)
Release only when all are true:
- P1/P2/P3 items complete (currently satisfied).
- Test suite + build pass in CI for release commit.
- Ops runbook validated by one dry-run incident simulation.
- One full onboarding dry run from create client -> number -> first lead -> report.

## SaaS Positioning (Next Phase)
- Keep managed-service defaults but expose controlled self-serve paths behind feature flags.
- Build progressive onboarding (wizard + checklists + tutorial links).
- Add tenant-safe RBAC UI for customers to manage assistants directly.
