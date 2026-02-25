# Operator Mastery Playbook

Last updated: 2026-02-25
Audience: Founder, spouse/operations monitor, future operators
Goal: become fully confident operating ConversionSurgery end-to-end for managed service delivery, while preparing for SaaS transition.
Last verified commit: `API-wide safe error logging hardening working tree (2026-02-25)`

## How to Use This Playbook
1. Execute phases in order.
2. Do not skip verification gates.
3. Log issues in your internal tracker, then rerun the failed step.

## Phase 1: System Foundation (Day 1)
Objective: understand architecture, auth boundaries, and mission-critical automations.

1. Read `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/07-LAUNCH-READINESS.md`.
2. Read `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/03-ACCESS-MANAGEMENT.md`.
3. Read `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/05-USE-CASES.md`.
4. Run baseline validation:
```bash
npm test
npm run build
```

Exit gate:
- You can explain who can access what (agency vs client scopes).
- You can explain all currently automated launch-critical flows (guarantee v2, monthly billing-policy cycle, bi-weekly reports, queue replay, access review).

## Phase 2: Controlled Walkthrough (Day 1-2)
Objective: run the full test path manually without getting blocked.

1. Execute `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/02-TESTING-GUIDE.md` Section `0` -> `4` in order.
2. Create at least one fresh test client via `/signup`.
3. Complete guided setup checks via `/signup/next-steps`.
4. Validate Day-One milestone/audit statuses from both:
- client checklist (`/signup/next-steps`)
- operator card (`/admin/clients/<id>`)
5. Validate cron auth and sub-jobs with real `CRON_SECRET`.

Exit gate:
- Full guide completes with no unresolved blockers.
- You can recover from common errors (missing role templates, env mismatch, auth failure).

## Phase 3: Daily Service Operations (Week 1)
Objective: run live managed-service operations reliably.

1. Execute `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/04-OPERATIONS-GUIDE.md` daily checklist.
2. Review escalation queue and SLA breaches every day.
3. Review pending onboarding clients and remove blockers.
4. Use Day-One Activation card to confirm:
- number and missed-call milestones complete on time
- call-your-number proof is explicitly confirmed
- Revenue Leak Audit is delivered with evidence link/summary
5. Review guarantee refund-review queue and billing events.
6. Review data-export SLA queue (requested/processing/ready/failed) and clear at-risk or breached items.
7. Review Smart Assist pending approvals/manual categories and timeout sends.
8. Review quarterly campaign status for each active client (planned/scheduled/launched/completed).
9. Review `Cron Catch-Up Controls` in `/admin/settings` and clear any backlog/stale state (`monthly_reset`, `biweekly_reports`).
10. Trigger cron sub-jobs manually if automation lag is detected.
11. Review Knowledge Gap Queue in `/admin/clients/<id>/knowledge?tab=queue` and clear stale high-priority items.
12. Review `Onboarding Quality Gates` panel for onboarding clients before switching to autonomous mode.
13. Review `Reminder Routing Policy` panel and verify chain previews match each client’s operating structure (owner vs assistant vs team).

Exit gate:
- You can run daily ops in under 30 minutes.
- No unresolved Sev1/Sev2 issues remain open at day end.

## Phase 4: Incident Mastery Drills (Week 2)
Objective: be operationally resilient when failures happen.

Run these drills on a staging/test environment:
1. Cron auth failure drill:
- Break `CRON_SECRET` intentionally.
- Confirm `401` on cron calls.
- Restore secret and verify recovery.
2. Escalation fallback drill:
- Remove normal recipients.
- Trigger escalation and confirm owner fallback.
3. Quiet-hours replay drill:
- Queue non-lead message during quiet-hours conditions.
- Run `/api/cron/process-queued-compliance` and verify replay.
4. Quiet-hours policy mode drill:
- Verify active mode in admin compliance dashboard (`Strict Queue` vs `Inbound Replies Allowed`).
- Switch environment policy mode in staging and rerun inbound SMS vs proactive sequence test.
- Confirm expected send/queue behavior and `quiet_hours_policy_mode_changed` audit event.
5. Reporting drill:
- Run `/api/cron/biweekly-reports` twice and verify idempotency.
- Run `/api/cron/report-delivery-retries` and verify failed deliveries respect backoff and retry attempt progression.
6. Day-One SLA drill:
- Create an onboarding client with pending milestones past target time in staging.
- Run `/api/cron/onboarding-sla-check`.
- Confirm open alerts appear in Day-One card and can be resolved.
7. Cron catch-up drill:
- Simulate missed monthly/bi-weekly windows by setting cursor to an older period in staging.
- Run `/api/cron/monthly-reset` and `/api/cron/biweekly-reports`.
- Confirm cursor/backlog transitions in `/admin/settings` and idempotent replay on rerun.
8. Deterministic replay drill:
- Run `./scripts/ops/replay.sh all-core`.
- Confirm every replayed endpoint returns 2xx and no silent failures.
9. Export recovery drill:
- Run `npm run ops:drill:export -- --client-id <client-id>`.
- Confirm bundle validation passes and includes required datasets.

Exit gate:
- You can diagnose and restore each drill without engineering help.

## Phase 5: Team Delegation and Governance (Week 2-3)
Objective: safely onboard your spouse and future assistants as operators.

1. Onboard spouse as agency member with scoped access (`assigned` by default).
2. Validate she can execute daily checklist and cannot access unassigned clients.
3. Add a contractor-side assistant on a test client and validate limits/permissions.
4. Review monthly access-review digest output and take actions.

Exit gate:
- Delegated operator can run core operations independently.
- Access boundaries are verified with negative tests.

## Phase 6: Client Delivery Excellence (Ongoing)
Objective: maintain service quality and retention.

1. Run onboarding quality review for every new client:
- number provisioned
- business hours configured
- knowledge base configured
- team access configured
2. Run bi-weekly outcome review:
- leads captured
- response time
- booking rate
- recovered revenue
- ROI multiple
3. Verify "Without Us" directional model quality on each bi-weekly report:
- assumptions/disclaimer present for `ready` model states
- insufficient-data states are tracked and corrected (missing inputs)
4. Run churn prevention checks:
- low ROI early warning
- high escalation load
- message delivery degradation

Exit gate:
- Clients receive measurable ROI evidence in each reporting cycle.
- Churn risks are identified before cancellation stage.

## Phase 7: SaaS Readiness Operator Lens (Next 3-6 Months)
Objective: transition from managed service to self-serve without operational regressions.

1. Track managed-only interventions that should become productized.
2. Build tutorial backlog from real onboarding friction.
3. Standardize role templates for customer-controlled assistants.
4. Keep compliance and tenant isolation checks in release gate.

Exit gate:
- Repeatable self-serve onboarding path exists without manual heroics.
- Managed service quality does not degrade during SaaS transition.

## Weekly Mastery Checklist
1. `npm test` and `npm run build` pass.
2. Cron orchestrator and key sub-jobs verified.
3. Escalation queue healthy and SLA breaches addressed.
4. Pending onboarding clients reviewed.
5. Day-One milestones and SLA alerts reviewed for every pending onboarding client.
6. Guarantee/refund-review queue reviewed.
7. Export SLA queue reviewed (no unresolved breached requests).
8. Smart Assist queue reviewed (pending manual approvals + delayed auto-sends).
9. Quarterly campaign lifecycle reviewed (no overdue launch targets).
10. Access-review outcomes reviewed.
11. Bi-weekly reports generated and delivered.
12. "Without Us" model status reviewed for every active client.
13. Add-on pricing transparency verified in client billing usage view and limit responses.
14. Add-on billing ledger freshness verified (recent team/number/voice rows present with no duplicate idempotency conflicts).
15. Add-on cycle CSV export and invoice line-item add-on labels validated for one active client.
16. Add-on dispute/provenance annotations reviewed and unresolved dispute states triaged.
17. Bi-weekly report delivery lifecycle reviewed (`generated/queued/retried/sent/failed`) from admin delivery panel and failed/backoff/terminal states triaged.
18. Cron catch-up backlog state reviewed in `/admin/settings` (no stale backlog for monthly reset or bi-weekly reports).
19. Knowledge Gap Queue reviewed (open vs closed trend, stale high-priority count, ownership coverage).
20. Onboarding quality gate failures reviewed and unresolved override paths triaged.
21. Reminder routing delivery audit entries reviewed for no-recipient/fallback anomalies.
22. `Solo Reliability Dashboard` reviewed at least once during operating hours.
23. Deterministic replay tooling validated after incidents (`./scripts/ops/replay.sh all-core`).
24. Weekly export recovery drill passed (`npm run ops:drill:export -- --client-id <client-id>`).
25. No active one-off client-specific code exceptions in delivery paths.

## Core References
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/02-TESTING-GUIDE.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/04-OPERATIONS-GUIDE.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/03-ACCESS-MANAGEMENT.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/05-USE-CASES.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/07-LAUNCH-READINESS.md`
