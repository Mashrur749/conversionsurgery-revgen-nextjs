# 07 — Day 1 Checkpoint

## What this is
The end-of-Day-1 verification. Every box below must be green before you start Day 2. If a box is red, fix it now — Day 2 work compounds on a green Day 1.

## Before you start this
- [ ] You completed files 02 through 06
- [ ] You have ~15 minutes of focus to walk this checklist deliberately

## Time required
~15 minutes

## What you'll do

Walk this list top to bottom. Tick each box only after you have verified it (not just "I think I did that earlier"). For ambiguous boxes, do the verification command in your terminal or click into the dashboard.

## The 12 boxes

- [ ] **A2P brand filed.** Twilio Console → Trust Hub → Brand Registrations shows your brand with a Brand SID.
- [ ] **A2P campaign filed.** Twilio Console → Trust Hub → Campaign Registrations shows your campaign with a Campaign SID. Status may be "Pending" — that is fine.
- [ ] **Stripe products + prices created (test mode).** Stripe Dashboard (test mode) → Products shows Pilot / Standard / Premium, each with one recurring monthly + one one-time setup price. Setup prices are 50% of total ($1,750 / $2,750 / $4,750).
- [ ] **9 Stripe env vars set** in `.env.local` AND in production deployment env (Cloudflare secrets or Vercel env vars).
- [ ] **`seed-plans.ts` ran cleanly.** SQL: `SELECT count(*) FROM plans;` returns 3.
- [ ] **Migration 0029 pushed.** SQL: `SELECT table_name FROM information_schema.tables WHERE table_name = 'client_cancellations';` returns 1 row.
- [ ] **App deployed at real domain with SSL.** `curl -I https://your-domain.com/api/health` returns `HTTP/2 200`.
- [ ] **`/login`, `/signup`, `/client-login` all return 200.** Three curl commands. All three return `HTTP/2 200`.
- [ ] **Twilio number provisioned with all three webhooks** (SMS in, Voice in, Voice status). Twilio Console → Phone Numbers → click your number → all three webhook URLs point at your production domain.
- [ ] **Resend domain verified.** Resend Dashboard → Domains shows green/verified for your sending domain.
- [ ] **`operator_phone` + `operator_name` set at `/admin/agency`.** Log in to deployed admin, navigate to Settings → Agency Settings, both fields are filled.
- [ ] **Test cron triggered, SMS received at `operator_phone`.** `curl -X POST https://your-domain.com/api/cron/morning-brief -H "Authorization: Bearer $CRON_SECRET"` returned 200 AND an SMS landed on your phone.

## What you have at end of Day 1

- A platform deployed at a real domain with SSL
- Three external integrations wired (Stripe, Twilio, Resend)
- Database schema current with `client_cancellations` ready
- Operator notification path proven end-to-end (cron → SMS arrived on your phone)
- A2P approval running in the background (probably still pending — fine)

## What is NOT yet done

- E2E rehearsal — you have not yet walked a fake homeowner through a full conversation. That is file 08.
- Sales reading — you have not yet internalized the offer copy and Irresistibility Levers. That is file 09.
- Cold outreach — Day 3.
- Live-mode Stripe — you remain in test mode until E2E passes.

## If a box is red

| Red box | Most likely cause | First-line fix |
|---------|--------------------|-----------------|
| A2P pending past 5 days | Brand or campaign rejected | Check Twilio email for rejection reason; resubmit. If still pending, file Twilio support ticket. |
| Stripe webhook not firing | `STRIPE_WEBHOOK_SECRET` mismatch | Re-pull the signing secret from Stripe Dashboard → Webhooks → click your endpoint → Reveal. Re-set in prod env. Re-deploy. |
| `/login` 500 | `NEXTAUTH_SECRET` or `DATABASE_URL` missing | Check deployment logs. Re-set the missing var. |
| Cron 200 but no SMS | A2P filtering, or Twilio creds wrong | Twilio Console → Logs → Messaging. The outbound message will show "filtered" or "failed" with a reason code. |
| Plans table empty in prod | Seed ran against dev DB | Re-export prod `DATABASE_URL`, re-run `pnpm tsx scripts/seed-plans.ts`. |
| Resend domain stuck "pending" | DNS record typo | `dig TXT your-domain.com` and compare against what Resend asked for. |

## When all 12 are green

Close your laptop. Day 2 starts fresh — full E2E rehearsal needs an unrushed brain. If you are doing this on a single calendar day, take at least a 60-minute break before file 08.

## Reference
- All Day 1 files: 02 through 06
- Master launch checklist Phase 4 verification: `docs/operations/LAUNCH-CHECKLIST.md` Phase 4.6 (Smoke Test)

## Next
[08 — Platform Rehearsal](./08-platform-rehearsal.md)
