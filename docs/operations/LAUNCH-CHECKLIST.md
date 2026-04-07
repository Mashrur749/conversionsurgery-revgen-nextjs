# Launch Checklist

Go top to bottom. Each phase tells you what to do and which document to open.

---

## Phase 1: Local Environment Setup

**Open:** `docs/engineering/ENVIRONMENT-SETUP.md`

Follow it end to end. When done:

- [ ] App runs at localhost:3000
- [ ] You can log in as admin
- [ ] Twilio dev phones working (5 numbers, ngrok tunnel)
- [ ] `operator_phone` and `operator_name` set at `/admin/agency`

---

## Phase 2: Test Everything Locally

**Reference:** `docs/engineering/01-TESTING-GUIDE.md` &mdash; Section 0 has Twilio setup details. If any test below fails or you need more detail on expected behavior, the testing guide has expanded multi-step instructions for every feature (use the &ldquo;Full System Test Path&rdquo; at the top to find the right section).

Tests are quick pass/fail. Fix anything that breaks before moving on.

- [ ] **Missed call text-back:** Call business number (#1) from Dev Phone #2. Text arrives within 5 seconds.
- [ ] **AI conversation:** Text #1 from Dev Phone #2: &ldquo;I need a quote for a kitchen renovation.&rdquo; AI responds in 2-8 seconds.
- [ ] **CSV import:** Admin &rarr; `/leads` &rarr; Import CSV with `status=estimate_sent`. Check CASL box. Follow-up scheduled.
- [ ] **Portal lead actions:** Log in as contractor. System Activity card visible. Mark a lead Won. Revenue card updates.
- [ ] **Report:** Trigger cron: `curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"`. Report generated at `/admin/reports`.
- [ ] **AI Preview:** `/admin/clients/[id]` &rarr; AI Preview &rarr; ask a question. Reasonable response.
- [ ] **AI Safety:** `npm run test:ai` &mdash; all Safety tests pass.
- [ ] **DNC/Exclusion List:** Navigate to a client&apos;s Configuration tab. Add a test phone number via the Exclusion List card. Verify it appears. Remove it.
- [ ] **Smart Assist Admin Drafts:** Set the client to Smart Assist mode. Trigger a draft (text the business number). Verify the draft appears in the Activity tab &rarr; Pending Drafts card. Approve from the dashboard.
- [ ] **Integrations Card:** Navigate to Configuration tab. Add a test Jobber webhook. Verify it saves. Delete it.
- [ ] **Google Calendar:** Connect OAuth, create appointment, verify in Google Calendar. *(Skip if not yet configured.)*
- [ ] **Voice AI (ConversationRelay):** Call the business number, let it ring. Voice AI answers with ElevenLabs voice, streams responses in ~1 second, handles interruptions. Verify call transcript + summary appear in admin. Test transfer intent: &ldquo;I want to speak to someone.&rdquo;
- [ ] **Voice AI Admin Config:** `/admin/voice-ai` &mdash; verify kill switch banner, canDiscussPricing toggle, maxDuration selector, business hours inline display, agentTone badge per client.
- [ ] **Voice AI Playground:** Expand a client &rarr; QA Checklist shows auto-checks. Run: Greeting Preview (hear it in selected voice), Simulator (type a question, get AI response), KB Test (10 questions, check coverage), Guardrail Test (8 adversarial inputs, all pass). QA Checklist all-green &rarr; click &ldquo;Go Live.&rdquo;
- [ ] **Weekly Pipeline SMS:** Trigger the weekly-summary cron. Verify SMS includes dollar pipeline values and needs-attention count.
- [ ] **Payment Link (managed):** Admin &rarr; client detail &rarr; &ldquo;Send Payment Link.&rdquo; Verify SMS + email arrive with Stripe checkout link. Complete checkout with test card `4242 4242 4242 4242`. Verify 30-day trial starts.
- [ ] **Self-Serve Checkout:** Contractor portal &rarr; Billing &rarr; Subscribe with test card. Verify 30-day trial starts. *(Only for self-serve clients.)*
- [ ] **Service Model:** Create a managed client (default). Verify: Flows nav item hidden, Settings &gt; Features tab hidden, Billing has no &ldquo;Change Plan&rdquo; button. Switch to self-serve in admin &mdash; verify all three reappear.
- [ ] **Contractor Portal Voice Card:** Log in as contractor. Voice AI status card on dashboard shows: Active badge, mode, phone number, call stats (or &ldquo;No voice calls this week yet&rdquo;).
- [ ] **Discussions:** From contractor portal, click &ldquo;Stuck? Text me&rdquo; &rarr; send a message. Check admin `/admin/discussions` &mdash; thread appears. Reply as admin. Check contractor portal &mdash; reply appears (15s polling). Test admin &ldquo;New Thread&rdquo; button &mdash; contractor receives email.
- [ ] **Welcome Comms:** Create a new client via `/signup`. Verify welcome email arrives + welcome SMS with login link.

---

## Phase 3: Operate a Simulated Client End-to-End

**Open:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10 (Onboarding Call Script)

Create a fake client (&ldquo;Summit Renovations&rdquo;) and walk through the entire lifecycle as if it were real. Play both roles &mdash; operator and contractor.

### Day 0: Signing
- [ ] Create client via admin wizard (service model: managed). Assign phone number.
- [ ] **Open:** `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` &mdash; walk through it as if sending to Summit Renovations.
- [ ] Send Payment Link from admin client detail page. Complete checkout with test card. Verify 30-day trial starts.
- [ ] Verify welcome email + SMS arrived after signup.

### Day 1: Onboarding Call (practice out loud)
- [ ] **Read:** Playbook Section 10 &mdash; the call script.
- [ ] Practice the script out loud. Fill the KB questionnaire while speaking.
- [ ] Practice the exclusion list step: &ldquo;Before we run anything &mdash; anyone you want us to skip? Family, close friends, personal relationships?&rdquo; This is mandatory for every real client. Practice adding the numbers in the admin dashboard: Configuration tab &rarr; Exclusion List card &rarr; Add Number.
- [ ] If testing Jobber, configure the webhook from the admin dashboard: Configuration tab &rarr; Integrations card &rarr; Add Integration &rarr; select Jobber.
- [ ] Before calling: use the Voice AI Playground to preview the greeting and run KB Test + Guardrail Test. QA Checklist all-green before the real call.
- [ ] Call the business number from your phone &mdash; experience the &ldquo;wow moment&rdquo; yourself.
- [ ] Import 10-15 test leads as `estimate_sent`. Verify follow-up scheduled.
- [ ] Try the contractor&apos;s portal KB wizard at `/client/onboarding`.
- [ ] Practice the expectations script out loud: &ldquo;Week 1: missed call text-back is live...&rdquo;

### Day 1-2: Revenue Leak Audit
- [ ] **Open:** `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md`
- [ ] Fill it out for a real contractor&apos;s Google Business Profile (pick one from Google Maps). This is practice for the real deliverable.
- [ ] Also practice the **Pre-Sale** Revenue Leak Audit: pick a real contractor from Google Maps and fill out the pre-sale template (`docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`) using only public data. This is the version you run BEFORE outreach &mdash; no contractor participation needed.

### Week 1-2 Simulation
- [ ] Text the business number as different &ldquo;homeowners&rdquo; with various questions. Watch the AI respond.
- [ ] Check `/admin/ai-quality` for flagged messages. Fix a KB gap from the queue.
- [ ] Set AI to Smart Assist mode. Verify 5-min review window works.
- [ ] Text something the AI can&apos;t handle: &ldquo;I want to speak to someone about a complaint.&rdquo; Check `/escalations`. Resolve it.
- [ ] Text: &ldquo;Can I book an estimate for next Tuesday?&rdquo; Verify appointment booking flow.
- [ ] Generate a report. Review it at `/admin/reports`.
- [ ] Check the contractor dashboard &mdash; Voice AI card, System Activity card, Revenue Recovered card.
- [ ] Log in as the contractor. Verify managed portal: no Flows nav, no Features settings tab, no &ldquo;Change Plan&rdquo; button on billing. Discussions, Help, Reviews all accessible.
- [ ] **Billing portal check:** Contractor sees current plan (read-only), invoices, payment method, guarantee status card with progress bar. No &ldquo;Change Plan&rdquo; button for managed clients.
- [ ] **Guarantee visibility:** Admin client detail &rarr; Overview tab shows guarantee phase, QLE count, pipeline value, days remaining.
- [ ] Verify Monday pipeline SMS arrived with dollar values (probable pipeline, confirmed revenue, needs-attention count).
- [ ] If testing Jobber integration: configure a test webhook and verify appointment sync + job completion triggers review request.

### Scenario Drills (practice handling real situations)

These are things that WILL happen once you have real clients. Practice each one now so you&apos;re not figuring it out live.

**Ref:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` has the detailed playbook for each scenario.

- [ ] **Lead opts out (Playbook Section 8):** Text STOP to the business number from a test phone. Verify: all messaging stops, opt-out logged, no further automation fires. Text START to re-subscribe. Understand: you cannot override an opt-out.
- [ ] **Wrong number / misrouted lead (Section 9):** What do you do when a lead texts &ldquo;wrong number&rdquo;? Practice: mark as opt-out, update lead notes, check if the number was imported incorrectly.
- [ ] **Contractor wants to pause (Section 6):** Navigate to admin client detail &rarr; pause the subscription. Verify: automations stop, contractor sees paused state, you know the difference between pause and cancel.
- [ ] **Review monitoring (Section 13):** Check `/admin/reputation`. If reviews exist, verify: AI draft generated, contractor can approve/edit in portal at `/client/reviews`. Understand the approval flow before a real negative review arrives.
- [ ] **Probable wins nudge (Section 17):** Trigger the `probable-wins-nudge` cron. Understand: the system asks the contractor about leads with appointments 14+ days ago that aren&apos;t marked won/lost. Practice replying YES/NO to the nudge SMS.
- [ ] **DNC vs opt-out (Section 19):** Understand the difference: opt-out = lead texted STOP (legal, irreversible until they re-subscribe). DNC = operator added the number to the exclusion list (operational, reversible). Practice both in the admin panel.

### Week 3+ Simulation (AI progression + billing lifecycle)
- [ ] **AI mode progression:** Verify the simulated client auto-advanced from `assist` to `autonomous` (check `aiAgentMode` in admin client detail). If client is too new, manually set mode to `autonomous` and verify AI sends responses immediately (no review window).
- [ ] **Trial reminders:** Trigger the trial-reminders cron. Verify email sends for the appropriate day milestone (Day 7/14/25/28/30). Verify SMS fires on Day 28+.
- [ ] **Cancellation flow:** From contractor portal, go to `/client/cancel`. Select a reason. Click &ldquo;Cancel Anyway.&rdquo; Verify 30-day grace period is set. Check admin &mdash; cancellation shows in client status. *(Re-create the subscription after testing.)*
- [ ] **Invoice check:** After the trial period ends (or manually create a test invoice in Stripe), verify: invoice appears on contractor billing page, PDF download works, status badge is correct.

### After Phase 3, you should know
- [ ] What the contractor sees on Day 1 (managed portal: scoreboard + inbox, no configuration)
- [ ] What the operator does daily and how long it takes
- [ ] What happens when the AI doesn&apos;t know something
- [ ] What the escalation flow feels like from both sides
- [ ] What the bi-weekly report looks like
- [ ] How Voice AI QA works (Playground: greeting preview, simulator, KB test, guardrails, checklist)
- [ ] How to capture payment during the onboarding call (Send Payment Link)
- [ ] How the AI progresses from off &rarr; assist &rarr; autonomous
- [ ] What the contractor sees on their billing page (guarantee progress, invoices, plan)
- [ ] What happens when a client cancels (grace period, data export, reminders)
- [ ] What to do when a lead opts out (STOP &rarr; all messaging stops, irreversible until re-subscribe)
- [ ] The difference between DNC (operator-controlled exclusion) and opt-out (lead-initiated, legal)
- [ ] How to handle a contractor who wants to pause (pause subscription, automations stop)
- [ ] How review monitoring and approval works (AI draft &rarr; contractor approves in portal)

---

## Phase 4: Understand the Value + Sales

### 4.1 Read (in this order)

| Order | Doc | Time | What you learn |
|:-----:|-----|:----:|----------------|
| 1 | `docs/operations/00-OPERATOR-GUIDE.md` | 60 min | Big picture &mdash; what the contractor gets, what you do, how the system works |
| 2 | `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (all 22 sections) | 60 min | How to deliver &mdash; every client scenario, onboarding script, payment capture |
| 3 | `docs/operations/01-OPERATIONS-GUIDE.md` | 30 min | Daily ops &mdash; what to check, what to fix, cron health, compliance |
| 4 | `docs/business-intel/OFFER-APPROVED-COPY.md` | 20 min | **Approved sales copy** &mdash; proposals, emails, agreements, website pull from HERE |
| 5 | `docs/operations/COLD-START-PLAYBOOK.md` | 30 min | Getting first clients &mdash; day-by-day schedule, scripts for every channel |
| 6 | `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` | 30 min | Handling pushback &mdash; &ldquo;too expensive,&rdquo; &ldquo;tried something similar,&rdquo; &ldquo;I get referrals&rdquo; |
| 7 | `docs/business-intel/COMPETITIVE-COMPARISON.md` | 10 min | Positioning vs. answering services, CRMs, DIY tools |
| 8 | `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` | 10 min | Known risks acknowledged before first client |
| 9 | `docs/business-intel/VOICE.md` | 10 min | Brand voice &mdash; how to write and speak as ConversionSurgery |

**Total reading: ~4.5 hours.** Split across two evenings or one focused day.

Reference (skim after you&apos;re live &mdash; detailed feature inventory for engineers and product):
- [ ] `docs/product/PLATFORM-CAPABILITIES.md` &mdash; complete technical inventory of every feature. Useful when a contractor asks &ldquo;can it do X?&rdquo; and you need the precise answer.

Save for sales calls (keep these bookmarked):
- [ ] `docs/business-intel/OFFER-APPROVED-COPY.md` (exact language for proposals and emails)
- [ ] `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`
- [ ] Fill in YOUR details: `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md`
- [ ] `docs/business-intel/COMPETITIVE-COMPARISON.md` (comparison table for objection handling)
- [ ] `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` (run before every outreach)
- [ ] `docs/product/ROI-CALCULATOR-GUIDE.md` (how to use the ROI calculator during calls)

### 4.2 Practice Sales Out Loud

**Open:** `docs/operations/COLD-START-PLAYBOOK.md` (scripts section)

- [ ] Say the cold call opener 3 times until it feels natural
- [ ] Practice the &ldquo;I&apos;m busy&rdquo; and voicemail responses
- [ ] Walk through the demo on your local environment as if a prospect is watching
- [ ] Practice using the Voice AI Simulator during a screen-share &mdash; type homeowner questions, show AI responses in real time. This replaces the need for a live Twilio call during demos.
- [ ] Practice the Revenue Leak Audit flow: call a real contractor&apos;s number after hours, test their web form, pull competitor reviews, fill out the one-page audit template
- [ ] Run the ROI calculator with 3 different contractor profiles (15 leads/$50K avg, 30 leads/$35K avg, 8 leads/$80K avg). Verify the numbers feel credible.
- [ ] Practice the demo with Voice AI: &ldquo;Call this number right now&rdquo; &mdash; the text-back fires in 5 seconds, AND if they let it ring, Voice AI answers
- [ ] **Pre-Outreach prep:** For each prospect on your list, run the Pre-Sale Revenue Leak Audit (`docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`) before reaching out. Budget 15-20 min per prospect. Have specific numbers ready before every outreach.
- [ ] **ROI Calculator:** Verify `POST /api/public/roi-calculator` returns a valid response. Have it bookmarked or ready to run during sales calls. Fallback: `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` for offline use.
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
- [ ] Where do you add excluded contacts during onboarding? (Configuration tab &rarr; Exclusion List card)
- [ ] Where do you see the guarantee progress? (Overview tab &rarr; Guarantee Status card)
- [ ] Where do you review pending AI drafts from the browser? (Activity tab &rarr; Pending Drafts card)
- [ ] What does the Monday pipeline SMS show?
- [ ] What is the $5,000 pipeline floor guarantee?
- [ ] How does the Jobber integration work? (appointment sync + review trigger)
- [ ] How do you QA a client&apos;s voice AI before going live? (Voice AI Playground: greeting preview, simulator, KB test, guardrail test, QA checklist)
- [ ] How do you capture payment during the onboarding call? (Send Payment Link from admin client detail page)
- [ ] What does the managed contractor see vs. the self-serve contractor? (Managed: no Flows, no Features tab, no plan picker)
- [ ] When does the AI advance from assist to autonomous? (Day 14, if no AI quality flags in past 7 days)
- [ ] What trial reminder emails fire, and when? (Day 7, 14, 25, 28+SMS, 30+SMS)
- [ ] What happens when a client cancels? (30-day grace, reminders at 20/7/3 days, data export within 5 business days, win-back email 7 days after grace ends)

**All 25 answered? You&apos;re ready.**

---

## Phase 5: Deploy to Production

### 5.1 External Services

**Stripe (30 min) &mdash; Required before selling:**
1. Create product: &ldquo;ConversionSurgery Managed Service&rdquo;, $1,000/month with 30-day free trial
2. Create webhook endpoint: `https://yourdomain.com/api/webhooks/stripe`
3. Events: `checkout.session.completed`, `customer.subscription.created/.updated/.deleted`, `invoice.paid/.payment_failed/.payment_action_required`, `charge.refunded/.dispute.created/.dispute.closed`, `customer.subscription.paused/.resumed/.trial_will_end`, `payment_method.attached`
4. *(Optional backup)* Create a Stripe Payment Link: same product, 30-day trial. The primary flow is the admin &ldquo;Send Payment Link&rdquo; button which creates checkout sessions automatically.
- [ ] Price ID, API keys, webhook secret set in production env
- [ ] Admin &ldquo;Send Payment Link&rdquo; tested with test card `4242 4242 4242 4242`

**Email (10 min):** Resend API key + domain verification.
- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set

**Google Calendar (10 min):** Google Cloud Console &rarr; Calendar API &rarr; OAuth credentials. Redirect: `https://yourdomain.com/api/auth/callback/google-calendar`
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set

**ElevenLabs (5 min):** API key for voice preview and Voice AI Playground.
- [ ] `ELEVENLABS_API_KEY` set in production env

### 5.2 Production Database

**Reference:** `docs/engineering/03-NEON-BRANCH-SETUP.md`

**Important:** If this is a fresh deploy with the latest schema, run migrations first to include the `service_model` column and any other recent additions.

```bash
DATABASE_URL=your_production_string npm run db:migrate
DATABASE_URL=your_production_string npm run db:seed -- --lean
DATABASE_URL=your_production_string npm run db:seed -- --demo
```

- [ ] Pro plan exists with correct Stripe price ID
- [ ] 12 help center articles seeded

### 5.3 Deploy + Configure

- [ ] Deploy main app to Cloudflare via OpenNext
- [ ] Deploy Voice Agent Worker: `cd packages/voice-agent && wrangler secret put ANTHROPIC_API_KEY && wrangler secret put DATABASE_URL && wrangler deploy`
- [ ] Set `VOICE_WS_URL` env var on main app (Worker URL, e.g., `https://voice-agent.your-account.workers.dev`)
- [ ] Verify ConversationRelay enabled on Twilio account (check Console &rarr; Voice &rarr; Settings)
- [ ] Pages load: `/login`, `/signup`, `/client-login`
- [ ] Cron trigger: every 5 min, `POST /api/cron`, `Authorization: Bearer CRON_SECRET`
- [ ] Agency number (#5) webhooks pointed at production
- [ ] `operator_phone` and `operator_name` set at `/admin/agency`

### 5.4 GST/Tax

- [ ] Under $30K? Small supplier exemption. Revisit at $30K.

### 5.5 Smoke Test

- [ ] Assign real Alberta number (403/780) to demo client
- [ ] Call it. Text-back in 5 seconds?
- [ ] Text it. AI responds in 10 seconds?
- [ ] Voice AI answers when call goes unanswered? Test with a real call.
- [ ] **All pass? Production is live.**

---

## Phase 6: Start Selling

**Open:** `docs/operations/COLD-START-PLAYBOOK.md` (you read this in Phase 4 &mdash; now execute it)

Also reference: `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` for the broader strategy of landing your first 5 clients.

Both have: day-by-day schedules (designed for a 9-5 job), word-for-word scripts for every channel, follow-up sequences, and objection handling.

### Before first outreach

- [ ] Service agreement filled &mdash; ready as PDF
- [ ] ROI worksheet saved for calls
- [ ] Demo number tested today
- [ ] Voice AI Playground QA passed for demo client &mdash; greeting previewed, KB test green, guardrails passing
- [ ] Prospect list built (80+ contacts)
- [ ] Joined 5 Alberta contractor Facebook Groups
- [ ] Top 3 objection responses memorized
- [ ] Pre-Sale Revenue Leak Audit completed for first 3 prospects
- [ ] Competitive comparison doc reviewed (`docs/business-intel/COMPETITIVE-COMPARISON.md`)
- [ ] Capacity positioning decided: how many contractors per trade per city? (Recommended: 1&ndash;3)

### After they say yes

**Open:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10

**Payment capture (on the call):** After the demo &ldquo;wow moment,&rdquo; click &ldquo;Send Payment Link&rdquo; from the client&apos;s admin detail page. Contractor receives SMS + email with Stripe checkout link. Stay on the line while they enter their card. Script and fallback process in Playbook Section 10, &ldquo;Payment Capture.&rdquo;

Day 0 &rarr; Day 1 &rarr; Week 2 &rarr; Week 3. Onboarding calls on Saturday mornings.

### Daily routine (per client)

1. `/admin/triage` &mdash; who needs attention?
2. `/escalations` &mdash; hot leads?
3. Knowledge gap queue &mdash; AI gaps to fill?
4. `/admin/ai-quality` &mdash; flagged messages?
5. New clients (Week 1): check Voice AI Playground &mdash; any KB gaps from real calls? Run KB Test again after adding answers.
6. Done. 5-10 min/client.
