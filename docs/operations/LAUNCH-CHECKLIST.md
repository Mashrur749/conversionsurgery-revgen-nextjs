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

**Test D: Mark a Lead Won**
1. Go to the contractor portal (log in as a contractor via `/client-login`)
2. Open Conversations, pick a lead
3. Click &ldquo;Mark Won&rdquo;, enter a revenue amount (e.g., 45000)
4. Check the Revenue Recovered card on the dashboard
- [ ] Revenue shows on the dashboard? Move on.

**Test E: Generate a Report**
1. Trigger the report cron: `curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`
2. Check `/admin/reports` for the generated report
3. Check that a follow-up SMS was sent to the owner
- [ ] Report generated, SMS sent? Move on.

**Test F: Google Calendar Sync**
1. Go to `/admin/clients/[id]` &rarr; Configuration tab
2. Click &ldquo;Connect Google Calendar&rdquo;
3. Authorize with a Google account
4. Create an appointment for a lead
5. Check your Google Calendar &mdash; the event should appear
- [ ] Event synced to Google Calendar? Move on.

**Test G: Stripe Checkout**
1. Go to the contractor portal &rarr; Billing
2. Click upgrade/subscribe
3. Complete Stripe Checkout with test card `4242 4242 4242 4242`
4. Verify the subscription is active
- [ ] Subscription active in Stripe dashboard? Move on.

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

## Step 3: Read the Docs (3-4 hours, can split across days)

Read these in order. Each one builds on the last.

| Order | Doc | What you learn | Time |
|:-----:|-----|----------------|:----:|
| 1 | `docs/product/PLATFORM-CAPABILITIES.md` | What the system does (all 12 sections) | 45 min |
| 2 | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` | How to deliver the service (22 sections) | 60 min |
| 3 | `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` | How to sell (10 objections + outreach scripts) | 30 min |
| 4 | `docs/operations/01-OPERATIONS-GUIDE.md` | Daily/weekly ops checklist (70 items) | 30 min |
| 5 | `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` | 7 hard rules for clients 1-5 | 10 min |
| 6 | `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` | Fill in YOUR details now | 15 min |
| 7 | `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md` | Day 1 deliverable format | 10 min |
| 8 | `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` | Sales call math tool | 5 min |

**After reading the Playbook, you should be able to answer these from memory:**
- What happens when the AI doesn&apos;t know something? (Section 1)
- How do I import a contractor&apos;s old quotes? (Section 2)
- What do I check before switching AI to autonomous? (Section 3)
- What are the guarantee terms and when do I refund? (Section 5)
- What&apos;s the onboarding call script? (Section 10)
- What are the 10 failure modes and how bad are they? (Section 21)
- What should I never promise? (Section 22)

---

## Step 4: Deploy to Production (2-3 hours)

Now you&apos;re setting up the real thing. Everything above was local testing.

### 4.1 Stripe (30 min)

1. Go to https://dashboard.stripe.com &rarr; Products &rarr; Add Product
2. Name: &ldquo;ConversionSurgery Managed Service&rdquo;
3. Add a price: $1,000/month, recurring
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

## Step 5: Prepare for Sales (1-2 hours)

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
