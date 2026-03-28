# Managed Service Launch Checklist

Date: 2026-03-28
Status: Pre-launch
Service: $1,000/mo managed revenue recovery for Alberta renovation contractors
Reference docs: `02-MANAGED-SERVICE-PLAYBOOK.md` (delivery processes), `01-OPERATIONS-GUIDE.md` (daily ops + knowledge gap resolution)

---

## Phase 1: Learn the Platform

- [ ] Walk through `docs/engineering/01-TESTING-GUIDE.md` end to end (Steps 1-38)
  - Create a test client via admin wizard
  - Assign a phone number
  - Import test leads via CSV (with status=estimate_sent)
  - Trigger all automations manually (estimate follow-up, win-back, no-show, payment)
  - Send a test message, verify AI responds
  - Generate a report
  - Test Stripe Checkout subscription flow (Step 26)
  - Test CSV import with status column (Step 27)
  - Test AI agent graceful handling without Twilio number (Step 28)
  - Test self-serve phone provisioning (Step 30)
  - Test per-client automation pause (Step 36)
  - Test AI quality review page (Step 37)
  - Run pre-launch AI scenario tests (Step 33) and AI criteria tests (Step 34)
  - Complete the full end-to-end lead lifecycle smoke (Step 38)
- [ ] Walk through `docs/engineering/TESTING-SELF-SERVE.md` (Steps 1-7)
  - Sign up as a contractor, verify auto-login to dashboard
  - Verify dashboard setup banner (phone + plan checklist)
  - Set up phone, choose plan via Stripe Checkout
  - Verify settings page phone card
- [ ] Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` cover to cover
  - This is your day-to-day reference for handling every client scenario
- [ ] Read `docs/operations/01-OPERATIONS-GUIDE.md` &mdash; Knowledge Gap Resolution Process section
  - This is how the AI improves over time
- [ ] Delete all test data when done (or use a separate Neon branch)

---

## Phase 2: Production Environment

### Stripe (30 minutes)

- [ ] Create 1 Stripe product: &quot;ConversionSurgery Managed Service&quot;
- [ ] Create 1 price: $1,000/month recurring
- [ ] Copy the price ID (starts with `price_`)
- [ ] Set in production env: `STRIPE_PRICE_PRO_MONTHLY=price_xxxxx`
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`
- [ ] Create Stripe webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `payment_method.attached`
- [ ] Copy webhook signing secret &rarr; set `STRIPE_WEBHOOK_SECRET`

### Email (10 minutes)

- [ ] Set `RESEND_API_KEY` (from resend.com dashboard)
- [ ] Set `EMAIL_FROM` to your verified domain (e.g., `noreply@conversionsurgery.com`)
- [ ] Verify domain in Resend (DNS records)

### Twilio (already configured if testing passed)

- [ ] Confirm `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
- [ ] Set `TWILIO_WEBHOOK_BASE_URL` to production domain
- [ ] Confirm at least one phone number is available to purchase in Twilio account

### Other Required Env Vars

- [ ] `DATABASE_URL` &mdash; production Neon connection string
- [ ] `AUTH_SECRET` &mdash; generate with `openssl rand -hex 32`
- [ ] `CLIENT_SESSION_SECRET` &mdash; generate with `openssl rand -hex 32`
- [ ] `CRON_SECRET` &mdash; generate with `openssl rand -hex 32`
- [ ] `ANTHROPIC_API_KEY` &mdash; from console.anthropic.com
- [ ] `NEXT_PUBLIC_APP_URL` &mdash; your production domain (e.g., `https://app.conversionsurgery.com`)

### Database

- [ ] Run `npm run db:migrate` on production
- [ ] Run `npm run db:seed -- --lean` (seeds plans, role templates, flow templates, system settings)
- [ ] Verify seed created the Pro plan with your Stripe price ID

### Deploy

- [ ] Deploy to Cloudflare (via OpenNext)
- [ ] Verify runtime smoke: hit `/login`, `/signup`, `/client-login` &mdash; all return 200
- [ ] Run `npm run quality:no-regressions` against production
- [ ] Set up cron jobs (Cloudflare Workers Cron Triggers or external scheduler):

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Every 5 min | `POST /api/cron` | Message processing (scheduled sends, compliance queue) |
| Every 5 min | `POST /api/cron/process-scheduled` | Process scheduled messages |
| Hourly | `POST /api/cron/onboarding-sla-check` | Day-One milestone SLA monitoring |
| Daily (10am) | `POST /api/cron/win-back` | Dormant lead + old quote reactivation |
| Daily | `POST /api/cron/no-show-recovery` | Missed appointment follow-up |
| Daily | `POST /api/cron/guarantee-check` | 30/90-day guarantee evaluation |
| Daily | `POST /api/cron/stripe-reconciliation` | Sync subscription status with Stripe |
| Daily | `POST /api/cron/coupon-reconciliation` | Coupon count consistency |
| Daily | `POST /api/cron/knowledge-gap-alerts` | Email digest of stale high-priority KB gaps |
| Daily | `POST /api/cron/daily-summary` | Aggregate daily stats |
| Daily | `POST /api/cron/estimate-fallback-nudges` | Nudge contractors about unflagged estimates |
| Bi-weekly | `POST /api/cron/biweekly-reports` | Generate and send client reports |
| Monthly | `POST /api/cron/monthly-reset` | Reset monthly message counters |
| Quarterly | `POST /api/cron/quarterly-campaign-planner` | Auto-plan seasonal campaigns |
| Quarterly | `POST /api/cron/quarterly-campaign-alerts` | Campaign status alerts |

All cron calls need header: `Authorization: Bearer $CRON_SECRET`

---

## Phase 3: First Client Delivery

Reference: `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` for detailed processes.

### Before the sales call

- [ ] Review `docs/business-intel/RESEARCH-INSIGHTS-MARCH-2026.md` &mdash; pitch angles and objection handling
- [ ] Prepare to ask: &quot;How many quotes in your phone have had no response for 2+ weeks?&quot;
- [ ] Have the quote reactivation angle ready: &quot;Give us your last 30 dead quotes &mdash; we text them this week&quot;

### After the contractor says yes

Day 0 (signing):
- [ ] Create client via admin wizard (`/admin/clients/new/wizard`)
- [ ] Assign a local phone number in the wizard (or from client detail page)
- [ ] Onboarding card on client detail page shows 3 next steps (phone, quotes, knowledge base)

Day 1:
- [ ] 30-minute onboarding call (see Playbook Section 10 for script)
- [ ] Contractor calls their own number &mdash; missed call text-back fires (visceral proof moment)
- [ ] Ask contractor for their old quotes (spreadsheet, phone contacts, or CRM export)
- [ ] Import quotes via CSV with `status=estimate_sent` (see Playbook Section 2)
- [ ] Verify leads appear in `/leads` filtered by source=CSV Import

Day 1-2:
- [ ] Enter knowledge base from onboarding call (`/admin/clients/[id]/knowledge`)
  - Business services, pricing approach, FAQs, competitive advantages
  - Use industry preset as starting point, customize per client
- [ ] Deliver Revenue Leak Audit (research their Google Business Profile, website, competitors)

Day 3-5:
- [ ] AI configured with client knowledge &mdash; enable form response automation
- [ ] Set AI mode to Smart Assist (5-min auto-send delay)
- [ ] Verify AI generates reasonable responses for test messages
- [ ] Run `npm run test:ai` with this client&apos;s KB &mdash; all Safety tests must pass before autonomous (Playbook Section 3)

Week 2 (KB sprint):
- [ ] Check knowledge gap queue daily (see Ops Guide &mdash; Knowledge Gap Resolution Process)
  - Expect 5-15 gaps in Week 2 as AI encounters real conversations for the first time
  - Dedicate 15-20 min on Day 8-10 to clear the queue in bulk
- [ ] Review AI quality page (`/admin/ai-quality`) for flagged messages (Playbook Section 3)
- [ ] First bi-weekly report generated and delivered (Playbook Section 4)
- [ ] Win-back cron starts picking up imported quotes (if 25+ days old)
- [ ] Text contractor recap: &quot;Week 2 update &mdash; [X] leads handled, [Y] quotes reactivated, [Z] appointments booked&quot;

Week 3+:
- [ ] Upgrade AI to Autonomous mode (only after Safety tests pass)
- [ ] All automations running: estimate follow-up, appointment reminders, payment collection, review generation, win-back
- [ ] Monitor escalations dashboard for anything that needs human attention
- [ ] Knowledge gap queue should be slowing down (most common questions answered)

### Track ROI

- [ ] After first week: count quote reactivation responses (target: 10%+ response rate)
- [ ] After 30 days: check 5 Qualified Lead Engagements &mdash; guarantee Layer 1 (Playbook Section 5)
- [ ] After 90 days: check 1 Attributed Project Opportunity &mdash; guarantee Layer 2 (Playbook Section 5)
- [ ] Revenue dashboard shows recovered pipeline value

### Ongoing (per client)

- [ ] Daily: check escalations, knowledge gap queue, AI quality flags (5-10 min per client)
- [ ] Bi-weekly: report delivery + check-in text to contractor (Playbook Section 4)
- [ ] Monthly: health check metrics review (Playbook Section 11)
- [ ] If contractor requests pause: set status to Paused from client detail page (Playbook Section 6)

---

## Phase 4: Outreach (Do This Now &mdash; Spring Window Closing)

The research confirms March-April is the prime outreach window. Contractors are flooded with leads and can&apos;t respond to all of them. After mid-April, they go heads-down into summer projects.

- [ ] Prepare outreach using angles from `RESEARCH-INSIGHTS-MARCH-2026.md` Section 3
- [ ] Lead with quote reactivation angle (Angle A) &mdash; lowest objection surface
- [ ] Track experiment results in the research doc Section 9
- [ ] First 3-5 clients: manually deliver, learn what friction points actually matter
- [ ] After 5 clients: update `OFFER-CLIENT-FACING.md` with validated reframe if outreach data supports it
