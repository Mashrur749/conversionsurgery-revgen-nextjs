# Launch Checklist

Your sequence: Local Setup &rarr; Test Everything Locally &rarr; Operate a Simulated Client &rarr; Learn the Value + Sales &rarr; Deploy to Production &rarr; Start Selling.

Go top to bottom. Fix issues as you find them locally, not in production.

---

## Phase 1: Local Environment Setup

Follow `docs/engineering/ENVIRONMENT-SETUP.md` end to end. It covers: Neon staging branch, env vars, Twilio dev phones, first login.

- [ ] Environment setup complete &mdash; `npm run dev` runs, you can log in at localhost:3000
- [ ] Twilio dev phones working (5 numbers, 3 browser tabs, ngrok tunnel)
- [ ] Agency line (#5) configured at `/admin/settings`

---

## Phase 2: Test Everything Locally

Run every test. If something breaks, fix it here &mdash; not in production.

### 2.1 Core Tests (must all pass)

**Test A: Missed Call Text-Back**
1. From Dev Phone #2 (Lead), call your business number (#1). Let it ring.
2. Within 5 seconds, Dev Phone #2 receives a text from #1.
- [ ] Pass

**Test B: AI Conversation**
1. From Dev Phone #2, text the business number: &ldquo;Hi, I need a quote for a kitchen renovation&rdquo;
2. AI responds in 2-8 seconds with something relevant.
- [ ] Pass

**Test C: Import Old Quotes**
1. Admin dashboard &rarr; `/leads` &rarr; Import CSV (`name, phone, status` with `estimate_sent`)
2. Check CASL consent checkbox. Import.
3. Leads appear with estimate follow-up scheduled.
- [ ] Pass

**Test D: Portal Lead Actions**
1. Log in as contractor via `/client-login`
2. Verify System Activity card shows stats (above Revenue Recovered)
3. Open Conversations &rarr; pick a lead &rarr; click &ldquo;Mark Estimate Sent&rdquo;
4. Pick another lead &rarr; click &ldquo;Mark Won&rdquo; &rarr; enter revenue amount
5. Dashboard Revenue Recovered card updates.
- [ ] Pass

**Test E: Generate a Report**
1. `curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`
2. Check `/admin/reports` &mdash; report generated.
3. Owner phone receives follow-up SMS.
- [ ] Pass

**Test F: AI Safety**
```bash
npm run test:ai
```
- [ ] All Safety tests pass

**Test G: AI Preview**
1. `/admin/clients/[id]` &rarr; AI Preview panel
2. Type: &ldquo;How much does a kitchen renovation cost?&rdquo;
3. AI responds using KB data, not hallucinating.
- [ ] Pass

### 2.2 Integration Tests (configure first, then test)

**Test H: Google Calendar Sync**
1. `/admin/clients/[id]` &rarr; Configuration tab &rarr; Connect Google Calendar
2. Authorize. Create an appointment for a lead.
3. Event appears in your Google Calendar.
- [ ] Pass (or skip if Google OAuth not yet configured)

**Test I: Stripe Checkout**
1. Contractor portal &rarr; Billing &rarr; Subscribe
2. Test card: `4242 4242 4242 4242`
3. Subscription active in Stripe dashboard.
- [ ] Pass (or skip if Stripe not yet configured)

### 2.3 Cleanup

- [ ] Reset: `npm run db:seed -- --demo-cleanup` or `neonctl branches reset staging --parent`

---

## Phase 3: Operate a Simulated Client End-to-End

This is where you truly learn the system. You play both roles &mdash; the operator AND the contractor &mdash; walking through the entire client lifecycle as if it were real.

### 3.1 Day 0: Signing

- [ ] Create a new test client via admin wizard (`/admin/clients/new/wizard`)
- [ ] Use a real business name (e.g., &ldquo;Summit Renovations&rdquo;) and realistic details
- [ ] Assign a phone number to the client
- [ ] Open the service agreement template (`docs/legal/SERVICE-AGREEMENT-TEMPLATE.md`) &mdash; imagine you just sent this to &ldquo;Summit Renovations&rdquo;

### 3.2 Day 1: Practice the Onboarding Call

**Actually talk through the script out loud.** Read Playbook Section 10, then run through it as if you&apos;re on a real call with the contractor from &ldquo;Summit Renovations.&rdquo;

Practice saying these out loud (not just reading):
- &ldquo;Walk me through your most common job types. What do you typically charge for each?&rdquo;
- &ldquo;When a lead asks for a price, what do you want the AI to say?&rdquo;
- &ldquo;Can you send me a list of everyone you quoted in the last 90 days who never got back to you?&rdquo;

While you practice the script, do the actual system work:
- [ ] Fill out the KB Intake Questionnaire at `/admin/clients/[id]` &mdash; answer all 12 questions as if you were &ldquo;Summit Renovations&rdquo; (kitchen, bathroom, basement renos in Edmonton)
- [ ] After filling KB, check `/admin/clients/[id]/knowledge` &mdash; entries populated
- [ ] Call the client&apos;s business number from your personal phone &mdash; missed-call text-back fires (this is the &ldquo;wow moment&rdquo; you&apos;ll do live on every onboarding call)
- [ ] Import 10-15 test leads via CSV with `status=estimate_sent`
- [ ] Check `/leads` &mdash; estimate follow-up sequences scheduled
- [ ] Try the portal KB wizard at `/client/onboarding` (log in as the contractor) &mdash; see what they see
- [ ] Practice the expectations script out loud: &ldquo;Week 1: missed call text-back is live, I&apos;ll import your old quotes. Week 2: the AI starts responding with a 5-minute review window. Week 3: fully autonomous.&rdquo;

### 3.3 Day 1-2: Revenue Leak Audit

- [ ] Open `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md`
- [ ] Fill it out as if &ldquo;Summit Renovations&rdquo; were real: research a real contractor&apos;s Google Business Profile, count their reviews, check competitor review counts
- [ ] This is practice for the real deliverable &mdash; it takes 30-45 min per client

### 3.4 Week 1: Watch the Automations

- [ ] From Dev Phone #2, text the business number as various &ldquo;homeowners&rdquo; with different questions
- [ ] Watch the AI respond. Note where it defers (knowledge gaps).
- [ ] Check `/admin/ai-quality` &mdash; are any messages flagged?
- [ ] Check the knowledge gap queue &mdash; gaps should appear from questions the AI couldn&apos;t answer
- [ ] Fill a gap from the queue (as the operator would)
- [ ] Trigger a cron cycle: `curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`
- [ ] Check if estimate follow-up messages were sent to your imported leads

### 3.5 Week 2: Smart Assist Mode

- [ ] Set AI mode to Smart Assist (5-min delay) in client settings
- [ ] From Dev Phone #2, text the business number again
- [ ] Verify: the AI drafts a response, holds it for 5 minutes, then auto-sends
- [ ] On Dev Phone #3 (Owner), check that you receive the Smart Assist notification
- [ ] Try editing or cancelling a pending response from the admin dashboard

### 3.6 Escalation Handling

- [ ] From Dev Phone #2, text something the AI can&apos;t handle: &ldquo;I want to speak to someone about a complaint&rdquo;
- [ ] Verify: lead is flagged `action_required`, escalation entry created
- [ ] Check `/escalations` &mdash; the escalation should appear
- [ ] Resolve it: respond as the operator, mark escalation resolved

### 3.7 Appointment Booking

- [ ] From Dev Phone #2, text: &ldquo;Can I book an estimate for next Tuesday?&rdquo;
- [ ] Verify: AI offers available slots based on business hours
- [ ] Book an appointment. Check `/admin/clients/[id]` for the appointment.
- [ ] If Google Calendar is connected: verify the event appears in the calendar

### 3.8 Review Response

- [ ] Check if there are any review response drafts at `/admin/clients/[id]` &rarr; Reviews
- [ ] If yes: review the AI-generated response, edit it, approve it
- [ ] Check the contractor portal at `/client/reviews` &mdash; contractor can also approve from here

### 3.9 Report + Dashboard

- [ ] Trigger another cron cycle to generate the bi-weekly report
- [ ] Check `/admin/reports` &mdash; review the report for your simulated client
- [ ] Check the contractor portal dashboard &mdash; does the System Activity card show realistic numbers?
- [ ] Check the Revenue Recovered card &mdash; does it show $0 with the nudge to mark wins?
- [ ] Mark a lead as Won in the portal conversations view. Check the card updates.

### 3.10 What You Should Now Understand

After walking through all of the above, you should be able to answer:

- [ ] What does the contractor see on Day 1? What&apos;s the &ldquo;wow&rdquo; moment?
- [ ] What does Week 2 feel like for the contractor? How much attention do they need to give?
- [ ] What does the operator do daily? How long does it take?
- [ ] What happens when the AI doesn&apos;t know something?
- [ ] What does the bi-weekly report actually look like?
- [ ] What does the escalation flow feel like from both sides?

---

## Phase 4: Understand the Value + Sales

Now you&apos;ve operated the system. The docs will make sense because you&apos;ve seen it all work.

### 4.1 Read the Operator Guide (90 min)

- [ ] `docs/operations/00-OPERATOR-GUIDE.md` &mdash; everything connected in one doc

### 4.2 Go Deep on Delivery (2-3 evenings)

**Evening 1: How every feature works (~45 min)**
- [ ] `docs/product/PLATFORM-CAPABILITIES.md` &mdash; all 12 sections
- This will click fast because you just tested most of these features yourself

**Evening 2: How you deliver every scenario (~60 min)**
- [ ] `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` &mdash; all 22 sections
- Pay special attention to Sections 20-22 (contractor experience, failure modes, honest boundaries)
- Section 12 has the qualification framework (who to sign, who to walk away from)

**Evening 3: How to sell + legal + materials (~60 min)**
- [ ] `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` &mdash; 10 objections + Section 12 outreach scripts
- [ ] `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` &mdash; 7 hard rules (10 min)
- [ ] Fill in `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` with YOUR details (15 min)
- [ ] Save `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` where you can open it on a call
- [ ] Read `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md` &mdash; you already practiced this in Phase 3

**Reference (skim when client #1 is live):**
- [ ] `docs/operations/01-OPERATIONS-GUIDE.md` &mdash; 70-item daily/weekly checklist

### 4.3 Final Self-Test (answer ALL without looking)

- [ ] What does the contractor get for their money?
- [ ] What&apos;s the deal? First month free, then what?
- [ ] What&apos;s the 4-touch estimate follow-up timing?
- [ ] What happens when the AI doesn&apos;t know something?
- [ ] What&apos;s the onboarding call script flow?
- [ ] Name 3 things the system does NOT do.
- [ ] What&apos;s the worst realistic failure and how bad is it?
- [ ] Who should you NOT sign? Name 3 disqualifiers.
- [ ] A contractor says &ldquo;What if the AI says something wrong?&rdquo; &mdash; what do you say?
- [ ] A contractor says &ldquo;I got burned before.&rdquo; &mdash; what do you say?
- [ ] A contractor says &ldquo;$1,000 is expensive.&rdquo; &mdash; what do you say?
- [ ] What&apos;s the demo moment that closes deals?
- [ ] What&apos;s the max the contractor can lose?

**If you can answer all 13: you know the system inside out.**

### 4.4 Practice the Sales Conversation

Before your first real outreach, practice the full sales flow out loud:

**Practice the cold call script** (from `docs/operations/COLD-START-PLAYBOOK.md`):
- [ ] Say the cold call opener out loud 3 times until it feels natural
- [ ] Practice the &ldquo;I&apos;m busy&rdquo; response
- [ ] Practice the voicemail script
- [ ] Record yourself on your phone &mdash; listen back. Does it sound like a person or a salesperson?

**Practice the demo flow** (from Playbook Section 12):
- [ ] Walk through the demo on your local environment as if a prospect is watching
- [ ] Say out loud: &ldquo;Call this number right now. Let it ring. Watch what happens.&rdquo;
- [ ] Practice the silence after the text-back arrives (don&apos;t fill it &mdash; let them react)
- [ ] Practice the transition to the close: &ldquo;First month is free. I set everything up. You pay nothing until you see results.&rdquo;

**Practice objection handling:**
- [ ] Have someone (friend, partner) ask you: &ldquo;What if the AI says something wrong?&rdquo; &mdash; respond without looking at notes
- [ ] Same with: &ldquo;I got burned by something like this before&rdquo;
- [ ] Same with: &ldquo;$1,000 a month is a lot&rdquo;
- [ ] If you stumble, re-read the script and try again

**You&apos;re ready to sell when the scripts feel like YOUR words, not something you&apos;re reading.**

---

## Phase 5: Deploy to Production

Everything works locally. Now replicate it in production.

### 5.1 External Services

**Stripe (30 min)**
1. https://dashboard.stripe.com &rarr; Products &rarr; Add Product
2. Name: &ldquo;ConversionSurgery Managed Service&rdquo;
3. Price: $1,000/month recurring with **30-day free trial**
4. Copy the price ID
5. Webhooks &rarr; Add Endpoint: `https://yourdomain.com/api/webhooks/stripe`
6. Events: `checkout.session.completed`, `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid`, `.payment_failed`, `.payment_action_required`, `charge.refunded`, `.dispute.created`, `.dispute.closed`, `customer.subscription.paused`, `.resumed`, `.trial_will_end`, `payment_method.attached`
- [ ] Price ID, API keys, webhook secret set in production env

**Email (10 min)**
1. https://resend.com &rarr; API Key + Domain verification
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set

**Google Calendar (10 min)**
1. https://console.cloud.google.com &rarr; Enable Calendar API &rarr; OAuth credentials
2. Redirect URI: `https://yourdomain.com/api/auth/callback/google-calendar`
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set

### 5.2 Production Database

```bash
DATABASE_URL=your_production_string npm run db:migrate
DATABASE_URL=your_production_string npm run db:seed -- --lean
```

- [ ] Pro plan exists with Stripe price ID
- [ ] `isUnlimitedMessaging: true` on Pro plan
- [ ] 12 help center articles seeded
- [ ] Demo client seeded: `DATABASE_URL=prod_string npm run db:seed -- --demo`

### 5.3 Deploy + Configure

- [ ] Deploy to Cloudflare via OpenNext
- [ ] Pages load: `/login`, `/signup`, `/client-login`
- [ ] Cloudflare Workers Cron Trigger: every 5 min, `POST /api/cron`, `Authorization: Bearer CRON_SECRET`
- [ ] Twilio agency number (#5) webhooks pointed at production
- [ ] `operator_phone` and `operator_name` set at `/admin/settings`

### 5.4 GST/Tax

- [ ] Under $30K revenue? Document small supplier exemption. Revisit at $30K.
- [ ] If registered: configure Stripe Tax (5% GST)

### 5.5 Smoke Test Production

- [ ] Assign a real Alberta phone number (403/780) to the demo client
- [ ] Call the demo number from your personal phone
- [ ] Missed-call text-back arrives within 5 seconds?
- [ ] Text it: &ldquo;I need a quote for a bathroom renovation&rdquo;
- [ ] AI responds within 10 seconds?

**Both pass? Production is live.**

---

## Phase 6: Start Selling

Your complete outreach plan: `docs/operations/COLD-START-PLAYBOOK.md`
Designed for a 9-5 schedule (early mornings + evenings + weekends).

### Before your first outreach

- [ ] Service agreement filled with YOUR details &mdash; ready as PDF
- [ ] ROI worksheet saved where you can open it on a call
- [ ] Demo number tested today
- [ ] Prospect list built (80+ contacts from Kijiji, Google Maps, HomeStars)
- [ ] Joined 5 Alberta contractor Facebook Groups
- [ ] Memorized top 3 objection responses

### The daily rhythm

| Time | What |
|------|------|
| 6:30 AM | Send 5-8 texts/DMs |
| Lunch | Reply to messages, follow-ups |
| 5:30-7:30 PM | 10-15 cold calls + demos |
| Saturday | Power session: 20 DMs, calls, Facebook posts |

### After they say yes

Day 0 &rarr; Day 1 &rarr; Week 2 &rarr; Week 3 &mdash; follow Playbook Section 10. Onboarding calls on Saturday mornings.

---

## Quick Reference

| Page | URL | What it&apos;s for |
|------|-----|--------------|
| Triage Dashboard | `/admin/triage` | Daily starting point |
| Client Detail | `/admin/clients/[id]` | KB, calendar, onboarding |
| Escalation Queue | `/escalations` | Hot leads needing humans |
| AI Quality | `/admin/ai-quality` | Flagged AI messages |
| AI Effectiveness | `/admin/ai-effectiveness` | Outcome trends |
| Reports | `/admin/reports` | Bi-weekly report review |
| Reliability | `/admin/reliability` | Cron/webhook health |
| Settings | `/admin/settings` | Kill switches, operator info |
