# Testing Guide

Last updated: 2026-04-06
Audience: Engineering + Operations
Purpose: run a manual + automated release check without getting blocked mid-flow.

> **First time here?** This guide is a comprehensive verification reference, not a learning path. If you are setting up the system for the first time, start with [`docs/operations/LAUNCH-CHECKLIST.md`](../operations/LAUNCH-CHECKLIST.md) instead — it walks you through setup, testing, learning the value, deploying, and selling in the right order. Come back to this guide when you need to verify a specific feature or run a full release check.

---

## Full System Test Path

Follow this sequence to test the entire platform end-to-end. Steps are grouped by domain and ordered to match the managed-service delivery journey. Each entry references the detailed step below.

### Phase A: Environment + Fast Gate
| # | What | Steps |
|:-:|------|:-----:|
| A1 | Preflight (env vars, Twilio, admin login) | Section 0 |
| A2 | Automated quality gate (`npm run quality:no-regressions`) | Section 1 |

### Phase B: Client Setup + Onboarding
| # | What | Steps |
|:-:|------|:-----:|
| B1 | Create test client via admin wizard | 1 |
| B2 | Day-one activation (milestones, phone, SLA) | 2 |
| B3 | Knowledge base + business hours + quality gates | 3, 57b |
| B4 | Help center articles seeded | 66c |
| B5 | Team setup + add-on pricing | 4 |
| B6 | KB onboarding wizard (contractor self-serve) | 65a |
| B7 | DNC / exclusion list | 62a-d, 68a |

### Phase C: AI Agent
| # | What | Steps |
|:-:|------|:-----:|
| C1 | Smart Assist &rarr; Autonomous progression | 5, 65b |
| C2 | AI graceful handling without Twilio number | 28 |
| C3 | Decision confidence &rarr; model routing | 32 |
| C4 | Pre-launch conversation scenario tests | 33 |
| C5 | AI criteria tests (safety quality gate) | 34 |
| C6 | AI message flagging (operator feedback) | 31 |
| C7 | AI quality review page | 37 |
| C8 | AI effectiveness dashboard | 35 |
| C9 | Per-client automation pause | 36 |
| C10 | Smart Assist admin drafts view | 68b |

### Phase D: Voice AI
| # | What | Steps |
|:-:|------|:-----:|
| D1 | Kill switch + ConversationRelay call test | 16a |
| D2 | Voice AI admin config (pricing, duration, hours, tone) | 16a-2 |
| D3 | Voice AI Playground (simulator, KB test, guardrails, QA checklist) | 16a-3 |
| D4 | Contractor portal voice status card | 16a-4 |
| D5 | Voice activation modes (always, after-hours, overflow) | 61a-c |
| D6 | ElevenLabs voice persona selection | 61d |
| D7 | Post-call transcript + summary storage | 61e |
| D8 | Missed transfer recovery (SMS + escalation + team alert) | 58d |
| D9 | AI preview / sandbox | 58e |
| D10 | Voice AI default-on for new clients | 67d |

### Phase E: Lead Lifecycle + Conversations
| # | What | Steps |
|:-:|------|:-----:|
| E1 | Inbound lead, AI response, escalation | 7 |
| E2 | Reminder routing (configurable chain) | 6 |
| E3 | Lead action buttons (estimate sent, won, lost) | 66d |
| E4 | AI attribution (decision &rarr; outcome link) | 29 |
| E5 | Flow reply-rate tracking | 59 |

### Phase F: Revenue Automations
| # | What | Steps |
|:-:|------|:-----:|
| F1 | Estimate follow-up + appointment reminders | 8 |
| F2 | Payment reminder + payment link delivery | 22 |
| F3 | Review request after job completion | 23, 60a-e |
| F4 | No-show recovery | 24 |
| F5 | Win-back automation (dormant reactivation) | 25, 57d |
| F6 | Probable wins nudge | 58a |

### Phase G: Compliance
| # | What | Steps |
|:-:|------|:-----:|
| G1 | Quiet-hours compliance | 9 |
| G2 | HELP keyword + compliance audit logging | 16b |
| G3 | CASL attestation (admin + portal import) | 66a-b |

### Phase H: Calendar + Scheduling
| # | What | Steps |
|:-:|------|:-----:|
| H1 | Google Calendar OAuth connect/disconnect | 56a-b, 56f |
| H2 | Calendar sync cron | 56c |
| H3 | Calendar event blocks booking slot | 56d |
| H4 | Platform appointment pushes to Google Calendar | 56e |
| H5 | Calendar sync status (portal) | 58f |

### Phase I: Billing + Subscriptions
| # | What | Steps |
|:-:|------|:-----:|
| I1 | Add-on billing ledger + voice rollup | 13a |
| I2 | Add-on invoice itemization + CSV export | 13b |
| I3 | Add-on dispute / provenance workflow | 13c |
| I4 | Stripe Checkout subscription flow | 26 |
| I5 | Trial creation, countdown, expiry | 64a-b |
| I6 | Plan upgrade + reconciliation | 64c-d |
| I7 | Payment confirmation SMS | 64e |
| I8 | Guarantee workflow (30-day proof + 90-day recovery) | 10 |
| I9 | Guarantee status card (admin) | 68c |
| I10 | Cancellation + data export | 14 |

### Phase J: Reporting + Analytics
| # | What | Steps |
|:-:|------|:-----:|
| J1 | Bi-weekly reports + Leads at Risk model | 11 |
| J2 | Quarterly Growth Blitz | 12 |
| J3 | System Activity card + pipeline proof in reports | 58g |
| J4 | Weekly Pipeline SMS | 67a |
| J5 | ROI Calculator endpoint | 67b |
| J6 | Since Your Last Visit card | 58b |
| J7 | Jobs We Helped Win card + Revenue page ROI summary (portal; Revenue Recovered dashboard card removed) | 57e |

### Phase K: Portal Self-Serve Features
| # | What | Steps |
|:-:|------|:-----:|
| K1 | Self-serve phone provisioning | 30 |
| K2 | CSV lead import + quote reactivation | 27a-c |
| K3 | Portal quote import | 65c |
| K4 | Review response approval (portal) | 65d |
| K5 | KB empty nudge (48-hour) | 65e |
| K6 | Day 3 check-in SMS | 65f |
| K7 | KB gap auto-notify + deep link | 65g, 66e |
| K8 | Webhook export on lead status change | 58c |
| K9 | Jobber webhook integration | 67c |

### Phase L: Admin Tools + Infrastructure
| # | What | Steps |
|:-:|------|:-----:|
| L1 | Access + tenant isolation | 15 |
| L2 | Cron reliability controls | 16c |
| L3 | Cron security | 17 |
| L4 | Monthly policy cycle + queue replay | 18 |
| L5 | Error telemetry + redaction | 19 |
| L6 | Solo reliability dashboard | 20 |
| L7 | Deterministic replay + export drill | 21 |
| L8 | Feature toggles inventory (18 toggles) | 63a-b |
| L9 | Operator triage dashboard | 57a |
| L10 | Engagement health badge | 68d |
| L11 | Integration webhook config UI | 68e |
| L12 | Admin data export trigger | 68f |

### Phase M: UX Polish + Final Smoke
| # | What | Steps |
|:-:|------|:-----:|
| M1 | Tier 3 UX polish (breadcrumbs, tooltips, skeletons, empty states) | 53 |
| M2 | Wave 1-2 operational fixes | 54 |
| M3 | Wave 4 consensus fixes | 55 |
| M4 | Final end-to-end smoke | 38 |

### Quick Reference: Test by What You Changed

| If you changed... | Run phases |
|-------------------|-----------|
| AI agent / guardrails / orchestrator | C |
| Voice AI / ConversationRelay | D |
| Billing / Stripe / subscriptions | I |
| Automations (estimate, payment, review, win-back) | F |
| Compliance / quiet hours / DNC | G |
| Calendar / appointments | H |
| Client portal UI | E, J, K |
| Admin UI / triage / settings | L |
| Onboarding / KB / self-serve | B, K |
| Full pre-launch release | A through M (all) |

---

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

**Configure the Agency Line (#5):** After the app is running and you have logged in as admin, go to `/admin/agency` and set the agency Twilio number to #5. This stores it in the `agencies` table under the key `agency_twilio_number`. While there, also set `operator_phone` (the number that receives cron-failure SMS alerts) and `operator_name` (used in notification copy). If the agency line is not configured, all owner/team notifications via SMS will silently fail.

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

This section follows the **operator&apos;s managed-service delivery journey** &mdash; from creating a client through ongoing operations to offboarding. Steps 1-14 mirror the chronological delivery timeline from the offer doc. Steps 15-21 cover platform administration and infrastructure checks. Steps 22-25 cover revenue-engine automations (payment collection, review generation, no-show recovery, win-back). Steps 26-28 cover subscription checkout, CSV import (including quote reactivation), and AI safety. Step 29 covers AI attribution. Step 30 covers self-serve phone provisioning. Step 31 covers AI message flagging. Step 32 covers decision confidence and model routing. Step 33 covers pre-launch conversation scenario tests. Step 34 covers AI criteria tests (the pre-launch quality gate). Steps 35-37 cover AI effectiveness, per-client automation pause, and AI quality review. Step 38 is the capstone end-to-end smoke. Step 53 covers Tier 3 UX polish (breadcrumbs, tooltips, progress indicators, SLA countdown, reports filtering, empty states, unsaved changes warnings, collapsible sections, cancellation layout). Step 54 covers Wave 1-2 operational and polish fixes (agency voice webhook, operator alerting, command palette, onboarding checklist improvements, sticky header, escalation auto-refresh, message pagination, booking email fallback). Step 55 covers Wave 4 consensus fixes (estimate nudge timing, confirmed revenue field, log-based guarantee attribution, report auto-follow-up SMS, KB gap &quot;Ask Contractor&quot; button). Step 56 covers Google Calendar two-way sync (CON-01): OAuth connect/disconnect, sync cron, slot blocking, and appointment push. Step 57 covers Wave 7 additions: operator triage dashboard, KB intake questionnaire, engagement health check cron, dormant re-engagement cron, and Jobs We Helped Win card / Revenue page ROI summary in client portal (the standalone Revenue Recovered dashboard card was removed; confirmed revenue is now in the Jobs We Helped Win card and the Revenue page 4-column ROI summary). Step 58 covers post-launch additions: Probable Wins Nudge, Since Your Last Visit card, webhook export on lead status change, Voice AI missed transfer recovery, AI Preview/Sandbox panel, and Calendar sync status improvements. Step 59 covers flow reply-rate tracking: verifies that inbound SMS from leads with active flow executions records reply counts and response time in template metrics. Step 65 covers the 9 self-serve features shipped post-Wave 7: KB onboarding wizard, AI auto-progression cron, portal quote import, review response approval in portal, KB empty nudge, Day 3 check-in SMS, and KB gap auto-notify. Step 66 covers four features shipped after Step 65: CASL consent attestation on CSV import (admin and portal), help center seed articles, portal lead action buttons (Mark Estimate Sent, Mark Won, Mark Lost), and KB gap SMS deep link (auto-opens add form with question pre-filled). Step 67 covers SPEC-07 through SPEC-12 features: Weekly Pipeline SMS (dollar values + needs-attention count), ROI Calculator public endpoint, Jobber webhook integration (inbound job_completed triggers review, outbound appointment_booked fires to Jobber), and Voice AI default-on for new clients.

> **Self-serve signup testing** (the public `/signup` flow) is covered separately in [`TESTING-SELF-SERVE.md`](./TESTING-SELF-SERVE.md).

---

### Step 1: Create a test client (admin path)

For managed-service testing, use the admin wizard. For self-serve signup testing, see [`TESTING-SELF-SERVE.md`](./TESTING-SELF-SERVE.md).

1. Open `/admin/clients/new/wizard` (or `/admin/clients/new` for the quick form).
2. Complete the wizard: business name, owner email, plan selection.
   - **Owner&apos;s Phone:** Enter the Owner number (#3 from preflight). This is for escalation alerts and account notifications &mdash; not shared with leads.
   - **AI Business Line:** Assign the Business Line (#1 from preflight). This is the number leads will text/call.
   - **Phone skip warning:** If you click &ldquo;Skip for now&rdquo; on the phone step, verify the inline warning appears: &ldquo;SMS alerts and voice calls won&apos;t work until a business line is assigned.&rdquo;
   - **Team member phone validation:** Add a team member with an invalid phone (e.g., &ldquo;555&rdquo;). Verify inline error &ldquo;Enter a 10-digit phone number including area code&rdquo; appears on blur.
3. Confirm the client appears in `/admin/clients`.
4. Navigate to the client detail page &rarr; click &ldquo;Manage Number&rdquo; on the AI Business Line card. Verify the assigned number appears in the phone manager (not &ldquo;No business lines assigned&rdquo;).

Expected:

- Client record created with `clientId`.
- Phone number visible in both the client detail card and the phone manager page.
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

### Step 11: Bi-weekly reports + Leads at Risk model

1. Generate bi-weekly report (or run cron in-window):

```bash
curl -i http://localhost:3000/api/cron/biweekly-reports -H "Authorization: Bearer $CRON_SECRET"
```

2. Open latest report detail in `/admin/reports/<id>`.
3. Verify "Leads at Risk — Based on your response times and lead volume" section behavior:

- If sufficient data: Conservative/Likely/Optimistic ranges, inputs, and disclaimer are visible.
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
13. Place a normal test call (kill switch off) and confirm the ConversationRelay voice flow works:
    - **Lead Dev Phone (port 3001):** Call the Business Line (#1). Voice AI answers.
    - Caller speaks, AI responds in ~1 second with a natural ElevenLabs voice (streamed token-by-token via ConversationRelay).
    - Caller can interrupt mid-response &mdash; AI stops and listens.
    - The conversation is handled by a Cloudflare Durable Object WebSocket server (`packages/voice-agent/`), which streams Claude responses to Twilio ConversationRelay.
    - Say something that triggers transfer intent &rarr; AI sends `end` message &rarr; session-end handler dials **Team Member Dev Phone (port 3003)** for hot transfer.

Expected:

- Each switch changes behavior without code changes/redeploy.
- Switching back to `false` restores normal behavior.
- Voice AI ConversationRelay flow: caller never hears dead silence &mdash; streamed token-by-token responses start within ~1 second.

#### 16a-2: Voice AI Admin Configuration UI

1. Navigate to `/admin/voice-ai`. Verify the **global kill switch banner** shows at the top: green &ldquo;Voice AI is active&rdquo; status.
2. Click &ldquo;Pause All Voice AI&rdquo; &rarr; confirm AlertDialog &rarr; banner turns red &ldquo;PAUSED.&rdquo; Click &ldquo;Resume&rdquo; &rarr; returns to green.
3. Expand a client accordion. Verify you see: voiceEnabled toggle, mode dropdown, greeting textarea, `canDiscussPricing` toggle, max duration selector, and business hours summary (when mode = after_hours).
4. Verify `agentTone` badge appears on the client accordion summary row (e.g., &ldquo;professional&rdquo;).
5. Toggle `canDiscussPricing` ON, save. Place a test voice call and ask about pricing &mdash; AI should share knowledge-base ranges.
6. Change `voiceMaxDuration` to 2 minutes, save. Place a test call longer than 2 minutes &mdash; AI should wrap up gracefully.

#### 16a-3: Voice AI Playground

1. Expand a client on `/admin/voice-ai`. **QA Checklist** should appear at top with auto-checks (greeting, voice, KB, hours, tone).
2. **Greeting Preview:** Click &ldquo;Preview Greeting&rdquo; next to the greeting textarea. Audio plays in the selected ElevenLabs voice.
3. **Voice A/B:** Below the voice picker, select 2 voices, type a sentence, click &ldquo;Compare All.&rdquo; Both play sequentially.
4. **Simulator tab:** Type &ldquo;How much does a kitchen renovation cost?&rdquo; &mdash; AI responds using the client&apos;s KB and guardrails. Click &ldquo;Play&rdquo; on the response to hear it synthesized.
5. **KB Test tab:** Click &ldquo;Run KB Test.&rdquo; 10 questions run. Verify results show answered/deferred/gap with correct classification.
6. **Guardrail Test tab:** Click &ldquo;Run Guardrail Test.&rdquo; 8 adversarial inputs. All should pass (AI deflects pricing, identifies as AI, respects opt-out, stays in lane).
7. Complete all 3 manual QA checks. &ldquo;Go Live&rdquo; button should turn green. Click it &mdash; voice AI enables for the client.

#### 16a-4: Contractor Portal Voice Status Card

1. Log into the client portal. Verify the **Voice AI status card** appears on the dashboard.
2. Card shows: Active/Off badge, current mode, phone number, and this week&apos;s call stats (calls handled, appointments booked, transfers).
3. If no calls this week, card shows &ldquo;No voice calls this week yet.&rdquo;
4. If voice is disabled for the client, the card should not render.

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

### Step 35: AI effectiveness dashboard

1. Navigate to `/admin/ai-effectiveness` &mdash; verify page loads with period selector (7d/14d/30d/60d/90d).
2. If agent decisions exist, verify: summary cards (total decisions, positive rate, avg confidence, avg response time), outcome distribution pie chart, daily trend line chart, action effectiveness stacked bar chart, model tier bar chart, confidence band bars, escalation reasons list.
3. Switch period &mdash; verify data refreshes.
4. Hit `GET /api/admin/ai-effectiveness?days=14` directly &mdash; confirm JSON response shape includes `totalDecisions`, `outcomeDistribution`, `actionEffectiveness`, `confidenceBands`, `modelTierMetrics`, `dailyTrend`.
5. Confirm AI effectiveness summary appears in newly generated biweekly reports under `roiSummary.aiEffectiveness` (only when agent decisions exist for the client).

### Step 36: Per-client automation pause

Verifies that setting a client to &quot;paused&quot; blocks outbound messages for that client only.

1. Set a test client&apos;s status to **Paused** from `/admin/clients/[id]` &rarr; Edit.
2. Trigger an outbound action for the paused client (e.g., run win-back cron, send a manual reply, or simulate an inbound lead).
3. Verify the message is **blocked** by the compliance gateway (check console logs for &quot;Client automations paused&quot;).
4. Verify a **different** active client still sends messages normally.
5. Set the paused client back to **Active**.
6. Re-trigger the outbound action &mdash; verify it now sends.

Expected:

- Only the paused client&apos;s outbound is blocked.
- Other clients are unaffected.
- Inbound messages from leads are still recorded (conversations table) even while paused.
- Status change takes effect immediately (no cache delay beyond 30s).

### Step 37: AI quality review page

1. Flag at least 2 AI messages from different clients via the lead detail page (`/leads/[id]` &rarr; conversation tab &rarr; flag icon on AI messages).
2. Navigate to `/admin/ai-quality`.
3. Verify both flagged messages appear with:
   - Reason badge (wrong tone, inaccurate, etc.)
   - Client name
   - Message preview
   - Flag note (if provided)
   - &quot;View lead&quot; link
4. Click &quot;View lead&quot; &mdash; verify it navigates to the correct lead detail page.

Expected:

- Page shows all flagged messages across all clients in one view.
- Sorted by most recently flagged.
- Empty state shows &quot;No flagged messages&quot; when none exist.

### Step 38: Final smoke (end-to-end lifecycle)

1. Validate one end-to-end lead lifecycle using Dev Phones: Lead (#2, port 3001) texts Business Line &rarr; AI responds &rarr; Owner (#3, port 3002) approves draft &rarr; Lead receives message &rarr; trigger escalation &rarr; Team Member (#4, port 3003) receives alert and claims.
2. Validate client portal permissions with at least two distinct roles.
3. Validate onboarding checklist loads for the test client and setup-request action succeeds.
4. Validate Day-One card and checklist remain in sync after audit delivery and manual milestone completion.
5. Validate onboarding quality and reminder routing panels load without API/auth errors for assigned-scope agency users with client access.

### Step 53: Tier 3 UX polish

Combined verification for all Tier 3 UX improvements (breadcrumbs, tooltips, progress indicators, SLA countdown, filtering, empty states, unsaved changes warnings, collapsible sections, cancellation page layout).

1. **Breadcrumbs (3.1):** Navigate to each of these client portal pages and verify a breadcrumb bar showing &quot;Dashboard &gt; Page Name&quot; appears at the top with a clickable link back to Dashboard:
   - `/client/billing`
   - `/client/revenue`
   - `/client/knowledge`
   - `/client/team`
   - `/client/help`
   - `/client/discussions`

2. **Settings tooltips (3.2):** Open `/client/settings` (AI tab and Features tab). Verify info icon tooltips appear next to: Quiet Hours, Review Before Sending, AI Lead Response, AI Tone, and Auto-send delay. Hover (desktop) or tap (mobile) to confirm tooltip text displays.

3. **Phone provisioning progress indicator (3.4):** Navigate to `/client/settings` (Phone tab) and start the provisioning flow. Verify a 3-step indicator appears: &quot;Choose location&quot; &rarr; &quot;Search numbers&quot; &rarr; &quot;Select your number&quot;. Each step shows a numbered circle. Current step is highlighted in brand color; completed steps are filled; future steps are muted.

4. **Escalation SLA countdown (3.5):** Create or view an active escalation with an SLA deadline. Verify each escalation card in the queue shows a live countdown (e.g., &quot;1h 23m remaining&quot;). Confirm color coding: green when &gt;1h remaining, sienna when 30-60m, red when &lt;30m, and &quot;SLA breached&quot; text when past deadline.

5. **Reports filtering (3.6):** Navigate to `/admin/reports`. Verify a client dropdown and date range presets (7d, 30d, 90d, All) appear above the reports table. Select a client &mdash; confirm the table filters to that client only. Select a date range &mdash; confirm the table filters accordingly. Verify the count indicator updates (e.g., &quot;Showing 5 of 23 reports&quot;).

6. **Knowledge base empty state CTA (3.7):** For a client with no knowledge base entries, navigate to `/client/knowledge`. Verify an empty state appears with a heading, description text, and an &quot;Add Knowledge Entry&quot; button. Click the button &mdash; verify the entry form opens.

7. **Unsaved changes warning (3.8):** Open `/client/settings` and modify a field (e.g., change AI tone). Without saving, attempt to close the tab or navigate away. Verify the browser shows a &quot;Leave site?&quot; / &quot;Changes you made may not be saved&quot; confirmation dialog. Repeat on the Notifications tab and Features tab.

8. **Day-one audit collapsible (3.9):** Open a client detail page (`/admin/clients/[id]`) that has a Revenue Leak Audit section. Verify the audit section is collapsed by default with a summary line. Click to expand &mdash; verify the full audit form appears.

9. **Cancellation page layout (3.10):** Navigate to `/client/cancel`. Verify the cancellation form is the primary visible content (not scrolled below a large ROI card). Verify the ROI / results summary is inside a collapsed accordion that can be expanded optionally. Verify the page heading is neutral (not retention-focused).

Expected: all 9 items pass. Item 3.3 (self-serve onboarding checklist) is deferred and not tested here.

### Step 54: Wave 1-2 operational and polish fixes

Combined verification for Wave 1 (OPS-01, OPS-02, resilience fixes) and Wave 2 (UX polish, edge case fixes).

1. **Agency voice webhook (OPS-01):** Call the agency number (#5) via a real phone or Dev Phone. Verify the call is answered with a TwiML message: &quot;This number is for text messages only.&quot; The call should end after the message plays. Requires voice webhook configured in Twilio Console for #5 pointing to `https://<domain>/api/webhooks/twilio/agency-voice`.

2. **Operator alerting (OPS-02):** Set `operator_phone` in the `agencies` table (via `/admin/agency`). Trigger a cron failure (e.g., POST to a nonexistent cron endpoint via the orchestrator). Verify the operator phone receives an SMS alert from the agency number. Verify deduplication: trigger the same failure again within 1 hour &mdash; no duplicate SMS should arrive.

3. **Command palette (UX-4.1):** In the admin dashboard, press Cmd+K (Mac) or Ctrl+K (Windows/Linux). Verify the command palette opens. Type a client name &mdash; verify search results appear. Press Enter on a result &mdash; verify navigation to that page. Close and repeat in the client portal &mdash; verify portal-specific items appear (10 page items). Verify Escape closes the palette.

4. **Onboarding checklist improvements (UX-3.3):** Navigate to the onboarding checklist (self-serve signup flow or `/signup/next-steps`). Verify tutorials are clickable links (not plain text). Verify each incomplete step has an action link to the relevant settings page. Verify quality gates are simplified: hidden when passing, shown in plain language when failing. Verify the &quot;Start Here&quot; banner appears and points to the most important next action.

5. **Dashboard sticky header (UX-4.3):** Open the client portal dashboard (`/client`). Scroll down past the stat cards. Verify the page title remains visible (sticky) at the top of the viewport.

6. **Escalation queue auto-refresh (UX-4.7):** Open the escalation queue (`/escalations`). Wait 30 seconds without interacting. Verify the data refreshes automatically and the &quot;Updated X ago&quot; timestamp updates (e.g., &quot;Updated just now&quot; or &quot;Updated 30s ago&quot;).

7. **Billing skeleton match (UX-4.2):** Navigate to `/client/billing` on a slow connection (or throttle via DevTools). Verify the loading skeleton shows 4 card placeholders matching the actual content layout.

8. **Wizard mobile labels (UX-4.4):** Open `/admin/clients/new/wizard` on a mobile viewport (375px). Verify step circles show abbreviated titles: Info, AI Line, Team, Hours, Review.

9. **Discussions CTA (UX-4.6):** Navigate to `/client/discussions` with no existing discussions. Verify the empty state includes a &quot;Start a Conversation&quot; button.

10. **Message pagination (EC-13):** Open a conversation with 50+ messages. Verify the initial load shows the most recent 50 messages. Verify a &quot;Load earlier messages&quot; button appears at the top. Click it &mdash; verify older messages load above the current ones.

11. **Booking email fallback (EC-16):** Trigger a booking where compliance blocks all SMS recipients (e.g., all team members opted out or in quiet hours). Verify the system falls back to sending an email notification about the booking instead of silently failing.

Expected: all 11 items pass.

### Step 55: Wave 4 consensus fixes

Combined verification for CON-02, CON-03, CON-05, CON-10, and CON-11.

1. **Estimate nudge timing (CON-02):** Verify the fallback nudge cron identifies stale leads after 48 hours (not 5 days). Check the `ESTIMATE_NUDGE_STALE_DAYS` constant is set to `2`. Create a lead, leave it without an estimate sequence for 48+ hours, then run the cron. Verify the owner receives a nudge SMS: &quot;Did you send an estimate to [name]?&quot;

2. **Confirmed revenue field (CON-03):** In the admin UI, mark a lead as &quot;won.&quot; Verify a `confirmedRevenue` input field appears where the operator enters the actual job value in dollars. Save it. Verify the value persists on the lead record. Generate a bi-weekly report for that client. Verify the report includes a &quot;Confirmed Won&quot; line showing the confirmed revenue total alongside pipeline estimates.

3. **Log-based guarantee attribution (CON-05):** Review the Layer 2 guarantee evaluation logic. Verify attribution checks platform logs (automated response or follow-up engagement) rather than requiring subjective contractor confirmation. The criterion is: &quot;the platform logs show the system engaged the lead through automated response or follow-up before the opportunity progressed.&quot;

4. **Report auto-follow-up SMS (CON-10):** Trigger a bi-weekly report delivery for a test client. After the report is sent (email delivery completes), verify the system auto-sends an SMS to the contractor via the agency number: &quot;[Business Name] &mdash; your bi-weekly performance report is ready. Check your email or view it in the dashboard. Questions? Just reply to this text.&quot; Verify this is fire-and-forget (does not affect the report delivery state).

5. **KB gap &quot;Ask Contractor&quot; button (CON-11):** Navigate to `/admin/clients/[id]/knowledge` &rarr; Gaps tab. Verify each knowledge gap card shows an &quot;Ask Contractor&quot; button. Click it. Verify an SMS is sent to the contractor: &quot;[Business Name] &mdash; a customer asked about [question]. How should we answer this?&quot; Verify the gap status changes to `in_progress`. Verify the API endpoint `POST /api/admin/clients/[id]/knowledge/gaps/[gapId]/ask` returns success.

Expected: all 5 items pass.

### Step 56: Google Calendar two-way sync (CON-01)

Verifies that Google Calendar integration connects, syncs, and blocks booking slots correctly.

**Prerequisites:**

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars set in `.dev.vars`
- A real Google account (for OAuth) or a test account with calendar access
- `calendarSyncEnabled` feature flag enabled for the test client (admin UI or direct DB update)

#### 56a: Enable and connect (admin path)

1. Open `/admin/clients/<clientId>` and navigate to the **Configuration** tab.
2. Locate the **Calendar Integration** card.
3. Click **Connect Google Calendar** — verify an OAuth redirect to Google&apos;s consent screen.
4. Complete OAuth with the test Google account.
5. Verify the card shows **Connected** status with the connected account email.

Expected:

- OAuth token stored in `calendar_integrations` table.
- Integration status is `active`.

#### 56b: Connect from the client portal

1. Log into the client portal as a test contractor.
2. Navigate to **Settings &gt; Features**.
3. Locate the **Calendar Connection** section.
4. Click **Connect Google Calendar** and complete OAuth.
5. Verify the connection is confirmed in the UI.

Expected:

- Same `calendar_integrations` row updated (or new row created if no prior admin connection).
- Both portal and admin views reflect the connected state.

#### 56c: Calendar sync cron

1. Add an event directly to the connected Google Calendar (any test event in the next 30 days).
2. Run the calendar sync cron:

```bash
curl -i http://localhost:3000/api/cron/calendar-sync -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify the response includes the test client in the synced integrations list.
4. Query the `calendar_events` table and confirm the Google Calendar event was imported:

```sql
SELECT id, title, start_time, end_time, external_id, source
FROM calendar_events
WHERE client_id = '<clientId>'
ORDER BY created_at DESC
LIMIT 5;
```

Expected:

- Event row exists with `source = 'google_calendar'` and a populated `external_id` matching the Google event ID.

#### 56d: Google Calendar event blocks booking slot

1. Using the imported event from 56c, note its `start_time` and `end_time`.
2. Attempt to book an appointment in the platform for the same client at the same time slot (via the booking conversation flow or admin UI).
3. Verify the slot is unavailable — the booking is rejected or the slot does not appear in available options.

Expected:

- `getAvailableSlots()` returns the overlapping slot as unavailable.
- No double-booking occurs.

#### 56e: Platform appointment pushes to Google Calendar

1. Book a new appointment for the test client (choose a slot that has no conflict).
2. Wait up to 15 minutes for the sync cron, or trigger it manually:

```bash
curl -i http://localhost:3000/api/cron/calendar-sync -H "Authorization: Bearer $CRON_SECRET"
```

3. Check the connected Google Calendar — verify the platform appointment appears as an event with the correct title and time.

Expected:

- Google Calendar event created with matching appointment details.
- `calendar_events` row updated with `external_id` from Google.

#### 56f: Disconnect

1. Click **Disconnect** in the admin client detail Configuration tab (or portal Settings &gt; Features).
2. Verify the card shows **Not Connected**.
3. Run the sync cron again — verify the disconnected client is skipped.

Expected:

- `calendar_integrations` row marked inactive (or deleted).
- Subsequent sync cron runs do not attempt to sync for this client.
- Booking slots revert to using only the `appointments` table (Google Calendar events no longer block).

### Step 57: Wave 7 — Operator Triage Dashboard, KB Intake Questionnaire, Engagement Health, Dormant Re-Engagement

#### 57a: Operator Triage Dashboard

1. Navigate to `/admin/triage` (Clients group in admin nav).
2. Verify the page loads and shows a cross-client prioritized action list.
3. Confirm P1 escalations appear at the top, followed by overdue knowledge gaps, onboarding SLA breaches, and failed report deliveries.
4. Click a listed item — verify it links to the correct client detail page or relevant admin page.

Expected:

- Page renders without errors.
- Items are ordered by priority (P1 first).
- Each item includes client name, issue type, and a direct link.

#### 57b: KB Intake Questionnaire

1. Open the admin client detail page for a new test client (one with an empty knowledge base).
2. Navigate to the Overview tab — verify the intake questionnaire form is visible.
3. Fill out the questionnaire fields (services offered, service area, pricing range, warranty, financing, etc.) and submit.
4. Navigate to the KB entries list — verify submitted answers appear as KB entries.

Expected:

- Form submits without errors.
- Each questionnaire answer creates a corresponding KB entry.
- The AI can now answer the covered topics without deferring.

#### 57c: Engagement Health Check Cron

1. Run the engagement-health-check cron:

```bash
curl -i http://localhost:3000/api/cron/engagement-health-check -H "Authorization: Bearer $CRON_SECRET"
```

2. Verify the cron returns `200` with a result payload including evaluated client count.
3. For a client with no recent lead activity (simulate by aging `last_activity` in DB), verify a health flag or operator alert is created.

Expected:

- `2xx` response with per-client evaluation results.
- Clients with 3+ weeks of declining engagement are flagged.
- Flagged clients surface in the triage dashboard.

#### 57d: Dormant Re-Engagement Cron

1. Create a test lead with `status=dormant` and `updated_at` set to 180+ days ago.
2. Run the dormant-reengagement cron:

```bash
curl -i http://localhost:3000/api/cron/dormant-reengagement -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify the eligible lead receives a re-engagement SMS.
4. Verify only one attempt is made (no follow-up scheduled for this lead).
5. Run the cron again immediately — verify no duplicate is sent (idempotent).

Expected:

- Single AI-personalized SMS sent to the eligible dormant lead.
- No additional follow-up messages scheduled.
- Re-run produces no additional sends.

#### 57e: Jobs We Helped Win Card + Revenue Page ROI Summary (Client Portal)

The standalone &ldquo;Revenue Recovered&rdquo; dashboard card has been removed. Confirmed-revenue data is now consolidated into two places:

1. **Jobs We Helped Win card** on the dashboard &mdash; the single confirmed-revenue money card. Log in to the client portal for a client with at least one lead marked &ldquo;won&rdquo; with confirmed revenue. Verify the card shows the confirmed revenue total.
2. **Revenue page ROI summary** &mdash; 4-column card at the top of `/client/revenue`: Your Investment, Revenue Recovered, Net Return, ROI. Verify all 4 columns render for a client with wins. Verify for a new client with no wins, the card still renders (showing investment vs. $0 confirmed).

For a new client with no won leads, verify the Jobs We Helped Win card shows an empty/nudge state (not an error).

Expected:

- Jobs We Helped Win card renders on dashboard with confirmed revenue total.
- Revenue page ROI summary card renders with 4 columns.
- No standalone &ldquo;Revenue Recovered&rdquo; card on the dashboard (removed).
- API endpoint `GET /api/client/attributed-wins` returns `200` with correct data shape.

### Step 58: Post-launch additions

Combined verification for six features shipped after Wave 7: Probable Wins Nudge, Since Your Last Visit card, webhook export, Voice AI missed transfer recovery, AI Preview/Sandbox, and Calendar sync status improvements.

#### 58a: Probable Wins Nudge

1. Create a test lead with `status=appointment_scheduled` (or `contacted`) and create an appointment for that lead with `status=completed` and `appointmentDate` set to 15+ days ago.
2. Run the cron:

```bash
curl -i http://localhost:3000/api/cron/probable-wins-nudge -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify `Owner Dev Phone (#3)` receives an SMS via the agency line: "Did you win [Lead Name]'s [project type]? Reply YES or NO..."
4. Verify response payload includes `nudged >= 1`.
5. Run the cron again immediately — verify the 14-day cooldown prevents a second nudge (no SMS sent, `nudged = 0`).

Expected:

- Nudge is sent only for unresolved leads with 14+ day old completed/confirmed appointments.
- 14-day per-client cooldown is enforced (checked via `agencyMessages` with `promptType = 'won_lost_nudge'`).
- Each lead is nudged at most once per run.
- Clients with no phone number or `status=paused` are skipped.

#### 58b: Since Your Last Visit Card

1. Log into the client portal as a test contractor.
2. On the dashboard (`/client`), note the &ldquo;Since Your Last Visit&rdquo; card.
3. Open browser DevTools and clear `localStorage` key `cs-last-dashboard-visit-<clientId>` (or set it to a timestamp 24+ hours ago).
4. Reload the page — the card should show activity counts since the stored timestamp.
5. Verify the card shows &ldquo;All caught up&rdquo; when no items need attention.
6. Verify the card shows lead counts, estimate follow-ups, and appointments when activity exists.
7. Verify `GET /api/client/activity-summary` returns `200` with correct shape.

Expected:

- Card content reflects real activity since the last visit timestamp.
- LocalStorage key is updated on each visit.
- &ldquo;All caught up&rdquo; state renders when actions needed = 0.

#### 58c: Webhook export on lead status change

1. Ensure a test client has `webhookUrl` and `webhookEvents` configured (include `"lead.status_changed"`). Set these directly in the `clients` table or via admin UI if the field is exposed.
2. Mark a test lead as `won` via the admin UI or API:

```bash
curl -i -X PATCH "http://localhost:3000/api/leads/<leadId>" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"status": "won", "confirmedRevenue": 5000}'
```

3. Verify your webhook receiver (e.g., a RequestBin or ngrok inspect URL) received a POST with:
   - `X-Webhook-Signature` header present
   - Body: `{ leadId, name, phone, email, status: "won", confirmedRevenue: 5000, projectType, address }`
4. Repeat with `status: "lost"` — verify webhook fires again.
5. Verify that setting `status=contacted` does NOT trigger a webhook (only `won`/`lost`).

Expected:

- Webhook fires on `won` and `lost` status changes only.
- Payload matches documented shape.
- HMAC-SHA256 `X-Webhook-Signature` header is present.
- Webhook failure is non-fatal — the lead status update still succeeds.

#### 58d: Voice AI missed transfer recovery

**Prerequisites:** Voice AI enabled, a team member configured with hot transfer.

1. Place a test call through Voice AI and trigger a transfer (say something like &ldquo;I need to speak to someone&rdquo;).
2. Ensure the team member phone does NOT answer the transfer (let it ring out or busy).
3. After Twilio reports the dial status:

   - **Lead phone** should receive SMS: "[Business] tried to connect you with a team member but they're currently unavailable. Someone will call you back shortly."
   - A **P1 escalation** should appear in the triage dashboard (`/admin/triage`) immediately.
   - **Team Member Dev Phone (#4)** should receive an alert SMS about the missed transfer.

4. Verify the voice call record in `voice_calls` has `outcome = 'dropped'`.
5. Confirm the TwiML response is never delayed — the webhook endpoint responds immediately regardless of side-effect completion.

Expected:

- All three side effects (homeowner SMS, escalation, team alert) fire without blocking TwiML.
- `voice_calls.outcome` = `dropped` for missed transfer.
- Escalation appears in triage dashboard at P1 priority.

#### 58e: AI Preview / Sandbox

1. Open `/admin/clients/<clientId>` — navigate to the client detail page.
2. Locate the &ldquo;Test the AI&rdquo; panel.
3. Type a homeowner question (e.g., &ldquo;Do you handle flat roofs?&rdquo;) and submit.
4. Verify a draft AI response appears in the panel without any message being sent to a real lead.
5. Verify via `conversations` table (or lead activity feed) that no new message record was created.
6. Test via API directly:

```bash
curl -i -X POST "http://localhost:3000/api/admin/clients/<clientId>/ai-preview" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"message": "Do you handle flat roofs?"}'
```

Expected:

- API returns `200` with the AI&apos;s draft response text.
- No message created in `conversations`, `scheduled_messages`, or any other table.
- Response uses the client&apos;s real knowledge base and AI settings.
- Works correctly even if no leads exist for the client.

#### 58f: Calendar sync status improvements (portal)

1. Log into the client portal and navigate to Settings &gt; Features.
2. Connect Google Calendar if not already connected (Step 56b).
3. **Test consecutive error banner:** manually set `consecutive_errors = 4` on the `calendar_integrations` row for this client in the DB. Reload the settings page. Verify a red banner appears: &ldquo;Sync failed multiple times. Please reconnect your Google Calendar.&rdquo;
4. **Test stale + has errors banner:** set `consecutive_errors = 2`, `last_sync_at = NOW() - INTERVAL '35 minutes'`, `last_error = 'token expired'`. Reload. Verify a yellow banner appears: &ldquo;Calendar sync may be disconnected. Try reconnecting below.&rdquo;
5. **Test OAuth redirect:** disconnect and reconnect via the portal. Verify the OAuth callback redirects to `/client/settings` (not an admin URL).

Expected:

- `consecutive_errors > 3`: red error banner shown.
- `consecutive_errors <= 3` AND sync stale (&gt;30 min) AND `last_error` set: yellow warning shown.
- No banner when `consecutive_errors = 0` and sync is recent.
- Portal OAuth flow redirects back to `/client/settings` on success.

#### 58g: System Activity card and pipelineProof in reports

**Verifies the pipeline proof feature: auto-tracked metrics on the contractor dashboard and in the bi-weekly report `roiSummary`.**

1. Log into the client portal as a test contractor on a client that has at least a few leads with automated responses.
2. Navigate to the dashboard (`/client`).
3. Verify the **System Activity** card is visible on the dashboard. The separate Revenue Recovered card has been removed from the dashboard; confirmed revenue is now in the Jobs We Helped Win card and the Revenue page ROI summary.
4. Verify the System Activity card shows 6 stat tiles: &ldquo;Leads Responded To,&rdquo; &ldquo;Estimates in Follow-Up,&rdquo; &ldquo;Missed Calls Caught,&rdquo; &ldquo;Dead Quotes Re-Engaged,&rdquo; &ldquo;Appointments Booked,&rdquo; and &ldquo;Avg Response Time.&rdquo;
5. Verify a **Probable Pipeline Value** figure is shown (calculated as appointments booked + reactivated quotes, multiplied by avg project value — defaults to $40,000 if no confirmed wins exist).
6. Verify the Jobs We Helped Win card is visible on the dashboard as the single confirmed-revenue card.
7. Generate or view a bi-weekly report for this client:

```bash
curl -i http://localhost:3000/api/cron/biweekly-reports -H "Authorization: Bearer $CRON_SECRET"
```

8. Open the report at `/admin/reports/<id>`. Verify the `roiSummary` JSON includes a `pipelineProof` block with the 6 metrics and `probablePipelineValue`.
9. If the client has no confirmed wins, verify `probablePipelineValue` uses the $40,000 default rather than showing $0 or `null`.

Expected:

- System Activity card renders on the client dashboard independently of whether any wins have been confirmed.
- All 6 stat tiles populate from platform activity (no contractor input required).
- Probable Pipeline Value is a positive number when any bookings or reactivations exist.
- Jobs We Helped Win card is the single confirmed-revenue card on the dashboard (no separate Revenue Recovered card).
- `pipelineProof` key is present in `roiSummary` of every generated report.

---

### Step 59: Flow reply-rate tracking

Verifies that inbound SMS replies from leads with an active flow execution are recorded in template metrics.

1. Create a test lead and trigger an estimate follow-up (or win-back) flow via the admin UI or API so a flow execution row exists for that lead with `status=active`.
2. Send an inbound SMS from the lead&apos;s number (Dev Phone #2) to the business line (#1).
3. After the message is processed, query the metrics tables:

```bash
# Check templateMetricsDaily for the day
# SELECT * FROM template_metrics_daily WHERE date = CURRENT_DATE;

# Check templateStepMetrics for the flow step
# SELECT * FROM template_step_metrics WHERE template_id = '<templateId>';
```

4. Verify `leadsResponded` incremented on the `templateMetricsDaily` row for today.
5. Verify a `templateStepMetrics` row exists (or was updated) with `responsesReceived >= 1`.
6. Verify `avgResponseTimeMinutes` reflects the time since the flow started (non-zero).
7. Confirm message processing was not delayed — the reply handling is fire-and-forget.

Expected:

- `templateMetricsDaily.leadsResponded` increments when inbound SMS is received during an active flow.
- `templateStepMetrics` records the response against the matching step.
- `avgResponseTimeMinutes` is populated with minutes since the flow execution started.
- No observable delay in inbound SMS processing.
- No metrics recorded if the lead has no active flow execution.

---

### Step 60: Review Monitoring &amp; Auto-Response

#### 60a: Review sync cron populates the `reviews` table

1. Ensure the test client has a Google Business URL set in the admin UI.
2. Run the review sync cron:

```bash
curl -i http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

3. Query the `reviews` table for the test client:

```sql
SELECT * FROM reviews WHERE client_id = '<clientId>' ORDER BY created_at DESC LIMIT 5;
```

Expected:

- Cron returns `200` with a summary payload.
- At least one row appears in `reviews` for the client (or rows are present from a prior sync).
- `rating`, `author_name`, `text`, and `review_date` are populated.

#### 60b: Negative review alert

1. Insert a test review with `rating <= 2` directly into the `reviews` table (or simulate via the sync cron if a low-rated review exists in the connected Google account).
2. Verify the contractor (Dev Phone #3) receives an SMS alert within the next cron cycle.

Expected:

- Outbound SMS is sent to the contractor&apos;s phone containing the reviewer&apos;s name and rating.
- Alert is sent only once per review (no duplicate on re-run).

#### 60c: AI review response draft generation

1. After Step 60a, query the `review_responses` table for the test client:

```sql
SELECT * FROM review_responses WHERE client_id = '<clientId>' ORDER BY created_at DESC LIMIT 5;
```

2. Confirm at least one row with `status = 'draft'` exists for a recent review.

Expected:

- `review_responses` row present with `status = 'draft'` and non-empty `response_text`.
- Draft is linked to the correct `review_id`.

#### 60d: Draft approval workflow

1. In the admin UI, navigate to the client&apos;s review management view.
2. Find a draft response and click **Approve**.
3. Verify the row in `review_responses` updates to `status = 'approved'` (or `'posted'`).
4. If live posting is configured, verify the API call to Google My Business is attempted (check server logs for the outbound POST).

Expected:

- `review_responses.status` transitions from `'draft'` to `'approved'` or `'posted'` after approval.
- No duplicate posts on re-approval attempt.

#### 60e: Review request automation fires after job completion

1. Mark a lead&apos;s job as complete via the admin lead detail page or API.
2. Wait for the configured review request delay (or set the delay to 1 minute for testing, then wait).
3. Verify Dev Phone #2 (the lead&apos;s number) receives a review request SMS containing the Google Business URL.

Expected:

- Review request SMS delivered to the lead after the configured delay.
- Message includes the Google Business URL set on the client.
- No duplicate request sent on subsequent completions of the same job.

---

### Step 61: Voice AI Activation Modes

#### 61a: Always-on mode

1. In the admin client detail page, set Voice AI mode to **always-on** and save.
2. Call the business line (Dev Phone #2 → #1).
3. Verify Voice AI answers immediately without ringing through to the contractor.

Expected:

- Voice AI picks up the call on the first ring.
- Call is handled entirely by the AI (or transferred on request).
- `voice_calls` row is created with `mode = 'always_on'`.

#### 61b: After-hours mode

1. Set Voice AI mode to **after-hours** and configure business hours (e.g., 9am–5pm local time).
2. Call during business hours — verify the call rings through normally (no Voice AI interception).
3. Call outside business hours — verify Voice AI answers.

Expected:

- During business hours: call passes through to the contractor&apos;s forwarding number.
- Outside business hours: Voice AI answers and a `voice_calls` row is created.
- Mode and time-of-call are logged in `voice_calls`.

#### 61c: Overflow mode

1. Set Voice AI mode to **overflow** and configure the ring timeout (e.g., 20 seconds).
2. Call the business line and let it ring without answering.
3. After the timeout, verify Voice AI picks up.

Expected:

- Voice AI answers after the configured ring timeout.
- If the contractor answers before timeout, Voice AI does not activate.
- `voice_calls` row records the overflow trigger.

#### 61d: ElevenLabs voice persona selection

1. In the admin client settings, change the ElevenLabs voice persona to a different option.
2. Make a test call to the business line (Voice AI mode must be active).
3. Verify the voice heard on the call matches the newly selected persona (audible difference from the prior setting).

Expected:

- Voice persona change takes effect on the next call without redeployment.
- `voice_calls` row logs the persona ID used.

#### 61e: Post-call transcript and summary storage

1. Complete a short test call with Voice AI active (say a sentence, then hang up).
2. Query the `voice_calls` table:

```sql
SELECT id, transcript, ai_summary, duration_seconds, created_at
FROM voice_calls
WHERE client_id = '<clientId>'
ORDER BY created_at DESC LIMIT 1;
```

Expected:

- Row exists with non-null `transcript` (verbatim conversation text).
- `ai_summary` contains a brief summary of the call intent.
- `duration_seconds` is populated and non-zero.

---

### Step 62: DNC List &amp; Blocked Numbers

#### 62a: Global DNC blocks outbound messages

1. Add a phone number (Dev Phone #2) to the global DNC list via the admin UI or API:

```bash
curl -i -X POST "http://localhost:3000/api/admin/dnc" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"phoneNumber": "+15550001111"}'
```

2. Attempt to send a message to that number (trigger an automation or use the send-message API).
3. Verify no SMS is delivered to Dev Phone #2.
4. Check the compliance gateway audit log — confirm the message was blocked with reason `dnc_global`.

Expected:

- Outbound SMS is silently blocked by `sendCompliantMessage()`.
- No Twilio API call is made for the blocked number.
- Compliance audit log records a `blocked` entry with reason `dnc_global`.

#### 62b: Per-client blocked number

1. Add Dev Phone #2 to the per-client blocked number list for the test client (admin client detail → Compliance or Contacts tab).
2. Trigger an outbound automation for a lead with that phone number.
3. Verify the message is blocked.

Expected:

- Message blocked with reason `blocked_number` (per-client).
- Global DNC and per-client blocks are independent — removing from per-client does not affect global DNC.

#### 62c: Remove from DNC resumes messages

1. Remove Dev Phone #2 from the global DNC list.
2. Trigger a new outbound message to that number.
3. Verify the SMS is delivered.

Expected:

- Message sends successfully after removal.
- Compliance audit log shows `allowed` status for the new send.

#### 62d: DNC blocking appears in the audit log

1. Review the compliance audit log (admin UI or direct DB query):

```sql
SELECT * FROM compliance_audit_log
WHERE phone_number = '+15550001111'
ORDER BY created_at DESC LIMIT 10;
```

Expected:

- Blocked entries show `status = 'blocked'` and `reason = 'dnc_global'` (or `'blocked_number'`).
- Each block event is timestamped and associated with the correct client and lead.

---

### Step 63: Feature Toggles Inventory

#### 63a: All 18 feature toggles save correctly

1. Open the admin client edit form for the test client.
2. Toggle each feature flag on and off, saving after each change. The 18 toggles are:

| Toggle | Purpose |
|--------|---------|
| `aiAgentEnabled` | AI agent responds autonomously |
| `flowsEnabled` | Multi-step follow-up flows active |
| `calendarSyncEnabled` | Google Calendar two-way sync |
| `voiceEnabled` | Voice AI active on the business line |
| `reviewMonitoringEnabled` | Google review sync and alerts |
| `reviewAutoResponseEnabled` | AI auto-drafts review responses |
| `knowledgeBaseEnabled` | KB gap detection and intake |
| `reportingEnabled` | Bi-weekly and monthly report delivery |
| `guaranteeEnabled` | Revenue guarantee tracking active |
| `smsEnabled` | Outbound SMS allowed |
| `smartAssistEnabled` | Smart Assist draft mode active |
| `estimateFollowUpEnabled` | Estimate follow-up sequence fires |
| `appointmentRemindersEnabled` | Appointment reminder messages send |
| `winBackEnabled` | Win-back cron targets this client |
| `dormantReengagementEnabled` | Dormant re-engagement cron targets this client |
| `engagementHealthEnabled` | Engagement health check monitors this client |
| `noShowRecoveryEnabled` | No-show recovery cron targets this client |
| `quarterlyBlitzEnabled` | Quarterly campaign planner includes this client |

3. After saving each toggle, query the DB to confirm the value persisted:

```sql
SELECT features FROM clients WHERE id = '<clientId>';
```

Expected:

- Each toggle saves immediately without error.
- DB value matches what was set in the UI.
- No other toggles are affected by changing one.

#### 63b: Key toggle gates actually prevent the feature

1. **`aiAgentEnabled = false`:** Send an inbound SMS from Dev Phone #2. Verify no AI response is sent (Smart Assist or autonomous response is suppressed).
2. **`calendarSyncEnabled = false`:** Run the calendar-sync cron — verify the client is skipped in the result payload.
3. **`voiceEnabled = false`:** Call the business line — verify Voice AI does not answer (call passes through or plays default Twilio handling).
4. **`flowsEnabled = false`:** Trigger an estimate follow-up — verify no flow execution row is created and no messages are scheduled.

Expected:

- Each disabled toggle prevents the associated feature from executing.
- No errors thrown — the feature is skipped gracefully.
- Cron result payloads indicate the client was skipped due to toggle being off.

---

### Step 64: Billing — Trial, Plan Changes, Reconciliation

#### 64a: Trial creation and countdown display

1. Create a new test client and set a trial end date 14 days in the future via the admin client edit form.
2. Navigate to the client detail page — verify a trial badge or countdown is visible (e.g., &ldquo;Trial: 14 days remaining&rdquo;).
3. Log into the client portal for that client — verify the trial status is also shown.

Expected:

- Trial end date saves correctly to `clients.trialEndsAt`.
- Admin client detail and portal both display the remaining trial days.
- No payment prompt shown while trial is active.

#### 64b: Trial expiry behavior

1. Set a test client&apos;s `trial_ends_at` to yesterday (past).
2. Reload the admin client detail page.
3. Verify the client is flagged as trial-expired (badge, status indicator, or locked state).
4. Attempt to use a gated feature (e.g., trigger an AI response) — verify the feature is blocked or a payment prompt appears.

Expected:

- Expired trial is surfaced clearly in the UI.
- Gated features are inaccessible or prompt for payment.
- Client data is preserved (no deletion on trial expiry).

#### 64c: Plan upgrade adjusts quotas in Stripe

1. In the admin client detail, change the subscription plan from a lower tier to a higher tier and save.
2. Check the Stripe dashboard — verify the subscription item was updated to the new price ID.
3. Query the DB to confirm the plan change:

```sql
SELECT subscription_plan, stripe_subscription_id FROM clients WHERE id = '<clientId>';
```

Expected:

- `clients.subscription_plan` updated in DB.
- Stripe subscription reflects the new plan (check via Stripe dashboard or API).
- Lead/message quotas for the new plan are enforced from the next billing period.

#### 64d: Stripe reconciliation cron

1. Manually change a client&apos;s `subscription_status` in the DB to `'active'` while their Stripe subscription is actually `'past_due'` (simulate by pausing payment in Stripe test mode).
2. Run the reconciliation cron:

```bash
curl -i http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

3. After the cron completes, query the DB:

```sql
SELECT subscription_status FROM clients WHERE id = '<clientId>';
```

Expected:

- `subscription_status` in DB is corrected to match Stripe&apos;s state (`'past_due'` or equivalent).
- Cron result payload lists the reconciled client IDs.
- No data loss or unintended side effects.

#### 64e: Payment confirmation SMS after Stripe `invoice.paid`

1. In Stripe test mode, trigger an `invoice.paid` webhook event for the test client&apos;s subscription (use the Stripe CLI):

```bash
stripe trigger invoice.paid --add invoice:customer=<stripe-customer-id>
```

2. Verify the Stripe webhook endpoint (`/api/webhooks/stripe`) returns `200`.
3. Verify the contractor (Dev Phone #3) receives a payment confirmation SMS.

Expected:

- Webhook processed with `200` response.
- Payment confirmation SMS delivered to the contractor&apos;s phone.
- `invoices` table (if present) updated with payment record.

### Step 65: Self-Serve Features (KB Wizard, AI Auto-Progression, Portal Import, Review Approval, Nudges)

Combined verification for the 9 self-serve features shipped post-Wave 7.

#### 65a: KB Onboarding Wizard (contractor self-serve)

1. Log into the client portal as a contractor with fewer than 5 KB entries.
2. Verify the dashboard shows a &ldquo;Set up your AI&rdquo; CTA banner.
3. Click the CTA — verify navigation to `/client/onboarding`.
4. Complete all 4 wizard steps (Services, Business, Hours &amp; Pricing, Booking) and submit.
5. Navigate to the Knowledge Base page and verify the submitted answers appear as KB entries.
6. Verify the API: `POST /api/client/kb-questionnaire` returns `200` with created entry IDs.

Expected:
- Wizard is gated by `PORTAL_PERMISSIONS.KNOWLEDGE_EDIT`.
- Each submitted answer creates a corresponding KB entry.
- &ldquo;Set up your AI&rdquo; CTA disappears once the client has 5+ KB entries.

#### 65b: AI Auto-Progression Cron

1. Set a test client&apos;s AI mode to `off` and set `createdAt` to 7+ days ago in the DB.
2. Ensure onboarding quality gates are passing for that client.
3. Run the cron:

```bash
curl -i http://localhost:3000/api/cron/ai-mode-progression -H "Authorization: Bearer $CRON_SECRET"
```

4. Verify the client&apos;s AI mode advances from `off` to `assist`.
5. Verify the contractor (Dev Phone #3) receives an SMS notification about the mode change.
6. Verify the transition is logged in audit_log.
7. Now set `createdAt` to 14+ days ago and confirm no AI flags exist in the last 7 days.
8. Run the cron again — verify mode advances from `assist` to `autonomous`.
9. Run the cron a third time — verify the mode does NOT change (no downgrade, no duplicate SMS).

Expected:
- Day 7 + quality gates pass → `off` → `assist`.
- Day 14 + no flags in 7 days → `assist` → `autonomous`.
- Manual overrides (client already set to `autonomous` manually) are not overwritten.
- Cron is idempotent — no duplicate transitions on re-run.

#### 65c: Portal Quote Import

1. Log into the client portal as a contractor.
2. Navigate to `/client/leads/import`.
3. Download the CSV template — verify it opens with correct column headers.
4. Prepare a test CSV with `status=estimate_sent` for 2 leads and `status=new` for 1 lead.
5. Drag and drop the file onto the upload area.
6. Verify the header auto-detection shows the mapped columns.
7. Verify the preview table shows all 3 rows with correct mapped values.
8. Click Import and confirm all 3 leads are created.
9. Verify the 2 `estimate_sent` leads have an estimate follow-up sequence triggered.
10. Test with an invalid CSV (missing required column) — verify a helpful error message.

Expected:
- `POST /api/client/leads/import` is gated by `PORTAL_PERMISSIONS.LEADS_EDIT`.
- Auto-detection maps common column name aliases correctly.
- `estimate_sent` imports trigger estimate follow-up automatically.
- Invalid rows show per-row error detail; valid rows still import.

#### 65d: Review Response Approval (client portal)

1. Ensure the test client has at least one Google review with an AI-drafted response (run review sync if needed).
2. Log into the client portal as a contractor.
3. Navigate to `/client/reviews`.
4. Verify a card appears showing: star rating, reviewer name, review text, and AI-drafted response.
5. Click the edit icon on the draft — verify inline edit mode activates.
6. Modify the draft text and verify the change is saved locally.
7. Click Approve — verify an AlertDialog confirmation appears.
8. Confirm the approval — verify the draft is sent and the card is removed from the pending list.

Expected:
- `GET /api/client/reviews/pending` returns pending drafts for the authenticated client.
- `POST /api/client/reviews/[responseId]/approve` returns `200` and marks the draft as approved.
- Empty state renders gracefully when no pending drafts exist.

#### 65e: KB Empty Nudge (48-hour)

1. Create a test client with fewer than 3 KB entries and set `createdAt` to 50 hours ago in the DB.
2. Run the cron:

```bash
curl -i http://localhost:3000/api/cron/ai-mode-progression -H "Authorization: Bearer $CRON_SECRET"
```

(The KB empty nudge fires as part of the daily onboarding cron — adjust the cron name to the actual route if different.)

3. Verify the contractor (Dev Phone #3) receives an SMS: &ldquo;Your AI needs your business info. Takes 10 min: [link]&rdquo;.
4. Run the cron again — verify no duplicate SMS is sent (deduped via audit_log).
5. Set `createdAt` to 25 hours ago — verify the nudge does NOT fire (outside the 48-72h window).

Expected:
- Fires once per client when client age is 48-72 hours and KB entry count is &lt; 3.
- Deduped via audit_log — only one nudge total per client.

#### 65f: Day 3 Check-in SMS

1. Set a test client&apos;s `createdAt` to 68 hours ago in the DB.
2. Ensure the client has some lead and conversation activity (create test records if needed).
3. Run the daily cron (7am UTC) or trigger it manually.
4. Verify the contractor (Dev Phone #3) receives an SMS containing the lead count and conversation count.
5. Run the cron again — verify no duplicate SMS (deduped via audit_log).

Expected:
- Fires once at 66-78 hours post-signup.
- Message body includes real counts from the DB (not placeholder text).
- Deduped via audit_log — only one check-in per client.

#### 65g: KB Gap Auto-Notify

1. Ensure the test client has at least 1 unresolved knowledge gap with no prior notification sent today.
2. Run the daily cron (10am UTC) or trigger it manually.
3. Verify the contractor (Dev Phone #3) receives an SMS about the unanswered question.
4. If the client has 3+ unresolved gaps, verify at most 2 notifications are sent (daily cap).
5. Run the cron again the same day — verify no additional SMS (deduped per gap via audit_log).

Expected:
- Max 2 gap notifications per client per day.
- Deduped per gap — same gap does not trigger duplicate notifications on re-run.
- Clients with no new gaps receive no SMS.

### Step 66: CASL Attestation, Help Center Articles, Lead Action Buttons, KB Gap Deep Link

Combined verification for four features shipped post-Step 65.

#### 66a: CASL consent attestation — admin CSV import

1. Prepare a valid CSV with 2 leads.
2. Attempt import via the admin UI (`/leads` &rarr; Import CSV) **without** checking the CASL consent checkbox.
3. Verify the import is blocked — UI prevents submission and/or the API returns `400`.
4. Check the request — verify the attestation field is absent or `false`.
5. Repeat with the checkbox checked.
6. Verify import succeeds and the response includes the attestation in the audit trail.

Expected:

- Import rejected (400) when `caslAttested` is missing or `false`.
- Import succeeds when `caslAttested: true` is sent.
- Audit trail in the import response echoes the attestation.

#### 66b: CASL consent attestation — portal quote import

1. Log into the client portal as a contractor.
2. Navigate to `/client/leads/import`.
3. Upload a valid CSV file.
4. Verify the CASL consent checkbox is present and required before Import can be clicked.
5. Try to submit without checking it — verify the button is disabled or a validation message appears.
6. Check the box and complete the import.
7. Verify `POST /api/client/leads/import` returns `200` with audit trail confirming attestation.

Expected:

- Checkbox is required; import is blocked without it.
- Attestation recorded in response.
- No leads created from unattestation attempts.

#### 66c: Help center seed articles

1. After running `npm run db:seed -- --lean`, log into the client portal.
2. Navigate to the Help section (or wherever help articles are surfaced in the portal).
3. Verify at least 12 articles exist across the expected categories: Getting Started, AI &amp; KB, Leads &amp; Follow-Up, Billing, Compliance.
4. Verify article content loads without errors.

Expected:

- 12 articles seeded, grouped into 5 categories.
- Articles are readable and contain expected content (no placeholder/lorem text).
- Help section renders without errors for the contractor portal user.

If blocked:

- No articles visible: run `npm run db:seed -- --lean` and reload. If still missing, check `help_articles` table directly.

#### 66d: Portal lead action buttons

1. Log into the client portal as a contractor.
2. Open a lead conversation that is in `new` or `contacted` status.
3. Verify three action buttons are visible: **Mark Estimate Sent**, **Mark Won**, **Mark Lost**.

**Mark Estimate Sent:**

4. Click **Mark Estimate Sent** — verify the lead status updates to `estimate_sent`.
5. Verify an estimate follow-up sequence is triggered for that lead (check `scheduledMessages` for a new estimate follow-up).

**Mark Won:**

6. Open a different lead. Click **Mark Won** — verify a dialog appears asking for confirmed revenue.
7. Enter a dollar amount (e.g., `4500`) and confirm.
8. Verify the lead status updates to `won` and the confirmed revenue is stored.

**Mark Lost:**

9. Open a third lead. Click **Mark Lost** — verify an AlertDialog confirmation appears.
10. Confirm the dismissal — verify lead status updates to `lost`.

Expected:

- `PATCH /api/client/leads/[id]/status` returns `200` for all three actions.
- Won action stores confirmed revenue in the lead record.
- Estimate Sent action schedules estimate follow-up sequence.
- Lost action requires AlertDialog confirmation before firing.

#### 66e: KB gap SMS deep link

1. Ensure the test client has at least one unresolved knowledge gap.
2. Run the KB gap auto-notify cron (or trigger manually):

```bash
curl -i http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

3. Verify the contractor (Dev Phone #3) receives an SMS about the unanswered question.
4. Inspect the SMS body — verify it contains a URL with a `?add=` query parameter.
5. Open the URL in a browser (or copy the path after the domain).
6. Navigate to the portal Knowledge Base page via that URL.
7. Verify the add-entry form opens automatically with the gap question pre-filled in the question field.
8. Submit an answer — verify the KB entry is created and the gap is updated.

Expected:

- SMS includes `?add=<encoded-question>` deep link.
- Portal KB page reads the `add` query param and opens the add form with the question pre-populated.
- Submitting the form creates a KB entry and links it to the gap.
- Navigating to the KB page without the param shows normal view (no stale pre-fill).

### Step 67: SPEC-07 through SPEC-12 features (Weekly Pipeline SMS, ROI Calculator, Jobber Integration, Voice AI Default)

#### 67a: Weekly Pipeline SMS

1. Ensure the test client has at least one active lead and one `action_required` lead.
2. Trigger the weekly digest cron:

```bash
curl -i http://localhost:3000/api/cron -H "Authorization: Bearer $CRON_SECRET"
```

3. **Owner Dev Phone (port 3002):** Verify an SMS arrives with dollar pipeline values (e.g., &quot;Probable pipeline: $80K | Confirmed: $25K&quot;) and a needs-attention count.

Expected:
- SMS includes dollar values for probable and confirmed pipeline.
- SMS includes the count of leads needing attention (action_required).
- SMS is sent via agency number (#5), not the business line.

#### 67b: ROI Calculator endpoint

```bash
curl -i -X POST http://localhost:3000/api/public/roi-calculator \
  -H "Content-Type: application/json" \
  -d '{"monthlyLeadVolume": 20, "avgProjectValue": 40000, "followUpGapPct": 60, "currentWinRate": 0.25}'
```

Expected:
- `200` response with `annualRevenueAtRisk`, `monthlyRecoveryPotential`, and `monthsToBreakEven` fields.
- No auth required (public endpoint).
- Invalid inputs return `400` with validation details.

#### 67c: Jobber webhook integration

**Inbound: job_completed event triggers review generation**

1. POST a simulated Jobber `job_completed` event to the platform:

```bash
curl -i -X POST http://localhost:3000/api/webhooks/jobber/job-completed \
  -H "Content-Type: application/json" \
  -d '{"jobId": "test-job-123", "clientPhone": "<lead-phone>", "clientId": "<client-id>"}'
```

2. Run the scheduled message processor:

```bash
curl -i http://localhost:3000/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"
```

3. **Lead Dev Phone (port 3001):** Verify review request SMS is received.

Expected:
- `200` response from webhook endpoint.
- Review request sequence scheduled for the matching lead.
- If no matching lead is found by phone, endpoint returns `404` (lead not found) — not a 500.

**Outbound: appointment_booked fires to configured Jobber URL**

4. Configure a mock webhook URL on the test client (`webhookUrl` in client settings or integration_webhooks table) pointing to a local test receiver (e.g., `http://localhost:9999/jobber`).
5. Book an appointment for a test lead via the booking flow.
6. Verify the mock receiver receives an `appointment_booked` event payload with the appointment details.

Expected:
- Outbound webhook fires non-blocking (appointment booking is not delayed or failed if webhook fails).
- Event payload includes `appointmentId`, `leadName`, `scheduledAt`, `eventType: "appointment_booked"`.

#### 67d: Voice AI default-on for new clients

1. Create a new test client via admin wizard (or `POST /api/admin/clients`).
2. Check the client record:

```sql
select id, business_name, settings->>'voiceEnabled' as voice_enabled
from clients
where id = '<new-client-id>';
```

Expected:
- `voiceEnabled` is `true` for the new client.
- An existing client that previously had `voiceEnabled = false` is NOT automatically changed.

3. Verify the Voice AI answers an inbound call to the new client&apos;s business line (if Twilio is configured and the new client has a phone number assigned).

---

### Step 68: Admin UI Tools (GAP-1 through GAP-6)

#### 68a: DNC/Exclusion List (per-client)

1. Navigate to admin client detail page &rarr; Configuration tab &rarr; Exclusion List card.
2. POST a phone number via the card UI or API:

```bash
curl -i -X POST "http://localhost:3000/api/admin/clients/<client-id>/dnc" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"phoneNumber": "+15550001234"}'
```

3. Verify the number appears in `GET /api/admin/clients/<client-id>/dnc`.
4. Send an outbound message to that number (trigger an automation). Verify compliance gateway blocks it.
5. DELETE the number and verify it no longer appears in the GET response.

Expected:
- Number is blocked by `sendCompliantMessage()` with reason `dnc_client`.
- Number is removed from the list and outbound resumes after DELETE.

#### 68b: Smart Assist Pending Drafts Admin View

1. Set the test client to Smart Assist mode.
2. Text the business number from Dev Phone #2 to trigger an AI draft.
3. Verify the draft appears in `GET /api/admin/clients/<client-id>/smart-assist`.
4. Approve via the API or Campaigns tab UI:

```bash
curl -i -X POST "http://localhost:3000/api/admin/clients/<client-id>/smart-assist/<message-id>" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"action": "approve"}'
```

5. Verify the message sends to Dev Phone #2.
6. Trigger another draft. Cancel it via `{ "action": "cancel" }`. Verify nothing sends.
7. Verify the Campaigns tab polls every 15 seconds and updates without a page refresh.

Expected:
- Approved draft sends successfully.
- Cancelled draft is killed with no outbound SMS.

#### 68c: Guarantee Status Card

1. Navigate to admin client detail page &rarr; Overview tab for a client with an active subscription.
2. Verify the Guarantee Status card is visible and shows: current phase (`proof_pending` or `recovery_pending`), QLE count vs. target, pipeline value vs. $5K floor, days remaining, and a status badge (green/yellow/red).
3. For a client past Day 30 in proof phase with 5+ QLEs, verify the badge shows on-track (green).

Expected:
- Card is visible without any API call (server-side render).
- Phase and progress values match the underlying guarantee subscription record.

#### 68d: Engagement Health Badge

1. Navigate to admin client detail page &rarr; Overview tab for a client with no estimate flags in 25+ days or no won/lost updates in 30+ days.
2. Verify the engagement health badge shows `at_risk` or `disengaged` with signal bullets (days since last estimate flag, days since last won/lost update).
3. For a client with recent activity, verify no badge or a healthy status is shown.

Expected:
- Badge renders for clients where `checkEngagementHealth()` returns a non-healthy status.
- Signal bullets accurately reflect the underlying data.

#### 68e: Integration Webhook Config UI

1. Navigate to admin client detail page &rarr; Configuration tab &rarr; Integrations card.
2. POST a new webhook via the card UI or API:

```bash
curl -i -X POST "http://localhost:3000/api/admin/clients/<client-id>/integrations" \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin-session-cookie>" \
  -d '{"provider": "jobber", "direction": "outbound", "eventType": "appointment_booked", "url": "https://example.com/webhook", "secretKey": "test-secret"}'
```

3. Verify the webhook appears in `GET /api/admin/clients/<client-id>/integrations`.
4. PATCH to disable it: `{ "enabled": false }`. Verify disabled state is reflected.
5. DELETE the webhook and verify it no longer appears in the GET response.

Expected:
- Webhook CRUD operations work without error.
- Disabled integrations do not fire events.
- Failure count and last triggered time display correctly once events have fired.

#### 68f: Admin Data Export Trigger

1. Navigate to admin client detail page &rarr; client header area (Actions card has been removed; Export Data is now in the page header).
2. Click &ldquo;Export Data.&rdquo; Confirm the AlertDialog prompt.
3. Verify via API:

```bash
curl -i -X POST "http://localhost:3000/api/admin/clients/<client-id>/export" \
  -H "Cookie: <admin-session-cookie>"
```

Expected:
- Response contains a success status.
- Export job is created (visible in the data export SLA queue at admin billing if applicable).
- No confirmation dialog is bypassable — the AlertDialog must be confirmed before the POST fires.

---

## 3. Useful Commands

```bash
# Automated baseline
npm test                    # 315 deterministic tests (no LLM calls)
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
curl -i http://localhost:3000/api/cron/calendar-sync -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/engagement-health-check -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/dormant-reengagement -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/probable-wins-nudge -H "Authorization: Bearer $CRON_SECRET"
curl -i http://localhost:3000/api/cron/ai-mode-progression -H "Authorization: Bearer $CRON_SECRET"
curl -i -X POST http://localhost:3000/api/cron/trial-reminders -H "Authorization: Bearer $CRON_SECRET"
curl -i -X POST http://localhost:3000/api/cron/cancellation-reminders -H "Authorization: Bearer $CRON_SECRET"

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
