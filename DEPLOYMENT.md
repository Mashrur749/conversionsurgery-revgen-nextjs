# Deployment Guide - Revenue Recovery SaaS

## Prerequisites

- Cloudflare account
- Neon PostgreSQL database set up and running
- All Phase 1-5 complete and tested locally
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
- [ ] Auth works (magic link login)
- [ ] Dashboard displays correctly
- [ ] Twilio webhooks updated
- [ ] Missed call → SMS works
- [ ] Form webhook → SMS works
- [ ] Incoming SMS → AI response works
- [ ] Cron jobs run (check logs)
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

## Next Steps

1. Onboard your first client
2. Monitor logs for 48 hours
3. Adjust AI prompts based on real conversations
4. Iterate based on feedback
