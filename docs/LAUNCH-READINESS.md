# Launch Readiness

Last updated: 2026-02-21
Scope: Managed service launch now + SaaS-readiness foundation (next ~6 months)

## Executive Status

| Area | Status | Notes |
|---|---|---|
| Access control + scope isolation | Ready | Assigned-scope enforcement + portal page guards implemented |
| Client onboarding baseline | Ready with caveats | Owner membership auto-created; wizard persistence improved |
| Team operations | Ready with caveats | Team limit enforcement added; escalation fallback added |
| Compliance gateway | Mostly ready | Consent/opt-out/quiet hours enforced; quiet-hour queue replay still a gap |
| Billing + plan limits | Mostly ready | Team/lead/message controls exist; overage invoicing automation still needed |
| Cron + reliability | Ready with caveats | Master cron now requires bearer secret; runbook updated |
| Self-serve foundation | Baseline ready | Public signup route/page added; lifecycle still managed-service-first |
| Reporting | Partial | Weekly/daily present; bi-weekly managed-service report automation needs hardening |

## What Was Closed Recently
- Agency assigned-scope access enforcement across major APIs and dashboard selection.
- Client portal server-side page permission enforcement.
- Team member plan-limit enforcement in client team API.
- Onboarding wizard persistence and failure handling improvements.
- Escalation owner fallback when no eligible escalation recipients.
- Cron orchestrator auth hardening (`Bearer CRON_SECRET` required).
- Public signup baseline (`/signup`, `/api/public/signup`) with owner membership creation.

## Remaining Launch Blockers (Managed Service)

### P1
1. Quiet-hours queued messages are logged as queued, but replay/delivery orchestration is not fully explicit.
2. 30-day guarantee measurement + refund/flag workflow is not automated end-to-end.

### P2
1. Overage billing line-item automation is incomplete.
2. Bi-weekly performance report generation/delivery should be fully deterministic and audited.
3. Appointment reminders to both homeowner and contractor need explicit verification in regression tests.

### P3
1. Periodic access review automation for agency/client memberships.
2. Self-serve onboarding completion pipeline (number provisioning + guided setup + tutorial readiness).

## Go-Live Gate (Managed Service)
Release only when all are true:
- P1 items complete.
- Test suite + build pass in CI for release commit.
- Ops runbook validated by one dry-run incident simulation.
- One full onboarding dry run from create client -> number -> first lead -> report.

## SaaS Positioning (Next Phase)
- Keep managed-service defaults but expose controlled self-serve paths behind feature flags.
- Build progressive onboarding (wizard + checklists + tutorial links).
- Add tenant-safe RBAC UI for customers to manage assistants directly.
