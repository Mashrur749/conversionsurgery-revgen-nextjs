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

Work through these sections in order. Each test tells you exactly what to click, what to type, and what you should see. If something breaks, fix it before moving on.

> **Deeper reference:** `docs/engineering/01-TESTING-GUIDE.md` has expanded multi-step instructions if you need more detail on any feature. Use the &ldquo;Full System Test Path&rdquo; table at the top to find the right section.

### 2.1 Create Your First Test Client

1. In the admin nav, click **Clients** &rarr; **Clients** &rarr; then click the **+ New Client** button (or use the wizard link)
2. Fill in:
   - Business name: &ldquo;Summit Renovations&rdquo; (or anything)
   - Owner name, email, phone: use your Dev Phone #3 (Owner) number for the phone
   - Twilio number: select Dev Phone #1 (Business Line)
3. Complete the wizard. Click through each step.
4. Click **Clients** &rarr; **Clients** in the nav &mdash; your new client should appear.

- [ ] Client shows in the list with status &ldquo;active&rdquo;

### 2.2 Test the Core Loop: Lead Texts In, AI Responds

This is the product&apos;s core value. A homeowner texts, the AI replies.

1. Open Dev Phone #2 (Lead) in your browser (port 3001)
2. Send a text to the Business Line (#1): &ldquo;Hi, I need a quote for a kitchen renovation&rdquo;
3. Watch your terminal &mdash; you should see webhook logs
4. Within 2-8 seconds, Dev Phone #2 receives an AI response
5. In the admin nav, click **Client View** &rarr; **Conversations** (make sure your test client is selected in the client dropdown)
6. You should see the conversation thread with the lead&apos;s message and the AI&apos;s response

- [ ] AI responded within 10 seconds
- [ ] Conversation visible in admin dashboard

### 2.3 Test Missed Call Text-Back

1. From Dev Phone #2 (Lead), **call** the Business Line (#1)
2. Let it ring &mdash; don&apos;t answer
3. Within 5 seconds, Dev Phone #2 should receive a text: something like &ldquo;Sorry we missed your call...&rdquo;
4. Check **Client View** &rarr; **Conversations** &mdash; a new conversation should appear for this caller

- [ ] Text-back arrived within 5 seconds of the missed call

### 2.4 Test Voice AI

> Skip this section if `ELEVENLABS_API_KEY` is not set or Voice AI is not enabled for your test client.

1. From Dev Phone #2, **call** the Business Line (#1) and let it ring until Voice AI picks up
2. You should hear a voice greeting (ElevenLabs voice)
3. Say: &ldquo;I need help with a bathroom renovation&rdquo; &mdash; AI should respond conversationally
4. Say: &ldquo;I want to speak to someone&rdquo; &mdash; this should trigger a transfer attempt
5. Hang up. Go to **Clients** &rarr; **Clients** &rarr; click your test client &rarr; look for call transcript + AI summary

- [ ] Voice AI answered with a natural greeting
- [ ] Transcript and summary appear in admin after the call

### 2.5 Smart Assist Mode (AI with human review)

This is the safety net for new clients &mdash; AI drafts a response, you approve it before it sends.

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client &rarr; find the AI mode setting
2. Change it to **Smart Assist** (also called &ldquo;assist&rdquo; mode)
3. From Dev Phone #2, text the Business Line: &ldquo;Do you do emergency plumbing?&rdquo;
4. This time the AI should NOT auto-reply. Instead:
5. Go to the client&apos;s **Activity tab** &rarr; look for **Pending Drafts** card
6. You should see the AI&apos;s draft response waiting for approval
7. Click **Approve** to send it
8. Dev Phone #2 should receive the response

- [ ] Draft appeared in Pending Drafts (not auto-sent)
- [ ] After approval, response arrived on Dev Phone #2

> Set the client back to **Autonomous** mode when done.

### 2.6 Lead Lifecycle: Estimate Sent &rarr; Won &rarr; Job Complete

Walk through the full lead journey as the contractor would see it.

1. Click **Client View** &rarr; **Leads** (make sure your test client is selected)
2. Click on the lead you created in 2.2
3. In the status dropdown (top right), change to **Estimate Sent**
   - This starts the 4-touch, 14-day follow-up automation
4. Click **Client View** &rarr; **Scheduled** &mdash; you should see follow-up messages queued
5. Go back to the lead. Change status to **Won**
   - Enter a confirmed revenue amount (e.g., $4,500)
   - Dev Phone #3 (Owner) should receive a &ldquo;recovered lead&rdquo; SMS notification
6. Change status to **Completed**
   - This triggers the review request automation (SMS sent next day at 10am)
7. Click **Client View** &rarr; **Scheduled** &mdash; you should see a review request message queued

- [ ] Follow-up messages scheduled after Estimate Sent
- [ ] Owner notification SMS after Won
- [ ] Review request scheduled after Completed

### 2.7 CSV Lead Import

1. Create a CSV file with columns: `name,phone,email,status`
2. Add 3-5 rows with test data. Set status to `estimate_sent` for at least one.
3. Click **Client View** &rarr; **Leads** &rarr; click **Import**
4. Upload the CSV. Check the **CASL consent** box.
5. Verify leads appear in the list. Leads with `estimate_sent` should have follow-ups scheduled.

- [ ] Leads imported and visible
- [ ] Follow-ups auto-scheduled for estimate_sent leads

### 2.8 Exclusion List (Do Not Contact)

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client &rarr; **Configuration** tab
2. Find the **Exclusion List** card
3. Add a phone number (any test number)
4. Verify it appears in the list
5. Remove it

- [ ] Number added and removed without errors

### 2.9 Reports

1. In your terminal, trigger the report cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
   Replace `YOUR_CRON_SECRET` with the value from your `.env.local`.
2. Click **Reporting** &rarr; **Reports** in the admin nav
3. A report should appear for your test client (may be empty data, that&apos;s fine)

- [ ] Report generated without errors

### 2.10 AI Safety Gate

Run the automated AI safety tests:

```bash
npm run test:ai
```

This runs 29 tests covering safety, quality, and adversarial scenarios. All safety tests must pass before launch.

- [ ] All Safety tests pass (quality tests may have some variance &mdash; that&apos;s OK)

### 2.11 AI Preview

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client
2. Find the **AI Preview** panel
3. Type a question a homeowner might ask: &ldquo;How much does a roof replacement cost?&rdquo;
4. AI should respond based on the client&apos;s knowledge base

- [ ] AI gives a reasonable response (or says it doesn&apos;t have that info &mdash; both are correct)

### 2.12 Voice AI Admin Config

1. Click **Settings** &rarr; **Voice AI** in the admin nav
2. Check that you see:
   - Kill switch banner at top (should show enabled/disabled)
   - Per-client cards with: pricing toggle, max duration, business hours, agent tone badge

- [ ] Voice AI admin page loads with client cards

### 2.13 Voice AI Playground

1. On the Voice AI page (**Settings** &rarr; **Voice AI**), expand your test client
2. Run each tool:
   - **Greeting Preview:** click play &mdash; hear the greeting in the selected voice
   - **Simulator:** type &ldquo;I need an estimate for deck building&rdquo; &mdash; see AI response
   - **KB Test:** runs 10 questions against the knowledge base &mdash; check coverage percentage
   - **Guardrail Test:** runs 8 adversarial inputs &mdash; all should pass
3. Check the **QA Checklist** &mdash; aim for all green

- [ ] QA Checklist all green (or you know why something is yellow/red)

### 2.14 Contractor Portal Experience

Log in as the contractor to see what they see.

1. Open http://localhost:3000/client-login in a new browser tab (or incognito window)
2. Enter the owner email you used when creating the test client
3. Enter the OTP code (check email or terminal logs)
4. You should land on the contractor dashboard showing:
   - Voice AI status card
   - System Activity card
   - Revenue Recovered card (may be empty)
5. Go to **Conversations** &mdash; you should see the test conversations from earlier
6. Find a lead in &ldquo;Won&rdquo; status &mdash; click **Mark Job Complete** button
7. Click **Discussions** &rarr; **Stuck? Text me** &rarr; send a message
8. Switch back to admin: click **Clients** &rarr; **Discussions** &mdash; the thread should appear

- [ ] Contractor dashboard loads with cards
- [ ] Mark Job Complete button works
- [ ] Discussion thread visible in both portal and admin

### 2.15 Payment and Billing

> Skip if `STRIPE_SECRET_KEY` is not set.

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client
2. Click **Send Payment Link**
3. Dev Phone #3 (Owner) should receive SMS with a Stripe checkout link
4. Open the link. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete checkout. Verify 30-day trial starts.
6. Check contractor portal &rarr; **Billing** &mdash; plan and trial countdown should show

- [ ] Payment link SMS received
- [ ] Checkout completed with test card
- [ ] Trial active in contractor billing page

### 2.16 Welcome Communications

1. Open http://localhost:3000/signup in a new browser tab and create a new client (use a different email)
2. Check that email inbox &mdash; welcome email should arrive
3. Check Dev Phone (if you used a real number) &mdash; welcome SMS with login link

- [ ] Welcome email received
- [ ] Welcome SMS received

### 2.17 Google Calendar *(skip if not configured)*

1. Go to contractor portal &rarr; **Settings** &rarr; **Calendar**
2. Click **Connect Google Calendar** &rarr; complete OAuth
3. Create an appointment in the platform
4. Check Google Calendar &mdash; appointment should appear

- [ ] OAuth connected
- [ ] Appointment synced to Google Calendar

### 2.18 Weekly Pipeline SMS

1. Trigger the weekly summary cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
2. Dev Phone #3 (Owner) should receive a Monday pipeline SMS with dollar values

- [ ] Pipeline SMS received with revenue numbers

### Phase 2 done?

You should now understand:
- What happens when a homeowner texts or calls
- How the AI responds (autonomous vs. Smart Assist)
- The lead lifecycle: new &rarr; estimate sent &rarr; won &rarr; completed &rarr; review request
- What the contractor sees in their portal
- How billing works
- How Voice AI sounds and how to QA it

If everything passed, move to Phase 3.

---

## Phase 3: Simulate a Real Client Delivery

You already know the features work (Phase 2). Now practice delivering the service end-to-end &mdash; exactly as you would for a real contractor. Play both roles: operator and contractor. This is where you build the confidence to sell.

> **Have open while working through this:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` &mdash; Section 10 is the onboarding call script you&apos;ll practice.

### 3.1 Day 0: Sign the Client

You&apos;re simulating the moment a contractor says &ldquo;yes.&rdquo;

1. Click **Clients** &rarr; **Clients** &rarr; **+ New Client** (use the wizard)
2. Create &ldquo;Summit Renovations&rdquo; (managed service model)
   - Owner phone: Dev Phone #3
   - Twilio number: Dev Phone #1
3. Open `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` and read through it as if you&apos;re about to send it to Summit Renovations. You need to be comfortable explaining every section on a call.
4. Click **Clients** &rarr; **Clients** &rarr; click Summit Renovations &rarr; click **Send Payment Link**
5. On Dev Phone #3, open the Stripe link. Pay with test card `4242 4242 4242 4242`.
6. Check: welcome email arrived? Welcome SMS with login link?

- [ ] Service agreement reviewed &mdash; I can explain every section
- [ ] Payment captured via Send Payment Link
- [ ] Welcome email + SMS received

### 3.2 Day 1: Practice the Onboarding Call

Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10 (the call script). Then practice it **out loud** &mdash; not silently. You need to hear yourself say these words.

**Step 1: KB Questionnaire**

1. Open the call script (Playbook Section 10)
2. Say the intro out loud: &ldquo;Thanks for signing up, let me walk you through...&rdquo;
3. Click **Clients** &rarr; **Clients** &rarr; click Summit Renovations &rarr; **Knowledge** tab
4. Fill in the knowledge base while &ldquo;asking&rdquo; Summit Renovations:
   - What services do you offer?
   - What&apos;s your service area?
   - What are your hours?
   - What&apos;s your pricing range? (or &ldquo;we provide custom quotes&rdquo;)
   - Any current promotions?

- [ ] KB has at least 5 entries covering the basics

**Step 2: Exclusion List**

Practice this exact phrase out loud: &ldquo;Before we turn anything on &mdash; anyone you want us to skip? Family, close friends, personal numbers that might be in your contacts?&rdquo;

1. Click **Clients** &rarr; **Clients** &rarr; click Summit Renovations &rarr; **Configuration** tab
2. Find **Exclusion List** card &rarr; add 2-3 fake numbers

This is mandatory for every real client. Skipping it means the AI could text a contractor&apos;s wife or best friend.

- [ ] Exclusion list practiced &mdash; I know the script and where to add numbers

**Step 3: Voice AI QA**

Before any real client goes live, you QA their voice AI.

1. Click **Settings** &rarr; **Voice AI** &rarr; expand Summit Renovations
2. **Greeting Preview:** click play &mdash; listen to the greeting. Does it sound right for a renovation company?
3. **KB Test:** run it &mdash; check coverage percentage. If below 70%, add more KB entries.
4. **Guardrail Test:** run 8 adversarial inputs. All should pass.
5. **QA Checklist:** all green?
6. Now call the business number (#1) from your real phone. Experience the &ldquo;wow moment&rdquo; yourself. This is exactly what you&apos;ll demo on a sales call.

- [ ] Voice AI QA all-green
- [ ] Called the number myself and heard the AI answer

**Step 4: Import Leads + Set Expectations**

1. Create a CSV with 10-15 fake leads (names, phone numbers, `status=estimate_sent`)
2. Click **Client View** &rarr; **Leads** &rarr; **Import** &rarr; upload &rarr; check CASL consent box
3. Click **Client View** &rarr; **Scheduled** &mdash; follow-up messages should be queued
4. Practice the expectations script out loud: &ldquo;Week 1: missed call text-back goes live immediately. The AI will handle initial conversations. By week 2, you&apos;ll start seeing the first follow-ups convert.&rdquo;

- [ ] Leads imported, follow-ups scheduled
- [ ] Expectations script practiced out loud

**Step 5: Contractor Portal Onboarding**

1. Open http://localhost:3000/client-login in an incognito window (use Summit&apos;s owner email)
2. In the contractor portal, look for the onboarding wizard &mdash; try the KB questionnaire from the contractor&apos;s perspective
3. Notice: managed clients see a simpler portal (no Flows nav, no Features settings, no Change Plan button)

- [ ] I understand what the contractor sees on their first login

### 3.3 Day 1-2: Revenue Leak Audit

This is the deliverable you give every client within 48 hours. Practice on a real business.

1. Open Google Maps. Search for a real renovation contractor in your area.
2. Open `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md`
3. Fill it out using what you find: their Google reviews, response time, website, and online presence
4. Also practice the **Pre-Sale** version: open `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` and fill it for a different contractor using only public data. This is what you run BEFORE outreach &mdash; no contractor participation needed.

- [ ] Revenue Leak Audit completed for a real business
- [ ] Pre-Sale audit completed for a second business

### 3.4 Week 1-2: Daily Operations

Simulate what your daily routine looks like with an active client.

**Simulate homeowner conversations (10 min):**

1. From Dev Phone #2, text the business number as different &ldquo;homeowners&rdquo;:
   - &ldquo;Hi, do you do bathroom renovations?&rdquo;
   - &ldquo;What&apos;s your availability next week?&rdquo;
   - &ldquo;How much for a deck?&rdquo;
   - &ldquo;Can I book an estimate for next Tuesday?&rdquo; (tests appointment booking)
   - &ldquo;I want to speak to someone about a complaint.&rdquo; (tests escalation)
2. Watch the AI respond to each. Note which responses are good and which need KB improvement.

**Check your daily operator dashboard (5 min):**

3. Click **Clients** &rarr; **Triage** &mdash; does Summit Renovations show as needing attention?
4. Click **Client View** &rarr; **Escalations** &mdash; the &ldquo;complaint&rdquo; text should have created an escalation. Click it. Read the AI&apos;s notes. Click **Resolve** with a note.
5. Click **Optimization** &rarr; **AI Quality** &mdash; any flagged messages? If so, review them.
6. Click **Clients** &rarr; **Clients** &rarr; Summit Renovations &rarr; **Knowledge** tab &rarr; **Queue** sub-tab &mdash; any KB gaps? Add the answer.

**Generate a report:**

7. Trigger the cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
8. Click **Reporting** &rarr; **Reports** &mdash; open the report. Even with fake data, understand the layout: recovered revenue, lead pipeline, AI effectiveness.

**Check the contractor&apos;s view:**

9. Log in as Summit&apos;s contractor (http://localhost:3000/client-login in incognito)
10. Check: Voice AI card, System Activity card, Revenue Recovered card
11. Go to **Billing** &mdash; you should see: current plan (read-only), trial countdown, guarantee status card with progress bar. No &ldquo;Change Plan&rdquo; button (managed client).
12. Switch to admin view &rarr; **Clients** &rarr; **Clients** &rarr; Summit Renovations &rarr; Overview tab &mdash; check guarantee phase, pipeline value, days remaining.

- [ ] I know what the daily operator routine feels like
- [ ] Escalation resolved
- [ ] KB gap filled
- [ ] Report reviewed
- [ ] Contractor portal makes sense from their perspective

### 3.5 Scenario Drills

These WILL happen with real clients. Practice now so you&apos;re not figuring it out live.

> For full playbook detail on each scenario, see `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (section numbers below).

**Lead opts out (Playbook Section 8):**

1. From Dev Phone #2, text **STOP** to the business number
2. Verify: Dev Phone #2 gets a confirmation. The system will never text this number again.
3. Click **Client View** &rarr; **Leads** and check the lead &mdash; status should be `opted_out`
4. Try texting START to re-subscribe
5. **Key learning:** you cannot override an opt-out. This is legally binding. If a contractor says &ldquo;that&apos;s my customer, text them anyway&rdquo; &mdash; the answer is no.

- [ ] I understand opt-out is permanent until the lead re-subscribes

**Contractor wants to pause (Section 6):**

1. Click **Clients** &rarr; **Clients** &rarr; Summit Renovations &rarr; pause the subscription
2. Verify: automations stop. Check **Client View** &rarr; **Scheduled** &mdash; pending messages should not send.
3. Log in as contractor &mdash; they should see the paused state
4. **Key learning:** pause = temporary, automations stop, data stays. Cancel = 30-day grace, then data export.

- [ ] I know the difference between pause and cancel

**DNC vs opt-out (Section 19):**

- **Opt-out:** the lead texted STOP. Legal. Irreversible until they text START. System-enforced.
- **DNC (Exclusion List):** the operator added this number. Operational. Reversible anytime. Prevents the AI from texting someone the contractor doesn&apos;t want contacted (family, friends).

- [ ] I can explain this difference to a contractor

**Review monitoring (Section 13):**

1. Click **Optimization** &rarr; **Reputation**
2. If Google reviews exist, verify: AI drafts a response, contractor can approve/edit in the contractor portal under **Reviews**
3. If no reviews yet, understand the flow: negative review &rarr; operator gets SMS alert &rarr; AI generates draft response &rarr; contractor approves in portal &rarr; posted to Google

- [ ] I understand the review approval flow

### 3.6 Billing Lifecycle

**Trial reminders:**

1. Trigger the trial-reminders cron. Email sends at Day 7/14/25/28/30 milestones. SMS fires on Day 28+.

**Cancellation flow:**

1. Log in as contractor &rarr; `/client/cancel`
2. Select a reason. Click &ldquo;Cancel Anyway.&rdquo;
3. Verify: 30-day grace period is set. Admin shows cancellation status.
4. **Key learning:** the system sends reminders at 20/7/3 days. Data export within 5 business days of grace end. Win-back email 7 days after grace ends.
5. Re-create the subscription after testing (you need Summit active for Phase 4).

- [ ] I understand the full cancellation timeline

### Phase 3 done?

You should now be able to:
- [ ] Walk a contractor through onboarding on a call (KB, exclusion list, Voice QA, expectations)
- [ ] Handle daily operations in 5-10 minutes per client
- [ ] Resolve an escalation
- [ ] Fill a KB gap when the AI can&apos;t answer something
- [ ] Explain what the report shows
- [ ] Handle opt-outs, pauses, and cancellations confidently
- [ ] Deliver a Revenue Leak Audit
- [ ] Capture payment during an onboarding call
- [ ] Explain the difference between DNC and opt-out

If you can check all of those, you&apos;re ready to learn the sales pitch. Move to Phase 4.

---

## Phase 4: Understand the Value + Sales

Phase 3 taught you the product. Phase 4 teaches you to explain and sell it.

### 4.1 Read These Docs (in order)

Do this in two evenings or one focused day (~4.5 hours total).

**Evening 1 &mdash; How to deliver the service (2.5 hours):**

1. `docs/operations/00-OPERATOR-GUIDE.md` (60 min) &mdash; big picture: what the contractor gets, what you do, how the system works
2. `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (60 min) &mdash; all 22 sections: every client scenario, onboarding script, payment capture
3. `docs/operations/01-OPERATIONS-GUIDE.md` (30 min) &mdash; daily ops: what to check, what to fix, cron health

After Evening 1 you should be able to describe the full service delivery without looking at notes.

**Evening 2 &mdash; How to sell it (2 hours):**

4. `docs/business-intel/OFFER-APPROVED-COPY.md` (20 min) &mdash; **approved sales copy**: proposals, emails, website language all come from HERE
5. `docs/operations/COLD-START-PLAYBOOK.md` (30 min) &mdash; day-by-day schedule for getting first clients, word-for-word scripts
6. `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` (30 min) &mdash; &ldquo;too expensive,&rdquo; &ldquo;tried something similar,&rdquo; &ldquo;I get referrals&rdquo;
7. `docs/business-intel/COMPETITIVE-COMPARISON.md` (10 min) &mdash; positioning vs answering services, CRMs, DIY tools
8. `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` (10 min) &mdash; known risks acknowledged before first client
9. `docs/business-intel/VOICE.md` (10 min) &mdash; brand voice: how to write and speak as ConversionSurgery

After Evening 2 you should be able to pitch the service and handle the top 5 objections.

**Bookmark these for sales calls (don&apos;t memorize &mdash; just know where they are):**

- `docs/business-intel/OFFER-APPROVED-COPY.md` &mdash; exact language for proposals and emails
- `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md` &mdash; ROI calculation for calls
- `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` &mdash; fill in YOUR details before first client
- `docs/business-intel/COMPETITIVE-COMPARISON.md` &mdash; comparison table for objection handling
- `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` &mdash; run before every outreach
- `docs/product/ROI-CALCULATOR-GUIDE.md` &mdash; how to use the calculator during calls
- `docs/product/PLATFORM-CAPABILITIES.md` &mdash; when a contractor asks &ldquo;can it do X?&rdquo;

- [ ] Evening 1 reading done
- [ ] Evening 2 reading done
- [ ] Service agreement filled in with my details

### 4.2 Practice Sales Out Loud

Don&apos;t skip this. Reading scripts silently is not the same as saying them. Open `docs/operations/COLD-START-PLAYBOOK.md`.

**The pitch (15 min):**

1. Say the cold call opener 3 times until it feels natural
2. Practice the &ldquo;I&apos;m busy&rdquo; response and voicemail script
3. Practice the close: &ldquo;First month is free. I set everything up. You pay nothing until you see results.&rdquo;
4. Have someone ask you the top 3 objections &mdash; respond without notes

- [ ] I can deliver the opener without reading it

**The demo (20 min):**

5. Open your local environment. Walk through a demo as if a prospect is screen-sharing with you.
6. The &ldquo;wow moment&rdquo;: call the business number. Text-back fires in 5 seconds. If they let it ring, Voice AI answers. Practice saying: &ldquo;Call this number right now.&rdquo;
7. Practice using the Voice AI Simulator during screen-share &mdash; type homeowner questions, show AI responses in real time. This works even without a live Twilio call.

- [ ] I can walk through a live demo confidently

**Pre-outreach prep (30 min):**

8. Pick 3 real contractors from Google Maps
9. For each one, fill out `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md` using only public data (15-20 min each)
10. Run the ROI calculator with 3 profiles: 15 leads/$50K avg, 30 leads/$35K avg, 8 leads/$80K avg. Check that numbers feel credible.
11. Verify `POST /api/public/roi-calculator` returns a valid response (bookmark this for calls)

- [ ] 3 Pre-Sale Revenue Leak Audits completed
- [ ] ROI calculator tested and bookmarked

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

You&apos;ve tested locally and practiced the delivery. Now set up the real environment.

### 5.1 External Services (1 hour total)

Work through each service. Don&apos;t skip &mdash; each one powers a specific part of the product.

**Stripe (30 min) &mdash; this is how you get paid:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a product: &ldquo;ConversionSurgery Managed Service&rdquo;, $1,000/month, 30-day free trial
3. Copy the Price ID (starts with `price_`)
4. Go to Developers &rarr; Webhooks &rarr; Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
5. Select these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `payment_method.attached`
6. Copy the webhook signing secret (starts with `whsec_`)

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_WEBHOOK_SECRET` set in production env

**Email (10 min):**

1. Go to [Resend](https://resend.com) &rarr; API Keys &rarr; create one
2. Verify your sending domain

- [ ] `RESEND_API_KEY` and `EMAIL_FROM` set

**Google Calendar (10 min):**

1. Go to [Google Cloud Console](https://console.cloud.google.com) &rarr; enable Calendar API
2. Create OAuth credentials. Set redirect to: `https://yourdomain.com/api/auth/callback/google-calendar`

- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set

**ElevenLabs (5 min):**

1. Go to [ElevenLabs](https://elevenlabs.io) &rarr; Profile &rarr; API key

- [ ] `ELEVENLABS_API_KEY` set in production env

### 5.2 Production Database

1. Point to your Neon production branch (see `docs/engineering/03-NEON-BRANCH-SETUP.md` if needed)
2. Run in your terminal:
   ```bash
   DATABASE_URL=your_production_string npm run db:migrate
   DATABASE_URL=your_production_string npm run db:seed -- --lean
   ```

- [ ] Migrations applied
- [ ] Seed data loaded (plans, role templates, help articles)

### 5.3 Deploy the App

1. Deploy main app to Cloudflare via OpenNext
2. Deploy Voice Agent Worker:
   ```bash
   cd packages/voice-agent
   wrangler secret put ANTHROPIC_API_KEY
   wrangler secret put DATABASE_URL
   wrangler deploy
   ```
3. Set `VOICE_WS_URL` env var on main app (the Worker URL from step 2)
4. Verify ConversationRelay is enabled: Twilio Console &rarr; Voice &rarr; Settings
5. Set up the cron trigger: every 5 minutes, `POST /api/cron` with `Authorization: Bearer CRON_SECRET`

- [ ] App deployed &mdash; `/login`, `/signup`, `/client-login` all load
- [ ] Voice Agent Worker deployed
- [ ] Cron running every 5 minutes

### 5.4 Configure

1. Log in as admin at `/login`
2. Go to `/admin/agency` (Settings &rarr; Agency Settings) &mdash; set:
   - Agency Twilio number (#5) + SID
   - Your operator phone (real phone for alerts)
   - Your operator name
3. Point agency number (#5) SMS + Voice webhooks at production URL

- [ ] Agency settings configured
- [ ] Webhooks pointed at production

### 5.5 Tax

- [ ] Under $30K annual revenue? Small supplier GST exemption applies. Revisit at $30K.

### 5.6 Smoke Test (5 min &mdash; do this right now)

1. Buy a real Alberta number (403 or 780 area code) in Twilio
2. Assign it to a demo client in the admin
3. **Call it from your real phone.** Text-back in 5 seconds?
4. **Text it from your real phone.** AI responds in 10 seconds?
5. **Let it ring.** Voice AI answers?

- [ ] Text-back works
- [ ] AI responds
- [ ] Voice AI answers
- [ ] **All pass? Production is live.**

---

## Phase 6: Start Selling

Everything before this was preparation. Now you execute.

### 6.1 Final Pre-Outreach Checklist

Before you contact anyone:

- [ ] Service agreement filled with your details &mdash; saved as PDF
- [ ] Demo number tested today (call it, text it, confirm it works)
- [ ] Voice AI Playground QA passed for demo client
- [ ] Prospect list built (80+ contacts &mdash; see Cold Start Playbook)
- [ ] Pre-Sale Revenue Leak Audit completed for first 3 prospects
- [ ] Top 3 objection responses memorized (from `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md`)
- [ ] Competitive comparison reviewed (`docs/business-intel/COMPETITIVE-COMPARISON.md`)

### 6.2 Start Outreach

**Open:** `docs/operations/COLD-START-PLAYBOOK.md` &mdash; follow the day-by-day schedule.

Also reference: `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` for the broader strategy of landing your first 5 clients.

Both docs have: day-by-day schedules (designed around a 9-5 job), word-for-word scripts for every channel, follow-up sequences, and objection handling.

### 6.3 When They Say Yes

**Open:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10

On the call, after the &ldquo;wow moment&rdquo; (they hear the AI answer their phone):

1. Click **Send Payment Link** from the client&apos;s admin detail page
2. Contractor receives SMS + email with Stripe checkout link
3. Stay on the line while they enter their card
4. Once paid: walk them through onboarding (you practiced this in Phase 3)

Timeline: Day 0 (signing) &rarr; Day 1 (onboarding call + KB + Voice QA) &rarr; Week 2 (first report) &rarr; Week 3 (check-in). Saturday mornings work well for onboarding calls.

### 6.4 Daily Routine (5-10 min per client)

This is your entire daily workload per client once they&apos;re onboarded:

1. `/admin/triage` &mdash; who needs attention? (red = act now, yellow = check soon)
2. `/escalations` &mdash; any hot leads the AI couldn&apos;t handle?
3. Knowledge gap queue &mdash; any questions the AI couldn&apos;t answer? Add the answer.
4. `/admin/ai-quality` &mdash; any flagged messages? Review and dismiss or fix.
5. New clients only (Week 1): run Voice AI KB Test again after adding answers from real calls.

That&apos;s it. The system handles everything else.
