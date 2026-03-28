# Managed Service Launch Checklist

Date: 2026-03-28
Status: Pre-launch
Service: $1,000/mo managed revenue recovery for Alberta renovation contractors

---

## Phase 1: Learn the Platform

- [ ] Walk through `docs/engineering/01-TESTING-GUIDE.md` end to end (Steps 1-32)
  - Create a test client via admin wizard
  - Assign a phone number
  - Import test leads via CSV (with status=estimate_sent)
  - Trigger all automations manually (estimate follow-up, win-back, no-show, payment)
  - Send a test message, verify AI responds
  - Generate a report
  - Test the full lead lifecycle (inbound → AI response → escalation → won)
- [ ] Walk through `docs/engineering/TESTING-SELF-SERVE.md` (Steps 1-7)
  - Sign up as a contractor, verify auto-login
  - Set up phone, choose plan via Stripe Checkout
  - Confirm dashboard setup banner works
- [ ] Delete all test data when done (or use a separate Neon branch)

---

## Phase 2: Production Environment

### Stripe (30 minutes)

- [ ] Create 1 Stripe product: "ConversionSurgery Managed Service"
- [ ] Create 1 price: $1,000/month recurring
- [ ] Copy the price ID (starts with `price_`)
- [ ] Set in production env: `STRIPE_PRICE_PRO_MONTHLY=price_xxxxx`
- [ ] Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` and `STRIPE_SECRET_KEY`
- [ ] Create Stripe webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`
  - Events to listen for: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `payment_method.attached`
- [ ] Copy webhook signing secret → set `STRIPE_WEBHOOK_SECRET`

### Email (10 minutes)

- [ ] Set `RESEND_API_KEY` (from resend.com dashboard)
- [ ] Set `EMAIL_FROM` to your verified domain (e.g., `noreply@conversionsurgery.com`)
- [ ] Verify domain in Resend (DNS records)

### Twilio (already configured if testing passed)

- [ ] Confirm `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
- [ ] Set `TWILIO_WEBHOOK_BASE_URL` to production domain
- [ ] Confirm at least one phone number is available to purchase in Twilio account

### Other Required Env Vars

- [ ] `DATABASE_URL` — production Neon connection string
- [ ] `AUTH_SECRET` — generate with `openssl rand -hex 32`
- [ ] `CLIENT_SESSION_SECRET` — generate with `openssl rand -hex 32`
- [ ] `CRON_SECRET` — generate with `openssl rand -hex 32`
- [ ] `ANTHROPIC_API_KEY` — from console.anthropic.com
- [ ] `NEXT_PUBLIC_APP_URL` — your production domain (e.g., `https://app.conversionsurgery.com`)

### Database

- [ ] Run `npm run db:migrate` on production
- [ ] Run `npm run db:seed -- --lean` (seeds plans, role templates, flow templates, system settings)
- [ ] Verify seed created the Pro plan with your Stripe price ID

### Deploy

- [ ] Deploy to Cloudflare (via OpenNext)
- [ ] Verify runtime smoke: hit `/login`, `/signup`, `/client-login` — all return 200
- [ ] Set up cron jobs (Cloudflare Workers Cron Triggers or external scheduler)
  - Every 5 min: `POST /api/cron` (message processing)
  - Every hour: `POST /api/cron/onboarding-sla-check`
  - Daily: `POST /api/cron/win-back`, `POST /api/cron/no-show-recovery`, `POST /api/cron/guarantee-check`, `POST /api/cron/stripe-reconciliation`
  - All cron calls need header: `Authorization: Bearer $CRON_SECRET`

---

## Phase 3: First Client Delivery

### Before the sales call

- [ ] Review `docs/business-intel/RESEARCH-INSIGHTS-MARCH-2026.md` — pitch angles and objection handling
- [ ] Prepare to ask: "How many quotes in your phone have had no response for 2+ weeks?"
- [ ] Have the quote reactivation angle ready: "Give us your last 30 dead quotes — we text them this week"

### After the contractor says yes

Day 0 (signing):
- [ ] Create client via admin wizard (`/admin/clients/new/wizard`)
- [ ] Assign a local phone number in the wizard (or from client detail page)
- [ ] Onboarding card on client detail page shows next steps

Day 1:
- [ ] Contractor calls their own number — missed call text-back fires (visceral proof moment)
- [ ] Ask contractor for their old quotes (spreadsheet, phone contacts, or CRM export)
- [ ] Import quotes via CSV with `status=estimate_sent`
- [ ] Verify leads appear in `/leads` filtered by source=CSV Import

Day 1-2:
- [ ] Start knowledge base setup (`/admin/clients/[id]/knowledge`)
  - Business services, pricing approach, FAQs, competitive advantages
  - Use industry preset as starting point, customize per client
- [ ] Deliver Revenue Leak Audit (research their Google Business Profile, website, competitors)

Day 3-5:
- [ ] AI configured with client knowledge — enable form response automation
- [ ] Set AI mode to Smart Assist (5-min auto-send delay)
- [ ] Verify AI generates reasonable responses for test messages

Week 2:
- [ ] Review AI quality — check flagged messages, refine knowledge base
- [ ] First bi-weekly report generated and delivered
- [ ] Win-back cron starts picking up imported quotes (if 25+ days old)

Week 3+:
- [ ] Upgrade AI to Autonomous mode
- [ ] All automations running: estimate follow-up, appointment reminders, payment collection, review generation, win-back
- [ ] Monitor escalations dashboard for anything that needs human attention

### Track ROI

- [ ] After first week: count quote reactivation responses (target: 10%+ response rate)
- [ ] After 30 days: check 5 Qualified Lead Engagements (guarantee Layer 1)
- [ ] After 90 days: check 1 Attributed Project Opportunity (guarantee Layer 2)
- [ ] Revenue dashboard shows recovered pipeline value

---

## Phase 4: Outreach (Do This Now — Spring Window Closing)

The research confirms March-April is the prime outreach window. Contractors are flooded with leads and can&apos;t respond to all of them. After mid-April, they go heads-down into summer projects.

- [ ] Prepare outreach using angles from `RESEARCH-INSIGHTS-MARCH-2026.md` Section 3
- [ ] Lead with quote reactivation angle (Angle A) — lowest objection surface
- [ ] Track experiment results in the research doc Section 9
- [ ] First 3-5 clients: manually deliver, learn what friction points actually matter
- [ ] After 5 clients: update `OFFER-CLIENT-FACING.md` with validated reframe if outreach data supports it
