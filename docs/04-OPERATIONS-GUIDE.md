# Operations Guide

Last updated: 2026-02-25
Audience: Founder, operations monitor, on-call engineer
Last verified commit: `Runtime hardening + kill-switch working tree (2026-02-25)`

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
14. Review `/admin/settings` `Cron Catch-Up Controls` for monthly reset and bi-weekly backlog/staleness.
15. Spot-check billing transparency: team/phone limit responses and client billing usage card should show explicit add-on rates.
16. Verify add-on billing ledger health: recent `addon_billing_events` rows for team seats, numbers, and voice rollups exist for active clients.
17. Spot-check invoice UX parity: invoice line items include add-on labels for matching periods and CSV download works from client billing usage card.
18. Review admin client `Add-On Charge Provenance` card and clear any unresolved `disputed`/`reviewing` annotations.
19. Review Knowledge Gap Queue (`/admin/clients/<id>/knowledge?tab=queue`) for stale high-priority items and unresolved owners.
20. Review `Onboarding Quality Gates` panel for onboarding clients and clear critical failures before autonomous mode.
21. Review reminder delivery audit outcomes (`reminder_delivery_sent`, `reminder_delivery_no_recipient`) and fix routing-policy gaps for any no-recipient cases.
22. Review internal `error_log` records for new unresolved 5xx issues and triage by `source` + `created_at`.
23. Verify kill-switch settings in `/admin/settings` are in expected state (`false`) before normal campaign operations.
24. Review `Solo Reliability Dashboard` in `/admin/settings` and clear top failure clusters before end of day.
25. Confirm no active client requests are being fulfilled via one-off custom code paths (policy enforcement check).

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

curl -s "$BASE_URL/api/cron/knowledge-gap-alerts" \
  -H "Authorization: Bearer $CRON_SECRET"

# Deterministic replay helper (preferred)
./scripts/ops/replay.sh all-core
```

### Expected behavior
- 2xx responses with per-job result payloads.
- Any non-empty error bucket is an incident candidate.
- Quarterly planner is idempotent (no duplicate client/quarter campaign records).
- Quarterly alerts include overdue campaign count for launch-risk visibility.
- Bi-weekly report payload includes directional "Without Us" model section or explicit insufficient-data state.
- Monthly reset and bi-weekly report cron responses now include `catchup` payloads (processed periods, backlog remaining, stale-backlog indicators).
- `/admin/settings` `Cron Catch-Up Controls` must reflect the same backlog state shown by `/api/admin/cron-catchup`.
- Report delivery retry payload includes `retried/sent/failed/backoffPending/terminal` counters and should trend to zero failed terminal items.
- Terminal report-delivery failures trigger daily agency-owner email alert digest (deduped per UTC date).
- Client dashboard report-delivery card should mirror latest delivery state and expose report artifact download when available.
- Cancellation-confirmed clients receive export requests with 5-business-day due date and monitored SLA states.
- Quiet-hours policy mode is visible in admin compliance dashboard and should match current legal operating posture.
- Onboarding SLA checker marks overdue Day-One milestones and opens operator alerts/tasks.
- Voice usage rollup upserts add-on ledger rows by billing period with idempotency protection.
- Knowledge-gap alert cron sends one stale high-priority digest/day to agency owners when overdue queue items exist.
- Autonomous mode transitions are blocked when onboarding quality critical gates fail (unless audited override is active).
- Internal appointment/booking reminders resolve recipients via routing policy (owner/assistant/team fallback chain) instead of owner-only assumptions.
- Twilio webhook failures should appear in `error_log` with redacted context (no full phone numbers/body text/secrets).
- Cron endpoint failures should also appear in `error_log` via `safeErrorResponse` with sanitized context (no raw stack/body leakage).
- Lead/payment/support API failures should also appear in `error_log` via `safeErrorResponse` without exposing internal details in API responses.
- Claims, sequences, escalations, and analytics API failures should also use the same centralized `safeErrorResponse` path.
- If kill switches are enabled, message/voice behavior should match containment mode and be documented in incident notes.

## Deterministic Replay Commands
Preferred replay path for critical jobs:
```bash
export BASE_URL="http://localhost:3000"
export CRON_SECRET="<secret>"

./scripts/ops/replay.sh process-scheduled
./scripts/ops/replay.sh process-queued-compliance
./scripts/ops/replay.sh report-delivery-retries
./scripts/ops/replay.sh guarantee-check
./scripts/ops/replay.sh all-core
```

Rules:
- Use replay script commands instead of ad-hoc curl for incident response.
- Every replay command must return 2xx; otherwise incident stays open.

## Weekly Maintenance Budget (Solo)
Reserve protected engineering maintenance time every week:
- Minimum: `4 hours/week` in one protected block (or two 2-hour blocks).
- Focus only on:
  - reliability fixes
  - refactors
  - test expansion
  - documentation synchronization

Mandatory weekly command set:
```bash
npm run quality:no-regressions
npm run quality:feature-sweep
```

## Backup/Export Recovery Drill
Run once per week for one pilot client:
```bash
npm run ops:drill:export -- --client-id <client-id>
```

Success criteria:
- export bundle builds successfully
- required sections exist (`leads.csv`, `conversations.csv`, `pipeline_jobs.csv`)
- drill result is logged in weekly notes

## Alert Compression Policy (Solo)
- `Sev1`: immediate response, no batching.
- `Sev2/Sev3`: triage in hourly digest windows via `Solo Reliability Dashboard`.
- Do not send immediate notifications for non-Sev1 unless legal/compliance breach risk exists.

Hourly digest sweep:
1. Open `/admin/settings` -> `Solo Reliability Dashboard`.
2. Triage by this order:
   - failed/stale cron jobs
   - unresolved internal errors
   - report delivery failures
   - escalation SLA breaches
3. Execute replay commands for affected pipelines.

## No-Custom-Code Client Policy
Do not ship one-off code for a single client.

Required approach:
- solve with reusable settings, templates, role permissions, or policy flags
- document behavior in operations/testing docs in same commit

Reject requests that require:
- hardcoded client IDs in logic
- private fork behavior in main codebase
- hidden behavior toggles without documented policy keys

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

### Emergency Kill Switches
Set via `/admin/settings` using System Settings Manager:

| Setting Key | `true` behavior | Default |
|---|---|---|
| `ops.kill_switch.outbound_automations` | Blocks outbound automation sends through compliance gateway | `false` |
| `ops.kill_switch.smart_assist_auto_send` | Forces Smart Assist drafts to manual approval (disables auto-send) | `false` |
| `ops.kill_switch.voice_ai` | Bypasses Voice AI conversation and routes to human fallback | `false` |

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

## Engineering Quality Gate (Required Before Deploy)
```bash
npm run quality:no-regressions
npm run quality:feature-sweep
```
If this fails, do not deploy.

Recommended local enforcement:
```bash
npm run quality:install-agent-hooks
```

## Deploy + Rollback (Single Path)

### Deploy path (production)
1. Run release gate:
```bash
npm run quality:feature-sweep
```
2. Deploy Cloudflare worker build:
```bash
npm run cf:deploy
```
3. Verify active deployment:
```bash
npx wrangler deployments status
```
4. Run post-deploy smoke validation checklist from `docs/02-TESTING-GUIDE.md` (Final smoke + telemetry checks).

### Rollback path (production)
1. List recent versions:
```bash
npx wrangler versions list
```
2. Select last known-good `version-id`.
3. Roll traffic back to that version:
```bash
npx wrangler versions deploy <version-id>@100 --message "rollback to stable" -y
```
4. Confirm rollback state:
```bash
npx wrangler deployments status
```
5. Re-run smoke validation and confirm incident containment notes are updated.

Rule:
- Do not use ad-hoc deploy/rollback commands outside this path.

## References
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/app/api/cron/route.ts`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/src/lib/utils/cron.ts`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/02-TESTING-GUIDE.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/06-REMAINING-GAPS.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/01-OPERATOR-MASTERY-PLAYBOOK.md`
- `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/docs/14-RUNTIME-RELIABILITY-SYSTEM.md`
