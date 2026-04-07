# Local Environment Setup

Follow this to get the app running locally. After this, move to the Launch Checklist Phase 2.

---

## 0. Prerequisites (5 min)

Make sure you have these installed before starting:

- **Node.js 20+** and npm &mdash; download from https://nodejs.org
- **Git** &mdash; download from https://git-scm.com
- **OpenSSL** &mdash; macOS includes it; Linux: `apt-get install openssl`

Verify:

```bash
node --version    # Should be 20+
npm --version     # Should be 9+
git --version
openssl version
```

Then install project dependencies:

```bash
npm install
```

Wait for this to complete (2&ndash;3 minutes). You should see a `node_modules` folder created.

---

## 1. Database (5 min)

```bash
npm install -g neonctl
neonctl auth
# You should see: "Authentication successful"

neonctl projects list                           # Copy your project ID
neonctl branches create --name staging --project-id YOUR_PROJECT_ID
neonctl connection-string staging --project-id YOUR_PROJECT_ID
# Copy the full connection string that starts with postgresql://
```

Create `.env.local` in the project root and paste the connection string:

```
DATABASE_URL=postgresql://...the-string-you-just-copied...
```

Now run:

```bash
npm run db:migrate     # Creates all database tables
npm run db:seed -- --lean   # Seeds essential data (plans, role templates, admin account)
```

- [ ] `db:migrate` completed without errors
- [ ] `db:seed` completed without errors

> **If `db:migrate` fails:** verify `DATABASE_URL` is correct in `.env.local`. Try `neonctl connection-string staging --project-id YOUR_PROJECT_ID` again.

---

## 2. Env Vars (10 min)

Add the following to your `.env.local` file. Replace every placeholder with your actual values.

```bash
DATABASE_URL=postgresql://...already set in Step 1...

# Generate 3 random secrets (run this command 3 times, paste one per line):
#   openssl rand -hex 32
AUTH_SECRET=paste-first-random-string-here
CLIENT_SESSION_SECRET=paste-second-random-string-here
CRON_SECRET=paste-third-random-string-here

# AI (required for AI responses)
ANTHROPIC_API_KEY=sk-ant-...          # Get from https://console.anthropic.com → API Keys

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (get from https://dashboard.stripe.com → Developers → API keys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...       # Create a webhook endpoint first (see Phase 5 of Launch Checklist)
STRIPE_PRICE_PRO_MONTHLY=price_...    # Create a product first (see Phase 5 of Launch Checklist)

# Email (get from https://resend.com → API Keys)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Twilio (get from https://console.twilio.com → Account Info)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WEBHOOK_BASE_URL=http://localhost:3000    # Will change to ngrok URL in Step 3

# Google Calendar (optional for now — skip if not set up)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

> **Stripe and Google keys are optional for local testing.** If you skip them, billing and calendar features won&apos;t work but everything else will. You&apos;ll set these up properly in Phase 5 of the Launch Checklist.

Now verify the app starts:

```bash
npm run dev
```

Open http://localhost:3000 &mdash; you should see the login page.

- [ ] `npm run dev` starts without errors
- [ ] Login page loads at localhost:3000

> **If it fails:** check that every env var has a value (no blanks). The most common issue is a missing `AUTH_SECRET` or `DATABASE_URL`.

---

## 3. Twilio Dev Phones (15 min)

You need 5 Twilio phone numbers to test the full SMS/voice flow. Buy them at https://console.twilio.com &rarr; Phone Numbers &rarr; Buy a Number.

> **Minimum to get started:** #1 (Business line) and #2 (Lead). Add #3&ndash;#5 later for notification and escalation testing.

| # | Role | What it does |
|:-:|------|-------------|
| 1 | **Business line** | Assigned to your test client. Homeowners text/call this number. |
| 2 | **Lead** | Dev Phone. You pretend to be a homeowner and text #1. |
| 3 | **Owner** | Dev Phone. Receives contractor notifications (win alerts, pipeline SMS). |
| 4 | **Team member** | Dev Phone. Receives escalation SMS and hot transfer calls. |
| 5 | **Agency line** | Platform outbound number. Sends draft approvals, escalation alerts. Not a Dev Phone &mdash; configured in-app. |

> **What is a Dev Phone?** A browser-based phone simulator from Twilio. It lets you send/receive real SMS and calls from your laptop without a physical phone. Each one runs in a browser tab.

### Install tools (one time)

```bash
brew install ngrok
npm install -g twilio-cli
twilio plugins:install @twilio/plugin-dev-phone
twilio login    # Enter your Twilio account SID and auth token when prompted
```

### Start your test session (5 terminals)

Open 5 terminal windows. Keep all of them running throughout testing.

```bash
# Terminal 1 — Tunnel (exposes localhost to the internet)
ngrok http 3000
# Look for the line that says:
#   Forwarding  https://abc123.ngrok-free.app -> http://localhost:3000
# Copy that https URL — you'll need it in the next steps

# Terminal 2 — App
npm run dev

# Terminal 3 — Lead Dev Phone (opens in browser)
twilio dev-phone --port 3001
# In the browser tab that opens: select your Lead number (#2)

# Terminal 4 — Owner Dev Phone
twilio dev-phone --port 3002
# Select your Owner number (#3)

# Terminal 5 — Team Member Dev Phone
twilio dev-phone --port 3003
# Select your Team Member number (#4)
```

### Configure webhooks

1. Update `.env.local`:
   ```
   TWILIO_WEBHOOK_BASE_URL=https://abc123.ngrok-free.app
   ```
   Replace with YOUR ngrok URL. **This changes every time you restart ngrok** &mdash; update it each session.

2. Restart `npm run dev` (Terminal 2) to pick up the new URL.

3. In [Twilio Console](https://console.twilio.com) &rarr; Phone Numbers &rarr; click your **Business Line (#1)**:
   - Under **Messaging** &rarr; &ldquo;A Message Comes In&rdquo; &rarr; Webhook URL: `https://YOUR_NGROK/api/webhooks/twilio/sms` (POST)
   - Under **Voice** &rarr; &ldquo;A Call Comes In&rdquo; &rarr; Webhook URL: `https://YOUR_NGROK/api/webhooks/twilio/voice` (POST)

> **Do NOT configure webhooks on #2, #3, #4, or #5.** Dev Phone manages #2&ndash;#4 automatically. #5 is outbound-only.

- [ ] ngrok running with https URL
- [ ] `TWILIO_WEBHOOK_BASE_URL` updated in `.env.local`
- [ ] Business line (#1) webhooks pointed at ngrok URL
- [ ] Dev Phones open in browser tabs

---

## 4. First Login (2 min)

1. Go to http://localhost:3000/login
2. Enter your admin email (the one from `ADMIN_EMAIL` in `.dev.vars`, or `rmashrur749@gmail.com` if using defaults)
3. Check your email inbox for a magic link &mdash; click it
4. You should land on the admin dashboard

Now configure agency settings:

5. Go to `/admin/agency` (in the nav: **Settings** &rarr; **Agency Settings**)
6. Click the **Settings** button (top area of the page)
7. Fill in:
   - **Agency Phone Number:** your Dev Phone #5 number (E.164 format, e.g., +14031234567)
   - **Number SID:** find this in Twilio Console next to #5 (starts with `PN`)
   - **Operator Name:** your name
   - **Operator Phone:** your real personal phone number (for receiving alerts)
8. Click **Save Settings**

- [ ] Logged in as admin
- [ ] Agency settings saved (Twilio #5, operator phone, operator name)

---

## Done

You should now have:

- App running at localhost:3000
- Admin logged in
- Database migrated and seeded
- 5 Twilio numbers configured
- ngrok tunnel active
- Dev Phones running in browser tabs
- Agency settings configured

**Keep all 5 terminals open** and move to the Launch Checklist Phase 2.

---

## Troubleshooting

### `npm run db:migrate` fails
- Verify `DATABASE_URL` is correct in `.env.local`
- Try connecting manually: `neonctl connection-string staging --project-id YOUR_PROJECT_ID`
- If it says &ldquo;relation already exists,&rdquo; the database was set up with `db:push` before &mdash; see the Testing Guide for migration reconciliation steps.

### `npm run dev` fails with &ldquo;missing env var&rdquo;
- Check `.env.local` for blank lines. Every key needs a value.
- The most common missing vars: `AUTH_SECRET`, `DATABASE_URL`, `CRON_SECRET`

### ngrok URL changed
- The ngrok URL changes every time you restart it
- Update `TWILIO_WEBHOOK_BASE_URL` in `.env.local`
- Restart `npm run dev`
- Update the webhook URLs in Twilio Console for Business Line (#1)

### Dev Phone won&apos;t start
- Make sure `twilio login` completed successfully
- Check: `twilio profiles:list` &mdash; should show your account
- If port is in use: `lsof -i :3001` and kill the process

### Magic link email not arriving
- Check spam folder
- Verify `RESEND_API_KEY` is set and valid
- Check terminal output for errors when you submit the login form

### SMS not arriving on Dev Phone
- Verify ngrok is running (Terminal 1 still active)
- Verify webhook URLs in Twilio Console match your current ngrok URL
- Check terminal output (Terminal 2) for webhook errors
