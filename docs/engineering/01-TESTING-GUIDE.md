# Testing Guide

Last updated: 2026-03-28
Audience: Engineering + Operations
Purpose: run a manual + automated release check without getting blocked mid-flow.
Last verified commit: `feat: AI attribution — link funnel events to agent decisions (2026-03-28)`

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
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (required for Steps 13/22/26)
- `STRIPE_PRICE_*` env vars (required for Step 26 — subscription checkout)
- `RESEND_API_KEY`

### Required for revenue-engine automation tests (Steps 22-25)

These are configured in-app, not via env vars. Set them up after your first admin login:

- **Stripe connected:** `STRIPE_SECRET_KEY` must be set and valid. Step 22 (payment reminders) creates Stripe payment links — without it, the `paymentLink` field will be `null` and the test is incomplete.
- **Google Business URL:** Set `googleBusinessUrl` on your test client in the admin UI (e.g., `https://g.page/your-business/review`). Step 23 (review requests) includes this URL in the SMS — without it, the review SMS will have a blank link.
- **Agency Twilio number (#5):** Configured at `/admin/agency` (see phone number table below). Required for all owner/team notification SMS in Steps 5-7, 22-25.

### One-time setup / refresh

```bash
npm install
npm run db:migrate
npm run db:seed -- --lean
```

The `--lean` flag seeds only reference data the product needs to function (subscription plans, role templates, flow templates, system settings, admin account, template variants) — no demo clients, leads, or conversations. You create everything else through the product UI, exactly like a real delivery.

Why this matters:

- Public signup and team flows require built-in role templates (`business_owner`, `team_member`).
- If role templates are missing, onboarding and team creation fail with 500s.

### Admin account

The seed script (`npm run db:setup`) creates an admin user at `rmashrur749@gmail.com` (or `ADMIN_EMAIL` from `.dev.vars`) with `agency_owner` role and `all` client scope.

Log in at `/login` with that email — a magic link is sent via Resend (`RESEND_API_KEY` must be set in `.dev.vars`).

### Real-device test setup (Twilio Dev Phone + ngrok)

For SMS/voice tests to work end-to-end, you need real Twilio numbers, a tunnel, and Dev Phone instances. This replaces any simulated or scripted approach — every interaction goes through the actual product.

**Buy 5 Twilio numbers** (SMS + Voice capable) in the [Twilio Console](https://console.twilio.com/):

| #   | Role              | How you interact                                                                           |
| --- | ----------------- | ------------------------------------------------------------------------------------------ |
| #1  | **Business line** | Assigned to the test client in Step 1. Receives all inbound SMS/calls via webhooks.        |
| #2  | **Lead**          | Dev Phone (port 3001). Text #1 to simulate a lead reaching out.                            |
| #3  | **Owner**         | Dev Phone (port 3002). Receives agency notifications. Sends approval commands to #1.       |
| #4  | **Team member**   | Dev Phone (port 3003). Receives escalation SMS and hot transfer calls.                     |
| #5  | **Agency line**   | The platform&apos;s outbound number. Sends Smart Assist drafts, escalation alerts, weekly digests, and other agency notifications to #3 and #4. Not a Dev Phone — configured in-app (see below). |

> **#1 vs #5 — why two outbound numbers?** #1 (Business Line) sends lead-facing messages — AI responses, follow-ups, appointment reminders. #5 (Agency Line) sends owner/team-facing notifications — draft approvals, escalation alerts, digests. Keeping them separate lets the owner distinguish "a lead texted my business" from "the platform needs my attention."

**Configure the Agency Line (#5):** After the app is running and you have logged in as admin, go to `/admin/agency` and set the agency Twilio number to #5. This stores it in `system_settings` under the key `agency_twilio_number`. If this is not configured, all owner/team notifications via SMS will silently fail.

**Install tooling** (one-time):

```bash
brew install ngrok
npm install -g twilio-cli
twilio plugins:install @twilio/plugin-dev-phone
twilio login  # follow prompts with your Twilio credentials
```

**Start infrastructure** (every test session, 5 terminals):

```bash
# Terminal 1 — tunnel
ngrok http 3000
# Copy the https URL (e.g., https://abc123.ngrok-free.app)

# Terminal 2 — app
npm run dev

# Terminal 3 — Lead Dev Phone
twilio dev-phone --port 3001
# In browser UI: select Lead number (#2)

# Terminal 4 — Owner Dev Phone
twilio dev-phone --port 3002
# In browser UI: select Owner number (#3)

# Terminal 5 — Team Member Dev Phone
twilio dev-phone --port 3003
# In browser UI: select Team Member number (#4)
```

**Configure Twilio webhooks** for Business Line (#1) only — in [Twilio Console](https://console.twilio.com/) → Phone Numbers → #1:

| Webhook | URL                                             | Method |
| ------- | ----------------------------------------------- | ------ |
| SMS     | `https://<ngrok-url>/api/webhooks/twilio/sms`   | POST   |
| Voice   | `https://<ngrok-url>/api/webhooks/twilio/voice` | POST   |

> **Do NOT configure webhooks on #2, #3, #4, or #5.** Dev Phone manages #2–#4 automatically. #5 is outbound-only (agency notifications) and never receives inbound traffic.

Add to `.dev.vars`:

```
TWILIO_WEBHOOK_BASE_URL=https://<ngrok-url>
```

> **Voice note:** Dev Phone uses WebRTC for calls. SMS works perfectly. Voice calls work but can be less reliable than a real phone — if hot transfer or voice AI tests are flaky, temporarily swap in a real phone for the team member role.

See [`scripts/test/tunnel-setup.md`](../../scripts/test/tunnel-setup.md) for a condensed quick-reference.

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

This section follows the **operator&apos;s managed-service delivery journey** &mdash; from creating a client through ongoing operations to offboarding. Steps 1-14 mirror the chronological delivery timeline from the offer doc. Steps 15-21 cover platform administration and infrastructure checks. Steps 22-25 cover revenue-engine automations (payment collection, review generation, no-show recovery, win-back). Steps 26-28 cover subscription checkout, CSV import (including quote reactivation), and AI safety. Step 29 covers AI attribution. Step 30 covers self-serve phone provisioning. Step 31 covers AI message flagging. Step 32 covers decision confidence and model routing. Step 33 covers pre-launch conversation scenario tests. Step 34 covers AI criteria tests (the pre-launch quality gate). Step 35 is the capstone end-to-end smoke.

> **Self-serve signup testing** (the public `/signup` flow) is covered separately in [`TESTING-SELF-SERVE.md`](./TESTING-SELF-SERVE.md).

---

### Step 1: Create a test client (admin path)

For managed-service testing, use the admin wizard. For self-serve signup testing, see [`TESTING-SELF-SERVE.md`](./TESTING-SELF-SERVE.md).

1. Open `/admin/clients/new/wizard` (or `/admin/clients/new` for the quick form).
2. Complete the wizard: business name, owner email, plan selection.
   - **Owner phone:** Enter the Owner number (#3 from preflight). This is how the system identifies the business owner on inbound SMS.
   - **Twilio number:** Assign the Business Line (#1 from preflight). This is the number leads will text/call.
3. Confirm the client appears in `/admin/clients`.

Expected:

- Client record created with `clientId`.
- No `Owner role template is missing` errors.

If blocked:

- `Owner role template is missing`: run `npm run db:seed -- --lean`.

### Step 2: Day-One Activation (operator's first post-creation task)

With the client created, the operator provisions the number and delivers day-one milestones per the offer doc (number live within 24 business hours, Revenue Leak Audit within 48 business hours).

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

### Step 3: Workspace configuration (knowledge base + business hours + quality gates)

The operator configures the client's workspace before AI goes live.

1. Use onboarding wizard (`/admin/clients/new/wizard` or current onboarding flow in your environment).
2. Trigger a failure at team step (invalid payload/network interruption).
3. Return to review step and edit business fields.

Expected:

- Team step blocks progression on API failure.
- Review step edits persist after save/reload.

4. Open `/admin/clients/<id>/knowledge?tab=queue`.
5. Confirm queue rows load with summary cards (`open`, `stale high priority`, `opened 7d`, `avg open age`).
6. Select one row and assign owner using bulk action.
7. Open `Manage` dialog for one row and set status `resolved` without KB link/note.

Expected:

- API blocks resolution with validation error (KB link + resolution note required).

8. Update same row with:

- status `resolved`
- linked KB entry
- resolution note >= 10 chars

9. For high-priority row (`priority >= 8`), verify `verified` transition requires reviewer policy.
10. Trigger stale gap digest:

```bash
curl -i http://localhost:3000/api/cron/knowledge-gap-alerts -H "Authorization: Bearer $CRON_SECRET"
```

Expected:

- Row lifecycle updates are persisted and visible on reload.
- Bulk actions update selected rows with per-row success/failure handling.
- Stale alert cron returns deterministic payload and dedupes to one digest/day.

11. Open `/admin/clients/<id>` and locate `Onboarding Quality Gates` panel.
12. Click `Re-evaluate` and confirm gate scores + action checklist render.
13. Attempt to set client `aiAgentMode=autonomous` while at least one critical gate is failing.

Expected:

- API returns `409` with onboarding quality payload and failure reasons.
- Admin panel shows failed gates and ordered action guidance.

14. In panel, add override reason (>= 10 chars) and click `Approve Override`.
15. Optionally toggle `Also enable autonomous mode now`.
16. Re-run `Re-evaluate` and confirm override state and decision reflect allowed transition.
17. Clear override and confirm decision returns to blocked (when critical failures still exist).

Expected:

- Override set/clear actions are persisted and auditable.
- Autonomous mode transition is policy-controlled (`enforce/warn/off`) and deterministic.

### Step 4: Team setup + add-on pricing

1. In admin/client team UI, add a team member using the Team Member number (#4 from preflight). Enable **Receive Escalations** and **Receive Hot Transfers** so this number gets escalation SMS and ring-group calls.
2. Add team members up to plan limit.
3. Attempt to add one over the limit.
4. Deactivate and reactivate a member.

Expected:

- Add/restore works up to limit.
- Over-limit attempt fails with clear limit error.
- Non-owner cannot escalate to owner-equivalent access.

If blocked:

- `Default team member role not configured`: run `npm run db:seed -- --lean`.

4. Trigger a team-member limit failure and confirm response copy includes explicit per-seat price.
5. Trigger a phone-number limit failure and confirm response copy includes explicit per-number price.
6. Open `/client/billing` and inspect `Usage This Period` card.

Expected:

- Add-on pricing section shows:
  - Additional Team Member price
  - Additional Phone Number price
  - Voice AI per-minute price
- Projected recurring add-on subtotal appears when extra seats/numbers exist.

### Step 5: AI progression (smart assist to autonomous)

1. Ensure test client has:

- `aiAgentMode = assist`
- `smartAssistEnabled = true`
- `smartAssistDelayMinutes = 1` (for quick validation)

2. **Lead Dev Phone (port 3001):** Text the Business Line (#1): "Hi, I need a quote for roof repair"
   - Webhook fires → system creates lead → AI generates draft → Owner Dev Phone (#3) receives Smart Assist notification with reference code.
3. Verify a pending smart-assist draft appears with reference code.
4. **Owner Dev Phone (port 3002):** Send commands to the Business Line (#1):

- `SEND <ref>` — sends immediately. Lead Dev Phone receives the approved message.
- `EDIT <ref>: Actually we can do Tuesday at 2pm` — sends edited version. Lead Dev Phone receives the updated message.
- `CANCEL <ref>` — cancels draft. Lead Dev Phone receives nothing.

5. For non-manual category drafts, leave untouched and run:

```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```

Expected:

- Draft auto-sends after delay when untouched.
- Manual-only categories do not auto-send.

### Step 6: Reminder routing

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

### Step 7: Lead lifecycle (inbound, response, escalation)

1. **Lead Dev Phone (port 3001):** Text the Business Line: "I NEED TO TALK TO SOMEONE RIGHT NOW"
   - AI detects escalation intent → triggers team escalation.
2. **Team Member Dev Phone (port 3003):** Receive escalation SMS with claim link. Click the link to claim the escalation.
3. To test owner fallback: temporarily deactivate the team member in admin UI, then trigger another escalation from Lead Dev Phone.

Expected:

- Escalation created.
- Team Member Dev Phone receives escalation SMS when team member is active.
- Owner Dev Phone receives fallback notification when no other recipients qualify.
- Agency communication actions are marked executed only after successful execution.

### Step 8: Estimate follow-up + appointment reminders

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

### Step 9: Quiet-hours compliance

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

### Step 10: Guarantee workflow (30-day proof + 90-day recovery)

```bash
curl -i http://localhost:3000/api/cron/guarantee-check -H "Authorization: Bearer $CRON_SECRET"
```

Expected:

- Endpoint responds with success payload.
- Eligible subscriptions progress through guarantee-v2 states (`proof_pending`/`recovery_pending`) then to `fulfilled` or `refund_review_required`.
- Billing events logged for transition states.

### Step 11: Bi-weekly reports + Without Us model

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

### Step 12: Quarterly Growth Blitz

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

### Step 13: Billing (add-on ledger, invoice itemization, dispute workflow)

#### 13a: Add-on billing ledger + voice rollup

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

#### 13b: Add-on invoice itemization + CSV UX

1. Open `/client/billing`.
2. In `Usage This Period`, verify `Add-On Charges This Cycle` renders when cycle events exist.
3. Click `Download CSV` and verify export contains event-level rows with unit price, total, idempotency key, and source reference.
4. Expand recent invoices and confirm add-on line items appear with `Add-on:` labels for matching period events.

Expected:

- Billing UI surfaces event-level add-on charges for the cycle.
- Invoice history line items include add-on entries with clear labels and quantities.
- CSV export is permission-gated and matches ledger event totals.

#### 13c: Add-on dispute/provenance workflow

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

### Step 14: Cancellation + data export

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

---

### Steps 15-21: Platform Administration + Infrastructure

These steps are not part of the client delivery journey but are required for release validation.

### Step 15: Access + tenant isolation

Use two agency users if available: one full scope, one assigned scope.

1. With assigned-scope user, access only assigned client data in:

- `/admin/clients`
- `/leads`
- `/api/leads?clientId=<unassigned-client-id>`

Expected:

- Assigned client access works.
- Unassigned API access returns `403`.
- Unauthorized portal pages redirect/deny by permission guard.

### Step 16: Kill switches + HELP keyword + cron reliability

#### 16a: Kill-switch control validation

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
    - **Lead Dev Phone (port 3001):** Call the Business Line (#1). Voice AI answers.
    - Caller speaks, hears a filler phrase ("One moment please..." / "Let me look into that..." / "Sure, give me just a second...")
    - After a brief pause, the AI response plays and the conversation continues.
    - The filler phrase is served by `/api/webhooks/twilio/voice/ai/gather` (thin handler), which redirects to `/api/webhooks/twilio/voice/ai/process` (heavy AI handler) for the actual response.
    - Say something that triggers transfer intent → **Team Member Dev Phone (port 3003)** rings for hot transfer.

Expected:

- Each switch changes behavior without code changes/redeploy.
- Switching back to `false` restores normal behavior.
- Voice AI two-step flow: caller never hears extended dead silence — filler phrase bridges the AI processing gap.

#### 16b: HELP keyword + compliance audit logging

1. **Lead Dev Phone (port 3001):** Send `HELP` to the Business Line (#1).
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

#### 16c: Cron reliability controls

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

### Step 17: Cron security

```bash
curl -i -X POST http://localhost:3000/api/cron
curl -i -X POST http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

Expected:

- First call: `401 Unauthorized`.
- Second call: `200` with cron job result payload.

If blocked:

- If both fail, verify `CRON_SECRET` matches app env exactly.

### Step 18: Monthly policy cycle + queue replay

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

### Step 19: Error telemetry + redaction

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

### Step 20: Solo reliability dashboard

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

### Step 21: Deterministic replay + export drill

Run:

```bash
export CRON_SECRET="<secret>"
./scripts/ops/replay.sh all-core
```

Expected:

- Every replay call returns 2xx.
- Script exits non-zero on any failed job.

Export recovery drill:

```bash
npm run ops:drill:export -- --client-id <client-id>
```

Expected:

- Script exits successfully.
- Output confirms required bundle sections: `leads.csv`, `conversations.csv`, `pipeline_jobs.csv`.

---

### Step 22: Payment reminder trigger + payment link delivery

1. Create an invoice for a test lead:

```bash
curl -i -X POST http://localhost:3000/api/sequences/payment \
  -H "Content-Type: application/json" \
  -H "Cookie: <client-portal-session-cookie>" \
  -d '{"leadId": "<lead-id>", "invoiceNumber": "TEST-001", "amount": 150.00, "dueDate": "2026-03-27"}'
```

2. Verify response includes `invoiceId`, `paymentLink` (Stripe URL), and `scheduledCount: 4`.
3. Run scheduled message processor:

```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```

4. **Lead Dev Phone (port 3001):** Confirm SMS received with invoice number, amount, and clickable Stripe payment link.
5. Click the payment link and confirm it loads a Stripe checkout page with correct amount.

Expected:

- 4 reminders scheduled (day 0, 3, 7, 14).
- First reminder SMS delivered with correct amount and working Stripe link.
- Payment link expires after 30 days.

### Step 23: Review request after job completion

1. Mark a test lead as job-completed (triggers review request):

```bash
curl -i -X POST http://localhost:3000/api/sequences/review \
  -H "Content-Type: application/json" \
  -H "Cookie: <client-portal-session-cookie>" \
  -d '{"leadId": "<lead-id>"}'
```

2. Verify lead status updated to `won`.
3. Run scheduled message processor:

```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```

4. **Lead Dev Phone (port 3001):** Confirm review request SMS received with Google Business URL link.

Expected:

- 2 messages scheduled: review request (day 1) and referral request (day 4).
- Review SMS contains the client&apos;s `googleBusinessUrl`.
- Lead status is `won`.

If blocked:

- No Google Business URL configured: set `googleBusinessUrl` on the test client in admin UI first.

### Step 24: No-show recovery (missed appointment → AI follow-up → rebook attempt)

1. Schedule an appointment for a test lead with a time **more than 2 hours in the past** (or wait 2 hours after a real appointment).
2. Run no-show detection:

```bash
curl -i http://localhost:3000/api/cron/no-show-recovery -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify response includes `detected` count &ge; 1 and `messaged` count &ge; 1.
4. **Lead Dev Phone (port 3001):** Confirm AI-personalized follow-up SMS received. Message should be warm, short (1-2 sentences), reference the project if available, and offer to reschedule.
5. Verify a second follow-up is scheduled (2 days later at 10:00 AM) in `scheduledMessages` with `sequenceType='no_show_followup'`.
6. To test the rebook path: reply from Lead Dev Phone with rescheduling intent (e.g., &quot;Can we do Thursday instead?&quot;). Confirm AI detects reschedule intent and offers available slots.

Expected:

- Appointment status transitions to `no_show`.
- First follow-up sent same day (or queued if quiet hours).
- Second follow-up scheduled 2 days out.
- Max 2 follow-up attempts total (no third message).
- Quiet hours respected (`queueOnQuietHours: true`).

### Step 25: Win-back automation (dormant lead reactivation)

The win-back is an always-on continuous automation, separate from Quarterly Growth Blitz campaigns. It targets stale leads with `status=contacted` or `status=estimate_sent` (25-35 days since last activity). For imported leads with no conversation history, staleness is measured from `createdAt`.

1. Ensure at least one test lead has `status='contacted'` or `status='estimate_sent'` with no messages sent in the last 25+ days (adjust timestamps in DB if needed for testing).
2. Run win-back cron:

```bash
curl -i http://localhost:3000/api/cron/win-back -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify response includes processed lead count.
4. **Lead Dev Phone (port 3001):** Confirm AI-personalized win-back SMS received.
5. Verify a follow-up message is scheduled 20-30 days later in `scheduledMessages` with `sequenceType='win_back'`.

Expected:

- Both `contacted` and `estimate_sent` leads with 25-35 days of inactivity are targeted.
- Message is AI-generated, personalized to the lead&apos;s project context.
- Send timing is randomized (10am-2pm weekdays, avoiding Monday morning and Friday afternoon).
- After second attempt with no response, lead status transitions to `dormant`.
- Win-back runs independently of quarterly campaigns — both can be active simultaneously.

### Step 26: Stripe Checkout subscription flow

Verifies new clients can subscribe and pay via Stripe Checkout.

**Prerequisites:** Real Stripe test price IDs configured (see Preflight). Set `STRIPE_PRICE_*` env vars and re-seed, or update the plans table directly.

1. Log in as a test client without a subscription (use `/client-login` or portal).
2. Navigate to `/client/billing/upgrade`.
3. Select a plan and billing cycle (monthly or yearly).
4. Verify redirect to Stripe Checkout page (hosted by Stripe, not in-app).
5. Complete payment with Stripe test card `4242 4242 4242 4242` (any future expiry, any CVC).
6. Verify redirect to `/client/billing/success` with confirmation message.
7. Navigate to `/client/billing` and verify subscription is active.

Expected:

- Checkout Session created with correct price ID and customer metadata.
- Webhook `checkout.session.completed` provisions subscription in DB.
- Client `monthlyMessageLimit` updated based on plan.
- Billing event logged with `subscription_created` type.
- Coupon validation works pre-checkout (if couponCode provided).

For 3D Secure testing: use Stripe test card `4000 0027 6000 3184` and confirm the 3D Secure challenge completes successfully.

If blocked:

- `Stripe pricing not configured`: price IDs are placeholder values. Create real products in Stripe Dashboard.
- Checkout doesn&apos;t redirect: check browser console for fetch errors. Ensure `NEXT_PUBLIC_APP_URL` matches the running dev server URL.

### Step 27: CSV lead import + quote reactivation

Verifies bulk lead import from CSV files, including status-aware import for quote reactivation.

#### 27a: Basic CSV import

1. Prepare a test CSV with at least 5 rows:

```csv
name,phone,email,projectType,notes
John Smith,+15551234567,john@test.com,Roofing,Test import
Jane Doe,+15559876543,jane@test.com,HVAC,
No Email,+15555551234,,Plumbing,No email provided
Bad Phone,invalid,,Siding,Should fail validation
John Smith,+15551234567,,Roofing,Duplicate phone
```

2. Navigate to `/leads` in the admin dashboard.
3. Click **Import CSV** button (next to Export).
4. Upload the CSV file.
5. Verify preview shows 5 rows with mapped columns.
6. Click **Import**.
7. Verify results: 3 imported, 1 validation error (bad phone), 1 duplicate.

Expected:

- Column auto-mapping recognizes standard headers and aliases.
- Phone numbers are normalized to E.164 format.
- Duplicates within the import are caught.
- Existing leads (same phone + client) are skipped with clear messaging.
- All imported leads appear in the leads table with `source: csv_import` and `status: new`.
- Max 1,000 rows enforced, max 5MB file size enforced.
- Invalid rows reported with specific error messages per row.

#### 27b: Quote reactivation import (status column)

This tests the quote reactivation workflow &mdash; importing a contractor&apos;s old estimates so win-back automation picks them up.

1. Prepare a CSV with status column:

```csv
name,phone,email,projectType,status,notes
Old Quote 1,+15552001001,q1@test.com,Kitchen Reno,estimate_sent,Quoted $25k in January
Old Quote 2,+15552001002,,Bathroom,estimate_sent,No response after estimate
New Inquiry,+15552001003,new@test.com,Deck,new,Fresh lead
Contacted Lead,+15552001004,,Roofing,contacted,Spoke on phone last month
```

2. Import the CSV via `/leads`.
3. Verify preview shows `status` as a mapped column.
4. After import, verify in the leads table:
   - &quot;Old Quote 1&quot; and &quot;Old Quote 2&quot; have `status: estimate_sent`
   - &quot;New Inquiry&quot; has `status: new`
   - &quot;Contacted Lead&quot; has `status: contacted`
   - All have `source: csv_import`
5. Verify invalid status values are rejected (test with `status: won` &mdash; should fail validation since only `new`, `contacted`, `estimate_sent` are allowed).

#### 27c: Win-back picks up imported estimates

1. Using the leads imported in 27b, adjust their `createdAt` to 30 days ago in the database (to fall within the 25-35 day win-back window):

```sql
UPDATE leads SET created_at = NOW() - INTERVAL '30 days'
WHERE source = 'csv_import' AND status = 'estimate_sent';
```

2. Run win-back cron (must be 10am-2pm weekday, not Monday morning or Friday afternoon):

```bash
curl -i http://localhost:3000/api/cron/win-back -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify response includes the `estimate_sent` leads as eligible.
4. Verify AI-personalized reactivation messages are sent/scheduled for those leads.

Expected:

- Win-back targets both `contacted` and `estimate_sent` leads.
- Imported leads with no conversation history are included (uses `createdAt` as fallback for staleness check).
- Reactivation messages are AI-personalized with the lead&apos;s project context.
- Standard win-back rules apply: 2 max attempts, randomized timing, quiet hours respected.

### Step 28: AI agent graceful handling without Twilio number

Verifies the AI agent doesn&apos;t crash when a client has no Twilio number.

1. Create a test client without assigning a Twilio number (skip phone provisioning step).
2. Simulate an inbound lead message for that client (directly call the agent orchestrator or use a test script).
3. Verify the agent returns gracefully with `action: no_action` instead of crashing.
4. Check logs for the warning: `[Agent] Client <id> has no Twilio number`.

Expected:

- No runtime crash or 500 error.
- Warning logged but no error thrown.
- Lead data is preserved (no partial state corruption).
- Other clients with Twilio numbers continue to work normally.

### Step 29: AI attribution (decision &rarr; outcome link)

Verifies that funnel events are automatically attributed to the agent decision that contributed to them.

**Prerequisites:** Steps 5 and 8 completed (a test lead with AI conversation history and an appointment).

1. Ensure at least one test lead has:
   - An AI conversation (agent decision exists in `agent_decisions` table)
   - A booked appointment (from Step 8)

2. Verify attribution was created during booking:

```sql
SELECT fe.id, fe.event_type, fe.agent_decision_id,
       ad.action, ad.confidence, ad.outcome, ad.outcome_details
FROM funnel_events fe
LEFT JOIN agent_decisions ad ON fe.agent_decision_id = ad.id
WHERE fe.lead_id = '<lead-id>'
ORDER BY fe.created_at DESC
LIMIT 5;
```

3. Verify the linked agent decision&apos;s outcome was updated:

```sql
SELECT id, action, confidence, outcome, outcome_details, created_at
FROM agent_decisions
WHERE lead_id = '<lead-id>'
  AND outcome IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

4. Run the attribution unit tests:

```bash
npx vitest run src/lib/services/ai-attribution.test.ts
```

Expected:

- Funnel event row exists with `agent_decision_id` pointing to the most recent agent decision for that lead.
- Agent decision `outcome` is `positive` for `appointment_booked` events.
- Agent decision `outcome_details` contains `Funnel event: appointment_booked`.
- Attribution only links decisions within a 7-day window &mdash; older decisions are not attributed.
- If no agent decision exists for the lead (manual booking), `agent_decision_id` is NULL &mdash; the funnel event is still created.
- All 13 unit tests pass (classifyOutcome covers all event types).

### Step 30: Self-serve phone provisioning (client portal)

Verifies new clients can set up their business phone number without admin help.

1. Log in as a test client without a Twilio number (use `/client-login`).
2. Navigate to `/client/settings/phone`.
3. Verify the provisioning UI shows (not the "Active Business Line" card).
4. Select Canada &rarr; Alberta, optionally enter a city.
5. Click **Search Available Numbers**.
6. Verify a list of available numbers appears (in dev, mock numbers are returned).
7. Click **Select** on a number.
8. Verify success message appears and number is assigned.
9. Navigate to `/client` (dashboard) and verify the client is now active.
10. Check onboarding checklist (`/signup/next-steps`) &mdash; `number_live` milestone should be complete.

Expected:

- Search returns up to 10 available numbers with locality info.
- Purchase assigns number, configures webhooks, marks day-one milestone.
- Client `status` changes from `pending` to `active`.
- Subsequent visits to `/client/settings/phone` show the active number.
- Usage limit check prevents exceeding plan phone number allocation.

If blocked:

- No numbers returned: Twilio API may be rate-limited. Dev fallback returns mock numbers.
- Purchase fails with 403: client has hit phone number plan limit. Upgrade plan or use admin override.

### Step 31: AI message flagging (operator feedback)

Verifies operators can flag problematic AI-generated messages for quality monitoring.

**Prerequisites:** Step 5 completed (a test lead with AI conversation history).

1. Open `/leads/<lead-id>` in the admin dashboard.
2. In the conversation timeline, hover over an AI message (marked with &ldquo;AI&rdquo; badge).
3. Click the flag icon that appears on hover.
4. Select a reason (e.g., &ldquo;Inaccurate info&rdquo;) and optionally add a note.
5. Click &ldquo;Flag&rdquo;.
6. Verify the flag badge appears on the message with the reason label.
7. Click the X next to the flag to unflag. Verify the flag disappears.

8. Verify the API directly:

```bash
# Flag a message
curl -i -X POST "http://localhost:3000/api/admin/clients/<clientId>/conversations/<messageId>/flag" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"reason": "wrong_tone", "note": "Too formal for this client"}'

# Get all flagged messages
curl -i "http://localhost:3000/api/admin/ai-quality" \
  -H "Cookie: <admin-session-cookie>"

# Get flagged messages for a specific client with stats
curl -i "http://localhost:3000/api/admin/ai-quality?clientId=<clientId>" \
  -H "Cookie: <admin-session-cookie>"

# Unflag
curl -i -X DELETE "http://localhost:3000/api/admin/clients/<clientId>/conversations/<messageId>/flag" \
  -H "Cookie: <admin-session-cookie>"
```

9. Run unit tests:

```bash
npx vitest run src/lib/services/ai-feedback.test.ts
```

Expected:

- Only AI messages (`messageType = 'ai_response'`) can be flagged &mdash; non-AI messages return 400.
- Flag persists across page refresh (stored in DB).
- `daily_stats.ai_messages_flagged` increments on flag.
- `/api/admin/ai-quality` returns flagged messages with reason, note, timestamp.
- `/api/admin/ai-quality?clientId=X` returns per-client stats breakdown by reason.
- Unflagging clears all flag fields.
- All 4 unit tests pass.

### Step 32: Decision confidence &rarr; model routing

1. Send an inbound SMS to a lead with low-confidence context (ambiguous message like &ldquo;maybe&rdquo;).
2. Verify `agent_decisions` record has `confidence` populated from AI output (not hardcoded 80).
3. Verify `actionDetails` includes `modelTier` and `modelRoutingReason` fields.
4. For a high-intent lead (intent &ge; 80), verify `modelTier` = `quality` and reason contains `high_intent`.
5. For a standard lead with normal confidence, verify `modelTier` = `fast` and reason = `standard`.
6. Run `npm test` &mdash; all 11 model routing tests pass.

### Step 33: Pre-launch conversation scenario tests

These tests validate the AI conversation system&apos;s deterministic behavior across all major lead scenarios. No LLM calls required &mdash; they test the state machine, routing, guardrails, and model selection logic.

1. Run the full agent test suite:
   ```bash
   npx vitest run src/lib/agent/
   ```
2. Verify all 3 test files pass:
   - `guardrails.test.ts` (33 tests) &mdash; prompt generation, harassment prevention, pricing rules, tone injection, confidence assessment
   - `graph.test.ts` (14 tests) &mdash; action-to-node routing for all 10 action types, escalation handler, close handler
   - `scenarios.test.ts` (55 tests) &mdash; 12 end-to-end conversation scenarios covering:

| Scenario | What it validates |
|----------|-------------------|
| Happy path (inquiry &rarr; booking) | Respond routing, booking counter increment, close handling |
| Price-sensitive lead | Pricing guardrail activation (canDiscussPricing toggle), objection handling |
| Frustrated customer escalation | Escalation safety net override, frustrated+urgent model routing |
| Long conversation | Harassment warning activation at 2+ unanswered messages |
| Lead re-engagement | Wait/trigger_flow routing for nurture sequences |
| High-value lead | Quality model tier triggers (score, intent, confidence thresholds) |
| Multi-signal priority | Priority ordering when multiple routing triggers fire |
| Lost lead terminal state | close_won/close_lost routing |
| Photo request &rarr; quote flow | request_photos/send_quote/send_payment routing |
| Adversarial input | Guardrail coverage (honesty, knowledge bounds, no-promises, stay-in-lane) |
| Exhaustive action routing | All 10 agent actions map to correct graph nodes |
| Boundary conditions | Exact threshold values for model routing (confidence, score, intent, frustration) |

3. Expected: 102 tests pass across the 3 files.

### Step 34: AI criteria tests (pre-launch quality gate)

These tests run real prompts through the real AI model and verify the output meets minimum safety and quality standards. They require `ANTHROPIC_API_KEY` and cost ~$0.02&ndash;0.05 per run.

1. Run the AI criteria suite:
   ```bash
   npm run test:ai
   ```
2. Verify all 29 tests pass across 4 categories:

**Single-turn criteria (23 tests):**

| Category | Tests | What it validates |
|----------|-------|-------------------|
| **Safety** (hard fail) | 10 | Pricing gating (canDiscussPricing toggle), AI disclosure when asked, opt-out respect (4 phrasings), knowledge boundaries (no hallucination), no pressure tactics |
| **Quality** (soft) | 6 | Response length limits, single question rule, empathy on frustration, tone consistency (casual vs professional), stay-in-lane (competitors, professional advice) |
| **Adversarial** | 4 | Prompt injection resistance (system prompt reveal, persona switch), gibberish handling, no real-world claims (weather) |

**Multi-turn conversation scenarios (6 tests):**

| Scenario | Turns | What it validates |
|----------|-------|-------------------|
| **Smooth booking** | 4 | Inquiry &rarr; qualify &rarr; pricing &rarr; schedule. Context retained, no repetition, natural progression. |
| **Price objection &rarr; recovery** | 4 | Sticker shock &rarr; value response (no pressure tactics) &rarr; lead re-engages &rarr; free estimate booking. |
| **Frustrated escalation** | 3 | Angry complaint &rarr; empathy (no excuses) &rarr; demands manager &rarr; clean handoff (no retention attempt). |
| **Slow nurture** | 5 | Casual inquiry &rarr; not ready &rarr; AI doesn&apos;t push &rarr; returns later &rarr; congratulates &amp; books. |
| **Knowledge boundary** | 4 | Asks unknown service (defers) &rarr; asks known service (answers confidently) &rarr; asks about service area outside KB (defers) &rarr; asks about warranty not in KB (defers). |
| **Mid-conversation opt-out** | 3 | Engaged conversation &rarr; abrupt &ldquo;stop texting me&rdquo; &rarr; immediate graceful exit (no retention, no booking push). |

3. Any Safety test failure is a **launch blocker** &mdash; fix the prompt or guardrails before deploying to a client.
4. Any multi-turn scenario failure is a **launch blocker** &mdash; these represent real conversations that happen daily.
5. Quality test failures warrant investigation but may occasionally fail due to LLM non-determinism. Re-run once; if it fails consistently, fix the prompt.

### Step 35: Final smoke (end-to-end lifecycle)

1. Validate one end-to-end lead lifecycle using Dev Phones: Lead (#2, port 3001) texts Business Line &rarr; AI responds &rarr; Owner (#3, port 3002) approves draft &rarr; Lead receives message &rarr; trigger escalation &rarr; Team Member (#4, port 3003) receives alert and claims.
2. Validate client portal permissions with at least two distinct roles.
3. Validate onboarding checklist loads for the test client and setup-request action succeeds.
4. Validate Day-One card and checklist remain in sync after audit delivery and manual milestone completion.
5. Validate onboarding quality and reminder routing panels load without API/auth errors for assigned-scope agency users with client access.

## 3. Useful Commands

```bash
# Automated baseline
npm test                    # 312 deterministic tests (no LLM calls)
npm run test:ai             # 29 AI tests: 23 single-turn criteria + 6 multi-turn scenarios (requires ANTHROPIC_API_KEY)
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
npx vitest run src/lib/services/ai-attribution.test.ts
npx vitest run src/lib/services/ai-feedback.test.ts
npx vitest run src/lib/ai/model-routing.test.ts
npx vitest run src/lib/agent/guardrails.test.ts src/lib/agent/graph.test.ts src/lib/agent/scenarios.test.ts

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
curl -i http://localhost:3000/api/cron/no-show-recovery -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/win-back -H "Authorization: Bearer $CRON_SECRET"

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
