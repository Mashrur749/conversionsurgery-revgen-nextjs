# Launch Readiness

Last updated: 2026-02-24
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
- `LAST_VERIFIED_COMMIT: MS-10 Milestone C working tree`

## Executive Status

| Area | Status | Notes |
|---|---|---|
| Access control + scope isolation | Ready | Assigned-scope enforcement + portal page guards implemented |
| Client onboarding baseline | Ready with caveats | Owner membership auto-created; wizard persistence improved |
| Team operations | Ready with caveats | Team limit enforcement added; escalation fallback added |
| Compliance gateway | Ready | Consent/opt-out/quiet hours enforced; durable replay covers lead + non-lead flows |
| Billing + plan policy | Ready with caveats | Unlimited policy defaults and cancellation/export parity are implemented; add-on transparency remains tracked in offer gaps |
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
- Billing policy aligned with offer defaults; Professional seeds now use unlimited messaging/leads with overage-disabled behavior and retained usage observability.
- Dual-layer guarantee lifecycle automation added: daily evaluator handles proof/recovery windows and marks `fulfilled` or `refund_review_required` with billing-event audit trail.
- Monthly reset now records billing-policy outcomes (`processed` vs `skippedByPolicy`) for audit-safe unlimited-plan handling.
- Bi-weekly report cron now generates and emails managed-service reports deterministically (idempotent by period).
- Bi-weekly reports now include "Without Us" directional model payload (low/base/high), assumptions, disclaimers, and insufficient-data guard state.
- Cancellation workflow now enforces 30-day notice with tracked export SLA and expiring secure download links for full lead/conversation/pipeline exports.
- Quiet-hours policy mode switch is now implemented with auditable classification decisions and admin diagnostics visibility.
- Appointment reminders now include both homeowner and contractor reminder scheduling paths.
- Quiet-hours replay now includes non-lead durable queue processing.
- Monthly access-review automation sends stale-access digest to agency owners.
- Self-serve onboarding now includes guided checklist and managed-setup request flow.
- Day-One Activation workflow now has tracked milestones, SLA breach alerts, and Revenue Leak Audit delivery proof.

## Remaining Launch Blockers (Managed Service)

### P1
1. None.

### P2
1. None.

### P3
1. None.

## Offer Parity Progress Snapshot
Active offer parity tracking lives in:
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/10-OFFER-PARITY-GAPS.md`

Current snapshot at this commit:
1. Done: `GAP-001` unlimited messaging parity.
2. Done: `GAP-002` guarantee v2 parity.
3. Done: `GAP-003` estimate trigger stack parity.
4. Done: `GAP-004` smart assist auto-send parity.
5. Done: `GAP-005` quarterly growth blitz productization.
6. Done: `GAP-006` bi-weekly "Without Us" model parity.
7. Done: `GAP-007` cancellation/export parity.
8. Done: `GAP-101` quiet-hours policy classification switch parity.
9. Done: `GAP-102` Day-One Activation SLA + Revenue Leak Audit tracking parity.
10. In progress: `GAP-103` add-on billing transparency (`MS-10` Milestones A-C complete; Milestone D remaining).

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
