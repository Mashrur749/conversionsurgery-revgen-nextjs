# Local Environment Setup

Follow this to get the app running locally. After this, move to the Launch Checklist.

---

## 1. Database (5 min)

```bash
npm install -g neonctl
neonctl auth
neonctl projects list                           # Copy your project ID
neonctl branches create --name staging --project-id YOUR_PROJECT_ID
neonctl connection-string staging --project-id YOUR_PROJECT_ID
# Copy the connection string
```

- [ ] Paste the connection string into `.env.local` as `DATABASE_URL`
- [ ] Run: `npm run db:migrate`
- [ ] Run: `npm run db:seed -- --lean`

## 2. Env Vars (10 min)

Copy into `.env.local`. Fill every line.

```
DATABASE_URL=postgresql://...your-staging-string...

# Run: openssl rand -hex 32   (run 3 times, one for each)
AUTH_SECRET=
CLIENT_SESSION_SECRET=
CRON_SECRET=

ANTHROPIC_API_KEY=               # https://console.anthropic.com
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO_MONTHLY=price_...

RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WEBHOOK_BASE_URL=http://localhost:3000

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] No blanks or placeholders remain
- [ ] `npm run dev` starts without errors

## 3. Twilio Dev Phones (15 min)

You need 5 Twilio phone numbers. Buy them at https://console.twilio.com.

| # | Role | How you use it |
|:-:|------|---------------|
| 1 | Business line | Assigned to test client. Receives inbound. |
| 2 | Lead | Dev Phone (port 3001). You text #1 as a homeowner. |
| 3 | Owner | Dev Phone (port 3002). Receives notifications. |
| 4 | Team member | Dev Phone (port 3003). Receives escalations. |
| 5 | Agency line | Sends operator notifications. Configured in-app. |

```bash
# Install (one time)
brew install ngrok
npm install -g twilio-cli
twilio plugins:install @twilio/plugin-dev-phone
twilio login

# Every test session (5 terminals)
ngrok http 3000                    # Terminal 1 — copy the https URL
npm run dev                        # Terminal 2
twilio dev-phone --port 3001       # Terminal 3 — Lead
twilio dev-phone --port 3002       # Terminal 4 — Owner
twilio dev-phone --port 3003       # Terminal 5 — Team
```

- [ ] Update `TWILIO_WEBHOOK_BASE_URL` in `.env.local` to your ngrok URL
- [ ] In Twilio Console: point business line (#1) SMS + Voice webhooks to `https://YOUR_NGROK/api/webhooks/twilio/sms` and `/voice`
- [ ] Do NOT configure webhooks on #2, #3, #4, or #5

## 4. First Login (2 min)

- [ ] Go to http://localhost:3000/login
- [ ] Enter your admin email &mdash; check inbox for magic link
- [ ] After login: `/admin/settings` &rarr; set `operator_phone` (your real phone) and `operator_name`
- [ ] `/admin/agency` &rarr; set the agency Twilio number to #5

## Done

You should now have:
- App running at localhost:3000
- Admin logged in
- 5 Twilio numbers configured
- ngrok tunnel active
- Operator phone and name set

Move to the Launch Checklist Phase 2.
