# Launch Checklist

Go top to bottom. Each phase tells you what to do and which document to open.

---

## Phase 1: Local Environment Setup

**Open:** `docs/engineering/ENVIRONMENT-SETUP.md`

Follow it end to end. When done:

- [ ] App runs at localhost:3000
- [ ] You can log in as admin
- [ ] Twilio dev phones working (5 numbers, ngrok tunnel)
- [ ] `operator_phone` and `operator_name` set

---

## Phase 2: Test Everything Locally

**Reference:** `docs/engineering/01-TESTING-GUIDE.md` Section 0 for Twilio details if needed.

Tests are quick pass/fail. Fix anything that breaks before moving on.

- [ ] **Missed call text-back:** Call business number (#1) from Dev Phone #2. Text arrives within 5 seconds.
- [ ] **AI conversation:** Text #1 from Dev Phone #2: &ldquo;I need a quote for a kitchen renovation.&rdquo; AI responds in 2-8 seconds.
- [ ] **CSV import:** Admin &rarr; `/leads` &rarr; Import CSV with `status=estimate_sent`. Check CASL box. Follow-up scheduled.
- [ ] **Portal lead actions:** Log in as contractor. System Activity card visible. Mark a lead Won. Revenue card updates.
- [ ] **Report:** Trigger cron: `curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`. Report generated at `/admin/reports`.
- [ ] **AI Preview:** `/admin/clients/[id]` &rarr; AI Preview &rarr; ask a question. Reasonable response.
- [ ] **AI Safety:** `npm run test:ai` &mdash; all Safety tests pass.
- [ ] **Google Calendar:** Connect OAuth, create appointment, verify in Google Calendar. *(Skip if not yet configured.)*
- [ ] **Stripe Checkout:** Contractor portal &rarr; Billing &rarr; Subscribe with `4242 4242 4242 4242`. *(Skip if not yet configured.)*

---

## Phase 3: Operate a Simulated Client End-to-End

**Open:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10 (Onboarding Call Script)

Create a fake client (&ldquo;Summit Renovations&rdquo;) and walk through the entire lifecycle as if it were real. Play both roles &mdash; operator and contractor.

### Day 0: Signing
- [ ] Create client via admin wizard. Assign phone number.
- [ ] **Open:** `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` &mdash; walk through it as if sending to Summit Renovations.

### Day 1: Onboarding Call (practice out loud)
- [ ] **Read:** Playbook Section 10 &mdash; the call script.
- [ ] Practice the script out loud. Fill the KB questionnaire while speaking.
- [ ] Call the business number from your phone &mdash; experience the &ldquo;wow moment&rdquo; yourself.
- [ ] Import 10-15 test leads as `estimate_sent`. Verify follow-up scheduled.
- [ ] Try the contractor&apos;s portal KB wizard at `/client/onboarding`.
- [ ] Practice the expectations script out loud: &ldquo;Week 1: missed call text-back is live...&rdquo;

### Day 1-2: Revenue Leak Audit
- [ ] **Open:** `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md`
- [ ] Fill it out for a real contractor&apos;s Google Business Profile (pick one from Google Maps). This is practice for the real deliverable.

### Week 1-2 Simulation
- [ ] Text the business number as different &ldquo;homeowners&rdquo; with various questions. Watch the AI respond.
- [ ] Check `/admin/ai-quality` for flagged messages. Fix a KB gap from the queue.
- [ ] Set AI to Smart Assist mode. Verify 5-min review window works.
- [ ] Text something the AI can&apos;t handle: &ldquo;I want to speak to someone about a complaint.&rdquo; Check `/escalations`. Resolve it.
- [ ] Text: &ldquo;Can I book an estimate for next Tuesday?&rdquo; Verify appointment booking flow.
- [ ] Generate a report. Review it at `/admin/reports`.
- [ ] Check the contractor dashboard &mdash; System Activity card, Revenue Recovered card.

### After Phase 3, you should know
- [ ] What the contractor sees on Day 1
- [ ] What the operator does daily and how long it takes
- [ ] What happens when the AI doesn&apos;t know something
- [ ] What the escalation flow feels like from both sides
- [ ] What the bi-weekly report looks like

---

## Phase 4: Understand the Value + Sales

### 4.1 Read (in this order)

| Order | Doc | Time |
|:-----:|-----|:----:|
| 1 | `docs/operations/00-OPERATOR-GUIDE.md` | 90 min |
| 2 | `docs/product/PLATFORM-CAPABILITIES.md` | 45 min |
| 3 | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (all 22 sections) | 60 min |
| 4 | `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` | 30 min |
| 5 | `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` | 10 min |

Save for sales calls:
- [ ] `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`
- [ ] Fill in YOUR details: `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md`

### 4.2 Practice Sales Out Loud

**Open:** `docs/operations/COLD-START-PLAYBOOK.md` (scripts section)

- [ ] Say the cold call opener 3 times until it feels natural
- [ ] Practice the &ldquo;I&apos;m busy&rdquo; and voicemail responses
- [ ] Walk through the demo on your local environment as if a prospect is watching
- [ ] Practice the close: &ldquo;First month is free. I set everything up. You pay nothing until you see results.&rdquo;
- [ ] Have someone ask you the top 3 objections &mdash; respond without notes

### 4.3 Self-Test (answer ALL without looking)

- [ ] What does the contractor get for their money?
- [ ] What&apos;s the deal? First month free, then what?
- [ ] What&apos;s the 4-touch estimate follow-up timing?
- [ ] What happens when the AI doesn&apos;t know something?
- [ ] Name 3 things the system does NOT do.
- [ ] What&apos;s the worst realistic failure and how bad is it?
- [ ] Who should you NOT sign? Name 3 disqualifiers.
- [ ] &ldquo;What if the AI says something wrong?&rdquo; &mdash; what do you say?
- [ ] &ldquo;I got burned before.&rdquo; &mdash; what do you say?
- [ ] &ldquo;$1,000 is expensive.&rdquo; &mdash; what do you say?
- [ ] What&apos;s the demo moment that closes deals?
- [ ] What&apos;s the max the contractor can lose?
- [ ] What&apos;s the onboarding call script flow?

**All 13 answered? You&apos;re ready.**

---

## Phase 5: Deploy to Production

### 5.1 External Services

**Stripe (30 min):**
1. Create product: &ldquo;ConversionSurgery Managed Service&rdquo;, $1,000/month with 30-day free trial
2. Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.created/.updated/.deleted`, `invoice.paid/.payment_failed/.payment_action_required`, `charge.refunded/.dispute.created/.dispute.closed`, `customer.subscription.paused/.resumed/.trial_will_end`, `payment_method.attached`
- [ ] Price ID, API keys, webhook secret set in production env

**Email (10 min):** Resend API key + domain verification.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set

**Google Calendar (10 min):** Google Cloud Console &rarr; Calendar API &rarr; OAuth credentials. Redirect: `https://yourdomain.com/api/auth/callback/google-calendar`
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set

### 5.2 Production Database

**Reference:** `docs/engineering/03-NEON-BRANCH-SETUP.md`

```bash
DATABASE_URL=your_production_string npm run db:migrate
DATABASE_URL=your_production_string npm run db:seed -- --lean
DATABASE_URL=your_production_string npm run db:seed -- --demo
```

- [ ] Pro plan exists with correct Stripe price ID
- [ ] 12 help center articles seeded

### 5.3 Deploy + Configure

- [ ] Deploy to Cloudflare via OpenNext
- [ ] Pages load: `/login`, `/signup`, `/client-login`
- [ ] Cron trigger: every 5 min, `POST /api/cron`, `Authorization: Bearer CRON_SECRET`
- [ ] Agency number (#5) webhooks pointed at production
- [ ] `operator_phone` and `operator_name` set at `/admin/settings`

### 5.4 GST/Tax

- [ ] Under $30K? Small supplier exemption. Revisit at $30K.

### 5.5 Smoke Test

- [ ] Assign real Alberta number (403/780) to demo client
- [ ] Call it. Text-back in 5 seconds?
- [ ] Text it. AI responds in 10 seconds?
- [ ] **Both pass? Production is live.**

---

## Phase 6: Start Selling

**Open:** `docs/operations/COLD-START-PLAYBOOK.md`

It has: day-by-day schedule (designed for 9-5 job), word-for-word scripts for every channel, follow-up sequences, and objection handling.

### Before first outreach

- [ ] Service agreement filled &mdash; ready as PDF
- [ ] ROI worksheet saved for calls
- [ ] Demo number tested today
- [ ] Prospect list built (80+ contacts)
- [ ] Joined 5 Alberta contractor Facebook Groups
- [ ] Top 3 objection responses memorized

### After they say yes

**Open:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10

Day 0 &rarr; Day 1 &rarr; Week 2 &rarr; Week 3. Onboarding calls on Saturday mornings.

### Daily routine (per client)

1. `/admin/triage` &mdash; who needs attention?
2. `/escalations` &mdash; hot leads?
3. Knowledge gap queue &mdash; AI gaps to fill?
4. `/admin/ai-quality` &mdash; flagged messages?
5. Done. 5-10 min/client.
