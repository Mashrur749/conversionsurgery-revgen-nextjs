# Deployment Guide - Revenue Recovery SaaS

## Prerequisites

- Cloudflare account
- Neon PostgreSQL database set up and running
- All features built and tested locally (95+ tables, 168+ routes, all [LIVE])
- Domain registered and configured in Cloudflare (optional but recommended)

## Step 1: Set Environment Variables

Set secrets via Wrangler (one at a time):

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put AUTH_SECRET
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put CRON_SECRET
npx wrangler secret put FORM_WEBHOOK_SECRET
```

Non-secret environment variables are set in `wrangler.toml` [vars] section.

## Step 2: Update wrangler.toml

Edit `wrangler.toml` and set your domain:

```toml
[vars]
NEXT_PUBLIC_APP_URL = "https://your-actual-domain.com"
```

## Step 3: Build for Cloudflare

```bash
npm run cf:build
```

This creates `.open-next/` directory with the compiled worker.

## Step 4: Test Locally

```bash
npm run cf:dev
```

Visit `http://localhost:8787` to test locally.

## Step 5: Deploy

```bash
npm run cf:deploy
```

This builds and deploys to Cloudflare Workers.

## Step 6: Verify Production

### Test Auth Flow
1. Visit `https://your-domain.com/login`
2. Enter a client email
3. Check that magic link is received
4. Verify login works

### Test Dashboard
1. Login as a client
2. Verify `/dashboard` loads with stats
3. Verify `/leads` shows leads
4. Verify `/conversations` shows messages

### Test Webhooks
1. Test form webhook:
   ```bash
   curl -X POST https://your-domain.com/api/webhooks/form \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_FORM_WEBHOOK_SECRET" \
     -d '{"clientId": "xxx", "phone": "+14035551234", "name": "Test"}'
   ```

2. Test Twilio SMS webhook by texting the Twilio number
3. Verify AI responds

### Test Cron Jobs
1. Check Cloudflare dashboard → Workers & Pages → Your Worker → Monitoring
2. Look for cron trigger executions
3. Verify `GET /api/cron/process-scheduled` runs every 5 minutes
4. Verify `GET /api/cron/weekly-summary` runs Mondays at 7am UTC

## Step 7: Update Twilio Webhooks

After deployment, configure Twilio to use production URLs:

1. Go to Twilio Console → Phone Numbers → Your Number
2. Set Voice Webhook: `https://your-domain.com/api/webhooks/twilio/voice`
3. Set SMS Webhook: `https://your-domain.com/api/webhooks/twilio/sms`

## Step 8: Monitor Production

### View Logs
```bash
npx wrangler tail
```

### Check Metrics
- Cloudflare dashboard shows request count, cache hit rate, errors
- Check response times and error rates

## Troubleshooting

### Build Fails
```bash
# Clear build cache and rebuild
rm -rf .open-next .next
npm run cf:build
```

### Environment Variables Not Available
```bash
# Verify secrets are set
npx wrangler secret list

# Regenerate types
npm run cf-typegen
```

### Database Connection Fails
1. Verify DATABASE_URL is correct
2. Check Neon dashboard for status
3. Test with: `npm run db:studio`

### Cron Jobs Not Running
1. Check wrangler.toml cron schedule syntax
2. Verify `CRON_SECRET` is set
3. Check Cloudflare dashboard for cron trigger errors

## Cost Monitoring

- Cloudflare Workers: Free tier includes 100k requests/day
- Database: Neon free tier includes 3 GB storage
- Email: Resend free tier includes 3k emails/month
- Twilio: ~$15/number + per-SMS cost
- OpenAI: ~$20-50/month depending on usage

## Post-Launch Checklist

- [ ] All env vars set in Cloudflare
- [ ] Build succeeds: `npm run cf:build`
- [ ] Deploy succeeds: `npm run cf:deploy`
- [ ] Auth works (magic link login + client OTP login)
- [ ] Admin dashboard displays correctly
- [ ] Client portal accessible and functional
- [ ] Twilio webhooks updated (SMS, Voice, Status callbacks)
- [ ] Missed call → SMS works
- [ ] Form webhook → SMS works
- [ ] Incoming SMS → AI response works
- [ ] Cron jobs run (check logs — 15 cron endpoints)
- [ ] Stripe webhooks configured
- [ ] ElevenLabs voice integration working (if configured)
- [ ] No errors in `wrangler tail`

## Updating Code

To deploy changes:

```bash
git add .
git commit -m "Your changes"
npm run cf:deploy
```

## Rollback

Cloudflare Workers keeps previous versions. To rollback:

1. Go to Cloudflare dashboard → Workers & Pages → Your Worker
2. Click "Rollback" to previous version

Or redeploy the previous commit:
```bash
git checkout <previous-commit>
npm run cf:deploy
```

## Security Hardening

### What was audited

A production security audit identified four categories of risk across 168+ API routes:

1. **IDOR (Insecure Direct Object Reference)** — Client API routes that accept entity IDs must scope all DB queries to the authenticated `clientId`. Audited all 17 `/api/client/` routes; found and fixed 2 with unscoped mutations (suggestions approve/reject, flow toggle).

2. **Exposed debug endpoint** — `/api/test-db` was a publicly accessible route that queried the database and returned connection status. Deleted entirely.

3. **Unauthenticated webhook** — `/api/webhooks/form` accepted POST requests with no authentication. Now requires `Authorization: Bearer <FORM_WEBHOOK_SECRET>`. Any form provider (website contact forms, landing pages) must send this header.

4. **No rate limiting** — No request rate limits on any endpoint. Risks include OTP brute-force, magic link email spam, and cost amplification via routes that call paid APIs (OpenAI, Twilio, Stripe).

### Rate Limiting (Cloudflare WAF)

Configure these in Cloudflare Dashboard > your domain > Security > WAF > Rate limiting rules. Create rules in this order (first match wins):

**Rule 1: Auth rate limit (critical)**
- **Expression:** `(http.request.uri.path matches "^/api/auth/.*") or (http.request.uri.path matches "^/api/client/auth/.*")`
- **Rate:** 10 requests per 1 minute
- **Per:** IP
- **Action:** Block
- **Block duration:** 10 minutes
- **Why:** Prevents OTP brute-force and magic link email spam. A real user won't hit 10 auth requests in a minute.

**Rule 2: Cron rate limit**
- **Expression:** `(http.request.uri.path matches "^/api/cron/.*")`
- **Rate:** 5 requests per 1 minute
- **Per:** IP
- **Action:** Block
- **Block duration:** 10 minutes
- **Why:** Cron jobs fire a few times per day. Already has `CRON_SECRET` but this stops external hammering entirely.

**Rule 3: Webhook rate limit**
- **Expression:** `(http.request.uri.path matches "^/api/webhooks/.*")`
- **Rate:** 60 requests per 1 minute
- **Per:** IP
- **Action:** Block
- **Block duration:** 5 minutes
- **Why:** Higher limit because Twilio can burst (multiple SMS arriving at once). Caps runaway replays and leaked-token abuse. Optional: add a "skip" rule above this for Twilio/Stripe IP ranges so legitimate webhooks are never throttled.

**Rule 4: General API catch-all**
- **Expression:** `(http.request.uri.path matches "^/api/.*")`
- **Rate:** 100 requests per 1 minute
- **Per:** IP
- **Action:** JS Challenge
- **Block duration:** 5 minutes
- **Why:** Soft catch-all. JS Challenge (not hard block) lets legitimate browser clients through while stopping scripts. Covers admin and client portal API calls.

**Free plan note:** Cloudflare Free tier only allows 1 rate limiting rule. If on Free, configure Rule 1 (auth) only — that's the highest risk. Pro ($20/mo) supports all four rules.

### Post-hardening checklist

- [x] IDOR: All client API mutations scoped to `clientId`
- [x] `/api/test-db` removed
- [x] `/api/webhooks/form` requires Bearer token (`FORM_WEBHOOK_SECRET`)
- [ ] Cloudflare rate limiting rules configured (see above)

## Next Steps

1. Onboard your first client via admin wizard
2. Monitor logs for 48 hours
3. Verify all 15 cron jobs fire correctly
4. Adjust AI prompts based on real conversations
5. Review A/B test results across clients
6. Iterate based on feedback

## Documentation

For the complete feature inventory, see [BUSINESS-CASE.md](./BUSINESS-CASE.md).
For all 96 use cases, see [docs/USE_CASES.md](./docs/USE_CASES.md).
