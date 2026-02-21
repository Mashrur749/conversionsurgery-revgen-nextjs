# Operations Guide

Last updated: 2026-02-21
Audience: Founder, operations monitor, on-call engineer

## Daily Operations Checklist
1. Check cron health response and errors.
2. Check failed webhook logs (Twilio, Stripe, form/webhooks).
3. Review unresolved escalations and SLA breaches.
4. Review message delivery failures and opt-out anomalies.
5. Review onboarding clients in `pending` and move blockers (number, hours, knowledge, team).
6. Review subscriptions flagged `refund_review_required` under 30-day guarantee workflow.

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

curl -s "$BASE_URL/api/cron/process-queued-compliance" \
  -H "Authorization: Bearer $CRON_SECRET"

curl -s "$BASE_URL/api/cron/access-review" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Expected behavior
- 2xx responses with per-job result payloads.
- Any non-empty error bucket is an incident candidate.

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
