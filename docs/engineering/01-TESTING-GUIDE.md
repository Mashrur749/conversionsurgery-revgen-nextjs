# Testing Guide

Last updated: 2026-03-07
Audience: Engineering + Operations
Purpose: run a manual + automated release check without getting blocked mid-flow.
Last verified commit: `perf(agent): use fast model tier (Haiku) for analyze-decide node (2026-03-07)`

## 0. Preflight (Run First)

### Required environment variables
Minimum required to execute this guide locally:
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL` (or `AUTH_URL` if your auth config expects it)
- `CRON_SECRET`

Optional but recommended for full managed-service simulation:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `ANTHROPIC_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`

### One-time setup / refresh
```bash
npm install
npm run db:setup
npx tsx src/scripts/seed-role-templates.ts
```

Why this matters:
- Public signup and team flows require built-in role templates (`business_owner`, `team_member`).
- If role templates are missing, onboarding and team creation fail with 500s.

### Launch app
```bash
npm run dev
```

Keep this terminal open. Use another terminal for commands below.

Optional but recommended once per clone:
```bash
npm run quality:install-agent-hooks
```
This installs:
- pre-commit (`npm run ms:gate`)
- pre-push (`npm run quality:no-regressions`)

## 1. Fast Validation (Required)

```bash
npm run quality:no-regressions
```

Expected:
- `ms:gate`, logging guard, build, unit tests, and runtime smoke pass in one run.
- Known non-blocking warning today: Next.js middleware deprecation warning (`middleware` -> `proxy`).

Stop and fix before continuing if the command fails.

Additional runtime logging sanity check:
```bash
rg -n "console\\.error" src/app/api
npm run quality:logging-guard
```
Expected:
- No matches in `src/app/api`.
- `quality:logging-guard` passes.

## 2. Sequential Manual Test Run

Run in order. Do not skip prerequisites.

### Step 1: Create/select a test client
1. Open `/signup` and create a fresh test client (unique email).
2. Confirm response includes `clientId`.
3. Open `/signup/next-steps?clientId=<id>&email=<email>`.
4. Click `Load Setup Status`.

Expected:
- Checklist loads with `Workspace created: Done`.
- Day-One milestones are visible in checklist (`number live`, `missed-call text-back`, `call-your-number proof`, `Revenue Leak Audit delivered`).
- No `Client not found` / `Owner role template is missing` errors.

If blocked:
- `Owner role template is missing`: run `npx tsx src/scripts/seed-role-templates.ts`.
- `Client not found`: verify exact `clientId` + `email` pair from signup response.

### Step 1b: Day-One activation operator workflow (MS-09)
1. Open `/admin/clients/<clientId>`.
2. In `Day-One Activation` card, verify:
- milestones are listed with target timestamps and status chips.
- open alert count is visible.
3. Save an audit draft:
- fill summary
- fill at least one structured finding row (title, detail, priority; optional impact range)
- optional artifact URL and impact ranges
- click `Save Draft`
4. Deliver audit:
- click `Save + Mark Delivered`
5. Mark `Call-your-own-number proof` complete from the same card.
6. Run SLA checker:
```bash
curl -i http://localhost:3000/api/cron/onboarding-sla-check -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- Audit status transitions to `delivered` with delivery timestamp.
- `revenue_leak_audit_delivered` milestone marks complete after delivery.
- Activity trail logs draft/delivery/milestone events.
- SLA checker responds successfully and creates alerts only for overdue pending milestones.

### Step 2: Access + tenant isolation checks
Use two agency users if available: one full scope, one assigned scope.

1. With assigned-scope user, access only assigned client data in:
- `/admin/clients`
- `/leads`
- `/api/leads?clientId=<unassigned-client-id>`

Expected:
- Assigned client access works.
- Unassigned API access returns `403`.
- Unauthorized portal pages redirect/deny by permission guard.

### Step 3: Team management checks
1. In admin/client team UI, add team members up to plan limit.
2. Attempt to add one over the limit.
3. Deactivate and reactivate a member.

Expected:
- Add/restore works up to limit.
- Over-limit attempt fails with clear limit error.
- Non-owner cannot escalate to owner-equivalent access.

If blocked:
- `Default team member role not configured`: rerun role seed script.

### Step 3b: Add-on pricing transparency baseline (MS-10 A)
1. Trigger a team-member limit failure and confirm response copy includes explicit per-seat price.
2. Trigger a phone-number limit failure and confirm response copy includes explicit per-number price.
3. Open `/client/billing` and inspect `Usage This Period` card.

Expected:
- Add-on pricing section shows:
  - Additional Team Member price
  - Additional Phone Number price
  - Voice AI per-minute price
- Projected recurring add-on subtotal appears when extra seats/numbers exist.

### Step 3c: Add-on billing ledger + voice rollup baseline (MS-10 B)
1. Add/reactivate a team member above included seat limit.
2. Purchase an additional phone number above included number limit.
3. Run voice rollup cron:
```bash
curl -i http://localhost:3000/api/cron/voice-usage-rollup -H "Authorization: Bearer $CRON_SECRET"
```
4. Query `addon_billing_events` and confirm idempotent rows exist for:
- `extra_team_member` (`source_type=team_membership`)
- `extra_number` (`source_type=phone_number`)
- `voice_minutes` (`source_type=voice_calls_rollup`, when voice duration exists)

Expected:
- Events include period start/end, quantity, unit price, total, and idempotency key.
- Re-running the same actions/cron updates existing idempotent rows instead of creating duplicates.

### Step 3d: Add-on invoice itemization + CSV UX (MS-10 C)
1. Open `/client/billing`.
2. In `Usage This Period`, verify `Add-On Charges This Cycle` renders when cycle events exist.
3. Click `Download CSV` and verify export contains event-level rows with unit price, total, idempotency key, and source reference.
4. Expand recent invoices and confirm add-on line items appear with `Add-on:` labels for matching period events.

Expected:
- Billing UI surfaces event-level add-on charges for the cycle.
- Invoice history line items include add-on entries with clear labels and quantities.
- CSV export is permission-gated and matches ledger event totals.

### Step 3e: Add-on dispute/provenance workflow (MS-10 D)
1. Open `/admin/clients/<clientId>`.
2. In `Add-On Charge Provenance`, verify each add-on event shows:
- source + period
- invoice linkage (`invoice_number` or unlinked state)
- dispute status + note fields
3. Set one event to `reviewing` with a note and save.
4. Set the same event to `resolved` and save.
5. Download CSV again from client billing and verify dispute/invoice columns are populated.

Expected:
- Admin API enforces billing permissions for read/update.
- Dispute annotation saves and persists across refresh.
- Provenance linkage is visible from event to invoice context.

### Step 4: Onboarding persistence checks
1. Use onboarding wizard (`/admin/clients/new/wizard` or current onboarding flow in your environment).
2. Trigger a failure at team step (invalid payload/network interruption).
3. Return to review step and edit business fields.

Expected:
- Team step blocks progression on API failure.
- Review step edits persist after save/reload.

### Step 5: Messaging + escalation fallback
1. Create a manual lead from authenticated context (`/api/leads` via app flow or UI).
2. Trigger escalation path (conversation needing human escalation).
3. Ensure no eligible escalation recipients besides owner.

Expected:
- Escalation created.
- Owner fallback recipient is notified when no normal recipients qualify.
- Agency communication actions are marked executed only after successful execution.

### Step 6: Cron security
```bash
curl -i -X POST http://localhost:3000/api/cron
curl -i -X POST http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- First call: `401 Unauthorized`.
- Second call: `200` with cron job result payload.

If blocked:
- If both fail, verify `CRON_SECRET` matches app env exactly.

### Step 7: Dual-layer guarantee workflow
```bash
curl -i http://localhost:3000/api/cron/guarantee-check -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- Endpoint responds with success payload.
- Eligible subscriptions progress through guarantee-v2 states (`proof_pending`/`recovery_pending`) then to `fulfilled` or `refund_review_required`.
- Billing events logged for transition states.

### Step 8: Monthly policy cycle + reporting + queue replay
```bash
curl -i http://localhost:3000/api/cron/monthly-reset -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/biweekly-reports -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/report-delivery-retries -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/process-queued-compliance -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- Monthly reset returns `catchup` payload with processed periods/backlog and is idempotent by period.
- Bi-weekly report returns `catchup` payload with processed periods/backlog and is idempotent by period.
- `report_deliveries` rows are created per active client and include lifecycle state + timestamps.
- `report_delivery_events` rows reflect state transitions (`generated`, `queued`, `sent`, `failed`).
- Retry cron reports deterministic counters (`scanned`, `retried`, `sent`, `failed`, `backoffPending`, `terminal`) and only retries eligible failed deliveries.
- Re-running retry cron immediately should keep most failed rows in `backoffPending` until backoff windows are reached.
- If terminal rows exist, retry cron response includes terminal alert digest result.
- `/admin/reports` now includes `Report Delivery Operations` panel and manual retry actions.
- Client dashboard now includes `Bi-Weekly Report Delivery` card with current status summary.
- If report artifact exists, `Download Latest Report` link resolves to `/api/client/reports/[id]/download` and returns attachment JSON.
- Queued compliance replay processes non-lead queued items without duplicates.
- `/admin/settings` `Cron Catch-Up Controls` should show latest cursor state for `monthly_reset` and `biweekly_reports`.
- Manual run via `/api/admin/cron-catchup` should update backlog/cursor state without duplicate side effects on rerun.

### Step 9: Appointment reminder parity
Verification path A (required):
```bash
npx vitest run src/lib/automations/appointment-reminder.test.ts
```

Expected:
- Confirms homeowner + contractor reminder scheduling.

Verification path B (recommended manual):
1. Schedule appointment for a test lead.
2. Run scheduled cron:
```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```
3. Confirm contractor reminder path (`appointment_reminder_contractor`) is delivered to client owner phone.

### Step 10: Smart Assist parity (MS-04)
1. Ensure test client has:
- `aiAgentMode = assist`
- `smartAssistEnabled = true`
- `smartAssistDelayMinutes = 1` (for quick validation)
2. Send inbound message from a lead.
3. Verify a pending smart-assist draft appears with reference code.
4. Validate command paths from owner phone:
- `SEND <ref>` sends immediately.
- `EDIT <ref>: <new message>` sends edited message.
- `CANCEL <ref>` cancels draft.
5. For non-manual category drafts, leave untouched and run:
```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```
Expected:
- Draft auto-sends after delay when untouched.
- Manual-only categories do not auto-send.

### Step 11: Quarterly Growth Blitz parity (MS-05)
1. Run planner:
```bash
curl -i http://localhost:3000/api/cron/quarterly-campaign-planner -H "Authorization: Bearer $CRON_SECRET"
```
2. In admin client page, confirm campaign draft exists for current/next quarter.
3. Execute lifecycle:
- approve plan
- launch campaign (only after required assets complete)
- mark completed (with outcome summary)
4. Run alerts/digest:
```bash
curl -i http://localhost:3000/api/cron/quarterly-campaign-alerts -H "Authorization: Bearer $CRON_SECRET"
curl -i "http://localhost:3000/api/cron/quarterly-campaign-alerts?mode=weekly" -H "Authorization: Bearer $CRON_SECRET"
```
Expected:
- Planner is idempotent.
- Invalid lifecycle jumps are blocked.
- Campaign summary appears in client dashboard and report context.

### Step 12: Bi-weekly "Without Us" model parity (MS-06)
1. Generate bi-weekly report (or run cron in-window):
```bash
curl -i http://localhost:3000/api/cron/biweekly-reports -H "Authorization: Bearer $CRON_SECRET"
```
2. Open latest report detail in `/admin/reports/<id>`.
3. Verify "Without Us (Directional Model)" section behavior:
- If sufficient data: low/base/high ranges, inputs, and disclaimer are visible.
- If insufficient data: explicit missing-input state is shown (no fabricated values).

Expected:
- Report payload includes a model status (`ready` or `insufficient_data`) with versioned output.
- UI renders assumptions/disclaimer when status is `ready`.
- UI shows clear insufficiency state without fake metrics when status is `insufficient_data`.

### Step 13: Cancellation + export parity (MS-07)
1. Open `/client/cancel` and submit cancellation with `Cancel Anyway`.
2. Confirm success response includes:
- `effectiveCancellationDate` (30-day notice)
- `dataExport` object with `status`, `dueAt`, and optional `downloadPath`
3. Open `/client/cancel/confirmed`:
- Verify effective cancellation date is shown.
- Verify export SLA messaging shows 5 business days.
4. Verify export status + retrieval:
- In browser session, open `/api/client/exports` (same authenticated client portal session).
- Use UI download button when request status is `ready`.

Expected:
- Cancellation no longer references 7-day grace.
- Export request lifecycle exists (`requested|processing|ready|delivered|failed`).
- Downloaded package contains `leads.csv`, `conversations.csv`, and `pipeline_jobs.csv` sections.

### Step 14: Quiet-hours policy switch parity (MS-08)
1. Run policy decision unit tests:
```bash
npx vitest run src/lib/compliance/quiet-hours-policy.test.ts
```
2. In admin UI, open `/admin/compliance` and confirm `Quiet-Hours Policy` card renders:
- active mode label
- override count
- override rows (if any)
3. Verify diagnostics endpoint permissions from an agency admin session:
```bash
curl -i http://localhost:3000/api/admin/compliance/quiet-hours-policy
```
4. In staging, set `QUIET_HOURS_POLICY_MODE=INBOUND_REPLY_ALLOWED` and restart app.
5. Re-run one inbound-reply path (incoming SMS response) during quiet hours and one proactive path (scheduled follow-up) during quiet hours.

Expected:
- Inbound reply path can send under inbound-allowed mode.
- Proactive path still queues under inbound-allowed mode.
- Missing `messageClassification` is rejected fail-closed in tests/typecheck.

### Step 15: Knowledge Gap closure queue parity (MS-13)
1. Open `/admin/clients/<id>/knowledge?tab=queue`.
2. Confirm queue rows load with summary cards (`open`, `stale high priority`, `opened 7d`, `avg open age`).
3. Select one row and assign owner using bulk action.
4. Open `Manage` dialog for one row and set status `resolved` without KB link/note.

Expected:
- API blocks resolution with validation error (KB link + resolution note required).

5. Update same row with:
- status `resolved`
- linked KB entry
- resolution note >= 10 chars
6. For high-priority row (`priority >= 8`), verify `verified` transition requires reviewer policy.
7. Trigger stale gap digest:
```bash
curl -i http://localhost:3000/api/cron/knowledge-gap-alerts -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- Row lifecycle updates are persisted and visible on reload.
- Bulk actions update selected rows with per-row success/failure handling.
- Stale alert cron returns deterministic payload and dedupes to one digest/day.

### Step 16: Onboarding quality gates parity (MS-14)
1. Open `/admin/clients/<id>` and locate `Onboarding Quality Gates` panel.
2. Click `Re-evaluate` and confirm gate scores + action checklist render.
3. Attempt to set client `aiAgentMode=autonomous` while at least one critical gate is failing.

Expected:
- API returns `409` with onboarding quality payload and failure reasons.
- Admin panel shows failed gates and ordered action guidance.

4. In panel, add override reason (>= 10 chars) and click `Approve Override`.
5. Optionally toggle `Also enable autonomous mode now`.
6. Re-run `Re-evaluate` and confirm override state and decision reflect allowed transition.
7. Clear override and confirm decision returns to blocked (when critical failures still exist).

Expected:
- Override set/clear actions are persisted and auditable.
- Autonomous mode transition is policy-controlled (`enforce/warn/off`) and deterministic.

### Step 17: Reminder routing flexibility parity (MS-15)
1. Open `/admin/clients/<id>` and locate `Reminder Routing Policy` panel.
2. Configure:
- `Appointment Reminder (Internal)`: primary=`assistant`, fallback1=`owner`
- `Booking Notification`: primary=`owner`, fallback1=`assistant`, secondary=`escalation_team` (optional)
3. Save policy and verify `Resolved chain preview` updates.
4. Schedule an appointment and run:
```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```
5. Confirm internal reminder delivery follows configured route (assistant-first in this test).
6. Temporarily remove/disable primary recipient phone and rerun reminder path.

Expected:
- Fallback chain engages deterministically when primary recipient is unavailable.
- Duplicate phones are de-duplicated (no duplicate SMS to same number).
- Audit entries include reminder delivery outcomes (`reminder_delivery_sent` / `reminder_delivery_no_recipient`).

### Step 18: Kill-switch control validation
1. Open `/admin/settings`.
2. Set `ops.kill_switch.outbound_automations=true`.
3. Trigger one outbound automation path (for example, follow-up send path through normal workflow).
4. Confirm message is blocked/paused and no outbound send occurs.
5. Set `ops.kill_switch.outbound_automations=false`.
6. Set `ops.kill_switch.smart_assist_auto_send=true`.
7. Send inbound message to trigger Smart Assist draft.
8. Confirm draft requires manual approval (no delayed auto-send).
9. Set `ops.kill_switch.smart_assist_auto_send=false`.
10. Set `ops.kill_switch.voice_ai=true`.
11. Place test call through Voice AI number and confirm AI conversation is bypassed to human fallback path.
12. Set `ops.kill_switch.voice_ai=false`.
13. Place a normal test call (kill switch off) and confirm the two-step voice flow works:
    - Caller speaks, hears a filler phrase ("One moment please..." / "Let me look into that..." / "Sure, give me just a second...")
    - After a brief pause, the AI response plays and the conversation continues.
    - The filler phrase is served by `/api/webhooks/twilio/voice/ai/gather` (thin handler), which redirects to `/api/webhooks/twilio/voice/ai/process` (heavy AI handler) for the actual response.

Expected:
- Each switch changes behavior without code changes/redeploy.
- Switching back to `false` restores normal behavior.
- Voice AI two-step flow: caller never hears extended dead silence — filler phrase bridges the AI processing gap.

### Step 18b: HELP keyword + compliance audit logging validation
1. Send `HELP` as inbound SMS to a client Twilio number (via test or Twilio console).
2. Verify auto-reply contains business name, owner phone, and STOP instructions.
3. Send `INFO` — same expected behavior.
4. Query `audit_log` for `compliance_exempt_send` events:
```sql
select action, metadata, created_at
from audit_log
where action = 'compliance_exempt_send'
order by created_at desc
limit 10;
```
5. Verify events exist for HELP response, and separately for opt-in and opt-out confirmations (test those paths too).

Expected:
- HELP/INFO messages trigger auto-reply even for opted-out leads.
- All exempt sends (HELP, opt-in, opt-out confirmations) produce `compliance_exempt_send` audit events with `reason` in metadata.
- No compliance gateway blocking on exempt sends.

### Step 18c: Cron reliability controls validation
1. Run process-scheduled cron:
```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```
2. Verify response payload includes `sent`, `skipped`, `failed` counters.
3. To test stuck recovery: manually set a scheduled message to `sent=true, sent_at=<10 minutes ago>, cancelled=false` in DB, then rerun cron — message should be recovered (reset to `sent=false`).
4. To test max-attempts: manually set a scheduled message to `attempts=2, max_attempts=3`, trigger a failure, and verify it is cancelled with reason `Failed after 3 attempts`.

Expected:
- Stuck messages (claimed >5 min, scheduled within last hour) are recovered.
- Messages exceeding max attempts are permanently cancelled.
- Concurrent cron runs do not double-process due to atomic claims.

### Step 19: Final smoke
1. Validate one end-to-end lead lifecycle: inbound -> response -> escalation/no escalation -> follow-up event.
2. Validate client portal permissions with at least two distinct roles.
3. Validate onboarding checklist loads for the test client and setup-request action succeeds.
4. Validate Day-One card and checklist remain in sync after audit delivery and manual milestone completion.
5. Validate onboarding quality and reminder routing panels load without API/auth errors for assigned-scope agency users with client access.

### Step 20: Internal error telemetry + redaction check
1. Trigger one controlled webhook failure (example: send malformed/invalid-signature request to a Twilio webhook route in local test setup).
2. Query latest internal error rows in DB:
```sql
select source, error_type, error_message, error_details, created_at
from error_log
order by created_at desc
limit 20;
```
3. Verify new row exists for the failed route and inspect `error_details`.

Expected:
- Error is captured in `error_log` with route/source context.
- No plaintext message bodies, full phone numbers, or secrets are present in logged fields.
- Route still returns safe/generic response body to caller.

### Step 21: Solo reliability dashboard validation
1. Open `/admin/settings`.
2. Confirm `Solo Reliability Dashboard` renders without permission/API errors.
3. Click `Refresh` and verify snapshot updates.
4. Validate cards and sections show:
- failed/stale cron jobs
- webhook failures (24h)
- open escalations + SLA breaches
- report delivery failure counts
- unresolved internal errors + top sources

Expected:
- Data loads successfully for agency admin users with settings access.
- Dashboard is usable as an hourly triage cockpit.

### Step 22: Deterministic replay tooling validation
Run:
```bash
export CRON_SECRET="<secret>"
./scripts/ops/replay.sh all-core
```

Expected:
- Every replay call returns 2xx.
- Script exits non-zero on any failed job.

### Step 23: Export recovery drill validation
Run:
```bash
npm run ops:drill:export -- --client-id <client-id>
```

Expected:
- Script exits successfully.
- Output confirms required bundle sections: `leads.csv`, `conversations.csv`, `pipeline_jobs.csv`.

## 3. Useful Commands

```bash
# Automated baseline
npm test
npm run build
npm run quality:logging-guard
npm run quality:no-regressions
npm run quality:feature-sweep
# If local environment cannot bind ports (restricted sandbox only):
SKIP_RUNTIME_SMOKE=1 npm run quality:no-regressions

# Focused tests
npx vitest run src/lib/permissions/resolve.test.ts
npx vitest run src/lib/automations/appointment-reminder.test.ts
npx vitest run src/lib/compliance/quiet-hours-policy.test.ts
npx vitest run src/lib/services/without-us-model.test.ts
npx vitest run src/lib/services/day-one-policy.test.ts
npx vitest run src/lib/services/cancellation-policy.test.ts src/lib/services/data-export-bundle.test.ts src/lib/services/data-export-requests.test.ts
npx vitest run src/lib/services/knowledge-gap-validation.test.ts src/lib/services/knowledge-gap-queue.test.ts
npx vitest run src/lib/services/onboarding-quality.test.ts src/lib/services/reminder-routing.test.ts
npx vitest run src/lib/services/internal-error-log.test.ts
npx vitest run src/lib/services/ops-kill-switches.test.ts

# Cron endpoints
curl -i -X POST http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/guarantee-check -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/monthly-reset -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/biweekly-reports -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/process-queued-compliance -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/onboarding-sla-check -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/quarterly-campaign-planner -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/quarterly-campaign-alerts -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/knowledge-gap-alerts -H "Authorization: Bearer $CRON_SECRET"

# Deterministic replay helpers
./scripts/ops/replay.sh all-core
./scripts/ops/replay.sh report-delivery-retries

# Export recovery drill
npm run ops:drill:export -- --client-id <client-id>
```

## 4. Release Gate

Release only if all pass:
1. `npm run quality:no-regressions`
2. `npm run quality:feature-sweep`
3. `npm test`
4. `npm run build`
5. Sequential manual run (Section 2) completed without blockers
6. No open P1 items in `docs/archive/REMAINING-GAPS.md`
7. No unresolved auth/compliance regressions from cron checks
