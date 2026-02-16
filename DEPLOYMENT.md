# Deployment Guide - Revenue Recovery SaaS

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Third-Party Service Setup](#third-party-service-setup)
4. [Database Setup](#database-setup)
5. [Production Deployment (Cloudflare)](#production-deployment-cloudflare)
6. [Post-Deploy Verification](#post-deploy-verification)
7. [Security Hardening](#security-hardening)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- npm 10+
- A Neon PostgreSQL database ([free tier](https://console.neon.tech))
- Accounts for: Twilio, OpenAI, Resend (all have free/trial tiers)

### Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp .env.example .env.local

# 3. Fill in your values (see "Environment Variables Reference" below)
#    At minimum you need: DATABASE_URL, AUTH_SECRET, CLIENT_SESSION_SECRET,
#    RESEND_API_KEY, TWILIO_*, OPENAI_API_KEY, CRON_SECRET, FORM_WEBHOOK_SECRET

# 4. Push schema to database (first time only)
npm run db:push

# 5. Start dev server
npm run dev
```

Visit `http://localhost:3000`. First user to log in via magic link becomes admin.

### Local Webhooks (Twilio/Stripe)

Twilio and Stripe need to reach your local machine. Use ngrok:

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL and set:
- `TWILIO_WEBHOOK_BASE_URL=https://xxxx.ngrok-free.app` in `.env.local`
- Twilio Console → Phone Number → SMS webhook: `https://xxxx.ngrok-free.app/api/webhooks/twilio/sms`
- Twilio Console → Phone Number → Voice webhook: `https://xxxx.ngrok-free.app/api/webhooks/twilio/voice`

For Stripe webhooks locally, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret it prints → STRIPE_WEBHOOK_SECRET in .env.local
```

### Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start local dev server (port 3000) |
| `npm run build` | Production build (verify 0 TS errors) |
| `npm run lint` | ESLint check |
| `npm run db:generate` | Generate Drizzle migrations after schema changes |
| `npm run db:push` | Push schema directly to database |
| `npm run db:migrate` | Run generated migrations |
| `npm run db:studio` | Visual database browser (Drizzle Studio) |

---

## Environment Variables Reference

28 environment variables total. See `.env.example` for the full template with inline comments.

### Required (app won't function without these)

| Variable | Where to get it | Used for |
|----------|----------------|----------|
| `DATABASE_URL` | [Neon Console](https://console.neon.tech) → Connection Details | Postgres connection |
| `AUTH_SECRET` | `openssl rand -base64 32` | NextAuth session encryption |
| `CLIENT_SESSION_SECRET` | `openssl rand -base64 32` | Client portal cookie encryption |
| `NEXTAUTH_URL` | Your app URL | Auth redirects |
| `NEXT_PUBLIC_APP_URL` | Your app URL | Magic links, webhook URLs |
| `RESEND_API_KEY` | [Resend](https://resend.com/api-keys) | Sending emails (magic links, daily summaries, notifications) |
| `EMAIL_FROM` | Verified domain in Resend | Sender address for all emails |
| `ADMIN_EMAIL` | Your email | Receives admin notifications |
| `TWILIO_ACCOUNT_SID` | [Twilio Console](https://console.twilio.com) | SMS/Voice API authentication |
| `TWILIO_AUTH_TOKEN` | Twilio Console | SMS/Voice API authentication |
| `TWILIO_PHONE_NUMBER` | Twilio Console → Phone Numbers | Default outbound number |
| `TWILIO_WEBHOOK_BASE_URL` | Your app URL (or ngrok for local) | Twilio callback URLs |
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) | AI lead responses, scoring |
| `CRON_SECRET` | `openssl rand -hex 32` | Authenticates cron job requests |
| `FORM_WEBHOOK_SECRET` | `openssl rand -hex 32` | Authenticates inbound form webhooks |

### Recommended (billing features need these)

| Variable | Where to get it | Used for |
|----------|----------------|----------|
| `STRIPE_SECRET_KEY` | [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) | Subscription billing, invoices |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard | Client-side payment forms |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → Signing secret | Verify Stripe webhook events |

### Optional (per-integration)

| Variable | Where to get it | Used for |
|----------|----------------|----------|
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) | Google Business OAuth (review auto-response) |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console | Google Business OAuth |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console (enable Places API) | Search businesses by name for review sources |
| `ELEVENLABS_API_KEY` | [ElevenLabs](https://elevenlabs.io/app/settings/api-keys) | AI voice synthesis on phone calls |
| `R2_ACCOUNT_ID` | [Cloudflare Dashboard](https://dash.cloudflare.com) → R2 | Media/MMS file storage |
| `R2_ACCESS_KEY_ID` | Cloudflare → R2 → Manage API Tokens | R2 API access |
| `R2_SECRET_ACCESS_KEY` | Cloudflare → R2 → Manage API Tokens | R2 API access |
| `R2_BUCKET_NAME` | Cloudflare → R2 → Create Bucket | R2 bucket name |
| `R2_PUBLIC_URL` | Cloudflare → R2 → Bucket → Settings → Public URL | Public media URLs |
| `SLACK_WEBHOOK_URL` | [Slack API](https://api.slack.com/messaging/webhooks) | Alert notifications to Slack |
| `ADMIN_PHONE_NUMBER` | Your phone | SMS alerts for critical events |

### Generating Secrets

```bash
# Auth secrets (base64, 32 bytes)
openssl rand -base64 32

# Webhook/cron secrets (hex, 32 bytes)
openssl rand -hex 32
```

---

## Third-Party Service Setup

### Neon PostgreSQL

1. Create account at [console.neon.tech](https://console.neon.tech)
2. Create a new project (free tier: 3 GB storage, 0.5 GB RAM)
3. Copy the connection string → `DATABASE_URL`
4. Run `npm run db:push` to create all 95+ tables

### Twilio

1. Create account at [twilio.com](https://www.twilio.com)
2. Buy a phone number with SMS + Voice capabilities
3. Copy Account SID + Auth Token from Console → Dashboard
4. Configure webhooks on the phone number:
   - **SMS webhook (POST):** `https://yourdomain.com/api/webhooks/twilio/sms`
   - **Voice webhook (POST):** `https://yourdomain.com/api/webhooks/twilio/voice`
   - **Status callback (POST):** `https://yourdomain.com/api/webhooks/twilio/status`

### Resend

1. Create account at [resend.com](https://resend.com)
2. Verify your sending domain (or use `onboarding@resend.dev` for testing)
3. Create API key → `RESEND_API_KEY`

### OpenAI

1. Create account at [platform.openai.com](https://platform.openai.com)
2. Add billing (pay-as-you-go, ~$20-50/month typical usage)
3. Create API key → `OPENAI_API_KEY`
4. Model used: `gpt-4o-mini` for lead scoring and conversation responses

### Stripe (for billing features)

1. Create account at [stripe.com](https://stripe.com)
2. Use **test mode** for local development (toggle in Dashboard)
3. Copy test API keys → `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Create webhook endpoint in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events to listen for:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.paid`
     - `invoice.payment_failed`
     - `payment_intent.succeeded`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### Google Business Profile (optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project
3. Enable APIs: **My Business API**, **Places API**
4. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized redirect URI: `https://yourdomain.com/api/auth/callback/google-business`
   - Copy Client ID → `GOOGLE_CLIENT_ID`, Client Secret → `GOOGLE_CLIENT_SECRET`
5. Create API key (restrict to Places API) → `GOOGLE_PLACES_API_KEY`

### ElevenLabs (optional)

1. Create account at [elevenlabs.io](https://elevenlabs.io)
2. Go to Settings → API Keys → Create
3. Copy API key → `ELEVENLABS_API_KEY`
4. Select a voice in Admin → Voice AI settings (voice picker loads from API)

### Cloudflare R2 (optional)

1. In Cloudflare Dashboard → R2 → Create Bucket
2. Name it (e.g., `revenue-recovery-media`)
3. Go to R2 → Manage R2 API Tokens → Create API Token
4. Copy credentials → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
5. Enable public access on bucket → copy public URL → `R2_PUBLIC_URL`

---

## Database Setup

### First-time setup

```bash
# Push schema to create all tables (95+ tables)
npm run db:push
```

### After schema changes

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate
```

### Browse data

```bash
npm run db:studio
# Opens Drizzle Studio at https://local.drizzle.studio
```

### Seed initial admin user

After running `npm run dev`, visit `http://localhost:3000/login` and log in with your email. The first user becomes admin automatically via the NextAuth adapter.

---

## Production Deployment (Cloudflare)

### Prerequisites

- Cloudflare account with Workers enabled
- Domain configured in Cloudflare (optional but recommended)
- All local testing complete

### Step 1: Update wrangler.toml

```toml
[vars]
NEXT_PUBLIC_APP_URL = "https://your-actual-domain.com"
```

### Step 2: Set Secrets

All sensitive values must be set as Wrangler secrets (not in `wrangler.toml`):

```bash
# Required
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put CLIENT_SESSION_SECRET
npx wrangler secret put NEXTAUTH_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put EMAIL_FROM
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_PHONE_NUMBER
npx wrangler secret put TWILIO_WEBHOOK_BASE_URL
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put FORM_WEBHOOK_SECRET

# Recommended (billing)
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET

# Optional (set only what you use)
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_PLACES_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler secret put R2_BUCKET_NAME
npx wrangler secret put R2_PUBLIC_URL
npx wrangler secret put SLACK_WEBHOOK_URL
npx wrangler secret put ADMIN_PHONE_NUMBER
```

### Step 3: Build

```bash
npm run cf:build
```

Creates `.open-next/` directory with the compiled worker.

### Step 4: Test Locally (Cloudflare runtime)

```bash
npm run cf:dev
```

Visit `http://localhost:8787`.

### Step 5: Deploy

```bash
npm run cf:deploy
```

### Step 6: Configure External Webhooks

After deployment, update callback URLs in third-party dashboards:

| Service | URL to set |
|---------|-----------|
| Twilio SMS | `https://yourdomain.com/api/webhooks/twilio/sms` |
| Twilio Voice | `https://yourdomain.com/api/webhooks/twilio/voice` |
| Twilio Status | `https://yourdomain.com/api/webhooks/twilio/status` |
| Stripe | `https://yourdomain.com/api/webhooks/stripe` |
| Google OAuth callback | `https://yourdomain.com/api/auth/callback/google-business` |
| Form providers | `POST https://yourdomain.com/api/webhooks/form` (with `Authorization: Bearer <FORM_WEBHOOK_SECRET>`) |

---

## Post-Deploy Verification

### Auth Flow
1. Visit `https://yourdomain.com/login`
2. Enter an email → verify magic link arrives
3. Visit `https://yourdomain.com/client-login` → verify OTP flow

### Admin Dashboard
1. Log in as admin
2. Verify `/admin` loads with client stats
3. Check `/admin/platform-analytics` for MRR, churn, funnel

### Client Portal
1. Log in as client
2. Verify `/dashboard`, `/leads`, `/conversations` load
3. Verify `/client/billing` shows subscription info

### Webhooks
```bash
# Test form webhook
curl -X POST https://yourdomain.com/api/webhooks/form \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FORM_WEBHOOK_SECRET" \
  -d '{"clientId": "xxx", "phone": "+14035551234", "name": "Test Lead"}'

# Test Twilio: text the Twilio number and verify AI responds
# Test Stripe: create a test subscription in Stripe Dashboard
```

### Cron Jobs
1. Cloudflare Dashboard → Workers → Your Worker → Monitoring
2. Look for cron trigger executions (every 5 min + Monday 7am UTC)
3. The master orchestrator at `POST /api/cron` dispatches 19 sub-jobs

### Post-Launch Checklist

```
[ ] All env vars set in Cloudflare (npx wrangler secret list)
[ ] Build succeeds: npm run cf:build
[ ] Deploy succeeds: npm run cf:deploy
[ ] Magic link login works
[ ] Client OTP login works
[ ] Admin dashboard loads correctly
[ ] Client portal loads correctly
[ ] Twilio SMS webhook → AI response works
[ ] Twilio Voice webhook → call handling works
[ ] Twilio Status callback → delivery status updates
[ ] Form webhook → lead creation works
[ ] Stripe webhooks → subscription lifecycle works
[ ] Cron jobs execute (check Cloudflare monitoring)
[ ] ElevenLabs voice preview works (if configured)
[ ] Google OAuth connect/disconnect works (if configured)
[ ] No errors in: npx wrangler tail
```

---

## Security Hardening

### What was audited

A production security audit identified four categories of risk across 168+ API routes:

1. **IDOR (Insecure Direct Object Reference)** — Client API routes that accept entity IDs must scope all DB queries to the authenticated `clientId`. Audited all 17 `/api/client/` routes; found and fixed 2 with unscoped mutations.

2. **Exposed debug endpoint** — `/api/test-db` was a publicly accessible route. Deleted entirely.

3. **Unauthenticated webhook** — `/api/webhooks/form` now requires `Authorization: Bearer <FORM_WEBHOOK_SECRET>`.

4. **No rate limiting** — Addressed via Cloudflare WAF rules below.

### Rate Limiting (Cloudflare WAF)

Configure in Cloudflare Dashboard → Security → WAF → Rate limiting rules:

| Priority | Expression | Rate | Action | Duration |
|----------|-----------|------|--------|----------|
| 1 | `^/api/auth/.*` or `^/api/client/auth/.*` | 10/min per IP | Block | 10 min |
| 2 | `^/api/cron/.*` | 5/min per IP | Block | 10 min |
| 3 | `^/api/webhooks/.*` | 60/min per IP | Block | 5 min |
| 4 | `^/api/.*` | 100/min per IP | JS Challenge | 5 min |

**Free plan note:** Only 1 rule allowed. Use Rule 1 (auth) — highest risk. Pro ($20/mo) supports all four.

### Hardening Checklist

- [x] IDOR: All client API mutations scoped to `clientId`
- [x] `/api/test-db` removed
- [x] `/api/webhooks/form` requires Bearer token
- [ ] Cloudflare rate limiting rules configured

---

## Monitoring & Troubleshooting

### View Logs

```bash
npx wrangler tail
```

### Build Fails

```bash
rm -rf .open-next .next
npm run cf:build
```

### Environment Variables Not Available

```bash
npx wrangler secret list
npm run cf-typegen
```

### Database Connection Fails

1. Verify `DATABASE_URL` is correct
2. Check [Neon dashboard](https://console.neon.tech) for status
3. Test: `npm run db:studio`

### Cron Jobs Not Running

1. Check `wrangler.toml` cron schedule syntax
2. Verify `CRON_SECRET` is set
3. Check Cloudflare Dashboard → Workers → Monitoring → Cron triggers

### Cost Monitoring

| Service | Free Tier | Typical Monthly |
|---------|-----------|----------------|
| Cloudflare Workers | 100k requests/day | Free for most |
| Neon PostgreSQL | 3 GB storage, 0.5 GB RAM | Free tier sufficient |
| Resend Email | 3k emails/month | Free tier sufficient |
| Twilio | — | ~$15/number + $0.0079/SMS |
| OpenAI | — | ~$20-50 (gpt-4o-mini) |
| Stripe | 2.9% + $0.30 per transaction | Usage-based |
| ElevenLabs | 10k chars/month free | $5-22/month |

### Updating Code

```bash
git add .
git commit -m "Your changes"
npm run cf:deploy
```

### Rollback

Cloudflare keeps previous versions:

1. Dashboard → Workers → Your Worker → Rollback to previous version
2. Or: `git checkout <previous-commit> && npm run cf:deploy`

---

## Documentation

- Feature inventory: [BUSINESS-CASE.md](./BUSINESS-CASE.md)
- 104 use cases: [docs/USE_CASES.md](./docs/USE_CASES.md)
- Gap audit (all resolved): [docs/GAPS.md](./docs/GAPS.md)
