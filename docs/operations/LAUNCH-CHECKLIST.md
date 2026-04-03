# Launch Checklist

Go top to bottom. Don&apos;t skip steps. Each step tells you exactly what to do.

---

## Step 1: Set Up Your Local Environment (30 min)

You need a database and API keys before you can test anything.

### 1.1 Database

```bash
# Install the Neon CLI
npm install -g neonctl
neonctl auth

# Find your project ID
neonctl projects list
# Copy the ID (looks like: aged-forest-12345678)

# Create a staging branch (safe copy of production)
neonctl branches create --name staging --project-id YOUR_PROJECT_ID

# Get the connection string
neonctl connection-string staging --project-id YOUR_PROJECT_ID
# Copy this — you'll paste it below
```

- [ ] Add the staging connection string to `.env.local` as `DATABASE_URL`
- [ ] Run: `npm run db:migrate`
- [ ] Run: `npm run db:seed -- --lean`

### 1.2 Env Vars

Copy this entire block into `.env.local`. Fill in each value.

```
# Database (from step 1.1)
DATABASE_URL=postgresql://...your-staging-string...

# Auth (generate these — run each command, paste the output)
# Run: openssl rand -hex 32
AUTH_SECRET=
CLIENT_SESSION_SECRET=
CRON_SECRET=

# AI (https://console.anthropic.com → API Keys → Create)
ANTHROPIC_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (https://dashboard.stripe.com → Developers → API Keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...

# Email (https://resend.com → API Keys)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Twilio (https://console.twilio.com → Account Info)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WEBHOOK_BASE_URL=http://localhost:3000

# Google Calendar (https://console.cloud.google.com → APIs → Credentials)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] Every line above has a real value (no blanks, no placeholders)
- [ ] Run: `npm run dev` &mdash; app starts without errors at http://localhost:3000

### 1.3 First Login

- [ ] Go to http://localhost:3000/login
- [ ] Enter your admin email &mdash; check your inbox for the magic link
- [ ] After login, go to `/admin/settings`
- [ ] Set `operator_phone` to your real phone number (you&apos;ll get SMS alerts here)
- [ ] Set `operator_name` to your name (shows on the contractor&apos;s &ldquo;Your Account Manager&rdquo; card)

---

## Step 2: Test the Core Experience (4 hours)

This is where you learn what the system actually does. Follow the Testing Guide for details, but here&apos;s the simplified version.

### 2.1 Set Up Twilio Dev Phones

You need 5 phone numbers and 3 browser tabs to simulate real conversations. See `docs/engineering/01-TESTING-GUIDE.md` Section 0 for the full setup, but here&apos;s the short version:

```bash
# Terminal 1: Tunnel (so Twilio can reach your local app)
ngrok http 3000
# Copy the https URL

# Terminal 2: App
npm run dev

# Terminal 3-5: Dev Phones (simulate lead, owner, team member)
twilio dev-phone --port 3001   # Lead phone
twilio dev-phone --port 3002   # Owner phone
twilio dev-phone --port 3003   # Team member phone
```

- [ ] Update `TWILIO_WEBHOOK_BASE_URL` in `.env.local` to your ngrok URL
- [ ] In Twilio Console: point your business line (#1) SMS + Voice webhooks to the ngrok URL
- [ ] Configure the Agency Line (#5) at `/admin/agency` in the app

### 2.2 The Tests That Matter

Do each one. If something fails, stop and fix it before moving on.

**Test A: Missed Call Text-Back**
1. From Dev Phone #2 (Lead), call your business number (#1)
2. Let it ring to voicemail
3. Within 5 seconds, Dev Phone #2 should receive a text from #1
- [ ] Text arrived within 5 seconds? Move on.

**Test B: AI Conversation**
1. From Dev Phone #2, text the business number: &ldquo;Hi, I need a quote for a kitchen renovation&rdquo;
2. Wait 2-8 seconds
3. You should get an AI-generated response
- [ ] AI responded with something relevant? Move on.

**Test C: Import Old Quotes**
1. Go to `/leads` in the admin dashboard
2. Click Import, upload a CSV with columns: `name, phone, status`
3. Set status to `estimate_sent` for all rows
4. Check the CASL consent checkbox
5. After import, check the lead list &mdash; they should appear with estimate follow-up scheduled
- [ ] Leads imported, follow-up scheduled? Move on.

**Test D: Mark a Lead Won + Verify System Activity**
1. Go to the contractor portal (log in as a contractor via `/client-login`)
2. On the dashboard, verify the **System Activity** card appears above the Revenue Recovered card and shows 6 stat tiles (Leads Responded To, Estimates in Follow-Up, Missed Calls Caught, Dead Quotes Re-Engaged, Appointments Booked, Avg Response Time)
3. Verify the Revenue Recovered card has a &ldquo;Confirmed by you&rdquo; subtitle
4. Open Conversations, pick a lead
5. Click &ldquo;Mark Won&rdquo;, enter a revenue amount (e.g., 45000)
6. Check the Revenue Recovered card on the dashboard
- [ ] System Activity card visible with stats? Move on.
- [ ] Revenue shows on the dashboard after marking won? Move on.

**Test E: Generate a Report**
1. Trigger the report cron: `curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`
2. Check `/admin/reports` for the generated report
3. Check that a follow-up SMS was sent to the owner (requires Twilio + Resend configured)
- [ ] Report generated, SMS sent? Move on.

**Test F: Google Calendar Sync** (skip if Google OAuth not yet configured &mdash; you&apos;ll test in Step 4)
1. Go to `/admin/clients/[id]` &rarr; Configuration tab
2. Click &ldquo;Connect Google Calendar&rdquo;
3. Authorize with a Google account
4. Create an appointment for a lead
5. Check your Google Calendar &mdash; the event should appear
- [ ] Event synced to Google Calendar? Move on. (Or: skipped, will test after Step 4.)

**Test G: Stripe Checkout** (skip if Stripe not yet configured &mdash; you&apos;ll test in Step 4)
1. Go to the contractor portal &rarr; Billing
2. Click upgrade/subscribe
3. Complete Stripe Checkout with test card `4242 4242 4242 4242`
4. Verify the subscription is active
- [ ] Subscription active in Stripe dashboard? Move on. (Or: skipped, will test after Step 4.)

**Test H: AI Safety Tests**
```bash
npm run test:ai
```
- [ ] All Safety tests pass? Move on.

**Test I: AI Preview**
1. Go to `/admin/clients/[id]` &rarr; AI Preview panel
2. Type: &ldquo;How much does a kitchen renovation cost?&rdquo;
3. The AI should respond using the client&apos;s KB (not hallucinate)
- [ ] Response is reasonable and uses KB data? Move on.

### 2.3 Cleanup

- [ ] Run `npm run db:seed -- --demo-cleanup` to remove test data
- [ ] Or just reset your staging branch: `neonctl branches reset staging --parent --project-id YOUR_PROJECT_ID`

---

## Step 3: Learn the System (~90 minutes for the core, then reference docs)

### Start here: The Operator Guide

- [ ] Read `docs/operations/00-OPERATOR-GUIDE.md` end to end (~90 minutes)

This single document covers everything you need to sell and operate: what the system does, the deal structure, how the AI works, the failure modes, the honest boundaries, the sales conversation flow, the top 3 objections, the onboarding script, the daily routine, and the 7 legal hard rules. All in one place, all connected.

**After reading the Operator Guide, do the self-tests below. If you can answer all of them without looking, you&apos;re ready to sell.**

### Self-test (answer from memory before moving on)

- [ ] What does the contractor get for their money? (Part 1)
- [ ] What&apos;s the deal structure? First month free, then what? (Part 2)
- [ ] What happens when the AI doesn&apos;t know something? (Part 3)
- [ ] What are the 3 objections you&apos;ll hear every time? (Part 4)
- [ ] What&apos;s the onboarding call flow? (Part 5)
- [ ] What are the 7 hard rules? (Part 6)
- [ ] Who should you NOT sign? (Part 2 &mdash; disqualifiers)

**If you can answer all 7: you&apos;re ready to sell.** Move to Step 4.

### Prepare your materials

- [ ] `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` &mdash; fill in YOUR name, email, address now (15 min)
- [ ] `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` &mdash; save where you can open it on a call (5 min)

### Deep reference docs (read during Week 1 of delivery, not before selling)

These go deeper than the Operator Guide. You don&apos;t need them to sell &mdash; you need them when you&apos;re delivering.

| Doc | When to read | What it adds |
|-----|-------------|-------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | Before onboarding client #1 | Every feature in detail (12 sections, 45 min) |
| `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | Before onboarding client #1 | Every delivery scenario (22 sections, 60 min) |
| `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` | Before your 3rd sales call | All 10 objections with full scripts + outreach angles (30 min) |
| `docs/operations/01-OPERATIONS-GUIDE.md` | When client #1 is live | Daily ops checklist &mdash; 70 items (skim 30 min) |
| `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md` | Day 1-2 of client #1 | The 48-hour deliverable format (10 min) |

---

## Step 4: Deploy to Production (2-3 hours)

Now you&apos;re setting up the real thing. Everything above was local testing.

### 4.1 Stripe (30 min)

1. Go to https://dashboard.stripe.com &rarr; Products &rarr; Add Product
2. Name: &ldquo;ConversionSurgery Managed Service&rdquo;
3. Add a price: $1,000/month, recurring, with a **30-day free trial** (Stripe supports this natively &mdash; set `trial_period_days: 30` on the price or subscription)
4. Copy the price ID (starts with `price_`)
5. Go to Developers &rarr; Webhooks &rarr; Add Endpoint
6. URL: `https://yourdomain.com/api/webhooks/stripe`
7. Select these events:
   - `checkout.session.completed`
   - `customer.subscription.created`, `.updated`, `.deleted`
   - `invoice.paid`, `.payment_failed`, `.payment_action_required`
   - `charge.refunded`, `.dispute.created`, `.dispute.closed`
   - `customer.subscription.paused`, `.resumed`, `.trial_will_end`
   - `payment_method.attached`
8. Copy the webhook signing secret

- [ ] Price ID, API keys, and webhook secret are set in production env

### 4.2 Email (10 min)

1. Go to https://resend.com &rarr; API Keys &rarr; Create
2. Go to Domains &rarr; Add your domain &rarr; Add the DNS records they give you
3. Wait for verification (usually 5-15 min)

- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set in production env

### 4.3 Google Calendar (10 min)

1. Go to https://console.cloud.google.com
2. Create a project (or use existing)
3. Enable &ldquo;Google Calendar API&rdquo;
4. Go to Credentials &rarr; Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI: `https://yourdomain.com/api/auth/callback/google-calendar`
6. Copy Client ID and Secret

- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set in production env

### 4.4 Production Database

```bash
# Get production connection string from Neon dashboard
# Set it in your production environment as DATABASE_URL

# Run migrations against production
DATABASE_URL=your_production_string npm run db:migrate

# Seed production
DATABASE_URL=your_production_string npm run db:seed -- --lean
```

- [ ] Verify the Pro plan exists with your Stripe price ID
- [ ] Verify `isUnlimitedMessaging: true` on the Pro plan
- [ ] Verify 12 help center articles are seeded

### 4.5 Deploy

- [ ] Deploy to Cloudflare via OpenNext
- [ ] Hit these URLs and confirm they load:
  - `https://yourdomain.com/login` &rarr; admin login page
  - `https://yourdomain.com/signup` &rarr; signup page
  - `https://yourdomain.com/client-login` &rarr; contractor login
- [ ] Set up one Cloudflare Workers Cron Trigger:
  - Schedule: every 5 minutes
  - URL: `POST https://yourdomain.com/api/cron`
  - Header: `Authorization: Bearer YOUR_CRON_SECRET`
- [ ] In Twilio Console, configure your agency number (#5) webhooks:
  - Voice: `https://yourdomain.com/api/webhooks/twilio/agency-voice` (POST)
  - SMS: `https://yourdomain.com/api/webhooks/twilio/agency-sms` (POST)
- [ ] Log in to production, set `operator_phone` and `operator_name` at `/admin/settings`
- [ ] Seed the demo client: `DATABASE_URL=prod_string npm run db:seed -- --demo`

### 4.6 GST/Tax (before first invoice)

- [ ] Are you GST-registered? If under $30K annual revenue, you&apos;re likely exempt (small supplier)
- [ ] If registered: configure Stripe Tax, update pricing to &ldquo;$1,000/month plus applicable taxes&rdquo;
- [ ] If not registered: note the decision, revisit at $30K revenue

### 4.7 Smoke Test Production

- [ ] Assign a real Alberta phone number (403/780) to the demo client
- [ ] Call the demo number from your personal phone
- [ ] Missed-call text-back arrives within 5 seconds?
- [ ] Text the demo number: &ldquo;I need a quote for a bathroom renovation&rdquo;
- [ ] AI responds within 10 seconds?

If both pass: production is live. If either fails: check Twilio webhooks and the reliability dashboard at `/admin/reliability`.

---

## Step 5: Start Selling

Your outreach plan with day-by-day schedule, word-for-word scripts, and channel strategy is at `docs/operations/COLD-START-PLAYBOOK.md`. It&apos;s designed for someone with a 9-5 job (early mornings + evenings + weekends).

### 5.1 Get Your Materials Ready

- [ ] Service agreement template is filled with YOUR details (name, email, address) &mdash; ready to send as PDF
- [ ] ROI worksheet is saved where you can pull it up on a call
- [ ] You&apos;ve memorized the response to: &ldquo;What if the AI says something wrong?&rdquo; (Playbook Objection 1)
- [ ] You&apos;ve memorized the response to: &ldquo;I got burned before&rdquo; (Playbook Objection 2)
- [ ] You know your demo number and have tested it today

### 5.2 Before Each Sales Call

- [ ] 5 min before: call the demo number, verify text-back fires
- [ ] Have the ROI worksheet open with the prospect&apos;s info pre-filled (if available)
- [ ] Know which angle to lead with:
  - Most contractors: Angle A (quote reactivation) &mdash; &ldquo;How many dead quotes in your phone?&rdquo;
  - Referral-heavy: Angle B &mdash; estimate follow-up + review generation
  - Running ads: Angle C &mdash; speed-to-lead
  - Spring timing: Angle D &mdash; seasonal ramp

### 5.3 After They Say Yes

Follow the Day 0 &rarr; Day 1 &rarr; Week 2 &rarr; Week 3 timeline in Playbook Section 10. The short version:

1. **Day 0:** Send service agreement. Create client in admin. Assign phone number.
2. **Day 1:** 30-min onboarding call. Fill KB. Import old quotes. They call their own number.
3. **Day 1-2:** Deliver Revenue Leak Audit. Supplement KB.
4. **Day 3-5:** Enable Smart Assist mode. Run AI safety tests.
5. **Week 2:** Clear KB gap queue daily. First report delivers.
6. **Week 3+:** AI goes autonomous. You&apos;re on cruise control (5-10 min/day per client).

### 5.4 Daily Routine (per client, 5-10 min)

1. Start at `/admin/triage` &mdash; which clients need attention?
2. Check `/escalations` &mdash; any hot leads waiting?
3. Check knowledge gap queue &mdash; any new AI gaps to fill?
4. Check `/admin/ai-quality` &mdash; any flagged messages?
5. Done.

---

## Quick Reference

| Page | URL | What it&apos;s for |
|------|-----|--------------|
| Triage Dashboard | `/admin/triage` | Daily starting point |
| Client Detail | `/admin/clients/[id]` | KB, calendar, onboarding |
| Escalation Queue | `/escalations` | Hot leads needing humans |
| AI Quality | `/admin/ai-quality` | Flagged AI messages |
| AI Effectiveness | `/admin/ai-effectiveness` | Outcome trends |
| Reports | `/admin/reports` | Bi-weekly report review |
| Reliability | `/admin/reliability` | Cron/webhook health |
| Settings | `/admin/settings` | Kill switches, operator info |

---

## Cron Job Reference

You set up ONE cron trigger (every 5 min). The system handles everything else internally:

| When | What runs |
|------|-----------|
| Every 5 min | Process message queue, check missed calls |
| Every 30 min | Calendar sync, review responses, report retries |
| Hourly | Usage tracking, escalation SLA, review sync, compliance replay |
| Daily midnight | Lead scoring, analytics, no-show recovery, Stripe reconciliation |
| Daily 7am | Daily summary, bi-weekly reports, Day 3 check-in |
| Daily 10am | Win-back, estimate nudges, KB nudges, AI auto-progression |
| Weekly Monday | Engagement health, agency digest |
| Weekly Wednesday | Dormant re-engagement (6-month leads) |
| Monthly 1st | Cohort analysis, access review |

---

## Twilio Webhook Reference

| Number | What | URL |
|--------|------|-----|
| Agency (#5) | Voice | `https://yourdomain.com/api/webhooks/twilio/agency-voice` |
| Agency (#5) | SMS | `https://yourdomain.com/api/webhooks/twilio/agency-sms` |
| Client numbers | Auto-configured when purchased via the platform | No manual setup needed |
