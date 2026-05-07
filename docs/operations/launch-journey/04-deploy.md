# 04 — Deploy

## What this is
Push the app to a real production URL with SSL. Stripe Checkout, Twilio webhooks, and contractor portal magic-link emails all need a live domain — `localhost` will not work for any of them.

## Before you start this
- [ ] Files 02 and 03 are submitted/done (A2P filed, Stripe products created, env vars set)
- [ ] You own a domain (or have one ready to point at the deployment)
- [ ] You have a Cloudflare account OR a Vercel account — pick ONE

## Time required
~60 minutes (longer if DNS is slow to propagate)

## Why this matters

Three things break without a real HTTPS URL:

1. Stripe Checkout requires `https://` for both `success_url` and `cancel_url`
2. Twilio webhooks (SMS + Voice) require a public HTTPS URL
3. Resend email magic links must point at a real domain — clients cannot log in to portal otherwise

## Pick one path

This project uses OpenNext for Cloudflare and is also Vercel-compatible. Pick whichever you are comfortable operating. **You only need one.**

### Path A — Cloudflare Workers (recommended; matches the codebase)

1. Install Wrangler if not already: `pnpm add -g wrangler` (or use `pnpm dlx wrangler`).
2. Authenticate: `wrangler login` → browser flow.
3. Confirm `wrangler.toml` is correct in repo root (project name, compatibility flags). The repo already has this configured.
4. Set production secrets:
   ```
   wrangler secret put DATABASE_URL
   wrangler secret put NEXTAUTH_SECRET
   wrangler secret put STRIPE_SECRET_KEY
   wrangler secret put STRIPE_WEBHOOK_SECRET
   wrangler secret put RESEND_API_KEY
   wrangler secret put TWILIO_ACCOUNT_SID
   wrangler secret put TWILIO_AUTH_TOKEN
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put CRON_SECRET
   wrangler secret put STRIPE_PRODUCT_PILOT
   wrangler secret put STRIPE_PRICE_PILOT_MONTHLY
   wrangler secret put STRIPE_PRICE_PILOT_SETUP
   wrangler secret put STRIPE_PRODUCT_STANDARD
   wrangler secret put STRIPE_PRICE_STANDARD_MONTHLY
   wrangler secret put STRIPE_PRICE_STANDARD_SETUP
   wrangler secret put STRIPE_PRODUCT_PREMIUM
   wrangler secret put STRIPE_PRICE_PREMIUM_MONTHLY
   wrangler secret put STRIPE_PRICE_PREMIUM_SETUP
   ```
5. Build + deploy: `pnpm run build && wrangler deploy` (or whatever the repo's deploy script is).
6. Add custom domain in Cloudflare dashboard → Workers → your worker → Custom Domains. Point your apex or subdomain at the worker.

### Path B — Vercel

1. Connect the GitHub repo to a new Vercel project.
2. In Vercel project settings → Environment Variables, add every variable from `.env.local` (set to **Production** scope). Be careful with the 9 Stripe IDs — Vercel does not validate names.
3. Add your domain under Domains tab. Vercel handles SSL automatically.
4. Trigger a deploy (push to main, or click Redeploy).

## After deploy (both paths)

1. Update `NEXT_PUBLIC_APP_URL` env var to your production URL (e.g. `https://app.conversionsurgery.io`). Redeploy if changed.
2. Verify three public pages return 200:
   ```
   curl -I https://your-domain.com/login
   curl -I https://your-domain.com/signup
   curl -I https://your-domain.com/client-login
   ```
   All three must return `HTTP/2 200`. If any returns 500, check the deployment logs.
3. Health check: `curl -I https://your-domain.com/api/health` → must return 200.

## What success looks like
- [ ] Production URL responds at `https://` with valid SSL
- [ ] `/login`, `/signup`, `/client-login` all return 200
- [ ] `/api/health` returns 200
- [ ] `NEXT_PUBLIC_APP_URL` is set to the production URL
- [ ] All 9 Stripe env vars are set in production (not just `.env.local`)

## If something goes wrong

- **500 on `/login`** — usually `NEXTAUTH_SECRET` or `DATABASE_URL` missing in production env. Check deployment logs.
- **502/523 on Cloudflare** — worker hit a runtime error during cold start. Logs in `wrangler tail` or Cloudflare dashboard → Logs.
- **DNS not resolving** — wait 15 minutes for propagation. If still broken after 30 minutes, double-check the DNS record type (CNAME for Vercel, custom for Cloudflare worker).
- **Build fails** — typecheck errors not caught locally. Run `pnpm run build` locally first; do not deploy with red typecheck.

## Reference
- Launch checklist: `docs/operations/LAUNCH-CHECKLIST.md` Phase 4.3 (Deploy the App) and Phase 4.6 (Smoke Test)
- OpenNext config: `wrangler.toml` and `next.config.ts`

## Next
[05 — Twilio + Resend + Operator Profile](./05-twilio-resend-operator.md)
