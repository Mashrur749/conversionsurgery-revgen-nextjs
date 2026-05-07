# 00 — Start Here

## What this is
This folder is your linear journey from "platform not deployed" to "first paid client signed." Open one file, do what it says, check the success boxes, click Next, move on. No decisions about ordering — the order is the work.

## Before you start this
- [ ] You have admin access to Stripe, Twilio, Resend, Cloudflare/Vercel, and Neon
- [ ] You have `.env.local` filled with dev secrets and the project running locally (`pnpm run dev`)
- [ ] You bookmark this file — it is your only entry point

## Time required
~3 days of focused execution + reactive use during the first 60 days

## How to use this folder

1. Open the next numbered file.
2. Complete every action under "What you'll do."
3. Tick every "What success looks like" box. If a box stays red, do not advance — go to "If something goes wrong."
4. Click the Next link at the bottom. Repeat.

Files 01–16 are sequential setup + first sale. Files 17–26 are reactive job-aids — you only open them when the corresponding event happens (Day-14 cancel arrives, 90-day window closes, etc.).

## The 3-day execution sprint

| Day | Files | What you walk away with | Time |
|-----|-------|--------------------------|------|
| 1   | 01 Mental Model              | Conceptual orientation                          | 30 min |
| 1   | 02 A2P First                 | A2P brand + campaign filed (waiting on carrier) | 30 min |
| 1   | 03 Stripe Products           | 3 products + 6 prices, 9 env vars set           | 45 min |
| 1   | 04 Deploy                    | App live at real domain with SSL                | 60 min |
| 1   | 05 Twilio + Resend + Operator| All three integrations wired                    | 45 min |
| 1   | 06 Migrations + Seed         | DB schema current, plans seeded                 | 20 min |
| 1   | 07 Day-1 Checkpoint          | 12 green boxes — ready for E2E                  | 15 min |
| 2   | 08 Platform Rehearsal        | Test contractor walked through full E2E in test mode | 3-4 hours |
| 2   | 09 Offer Mastery             | OFFER-APPROVED-COPY + ICP-DEFINITION internalized    | 90 min |
| 2   | 10 Script Rehearsal          | Cold scripts read out loud, 1 mock discovery call    | 90 min |
| 2   | 11 Loom + Prospects          | Loom Pro set up, 30+ prospect list refined           | 2-3 hours |
| 2   | 12 Day-2 Checkpoint          | 10 green boxes — pitch-ready, demo-ready             | 15 min |
| 3   | 13 Cold Outreach Batch 1     | First 25 personalized emails out (morning)           | 60-90 min |
| 3   | 14 Warm Reply Protocol       | Bookmark — what to do when first reply lands        | bookmark |
| 3   | 15 Cold Outreach Batch 2     | Second 25 personalized emails out (afternoon)        | 60-90 min |
| 3   | 16 Day-3 Checkpoint          | 50 emails sent, transition to reactive mode          | 15 min |

After Day 3 you are in execution mode. Files 17–26 are reactive:

| File | Open when |
|------|-----------|
| 17 Discovery Call             | A discovery call is booked                    |
| 18 Closing                    | Prospect says yes                             |
| 19 Onboarding                 | Contract signed, payment cleared              |
| 20 Implementation             | Day 1-21 of every new client                  |
| 21 Go-Live Gate               | Day 21 of every new client                    |
| 22 Delivery Window            | Day 21-90 of every active client              |
| 23 Day-90 Decision            | Day 90 of every client (continue/upgrade/cancel) |
| 24 Monthly Machine            | Steady-state ongoing operations              |
| 25 When Things Break          | Any failure mode (cron, Stripe, Twilio, Resend, migration) |
| 26 Pilot 1 Reflection         | Day 120 of Pilot #1 (post-mortem retrospective) |

## What if A2P approval slips
Twilio A2P/10DLC approval takes 1-5 business days. File it on Day 1 first thing and treat it as a background process. If it is still pending by Day 3 outreach, you can still send from your existing dev number for early conversations — but every paid client must be on an A2P-approved campaign before their first homeowner SMS goes out. Plan a 24-hour buffer between contract signing and Day-21 go-live to absorb a worst-case approval delay.

## Reference
- Master operator runbook: `docs/operations/00-OPERATOR-GUIDE.md`
- Full launch checklist: `docs/operations/LAUNCH-CHECKLIST.md`
- E2E delivery guide: `docs/operations/E2E-PILOT-STANDARD-DELIVERY-GUIDE.md`

## Next
[01 — Mental Model](./01-mental-model.md)
