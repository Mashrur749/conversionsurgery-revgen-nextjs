# Managed Service Launch Checklist

Date: 2026-04-01
Status: Pre-launch
Service: $1,000/mo managed revenue recovery for Alberta renovation contractors
Reference docs: `02-MANAGED-SERVICE-PLAYBOOK.md` (delivery processes), `01-OPERATIONS-GUIDE.md` (daily ops + knowledge gap resolution)

---

## Phase 1: Learn the Platform

- [ ] Walk through `docs/engineering/01-TESTING-GUIDE.md` end to end (Steps 1-38, 53-57)
  - Create a test client via admin wizard
  - Assign a phone number
  - Import test leads via CSV (with status=estimate_sent)
  - Trigger all automations manually (estimate follow-up, win-back, no-show, payment)
  - Send a test message, verify AI responds
  - Generate a report
  - Test Stripe Checkout subscription flow (Step 26)
  - Test CSV import with status column (Step 27)
  - Test AI agent graceful handling without Twilio number (Step 28)
  - Test self-serve phone provisioning (Step 30)
  - Test per-client automation pause (Step 36)
  - Test AI quality review page (Step 37)
  - Run pre-launch AI scenario tests (Step 33) and AI criteria tests (Step 34)
  - Complete the full end-to-end lead lifecycle smoke (Step 38)
  - Test consensus fixes: 48hr estimate nudge, confirmed revenue, report follow-up SMS (Step 55)
  - Test Google Calendar two-way sync (Step 56)
  - Test triage dashboard, KB questionnaire, engagement health, dormant re-engagement, Revenue Recovered card (Step 57)
  - Complete Testing Guide Steps 60-64 (review monitoring, voice AI modes, DNC list, feature toggles, billing/trial)
- [ ] Verify Google Places review sync is running for the demo client (check `review_sources` table has a Place ID)
- [ ] Walk through `docs/engineering/TESTING-SELF-SERVE.md` (Steps 1-7)
  - Sign up as a contractor, verify auto-login to dashboard
  - Verify dashboard setup banner (phone + plan checklist)
  - Set up phone, choose plan via Stripe Checkout
  - Verify settings page phone card
- [ ] Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` cover to cover
  - This is your day-to-day reference for handling every client scenario
  - Includes Section 12: Sales Conversation Guide
- [ ] Read `docs/operations/01-OPERATIONS-GUIDE.md` &mdash; Knowledge Gap Resolution Process section
  - This is how the AI improves over time
- [ ] Read `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md`
  - 10 objections with scripts, proof points, and demo sequences
  - Social proof capture framework
  - Quiet hours positioning
- [ ] Delete all test data when done (or use a separate Neon branch)

---

## Phase 2: Production Environment

### Stripe (30 minutes)

- [ ] Create 1 Stripe product: &quot;ConversionSurgery Managed Service&quot;
- [ ] Create 1 price: $1,000/month recurring
- [ ] Copy the price ID (starts with `price_`)
- [ ] Set in production env: `STRIPE_PRICE_PRO_MONTHLY=price_xxxxx`
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`
- [ ] Create Stripe webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `payment_method.attached`
- [ ] Copy webhook signing secret &rarr; set `STRIPE_WEBHOOK_SECRET`

### Email (10 minutes)

- [ ] Set `RESEND_API_KEY` (from resend.com dashboard)
- [ ] Set `EMAIL_FROM` to your verified domain (e.g., `noreply@conversionsurgery.com`)
- [ ] Verify domain in Resend (DNS records)

### Twilio (already configured if testing passed)

- [ ] Confirm `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
- [ ] Set `TWILIO_WEBHOOK_BASE_URL` to production domain
- [ ] Confirm at least one phone number is available to purchase in Twilio account

### Google Calendar (10 minutes)

- [ ] Create a Google Cloud project (or reuse existing)
- [ ] Enable the Google Calendar API
- [ ] Create OAuth 2.0 credentials (Web application type)
- [ ] Set authorized redirect URI: `https://yourdomain.com/api/auth/callback/google-calendar`
- [ ] Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in production env

### Other Required Env Vars

- [ ] `DATABASE_URL` &mdash; production Neon connection string
- [ ] `AUTH_SECRET` &mdash; generate with `openssl rand -hex 32`
- [ ] `CLIENT_SESSION_SECRET` &mdash; generate with `openssl rand -hex 32`
- [ ] `CRON_SECRET` &mdash; generate with `openssl rand -hex 32`
- [ ] `ANTHROPIC_API_KEY` &mdash; from console.anthropic.com
- [ ] `NEXT_PUBLIC_APP_URL` &mdash; your production domain (e.g., `https://app.conversionsurgery.com`)
- [ ] `GOOGLE_CLIENT_ID` &mdash; from Google Cloud Console (see Google Calendar section)
- [ ] `GOOGLE_CLIENT_SECRET` &mdash; from Google Cloud Console

**Post-login setup (not env vars):**
- [ ] After first admin login, set `operator_phone` and `operator_name` in system_settings via `/admin/settings`. The phone receives SMS alerts on cron failures and SLA breaches. The name appears on the &quot;Your Account Manager&quot; card in the client portal.

### Billing &amp; Tax (before first invoice)

- [ ] Determine your GST registration status (if under $30K annual revenue, you may be exempt as a small supplier)
- [ ] If GST-registered: configure Stripe Tax with your GST number (5% GST for Alberta clients)
- [ ] If GST-registered: update pricing language to &quot;$1,000/month plus applicable taxes&quot; in proposals
- [ ] If NOT GST-registered: document the small supplier exemption decision and revisit at $30K revenue
- [ ] Verify Stripe invoices show correct business name, address, and tax line before first client bill

### Database

- [ ] Create a staging Neon branch for safe testing:
  - Via Neon Dashboard: Project &rarr; Branches &rarr; Create Branch (name: `staging`)
  - Or via CLI: `neonctl branches create --name staging --project-id <project-id>`
  - Use the staging branch connection string for local dev (`DATABASE_URL` in `.env.local`)
  - Production branch stays untouched until `db:migrate` is explicitly run against it
  - Reset staging to match production anytime: `neonctl branches reset staging --parent`
- [ ] Run `npm run db:migrate` on production
- [ ] Run `npm run db:seed -- --lean` (seeds plans, role templates, flow templates, system settings)
- [ ] Verify seed created the Pro plan with your Stripe price ID
- [ ] Confirm the production plan seed has `isUnlimitedMessaging: true` for the $1,000/month Pro plan
- [ ] Run `npm run db:seed -- --demo` to create a demo client for sales calls (removable via `--demo-cleanup`)

### Deploy

- [ ] Deploy to Cloudflare (via OpenNext)
- [ ] Verify runtime smoke: hit `/login`, `/signup`, `/client-login` &mdash; all return 200
- [ ] Run `npm run quality:no-regressions` against production
- [ ] Verify the Stripe reconciliation cron runs without errors
- [ ] Verify the review sync cron runs without errors

**Cron setup (single trigger):**

The platform uses a unified cron orchestrator. You only need **one** Cloudflare Workers Cron Trigger:

| Schedule | Endpoint | Header |
|----------|----------|--------|
| Every 5 min | `POST /api/cron` | `Authorization: Bearer $CRON_SECRET` |

The orchestrator dispatches all sub-jobs internally based on time:

| Frequency | Jobs dispatched |
|-----------|----------------|
| **Every 5 min** | Process scheduled messages, check missed calls |
| **Every 30 min** | Auto review response, Google Calendar sync, report delivery retries |
| **Hourly** | Usage tracking, escalation SLA check, review sync, expire prompts, NPS, agent check, compliance queue replay, knowledge gap alerts, onboarding SLA check |
| **Daily midnight UTC** | Lead scoring, analytics aggregation, trial reminders, no-show recovery, Stripe reconciliation, voice usage rollup, guarantee check, monthly reset |
| **Daily 7am UTC** | Daily summary, bi-weekly reports (auto-scheduled) |
| **Daily 10am UTC** | Win-back, estimate fallback nudges, quarterly campaign planner + alerts |
| **Weekly Monday 7am UTC** | Weekly summary, agency digest, quarterly campaign digest, engagement health check |
| **Weekly Wednesday 10am UTC** | Dormant re-engagement (6-month) |
| **Monthly 1st** | Cohort analysis, access review |

No individual sub-endpoints need separate Cloudflare triggers.

**Twilio webhook configuration:**

Configure these webhooks in the Twilio Console for each phone number:

| Number | Webhook | URL | Method |
|--------|---------|-----|--------|
| **Agency number (#5)** | Voice | `https://<domain>/api/webhooks/twilio/agency-voice` | POST |
| **Agency number (#5)** | SMS | `https://<domain>/api/webhooks/twilio/agency-sms` | POST |
| **Each client business number** | SMS | `https://<domain>/api/webhooks/twilio/sms` | POST |
| **Each client business number** | Voice | `https://<domain>/api/webhooks/twilio/voice` | POST |
| **Each client business number** | Status Callback | `https://<domain>/api/webhooks/twilio/status` | POST |

Note: Client business numbers purchased via the platform auto-configure webhooks via the Twilio API. You only need to manually configure the agency number (#5) in the Twilio Console.

---

## Phase 3: First Client Delivery

Reference: `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` for detailed processes.

### Before the sales call

- [ ] Read `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` &mdash; scripts for the 10 most common objections + Section 12 for pitch angles and outreach scripts
- [ ] Open `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` &mdash; fill in the prospect&apos;s outstanding quotes and average job value before the call so the recoverable pipeline number is ready when price sensitivity comes up (Objection 8)
- [ ] Prepare the demo client (`npm run db:seed -- --demo`) so you can show the system live
  - [ ] Assign a real phone number to the demo client (verify Alberta 403/780 area code)
  - [ ] Confirm Twilio webhooks are pointed at production for the demo number
  - [ ] Do a live test: call the demo number, verify missed-call text-back fires within 5 seconds
  - [ ] Verify the demo client has a populated knowledge base (use the seed data)
  - [ ] Run `--demo-cleanup` after each sales demo session to prevent stale cron activity
- [ ] Prepare to do the &quot;call your own number&quot; demo during the sales conversation (not onboarding)
- [ ] Pre-qualify: &quot;How many inbound leads do you get per month?&quot; (target: 10+)
- [ ] Pre-qualify: &quot;How many quotes in your phone have had no response for 2+ weeks?&quot;
- [ ] If referral-heavy: lead with estimate follow-up + review generation angle (see Playbook Section 12)

### After the contractor says yes

Day 0 (signing):
- [ ] Send the service agreement for signature — template at `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md`
  - Fill in all [bracketed] fields (client name, address, email, start date, operator name/email)
  - Send as PDF via DocuSign, HelloSign, or email confirmation
  - Do not proceed with platform setup until signed agreement is received
  - Note: sections marked [PENDING COUNSEL REVIEW] are draft language — get counsel review at client #5
- [ ] Verify agency number (#5) webhooks are configured (see Phase 2 Deploy section)
- [ ] Verify `operator_phone` and `operator_name` are set in system_settings
- [ ] Create client via admin wizard (`/admin/clients/new/wizard`)
- [ ] Assign a local phone number in the wizard (or from client detail page)
- [ ] Onboarding card on client detail page shows 3 next steps (phone, quotes, knowledge base)
- [ ] If contractor uses Google Calendar: connect during setup, verify first sync completes
- [ ] If contractor wants Voice AI: configure activation mode (always-on / after-hours / overflow) and verify with a test call

Day 1 (onboarding call):
- [ ] 30-minute onboarding call (see Playbook Section 10 for script)
- [ ] **During the call:** fill out the KB Intake Questionnaire (`/admin/clients/[id]` &mdash; shows automatically when fewer than 5 KB entries). This pre-populates the AI with 80% of what it needs before the first lead.
- [ ] Contractor calls their own number &mdash; missed call text-back fires (visceral proof moment)
- [ ] Ask contractor for their old quotes (spreadsheet, phone contacts, or CRM export)
- [ ] Import quotes via CSV with `status=estimate_sent` (see Playbook Section 2)
- [ ] Verify leads appear in `/leads` filtered by source=CSV Import
- [ ] Offer Google Calendar connection if they use Google Calendar (`/admin/clients/[id]` &mdash; Calendar Integration card, or contractor self-serves from portal Settings)
- [ ] Walk contractor through the weekly &quot;probable wins&quot; nudge SMS &mdash; explain they&apos;ll get a weekly text asking about appointment outcomes
- [ ] Explain the review monitoring feature: negative review alerts, AI-drafted responses, approval before posting
- [ ] If contractor reports booking notification emails instead of SMS: check compliance audit log for blocked SMS entries

Day 1-2:
- [ ] Supplement KB from onboarding call (`/admin/clients/[id]/knowledge`)
  - Fill any gaps the questionnaire missed: edge cases, competitive advantages, specific FAQs
- [ ] Deliver Revenue Leak Audit (research their Google Business Profile, website, competitors)

Day 3-5:
- [ ] AI configured with client knowledge &mdash; enable form response automation
- [ ] Set AI mode to Smart Assist (5-min auto-send delay)
- [ ] Verify AI generates reasonable responses for test messages
- [ ] Run `npm run test:ai` with this client&apos;s KB &mdash; all Safety tests must pass before autonomous (Playbook Section 3)

Week 2 (KB sprint):
- [ ] Check knowledge gap queue daily (see Ops Guide &mdash; Knowledge Gap Resolution Process)
  - Expect 5-15 gaps in Week 2 as AI encounters real conversations for the first time
  - Use the &quot;Ask Contractor&quot; button to get answers via SMS without leaving the dashboard
  - Dedicate 15-20 min on Day 8-10 to clear the queue in bulk
- [ ] Review AI quality page (`/admin/ai-quality`) for flagged messages (Playbook Section 3)
- [ ] First bi-weekly report generated and delivered (Playbook Section 4)
  - System auto-sends follow-up SMS to contractor after delivery
- [ ] Win-back cron starts picking up imported quotes (if 25+ days old)
  - Imported quotes with `estimate_sent` status also get auto-triggered follow-up within 72 hours (CON-07)
- [ ] Verify flow reply-rate metrics are populating (`templateMetricsDaily.leadsResponded` &gt; 0 for active flows)
- [ ] Check AI Preview panel works for this client&apos;s KB &mdash; test with 3 sample homeowner questions
- [ ] Verify probable wins nudge cron fires for the first time (runs weekly, 14-day cooldown)
- [ ] Verify flow metrics are populating: check `templateMetricsDaily.leadsResponded` for any estimate or win-back flows triggered this week. If the count stays at 0 after the first inbound reply, confirm the SMS webhook is routing correctly and the flow execution row is marked `active`.
- [ ] Text contractor recap: &quot;Week 2 update &mdash; [X] leads handled, [Y] quotes reactivated, [Z] appointments booked&quot;

Week 3+:
- [ ] Upgrade AI to Autonomous mode (only after Safety tests pass)
- [ ] All automations running: estimate follow-up, appointment reminders, payment collection, review generation, win-back, dormant re-engagement (6-month)
- [ ] Monitor escalations dashboard for anything that needs human attention
- [ ] Knowledge gap queue should be slowing down (most common questions answered)
- [ ] Check AI Effectiveness dashboard (`/admin/ai-effectiveness`) for outcome trends

### Track ROI

- [ ] After first week: count quote reactivation responses (target: 10%+ response rate)
  - **Capture social proof:** if a reactivated lead responds positively, document the win (see Sales Objection Playbook &mdash; Social Proof Framework)
- [ ] After 30 days: check 5 Qualified Lead Engagements &mdash; guarantee Layer 1 (Playbook Section 5)
- [ ] After 90 days: check 1 Attributed Project Opportunity &mdash; guarantee Layer 2 (Playbook Section 5)
  - Attribution is fully log-based (no contractor confirmation needed)
- [ ] Verify the Revenue Recovered card shows in the contractor&apos;s portal dashboard (`/client`)
  - Shows confirmed revenue, ROI vs cost, and recent wins
- [ ] When first job is marked Won: verify the win notification SMS fires to the contractor

### Ongoing (per client)

- [ ] **Daily:** Start at the Triage Dashboard (`/admin/triage`) &mdash; shows which clients need attention, sorted by urgency. Then check escalations, knowledge gap queue, AI quality flags (5-10 min per client).
- [ ] **Bi-weekly:** Report auto-delivers + auto-sends follow-up SMS. Review report for accuracy before delivery (Playbook Section 4).
- [ ] **Weekly:** Engagement health check runs automatically on Mondays. You receive SMS alerts if a client shows disengagement signals (no estimate flags in 21+ days, no won/lost updates in 30+ days).
- [ ] **Monthly:** Health check metrics review (Playbook Section 11)
- [ ] **Quarterly:** Growth Blitz campaign selection (Playbook Section 10 of capabilities doc)
- [ ] If contractor requests pause: set status to Paused from client detail page (Playbook Section 6)
- [ ] If approaching slow season (November): proactively offer pause before contractor asks to cancel

---

## Phase 4: Outreach (Do This Now &mdash; Spring Window Closing)

The research confirms March-April is the prime outreach window. Contractors are flooded with leads and can&apos;t respond to all of them. After mid-April, they go heads-down into summer projects.

- [ ] Read `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` &mdash; memorize the Tier 1 objection responses
- [ ] Open ROI worksheet (`docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`) before each call
- [ ] 5 minutes before each sales call: call the demo number from a separate phone and verify missed-call text-back fires within 10 seconds
- [ ] Prepare outreach using angles from `SALES-OBJECTION-PLAYBOOK.md` Section 12 (Outreach Scripts)
- [ ] Lead with quote reactivation angle (Angle A) &mdash; lowest objection surface
- [ ] For referral-heavy prospects: pivot to estimate follow-up + review generation angle (Playbook Tier 2)
- [ ] Track outreach experiment results (what angles convert, what objections surface)
- [ ] First 3-5 clients: manually deliver, learn what friction points actually matter
- [ ] After 5 clients: update `OFFER-CLIENT-FACING.md` with validated reframe if outreach data supports it

---

## Quick Reference: Key Admin Pages

| Page | URL | Use |
|------|-----|-----|
| Client Triage | `/admin/triage` | Daily starting point &mdash; see which clients need attention |
| Client Detail | `/admin/clients/[id]` | KB questionnaire, calendar integration, onboarding card |
| Escalation Queue | `/escalations` | Handle AI escalations (SLA: 4 business hours for P1) |
| AI Quality | `/admin/ai-quality` | Review flagged AI messages across all clients |
| AI Effectiveness | `/admin/ai-effectiveness` | Outcome trends, model tier ROI, confidence bands |
| Reports | `/admin/reports` | Review bi-weekly reports before delivery |
| Reliability | `/admin/reliability` | Failed crons, webhook failures, error telemetry |
| Settings | `/admin/settings` | Kill switches, operator phone, system config |
