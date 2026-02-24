# Operations Guide

Last updated: 2026-02-24
Audience: Founder, operations monitor, on-call engineer
Last verified commit: `MS-11 Milestone C working tree`

## Daily Operations Checklist
1. Check cron health response and errors.
2. Check failed webhook logs (Twilio, Stripe, form/webhooks).
3. Review unresolved escalations and SLA breaches.
4. Review message delivery failures and opt-out anomalies.
5. Confirm quiet-hours policy mode in `/admin/compliance` (`Strict Queue` vs `Inbound Replies Allowed`) and check unexpected client overrides.
6. Review onboarding clients in `pending` and move blockers (number, hours, knowledge, team).
7. Review Day-One activation panel per onboarding client (milestones, open SLA alerts, audit delivery proof).
8. Review subscriptions in guarantee-v2 risk states (`proof_pending`, `recovery_pending`, `refund_review_required`) and action queues.
9. Review data export SLA queue in admin billing (`requested`, `processing`, `ready`, `failed`) and clear at-risk/breached items.
10. Review Smart Assist pending approvals and auto-send backlog (manual-only categories especially).
11. Review quarterly campaign lifecycle health (planned/scheduled/launched/completed + overdue launches).
12. Review latest bi-weekly report "Without Us" status per client (`ready` vs `insufficient_data`) and investigate repeated insufficiency.
13. Review `Report Delivery Operations` panel for latest cycle states (`generated`, `queued`, `retried`, `sent`, `failed`) and clear failed/terminal queues.
14. Spot-check billing transparency: team/phone limit responses and client billing usage card should show explicit add-on rates.
15. Verify add-on billing ledger health: recent `addon_billing_events` rows for team seats, numbers, and voice rollups exist for active clients.
16. Spot-check invoice UX parity: invoice line items include add-on labels for matching periods and CSV download works from client billing usage card.
17. Review admin client `Add-On Charge Provenance` card and clear any unresolved `disputed`/`reviewing` annotations.

## Cron Operations

### Required auth
All cron routes require:
- `Authorization: Bearer $CRON_SECRET`

### Manual trigger examples
```bash
export BASE_URL="http://localhost:3000"
export CRON_SECRET="<secret>"

curl -s -X POST "$BASE_URL/api/cron" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/process-scheduled" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/check-missed-calls" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/guarantee-check" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/biweekly-reports" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/report-delivery-retries" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/process-queued-compliance" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/quarterly-campaign-planner" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/quarterly-campaign-alerts" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/access-review" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/onboarding-sla-check" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/voice-usage-rollup" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Expected behavior
- 2xx responses with per-job result payloads.
- Any non-empty error bucket is an incident candidate.
- Quarterly planner is idempotent (no duplicate client/quarter campaign records).
- Quarterly alerts include overdue campaign count for launch-risk visibility.
- Bi-weekly report payload includes directional "Without Us" model section or explicit insufficient-data state.
- Bi-weekly report payload includes delivery counters and indicates whether period lock was updated (`lastRunUpdated`) or manual rerun is required.
- Report delivery retry payload includes `retried/sent/failed/backoffPending/terminal` counters and should trend to zero failed terminal items.
- Terminal report-delivery failures trigger daily agency-owner email alert digest (deduped per UTC date).
- Cancellation-confirmed clients receive export requests with 5-business-day due date and monitored SLA states.
- Quiet-hours policy mode is visible in admin compliance dashboard and should match current legal operating posture.
- Onboarding SLA checker marks overdue Day-One milestones and opens operator alerts/tasks.
- Voice usage rollup upserts add-on ledger rows by billing period with idempotency protection.

## Access Management Operations

### Onboard internal monitor (agency user)
1. Add agency team member.
2. Assign role template.
3. Set `assigned` scope unless full access is required.
4. Validate they can only access intended clients.

### Add contractor assistant (client-side)
1. Add client team member via portal/team flow.
2. Assign role template.
3. Confirm plan limit enforcement if at capacity.

## Incident Severity
- Sev1: Messaging outage, auth outage, cross-tenant exposure, billing corruption.
- Sev2: Automation lag, cron failures for core jobs, onboarding blockers.
- Sev3: UI defects with operational workaround.

## Incident Response Runbook
1. Acknowledge and scope impact (clients, revenue flow, compliance risk).
2. Contain (disable automation path/feature flag if needed).
3. Restore core service path.
4. Verify with smoke tests.
5. Write incident notes and remediation actions.

## Smoke Tests After Incident
1. Agency login and scoped client switch.
2. Client portal login and permission-gated page access.
3. Inbound message -> compliant outbound response path.
4. Escalation routing fallback behavior.
5. Cron orchestrator run with authenticated request.

## Metrics to Watch Weekly
- MRR trend and churn.
- Response time to lead.
- Escalation SLA breaches.
- Message send failure rate.
- API cost per active client.

## References
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/app/api/cron/route.ts`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/lib/utils/cron.ts`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/02-TESTING-GUIDE.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/06-REMAINING-GAPS.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/01-OPERATOR-MASTERY-PLAYBOOK.md`
