# Testing Guide

Last updated: 2026-02-24
Audience: Engineering + Operations
Purpose: run a manual + automated release check without getting blocked mid-flow.
Last verified commit: `MS-10 Milestone C working tree`

## 0. Preflight (Run First)

### Required environment variables
Minimum required to execute this guide locally:
- `DATABASE_URL`
- `AUTH_SECRET`
- `NEXTAUTH_URL` (or `AUTH_URL` if your auth config expects it)
- `CRON_SECRET`

Optional but recommended for full managed-service simulation:
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `OPENAI_API_KEY`
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

## 1. Fast Validation (Required)

```bash
npm test
npm run build
```

Expected:
- Unit tests pass.
- Build passes.
- Known non-blocking warning today: Next.js middleware deprecation warning (`middleware` -> `proxy`).

Stop and fix before continuing if either command fails.

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
curl -i http://localhost:3000/api/cron/process-queued-compliance -H "Authorization: Bearer $CRON_SECRET"
```

Expected:
- Monthly reset is idempotent by period and includes billing policy result (`processed` or `skippedByPolicy` for unlimited plans).
- Bi-weekly report run is idempotent by period.
- Queued compliance replay processes non-lead queued items without duplicates.

Note:
- `monthly-reset` only executes full reset on day 1 (defensive guard).

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

### Step 15: Final smoke
1. Validate one end-to-end lead lifecycle: inbound -> response -> escalation/no escalation -> follow-up event.
2. Validate client portal permissions with at least two distinct roles.
3. Validate onboarding checklist loads for the test client and setup-request action succeeds.
4. Validate Day-One card and checklist remain in sync after audit delivery and manual milestone completion.

## 3. Useful Commands

```bash
# Automated baseline
npm test
npm run build

# Focused tests
npx vitest run src/lib/permissions/resolve.test.ts
npx vitest run src/lib/automations/appointment-reminder.test.ts
npx vitest run src/lib/compliance/quiet-hours-policy.test.ts
npx vitest run src/lib/services/without-us-model.test.ts
npx vitest run src/lib/services/day-one-policy.test.ts
npx vitest run src/lib/services/cancellation-policy.test.ts src/lib/services/data-export-bundle.test.ts src/lib/services/data-export-requests.test.ts

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
```

## 4. Release Gate

Release only if all pass:
1. `npm test`
2. `npm run build`
3. Sequential manual run (Section 2) completed without blockers
4. No open P1 items in `docs/06-REMAINING-GAPS.md`
5. No unresolved auth/compliance regressions from cron checks
