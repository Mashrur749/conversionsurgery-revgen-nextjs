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

## Phase 2: Experience the Product End-to-End

One continuous walkthrough covering all three perspectives: homeowner, contractor, and operator. No isolated feature tests &mdash; you are playing out a real client story from first text to guarantee evaluation. Budget about 90 minutes.

> **Deeper reference:** `docs/engineering/01-TESTING-GUIDE.md` has expanded multi-step instructions if you need more detail on any feature. If a specific feature breaks, jump to the Appendix at the bottom of this document.

---

### Step 1 &mdash; Setup (5 min)

1. In the admin nav, click **Clients** &rarr; **Clients** &rarr; **+ New Client** (or use the wizard link)
2. Fill in:
   - Business name: &ldquo;Peak Basements YYC&rdquo;
   - Owner name, email, phone: use your Dev Phone #3 (Owner) number for the phone
   - Twilio number: select Dev Phone #1 (Business Line)
3. Complete the wizard. Click through each step.
4. **Load the basement KB preset:** open `docs/operations/templates/BASEMENT-KB-PRESET.md` and enter the 21 preset entries into the Knowledge Base. Customize the 5 REQUIRED entries (pricing range, warranty, service area, trades, scope exclusions) for your test company. This simulates what you&apos;ll do for every real client.
5. Click **Clients** &rarr; **Clients** in the nav &mdash; your new client should appear.

- [ ] Client shows in the list with status &ldquo;active&rdquo;

---

### Step 2 &mdash; Homeowner Journey: Full Multi-Turn Conversation (20 min)

This is the most important test in the entire checklist. You are playing a real homeowner having a real conversation. Do not send one message and stop &mdash; go all the way through turn 8. After each AI reply, note what changed in the admin before sending the next message.

Open Dev Phone #2 (Lead) in your browser (port 3001). Send each message below to the Business Line (Dev Phone #1). Wait for the AI reply each time.

---

**Turn 1 &mdash; Initial inquiry**

Send exactly:

```
Hi, I&apos;m looking to get my basement finished. About 800 square feet. What would something like that cost?
```

After AI replies &mdash; CHECK in admin (Client View &rarr; Conversations):
- [ ] Conversation thread visible with lead message + AI response
- [ ] AI responded within 10 seconds
- [ ] Lead record created under Client View &rarr; Leads

---

**Turn 2 &mdash; Ask about pricing**

Send exactly:

```
Do you have a ballpark price range? I&apos;ve been getting quotes from a few companies.
```

After AI replies &mdash; CHECK in admin (click the lead):
- [ ] Lead score has changed (AI is updating signals with each turn)
- [ ] Budget signal may have appeared if KB has pricing info

---

**Turn 3 &mdash; Ask about timeline**

Send exactly:

```
How long does a full basement development usually take? We&apos;re hoping to be done before summer.
```

After AI replies &mdash; CHECK in admin:
- [ ] Conversation stage progressed (intent signal rising)

---

**Turn 4 &mdash; Decision-maker detection**

Send exactly:

```
This all sounds good but I&apos;ll need to run it by my wife before we commit to anything.
```

After AI replies &mdash; CHECK in admin (lead detail page):
- [ ] Decision-maker field shows &ldquo;partner involved&rdquo; or equivalent &mdash; this is the AI extracting structured info from conversation
- [ ] The AI response should acknowledge this without pressuring

---

**Turn 5 &mdash; KB knowledge boundary**

Send exactly:

```
Do you handle the permits and inspections, or is that something we need to arrange ourselves?
```

After AI replies &mdash; CHECK in admin:
- [ ] If KB has permit info: AI answered from KB, no hallucination
- [ ] If KB does not have permit info: AI said it doesn&apos;t have that specific detail and offered to connect them &mdash; this is correct behavior, not a failure

---

**Turn 6 &mdash; Objection: quote seems high**

Send exactly:

```
I got another quote that was quite a bit lower. Your pricing seems high compared to what I&apos;ve seen.
```

After AI replies &mdash; CHECK in admin:
- [ ] Objection signal detected &mdash; lead score may shift
- [ ] An escalation should appear under Client View &rarr; Escalations (price-sensitivity flag)
- [ ] AI response defends value without matching competitor price &mdash; guardrail working

---

**Turn 7 &mdash; Booking intent**

Send exactly:

```
Actually my wife is on board. When can we meet for an estimate? We&apos;re free most evenings this week.
```

After AI replies &mdash; CHECK in admin:
- [ ] Booking attempt registered &mdash; bookingAttempts counter in lead state
- [ ] Lead stage badge should advance (AI detected appointment intent)
- [ ] AI response should offer times or ask for availability

---

**Turn 8 &mdash; Appointment confirmation**

Send exactly:

```
Thursday at 6pm works great. See you then.
```

After AI replies &mdash; CHECK in admin:
- [ ] Appointment record created under the lead (if calendar is configured) or conversation reflects confirmed meeting
- [ ] Lead shows appointment status in the timeline

---

**Verify the full conversation in admin:**

- [ ] Lead detail page shows: stage badge reflecting conversation progression
- [ ] Lead score badge has changed from initial value
- [ ] Decision-maker field populated from Turn 4
- [ ] Escalation from Turn 6 appears in Client View &rarr; Escalations
- [ ] Conversation history shows all 8 turns in correct order

---

### Step 3 &mdash; After-Hours Lead + Quiet Hours (5 min)

This tests the inbound-reply exemption (FM-38): a key selling point. &ldquo;Your competitor&apos;s leads text at 10pm and get nothing until 9am. Yours get an answer in 30 seconds. Who do you think they call back?&rdquo;

1. Set your test client&apos;s timezone so that the current local time falls inside quiet hours (9pm&ndash;10am).
2. From Dev Phone #2, text the Business Line: &ldquo;Hi, I saw your ad. Looking to finish my basement. Do you have availability this month?&rdquo;
3. Verify: AI responds IMMEDIATELY &mdash; not queued until morning. This is the inbound-reply exemption. Direct replies to inbound contacts bypass quiet hours.
4. Now trigger a proactive automation (e.g., estimate follow-up via curl &mdash; see Appendix 2.6). Verify: the proactive message IS queued until morning, not sent immediately. Only direct inbound replies bypass quiet hours.

- [ ] After-hours inbound reply arrived immediately
- [ ] Proactive automation respected quiet hours (queued, not sent)
- [ ] I can explain this distinction in one sentence on a sales call

---

### Step 4 &mdash; Missed Call + Voice AI (5 min)

**Missed call text-back:**

1. From Dev Phone #2 (Lead), **call** the Business Line (#1)
2. Let it ring &mdash; do not answer
3. Within 5 seconds, Dev Phone #2 should receive a text: &ldquo;Sorry we missed your call...&rdquo;
4. Check Client View &rarr; Conversations &mdash; a new conversation should appear for this caller

- [ ] Text-back arrived within 5 seconds of the missed call
- [ ] Conversation appears in admin

**Voice AI (skip if `ELEVENLABS_API_KEY` is not set):**

5. From Dev Phone #2, **call** the Business Line (#1) again and let Voice AI pick up
6. You should hear a voice greeting (ElevenLabs voice)
7. Say: &ldquo;I&apos;m looking to finish my basement &mdash; about 1,000 square feet&rdquo; &mdash; AI should respond using KB preset data
8. Say: &ldquo;I want to speak to someone&rdquo; &mdash; this should trigger a transfer attempt
9. Hang up. Go to Clients &rarr; Clients &rarr; click your test client &rarr; look for call transcript + AI summary

- [ ] Voice AI answered with a natural greeting
- [ ] Transcript and summary appear in admin after the call

---

### Step 5 &mdash; Smart Assist Mode (5 min)

This is the safety net for new clients &mdash; AI drafts a response, you approve it before it sends.

1. Go to Clients &rarr; Clients &rarr; click your test client &rarr; find the AI mode setting
2. Change it to **Smart Assist** (also called &ldquo;assist&rdquo; mode)
3. From Dev Phone #2, text the Business Line: &ldquo;Do you do emergency plumbing?&rdquo;
4. The AI should NOT auto-reply. Instead, go to the client&apos;s **Campaigns** tab &rarr; look for the **Pending Drafts** card
5. You should see the AI&apos;s draft response waiting for approval
6. Click **Approve** to send it
7. Dev Phone #2 should receive the response

- [ ] Draft appeared in Pending Drafts (not auto-sent)
- [ ] After approval, response arrived on Dev Phone #2

> Set the client back to **Autonomous** mode before continuing.

---

### Step 6 &mdash; Contractor Perspective (15 min)

Switch roles: you are now the contractor (the person using the portal day to day).

**Log in:**

1. Open http://localhost:3000/client-login in a new incognito window
2. Enter the owner email you used when creating the test client
3. Enter the OTP code (check email or terminal logs)
4. You should land on the contractor dashboard showing:
   - Voice AI status card
   - Setup card (if phone/billing not configured) or AI Setup card (if KB is sparse)
   - System Activity card (always visible &mdash; shows probable pipeline, leads engaged, missed calls caught)
   - Jobs We Helped Win card (the single confirmed-revenue card &mdash; may show $0 with no won jobs yet)
   - Account Manager card (shows when operator phone is configured)

- [ ] Contractor dashboard loads with all cards visible
- [ ] Conversations page shows the test conversations from Step 2

**Daily digest + reply flow:**

5. Trigger the daily-digest cron from your terminal:
   ```bash
   curl -X GET http://localhost:3000/api/cron/daily-digest -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
6. On Dev Phone #3 (contractor phone), read the digest SMS. Note the format: numbered items, reply syntax (W1/L1 for won/lost, free text for KB answers).
7. Reply `W1` to mark the first item won. Verify in admin: lead status changed to `won`.
8. If there&apos;s a KB gap item in the digest, reply with a plain text answer. Verify in admin: KB entry created.
9. Reply `0` to skip remaining items. Verify: no errors.

- [ ] Digest SMS received on contractor phone
- [ ] Replied W/L and outcome reflected in admin
- [ ] Replied with KB answer and entry appeared

**SMS commands from the contractor&apos;s phone:**

10. From Dev Phone #3, text the Business Line (Dev Phone #1):
    - `EST Sarah` &mdash; verify estimate follow-up starts for a lead named Sarah
    - `WON 1` (or the ref code from your digest) &mdash; verify lead marked won, revenue logged
    - `LOST 2` &mdash; verify lead marked lost, sequences cancelled
    - `WINS` &mdash; verify list of pending leads with ref codes

- [ ] EST command starts follow-up
- [ ] WON, LOST commands update lead status
- [ ] WINS returns pending leads list
- [ ] I can explain each command to a contractor in 10 seconds

**Portal pages:**

11. In the contractor portal, check:
    - **Settings** &rarr; Billing: plan, trial countdown, guarantee status card
    - **Reviews**: any pending AI-drafted responses?
    - **Conversations**: threads from Step 2

- [ ] Billing page shows plan and trial countdown
- [ ] Guarantee status card visible in Settings &rarr; Billing

---

### Step 7 &mdash; Appointment Follow-Up Trigger (5 min)

This is the platform&apos;s most valuable automation: post-estimate follow-up that fires automatically without the contractor doing anything.

&ldquo;Every estimate you give at an appointment &mdash; the system automatically follows up with the homeowner at Day 5, 8, 13, and 17. You don&apos;t have to remember, text, or do anything. It just happens.&rdquo;

1. In admin, create a test appointment for the Step 2 lead. Set the date to 4 days ago and status &ldquo;completed.&rdquo;
2. Trigger the appointment-followup cron:
   ```bash
   curl -X GET http://localhost:3000/api/cron/appointment-followup -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
3. Verify: lead status changed to `estimate_sent`. Check Client View &rarr; Scheduled &mdash; estimate follow-up messages should be queued at Day 2/5/10/14 from trigger.

- [ ] Lead status auto-set to estimate_sent (no manual action)
- [ ] Follow-up sequence scheduled in Client View &rarr; Scheduled
- [ ] I can explain this to a contractor without using technical language

---

### Step 8 &mdash; Operator Dashboard (10 min)

Switch roles: you are now the operator managing the account.

**Triage &mdash; engagement signals:**

1. Click **Clients** &rarr; **Triage** &mdash; does Peak Basements YYC appear? What color?
2. Understand the 6 signals: estimate recency, WON/LOST recency, KB gap response rate, nudge response rate, contractor contact, lead volume trend.
3. A client is flagged when 4 of 6 signals are yellow or red. During Calgary winters, expect seasonal yellow &mdash; the key question is whether the contractor is still responding to prompts.

- [ ] I can read the 6 engagement signals and know what each means
- [ ] I understand green/yellow/red for each

**Escalation from Step 2 Turn 6:**

4. Click **Client View** &rarr; **Escalations** &mdash; the &ldquo;quote seems high&rdquo; message from Turn 6 should have created an escalation.
5. Click it. Read the AI&apos;s notes. Click **Resolve** with a note.

- [ ] Escalation resolved

**KB gaps:**

6. Click **Clients** &rarr; **Clients** &rarr; Peak Basements YYC &rarr; **Knowledge Base** (page link) &rarr; **Gap Queue** tab
7. If any gaps appeared from the conversation (the permit question in Turn 5 is a likely candidate), add the answer.

- [ ] KB gap reviewed and filled (if any)

**Reports:**

8. Trigger the report cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
9. Click **Reporting** &rarr; **Reports** &mdash; open the report. Even with test data, understand the layout: recovered revenue, lead pipeline, AI effectiveness, ROI summary.

- [ ] Report generated without errors
- [ ] I understand the report layout: what each section shows

**Health check:**

10. Run:
    ```bash
    curl http://localhost:3000/api/health
    ```
    Verify: 200 OK response.

- [ ] Health endpoint returns 200 OK

**Capacity overview:**

11. Click `/admin/triage` &mdash; note the raw metrics at the top: client count, open escalations, KB gaps. This is your daily 30-second check.

- [ ] I know what to look at in /admin/triage every morning

---

### Step 9 &mdash; Billing Lifecycle (5 min)

> Skip if `STRIPE_SECRET_KEY` is not set.

1. In admin, click **Clients** &rarr; **Clients** &rarr; click your test client &rarr; click **Send Payment Link**
2. Dev Phone #3 (Owner) should receive an SMS with a Stripe checkout link
3. Open the link. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC. Verify Terms of Service checkbox appears on checkout page.
4. Complete checkout. Verify: 30-day trial starts.
5. Check welcome email and welcome SMS (Dev Phone #3).
6. In contractor portal &rarr; **Settings** &rarr; Billing &mdash; plan and trial countdown should show.

- [ ] Payment link SMS received on contractor phone
- [ ] Checkout completed with test card and ToS accepted
- [ ] Welcome email received
- [ ] Welcome SMS received
- [ ] Trial active in contractor billing page (Settings &rarr; Billing)

---

### Step 10 &mdash; Edge Cases (10 min)

These WILL happen with real clients. Practice now so you are not figuring it out live.

**Opt-out and re-subscribe:**

1. From Dev Phone #2, text **STOP** to the Business Line
2. Verify: Dev Phone #2 gets a confirmation. Status shows `opted_out` in Client View &rarr; Leads.
3. Text **START** from Dev Phone #2 to re-subscribe.
4. **Key learning:** you cannot override an opt-out. This is legally binding. If a contractor says &ldquo;that&apos;s my customer, text them anyway&rdquo; &mdash; the answer is no.

- [ ] I understand opt-out is permanent until the lead re-subscribes

**Exclusion list (DNC):**

5. Go to Clients &rarr; Clients &rarr; click your test client &rarr; **Configuration** tab &rarr; **Exclusion List** card
6. Add a phone number (any test number)
7. Verify it appears in the list
8. Remove it
9. **Key learning &mdash; DNC vs opt-out:** Opt-out = the lead texted STOP. Legal, irreversible until they text START. DNC = operator added this number. Operational, reversible anytime. Prevents AI from texting someone the contractor doesn&apos;t want contacted (family, friends).

- [ ] Number added and removed without errors
- [ ] I can explain DNC vs opt-out to a contractor

**Pause and resume:**

10. Click Clients &rarr; Clients &rarr; Peak Basements YYC &rarr; pause the subscription
11. Verify: automations stop. Check Client View &rarr; Scheduled &mdash; pending messages should not send.
12. Log in as contractor &mdash; they should see the paused state.
13. Resume the subscription.
14. **Key learning:** pause = temporary, automations stop, data stays. Cancel = 30-day grace, then data export.

- [ ] Pause and resume work correctly
- [ ] I know the difference between pause and cancel

**Cancellation flow:**

15. Log in as contractor &rarr; `/client/cancel`
16. Select a reason. Click &ldquo;Cancel Anyway.&rdquo;
17. Verify: 30-day grace period is set. Admin shows cancellation status.
18. **Key learning:** system sends reminders at 20/7/3 days. Data export within 5 business days of grace end. Win-back email 7 days after grace ends.
19. Re-create the subscription after testing (you need the client active for Phase 3).

- [ ] I understand the full cancellation timeline

---

### Step 11 &mdash; Guarantee Evaluation (5 min)

On a sales call, contractors will ask: &ldquo;What happens at 90 days?&rdquo; You need to walk through this confidently.

1. Open `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 5.
2. In admin, click Clients &rarr; Clients &rarr; Peak Basements YYC &rarr; Overview tab &rarr; look for the **Guarantee Status** card.
3. Note: the phase (`proof_pending` / `recovery_pending`), progress bar, days remaining.
4. Understand: proof_pending = system is building evidence of pipeline value. recovery_pending = $5K pipeline threshold was not met, recovery window is open.
5. Know where to find pipeline value: Overview tab, the guarantee card shows the running total.

- [ ] I can find the guarantee card and read the phase
- [ ] I know the $5,000 pipeline floor threshold
- [ ] I can explain proof_pending vs recovery_pending in plain language
- [ ] I know where to find the pipeline value number

---

### Phase 2 Completion Checklist

You should now be able to do all of the following without looking at this document:

**The core product:**
- [ ] Explain what happens when a homeowner texts or calls (within 10 seconds, at any hour)
- [ ] Describe the difference between autonomous mode and Smart Assist mode
- [ ] Describe the lead lifecycle: new &rarr; estimate sent &rarr; won &rarr; completed &rarr; review request
- [ ] Explain what the appointment follow-up automation does and why contractors love it
- [ ] Explain the inbound-reply quiet-hours exemption in one sentence

**AI quality:**
- [ ] Describe what the AI does when it doesn&apos;t know something (says so, offers to connect)
- [ ] Describe what happens when a homeowner raises a price objection (AI defends value, creates escalation)
- [ ] Explain what a KB gap is and how to fill one
- [ ] Explain what the escalation queue is and when it fires

**Contractor perspective:**
- [ ] Walk through the contractor dashboard and name each card
- [ ] Explain the daily digest: format, reply syntax, what happens if ignored 3+ times
- [ ] Demonstrate all 4 SMS commands: EST, WON, LOST, WINS
- [ ] Show where the billing page is (Settings &rarr; Billing) and what it shows
- [ ] Show where to find the guarantee status card

**Operator perspective:**
- [ ] Read engagement signals and identify a flagged client
- [ ] Resolve an escalation with a note
- [ ] Fill a KB gap from the Gap Queue tab
- [ ] Open a report and explain what each section means
- [ ] Run the health check and know what 200 OK means

**Edge cases:**
- [ ] Handle an opt-out correctly (legally binding, cannot override)
- [ ] Add and remove a number from the exclusion list
- [ ] Pause and resume a client subscription
- [ ] Navigate the cancellation flow and explain the 30-day grace period
- [ ] Find the guarantee status card and explain proof_pending vs recovery_pending

**Run the AI safety gate:**

```bash
npm run test:ai
```

- [ ] All Safety tests pass (quality tests may have some variance &mdash; that&apos;s acceptable)

If everything passed, move to Phase 3.

---

## Phase 3: Practice Your Scripts

Phase 2 taught you the product. Phase 3 is where you learn to deliver and sell it. You must say these scripts out loud &mdash; reading them silently does not count.

### 3.1 Read These Docs (in order)

Do this in two evenings or one focused day (~4.5 hours total).

**Evening 1 &mdash; How to deliver the service (2.5 hours):**

1. `docs/operations/00-OPERATOR-GUIDE.md` (60 min) &mdash; big picture: what the contractor gets, what you do, how the system works
2. `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` (60 min) &mdash; all 22 sections: every client scenario, onboarding script, payment capture
3. `docs/operations/01-OPERATIONS-GUIDE.md` (30 min) &mdash; daily ops: what to check, what to fix, cron health

After Evening 1 you should be able to describe the full service delivery without looking at notes.

**Evening 2 &mdash; How to sell it (2 hours):**

4. `docs/business-intel/ICP-DEFINITION.md` (10 min) &mdash; **your target buyer**: Calgary basement development contractors. Memorize the 30-second qualifier.
5. `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` (30 min) &mdash; **your complete sales toolkit**: cold call script with guardrails, DM templates, instant demo flow, 10 objection handlers, leave-behind one-pager, practice call guide. This is your primary sales doc.
6. `docs/business-intel/OFFER-APPROVED-COPY.md` (20 min) &mdash; approved sales copy for proposals and emails
7. `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` (20 min) &mdash; broader strategy for landing first 5 clients
8. `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md` (20 min) &mdash; deep-dive objection handling
9. `docs/legal/03-RISK-ACCEPTANCE-PRE-5-CLIENTS.md` (10 min) &mdash; known risks acknowledged before first client
10. `docs/operations/templates/CS-PLUS-YOUR-TOOL.md` (5 min) &mdash; how to position CS alongside Jobber/BuilderTrend/etc.

After Evening 2 you should be able to pitch the service and handle the top 5 objections.

**Bookmark these for sales calls (don&apos;t memorize &mdash; just know where they are):**

- `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` &mdash; **your primary sales doc**: scripts, objections, demo flow, leave-behind
- `docs/operations/templates/BASEMENT-REVENUE-LEAK-AUDIT.md` &mdash; run before every demo call
- `docs/business-intel/ICP-DEFINITION.md` &mdash; your target buyer definition + 30-second qualifier
- `docs/business-intel/OFFER-APPROVED-COPY.md` &mdash; exact language for proposals and emails
- `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` &mdash; fill in YOUR details before first client
- `docs/operations/templates/CS-PLUS-YOUR-TOOL.md` &mdash; positioning when they use Jobber/BuilderTrend
- `docs/product/ROI-CALCULATOR-GUIDE.md` &mdash; how to use the calculator during calls
- `docs/product/PLATFORM-CAPABILITIES.md` &mdash; when a contractor asks &ldquo;can it do X?&rdquo;

- [ ] Evening 1 reading done
- [ ] Evening 2 reading done
- [ ] Service agreement filled in with my details

---

### 3.2 Practice Scripts Out Loud

Open `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` and `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md`. Practice each script out loud &mdash; not silently.

**Close flow (Day 0) &mdash; 20 min:**

Say these out loud as if you are on the call with a contractor who just said yes.

1. &ldquo;Awesome. Let&apos;s get you set up.&rdquo;
2. Walk through the 5 key terms (say them out loud):
   - First month free
   - Month-to-month, cancel anytime with 30 days notice
   - 90-day guarantee
   - Your data is yours, full export if you leave
   - $1,000/month flat, no hidden fees
3. &ldquo;I&apos;m sending you the payment link now. The full terms are on the checkout page.&rdquo;
4. (Send payment link &mdash; from admin client detail page &rarr; Send Payment Link)
5. &ldquo;Perfect, I can see that went through. Your free month starts today. Billing kicks in on [date]. Sound good?&rdquo;
6. &ldquo;Now let&apos;s get you live. I need 30 minutes with you to set up your business number and train the AI on your business. What works &mdash; [time options]?&rdquo;
7. &ldquo;Here&apos;s what happens next. On our onboarding call I&apos;ll set up your business number, train the AI with your services, and import your old quotes so we can start following up immediately. You&apos;ll start catching leads the same day.&rdquo;
8. Practice the welcome text: &ldquo;Hey [Name], welcome to ConversionSurgery. Your free month starts today. Onboarding call: [day] at [time]. Before that call, think of 5 people you quoted in the last 6 months that never got back to you &mdash; just first names and what the project was. Talk soon. &mdash; Mashrur&rdquo;

- [ ] Close script practiced out loud &mdash; I can say the 5 key terms without reading
- [ ] Post-close script practiced &mdash; I can book the onboarding call naturally

**Onboarding call (Day 1) &mdash; 20 min:**

Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10, then say it out loud.

1. Intro: &ldquo;Thanks for signing up, let me walk you through what happens today...&rdquo;
2. KB questionnaire: what services, service area, hours, pricing range, promotions
3. Exclusion list script: &ldquo;Before we turn anything on &mdash; anyone you want us to skip? Family, close friends, personal numbers that might be in your contacts?&rdquo;
4. Voice AI QA: greeting preview, KB test, guardrail test &mdash; QA checklist all green
5. Import leads: CSV with estimate_sent leads, verify follow-ups scheduled
6. Expectations: &ldquo;Week 1: missed call text-back goes live immediately. The AI will handle initial conversations. By week 2, you&apos;ll start seeing the first follow-ups convert.&rdquo;
7. EST walkthrough: &ldquo;When you send an estimate, text EST [name] to your business number. That starts the follow-up.&rdquo;

- [ ] Onboarding call flow practiced out loud &mdash; I can run it without reading the script
- [ ] I know where to add excluded contacts (Configuration tab &rarr; Exclusion List card)
- [ ] I know how to run Voice AI QA (Settings &rarr; Voice AI &rarr; expand client &rarr; Greeting Preview / KB Test / Guardrail Test)

**Quote Import Call (Day 2&ndash;3) &mdash; 10 min:**

1. Pre-call SMS: &ldquo;One more thing before our next quick call &mdash; think of 5 people you gave a quote to in the last 6 months that never got back to you. Just first name and what the project was.&rdquo;
2. Simulate the call: they read 5 names, you type them into a CSV, import via Client View &rarr; Leads &rarr; Import with `status=estimate_sent`
3. Verify follow-up sequences are scheduled
4. Post-import text: &ldquo;Just sent follow-ups to 5 of your old quotes. You&apos;ll start seeing replies within 24-48 hours.&rdquo;

- [ ] Quote Import Call script practiced out loud
- [ ] Old quotes imported and follow-ups firing

**Day 7 check-in &mdash; 10 min:**

1. &ldquo;Hey [Name], quick check-in. Let me show you what the system did this week.&rdquo;
2. Open Client View &rarr; Leads &mdash; note leads in, responses, conversions.
3. &ldquo;You had X leads come in. We responded to all of them in under 10 seconds. Y of your old quotes replied.&rdquo;
4. EST reinforcement: &ldquo;Quick reminder &mdash; when you send an estimate, text EST [name] to your business number. That starts the follow-up.&rdquo;
5. WON/LOST intro: &ldquo;And when a job closes, text WON [name] so we can track your results for the guarantee.&rdquo;
6. Book next check-in: &ldquo;Let&apos;s do a 30-minute strategy call in two weeks. I&apos;ll walk you through a full report with your numbers.&rdquo;

- [ ] Day 7 check-in practiced out loud
- [ ] I know where to find the data to walk through

**Bi-weekly strategy call &mdash; 15 min:**

Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 4, then practice out loud with 2 weeks of test data.

1. **Revenue capture (5 min):** &ldquo;Let&apos;s go through your recent leads. Sarah T. had an appointment 2 weeks ago. Did you close that one?&rdquo; Enter WON in admin.
2. **Report walkthrough (10 min):** leads captured, response time, appointments, reviews, pipeline.
3. **Action items (5 min):** &ldquo;I see 3 estimates went out but only 1 triggered follow-up. Let&apos;s make sure we catch all of them.&rdquo;
4. **Business challenges (5 min):** &ldquo;Anything going on in the business I should know about?&rdquo;
5. **Close (5 min):** &ldquo;You recovered $X this cycle. One more basement like Sarah&apos;s covers the whole year.&rdquo;

- [ ] Strategy call flow practiced out loud
- [ ] I can walk through the report and capture revenue data naturally

**Day 80 guarantee conversation &mdash; 10 min:**

Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 5 first.

Practice each of these out loud:

*If pipeline is below threshold with 10 days left:*

&ldquo;Hey [Name], I&apos;m looking at your numbers and we&apos;re at $3,200 pipeline against the $5,000 threshold with 10 days left. Here&apos;s what I want to try &mdash; let&apos;s import any quotes you&apos;ve sent in the last 2 months that haven&apos;t closed yet. The system will follow up automatically.&rdquo;

*If guarantee was met:*

&ldquo;Great news &mdash; your 90-day guarantee passed. The system booked 2 appointments from old leads and built $8,400 in pipeline. That&apos;s $8,400 in revenue you weren&apos;t going to see without this.&rdquo;

*If guarantee failed:*

&ldquo;I want to be upfront &mdash; we didn&apos;t hit the $5,000 pipeline target. Your most recent month is refunded. Here&apos;s what I think happened: [diagnosis]. I&apos;d like to offer [extension/fix]. But if you&apos;d rather part ways, you keep every lead and conversation we captured.&rdquo;

*Attribution question (they ask: &ldquo;How do you know the system helped close that?&rdquo;):*

&ldquo;Every lead interaction is logged with timestamps. If the system captured the lead and sent at least one automated message before you closed the deal, that&apos;s system-attributed. You can see every message in your dashboard. If the logs don&apos;t show system engagement, we don&apos;t count it &mdash; and we honor the refund.&rdquo;

- [ ] I can handle the Day 80 intervention conversation
- [ ] I can explain attribution without jargon
- [ ] I can have the guarantee-failed conversation honestly

**At-risk client intervention &mdash; 5 min:**

&ldquo;Hey [Name], I noticed you haven&apos;t been responding to the digest the last couple weeks. Everything okay? Want me to adjust anything about how the system works for you?&rdquo;

- [ ] I can read the 6 engagement signals and know what each means
- [ ] I know the difference between seasonal yellow and disengagement red
- [ ] I can explain at-risk status in plain language

**Cold call pitch &mdash; 20 min:**

Open `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` Section 1 and Section 6 (Practice Call Guide).

1. Read the script out loud 5 times. Record yourself. Listen back.
2. Practice ALL 6 cold call branches: engage, send me something, not interested, what does it cost, too busy, awkward silence.
3. Practice the close: &ldquo;First month is free. I set everything up. You pay nothing until you see results.&rdquo;
4. Have someone play the contractor using these 5 responses: (a) &ldquo;yeah tell me more&rdquo; (b) &ldquo;not interested&rdquo; (c) &ldquo;what does it cost?&rdquo; (d) &ldquo;I&apos;m busy&rdquo; (e) awkward silence
5. Your first 3 REAL calls are practice calls &mdash; pick the 3 lowest-priority prospects on your list.

- [ ] I can deliver the opener without reading it
- [ ] I can handle the 5 contractor responses naturally

**Live demo &mdash; 10 min:**

1. Open your local environment. Walk through a demo as if a prospect is screen-sharing with you.
2. The &ldquo;wow moment&rdquo;: &ldquo;Call this number right now.&rdquo; Text-back fires in 5 seconds. Voice AI answers.
3. Use the Voice AI Simulator (Settings &rarr; Voice AI &rarr; expand client &rarr; Simulator) &mdash; type homeowner questions, show AI responses in real time. Works even without a live Twilio call.

- [ ] I can walk through a live demo confidently

---

### 3.3 Revenue Leak Audit for 3 Real Contractors

This is the deliverable you give every client within 48 hours. Practice on real businesses.

1. Open Google Maps. Search &ldquo;basement development Calgary&rdquo; &mdash; pick a real basement contractor.
2. Open `docs/operations/templates/BASEMENT-REVENUE-LEAK-AUDIT.md` (the basement-specific audit template)
3. Follow the 5-step research checklist (10-15 min). Fill in every section: Google reviews vs competitors, estimated response time, secondary suite listing, follow-up gap estimate, missed call revenue.
4. Do this for 3 different real basement contractors. By the third one, you&apos;ll be fast. These become your first 3 outreach targets.
5. Run the ROI calculator with 3 basement profiles: 15 leads/$60K avg, 25 leads/$50K avg, 12 leads/$90K avg (suite specialist). Verify: `POST /api/public/roi-calculator` returns a valid response.

- [ ] Revenue Leak Audit completed for 3 real Calgary basement contractors
- [ ] I can complete one in under 15 minutes
- [ ] ROI calculator tested and bookmarked

---

### 3.4 Self-Test (answer ALL without looking)

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
- [ ] Where do you see the guarantee progress? (Overview tab &rarr; Guarantee Status card, and a progress indicator on the contractor dashboard when in proof or recovery window)
- [ ] Where do you review pending AI drafts from the browser? (Campaigns tab &rarr; Pending Drafts card)
- [ ] Where do contractors view past reports? (Contractor portal &rarr; Reports page in the nav)
- [ ] What cards always appear on the contractor dashboard? (Voice AI status, System Activity, Jobs We Helped Win &mdash; plus conditional: Setup card, AI Setup card, Guarantee indicator, Account Manager, Revenue Leak Audit)
- [ ] How do you access the Knowledge Base for a client? (Client detail page &rarr; Knowledge Base link, opens a separate page with Guided Interview / All Entries / Gap Queue tabs and a side-by-side AI test chat)
- [ ] What does the Monday activity digest show? (Activity summary: new leads, appointments, follow-ups, won jobs. Cadence adapts: weekly/biweekly/monthly based on activity level.)
- [ ] What is the $5,000 pipeline floor guarantee?
- [ ] How does the Jobber integration work? (appointment sync + review trigger)
- [ ] How do you QA a client&apos;s voice AI before going live? (Voice AI Playground: greeting preview, simulator, KB test, guardrail test, QA checklist)
- [ ] How do you capture payment during the onboarding call? (Send Payment Link from admin client detail page)
- [ ] What does the managed contractor see vs. the self-serve contractor? (Managed: no Flows, no Features tab, no plan picker)
- [ ] When does the AI advance from assist to autonomous? (Day 14, if no AI quality flags in past 7 days)
- [ ] What trial reminder emails fire, and when? (Day 7, 14, 25, 28+SMS, 30+SMS)
- [ ] What happens when a client cancels? (30-day grace, reminders at 20/7/3 days, data export within 5 business days, win-back email 7 days after grace ends)
- [ ] What does the AI do when a homeowner mentions their spouse? (Detects decision-maker, populates decision-maker field on the lead, adjusts conversation to acknowledge the partner&apos;s role without pressuring)
- [ ] How does the appointment follow-up work? (Cron checks appointments completed 4+ days ago, sets lead to estimate_sent, schedules follow-up sequence at Day 2/5/10/14 &mdash; no contractor action required)

**All 30 answered? You&apos;re ready.**

---

## Phase 4: Deploy to Production

You&apos;ve tested locally and practiced the delivery. Now set up the real environment.

### 4.1 External Services (1 hour total)

Work through each service. Don&apos;t skip &mdash; each one powers a specific part of the product.

**Stripe (30 min) &mdash; this is how you get paid:**

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Create a product: &ldquo;ConversionSurgery Managed Service&rdquo;, $1,000/month, 30-day free trial
3. Copy the Price ID (starts with `price_`)
4. Go to Developers &rarr; Webhooks &rarr; Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
5. Select these events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `customer.subscription.paused`, `customer.subscription.resumed`, `customer.subscription.trial_will_end`, `payment_method.attached`
6. Copy the webhook signing secret (starts with `whsec_`)

- [ ] `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MANAGED_MONTHLY`, `STRIPE_WEBHOOK_SECRET` set in production env

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

### 4.2 Production Database

1. Point to your Neon production branch (see `docs/engineering/03-NEON-BRANCH-SETUP.md` if needed)
2. Run in your terminal:
   ```bash
   DATABASE_URL=your_production_string npm run db:migrate
   DATABASE_URL=your_production_string npm run db:seed -- --lean
   ```

- [ ] Migrations applied
- [ ] Seed data loaded (plans, role templates, help articles)

### 4.3 Deploy the App

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
6. Configure external health monitor (Cloudflare Health Checks, BetterUptime, or equivalent) to `GET /api/health` every 5 minutes. Alert when HTTP status is not 200.

- [ ] App deployed &mdash; `/login`, `/signup`, `/client-login` all load
- [ ] Voice Agent Worker deployed
- [ ] Cron running every 5 minutes
- [ ] External health monitor pinging `/api/health` every 5 minutes

### 4.4 Configure

1. Log in as admin at `/login`
2. Go to `/admin/agency` (Settings &rarr; Agency Settings) &mdash; set:
   - Agency Twilio number (#5) + SID
   - Your operator phone (real phone for alerts)
   - Your operator name
3. Point agency number (#5) SMS + Voice webhooks at production URL

- [ ] Agency settings configured
- [ ] Webhooks pointed at production

### 4.5 Tax

- [ ] Under $30K annual revenue? Small supplier GST exemption applies. Revisit at $30K.

### 4.6 Smoke Test (5 min &mdash; do this right now)

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

## Phase 5: Start Selling

Everything before this was preparation. Now you execute.

### 5.1 Final Pre-Outreach Checklist

Before you contact anyone:

- [ ] Service agreement filled with your details &mdash; saved as PDF
- [ ] Demo number tested today (call it, text it, confirm it works)
- [ ] Voice AI Playground QA passed for demo client
- [ ] Prospect list built (80+ Calgary basement contractors &mdash; see ICP Definition for sources)
- [ ] Basement Revenue Leak Audit completed for first 3 prospects (`docs/operations/templates/BASEMENT-REVENUE-LEAK-AUDIT.md`)
- [ ] Cold call script practiced out loud 5+ times (Sales Toolkit Section 1)
- [ ] Top 5 objection responses practiced (Sales Toolkit Section 4)
- [ ] 3 practice calls done on lowest-priority prospects

### 5.2 Start Outreach

**Open:** `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` &mdash; your primary sales doc with scripts, DM templates, demo flow, and objection handlers.

Also reference: `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` for the broader strategy of landing your first 5 Calgary basement clients.

**Your ICP:** `docs/business-intel/ICP-DEFINITION.md` &mdash; the 30-second qualifier, where to find prospects, and which sub-segments to prioritize.

### 5.3 When They Say Yes

**Open:** `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10

**Before hanging up the sales call** &mdash; run the live phone test if you haven&apos;t already (ICP qualifier Q5): text their business number from your Twilio number while still on the line. Confirms texts arrive, no carrier filtering, correct number. If it fails, flag the issue and plan the workaround before onboarding day. Also confirm Google Business Profile access (Q6) &mdash; if they can&apos;t log in, help them claim it before the Day 7 listing migration.

On the call, after the &ldquo;wow moment&rdquo; (they hear the AI answer their phone):

1. Click **Send Payment Link** from the client&apos;s admin detail page
2. Contractor receives SMS + email with Stripe checkout link
3. Stay on the line while they enter their card
4. Once paid: walk them through onboarding (you practiced this in Phase 3)
5. **Pre-commit the Day 7 listing migration** &mdash; before hanging up, schedule the Day 7 check-in on both calendars. Frame it: &ldquo;Next week I&rsquo;ll update your Google listing so every Google lead gets the same safety net. 5 minutes, you watch me do it.&rdquo; If they say &ldquo;just do it now,&rdquo; do it on the spot.
6. **Hand them the exit document** (Playbook Appendix) &mdash; lists every change made, original values, and how to revert in 5 minutes. Makes exit feel safe.

Timeline: Day 0 (signing + conditional forwarding) &rarr; Day 1 (onboarding call + KB + Voice QA) &rarr; **Day 7 (listing migration call)** &rarr; Week 2 (first report) &rarr; Week 3 (check-in). Saturday mornings work well for onboarding calls.

### 5.4 Daily Routine (5-10 min per client)

This is your entire daily workload per client once they&apos;re onboarded:

1. `/admin/triage` &mdash; who needs attention? (red = act now, yellow = check soon)
2. `/escalations` &mdash; any hot leads the AI couldn&apos;t handle? (cross-client queue; per-client is under Client View &rarr; Escalations)
3. Knowledge gap queue &mdash; any questions the AI couldn&apos;t answer? Add the answer. (**Clients** &rarr; **Clients** &rarr; client &rarr; **Knowledge Base** &rarr; **Gap Queue** tab)
4. `/admin/ai-quality` (**Clients** &rarr; **AI Flagged Responses**) &mdash; any flagged messages? Review and dismiss or fix.
5. New clients only (Week 1): run Voice AI KB Test again after adding answers from real calls.

That&apos;s it. The system handles everything else.

---

## Appendix: Feature Verification Reference

Use this section only if a specific feature breaks during Phase 2 or during a real client delivery. These are the isolated feature tests from the original checklist &mdash; not required for the main walkthrough.

### A.1 Create Your First Test Client

1. In the admin nav, click **Clients** &rarr; **Clients** &rarr; then click the **+ New Client** button (or use the wizard link)
2. Fill in:
   - Business name: &ldquo;Peak Basements YYC&rdquo;
   - Owner name, email, phone: use your Dev Phone #3 (Owner) number for the phone
   - Twilio number: select Dev Phone #1 (Business Line)
3. Complete the wizard. Click through each step.
4. **Load the basement KB preset:** open `docs/operations/templates/BASEMENT-KB-PRESET.md` and enter the 21 preset entries into the Knowledge Base. Customize the 5 REQUIRED entries (pricing range, warranty, service area, trades, scope exclusions) for your test company.
5. Click **Clients** &rarr; **Clients** in the nav &mdash; your new client should appear.

- [ ] Client shows in the list with status &ldquo;active&rdquo;

### A.2 Core Loop: Lead Texts In, AI Responds

1. Open Dev Phone #2 (Lead) in your browser (port 3001)
2. Send a text to the Business Line (#1): &ldquo;Hi, I&apos;m looking to get my basement finished. About 800 square feet. What would something like that cost?&rdquo;
3. Watch your terminal &mdash; you should see webhook logs
4. Within 2-8 seconds, Dev Phone #2 receives an AI response
5. In the admin nav, click **Client View** &rarr; **Conversations** &mdash; you should see the conversation thread

- [ ] AI responded within 10 seconds
- [ ] Conversation visible in admin dashboard

### A.3 Missed Call Text-Back

1. From Dev Phone #2 (Lead), **call** the Business Line (#1)
2. Let it ring &mdash; don&apos;t answer
3. Within 5 seconds, Dev Phone #2 should receive a text: &ldquo;Sorry we missed your call...&rdquo;
4. Check **Client View** &rarr; **Conversations** &mdash; a new conversation should appear

- [ ] Text-back arrived within 5 seconds of the missed call

### A.4 Voice AI

> Skip if `ELEVENLABS_API_KEY` is not set or Voice AI is not enabled for your test client.

1. From Dev Phone #2, **call** the Business Line (#1) and let it ring until Voice AI picks up
2. You should hear a voice greeting (ElevenLabs voice)
3. Say: &ldquo;I&apos;m looking to finish my basement &mdash; about 1,000 square feet&rdquo; &mdash; AI should respond conversationally using the KB preset data
4. Say: &ldquo;I want to speak to someone&rdquo; &mdash; this should trigger a transfer attempt
5. Hang up. Go to **Clients** &rarr; **Clients** &rarr; click your test client &rarr; look for call transcript + AI summary

- [ ] Voice AI answered with a natural greeting
- [ ] Transcript and summary appear in admin after the call

### A.5 Smart Assist Mode

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client &rarr; find the AI mode setting
2. Change it to **Smart Assist** (also called &ldquo;assist&rdquo; mode)
3. From Dev Phone #2, text the Business Line: &ldquo;Do you do emergency plumbing?&rdquo;
4. AI should NOT auto-reply. Go to the client&apos;s **Campaigns** tab &rarr; **Pending Drafts** card
5. You should see the AI&apos;s draft response waiting for approval
6. Click **Approve** to send it
7. Dev Phone #2 should receive the response

- [ ] Draft appeared in Pending Drafts (not auto-sent)
- [ ] After approval, response arrived on Dev Phone #2

> Set the client back to **Autonomous** mode when done.

### A.6 Lead Lifecycle: Estimate Sent &rarr; Won &rarr; Job Complete

1. Click **Client View** &rarr; **Leads** (make sure your test client is selected)
2. Click on the lead you created
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

### A.7 CSV Lead Import

1. Create a CSV file with columns: `name,phone,email,status`
2. Add 3-5 rows with test data. Set status to `estimate_sent` for at least one.
3. Click **Client View** &rarr; **Leads** &rarr; click **Import**
4. Upload the CSV. Check the **CASL consent** box.
5. Verify leads appear in the list. Leads with `estimate_sent` should have follow-ups scheduled.

- [ ] Leads imported and visible
- [ ] Follow-ups auto-scheduled for estimate_sent leads

### A.8 Exclusion List (Do Not Contact)

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client &rarr; **Configuration** tab
2. Find the **Exclusion List** card
3. Add a phone number (any test number)
4. Verify it appears in the list
5. Remove it

- [ ] Number added and removed without errors

### A.9 Reports

1. In your terminal, trigger the report cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
2. Click **Reporting** &rarr; **Reports** in the admin nav
3. A report should appear for your test client (may be empty data &mdash; that&apos;s fine)

- [ ] Report generated without errors

### A.10 AI Safety Gate

```bash
npm run test:ai
```

This runs 29 tests covering safety, quality, and adversarial scenarios. All safety tests must pass before launch.

- [ ] All Safety tests pass (quality tests may have some variance &mdash; that&apos;s acceptable)

### A.11 AI Preview

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client
2. Click the **Configuration** tab &rarr; find the **AI Preview** panel
3. Type a question a homeowner might ask: &ldquo;How much does a roof replacement cost?&rdquo;
4. AI should respond based on the client&apos;s knowledge base

> **Deeper test:** From the client detail page, click **Knowledge Base** (top-right link or Overview tab link) &rarr; this opens the Knowledge page with a side-by-side KB editor and test chat. Use the &ldquo;Test AI&rdquo; button at top-right for a full knowledge chat session.

- [ ] AI gives a reasonable response (or says it doesn&apos;t have that info &mdash; both are correct)

### A.12 Voice AI Admin Config

1. Click **Settings** &rarr; **Voice AI** in the admin nav
2. Check that you see:
   - Kill switch banner at top (should show enabled/disabled)
   - Per-client cards with: pricing toggle, max duration, business hours, agent tone badge

- [ ] Voice AI admin page loads with client cards

### A.13 Voice AI Playground

1. On the Voice AI page (**Settings** &rarr; **Voice AI**), expand your test client
2. Run each tool:
   - **Greeting Preview:** click play &mdash; hear the greeting in the selected voice
   - **Simulator:** type &ldquo;I need an estimate for deck building&rdquo; &mdash; see AI response
   - **KB Test:** runs 10 questions against the knowledge base &mdash; check coverage percentage
   - **Guardrail Test:** runs 8 adversarial inputs &mdash; all should pass
3. Check the **QA Checklist** &mdash; aim for all green

- [ ] QA Checklist all green (or you know why something is yellow/red)

### A.14 Contractor Portal Experience

1. Open http://localhost:3000/client-login in a new browser tab (or incognito window)
2. Enter the owner email you used when creating the test client
3. Enter the OTP code (check email or terminal logs)
4. You should land on the contractor dashboard showing:
   - Voice AI status card
   - Setup card (if phone/billing not configured) or AI Setup card (if KB is sparse)
   - System Activity card (always visible &mdash; shows probable pipeline, leads engaged, missed calls caught)
   - Jobs We Helped Win card (the single confirmed-revenue card &mdash; may show $0 with no won jobs yet)
   - Account Manager card (shows when operator phone is configured)
5. Go to **Conversations** &mdash; you should see the test conversations from earlier
6. Find a lead in &ldquo;Won&rdquo; status &mdash; click **Mark Job Complete** button
7. Click **Help &amp; Support** &rarr; send a support message
8. Switch back to admin: click **Clients** &rarr; **Support** &mdash; the thread should appear

- [ ] Contractor dashboard loads with cards
- [ ] Mark Job Complete button works
- [ ] Discussion thread visible in both portal and admin

### A.15 Payment and Billing

> Skip if `STRIPE_SECRET_KEY` is not set.

1. Go to **Clients** &rarr; **Clients** &rarr; click your test client
2. Click **Send Payment Link**
3. Dev Phone #3 (Owner) should receive SMS with a Stripe checkout link
4. Open the link. Use test card: `4242 4242 4242 4242`, any future expiry, any CVC
5. Complete checkout. Verify 30-day trial starts.
6. Check contractor portal &rarr; **Settings** &rarr; Billing &mdash; plan and trial countdown should show

- [ ] Payment link SMS received
- [ ] Checkout completed with test card
- [ ] Trial active in contractor billing page

### A.16 Welcome Communications

1. Open http://localhost:3000/signup in a new browser tab and create a new client (use a different email)
2. Check that email inbox &mdash; welcome email should arrive
3. Check Dev Phone (if you used a real number) &mdash; welcome SMS with login link

- [ ] Welcome email received
- [ ] Welcome SMS received

### A.17 Google Calendar *(skip if not configured)*

1. Go to contractor portal &rarr; **Settings** &rarr; **Calendar**
2. Click **Connect Google Calendar** &rarr; complete OAuth
3. Create an appointment in the platform
4. Check Google Calendar &mdash; appointment should appear

- [ ] OAuth connected
- [ ] Appointment synced to Google Calendar

### A.18 Weekly Activity Digest

1. Ensure test client is at least 7 days old (skip onboarding gate) and has `weeklyDigestEnabled = true`.
2. Trigger the weekly digest cron:
   ```bash
   curl http://localhost:3000/api/cron/weekly-digest -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
3. Dev Phone #3 (Owner) should receive an activity summary SMS.
4. Verify message format: &ldquo;Hey [name], your week: X new leads, X appointments booked...&rdquo;
5. If the client had zero activity, verify the digest was skipped or sent the quiet/reassurance variant.

- [ ] Activity digest SMS received with correct stats
- [ ] Zero-activity client was skipped (no SMS sent)

### A.19 Operator SMS Alerts

You WILL receive these alerts with real clients. Test them now so the first one doesn&apos;t surprise you.

1. Verify `operator_phone` is set at `/admin/agency` (should be your real phone number).
2. **Payment failure alert:** In Stripe test mode, create a subscription with a card that declines on renewal (e.g., `4000 0000 0000 0341`). Trigger the billing cron. Verify: you receive an SMS about the payment failure.
3. **Escalation SLA alert:** Create a test escalation and let it sit for 2+ hours past SLA. Trigger the escalation SLA cron. Verify: you receive an SMS.
4. **AI quality alert (hourly):** Verify the cron runs:
   ```bash
   curl -X GET http://localhost:3000/api/cron/ai-quality-alert -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
   Response should be `{"checked":true,"alerted":false}` (no issues in test).
5. **Key learning:** These alerts are deduplicated (max 1 per subject per hour). If you get an alert, something real happened &mdash; check the admin dashboard immediately.

- [ ] I know what alerts I&apos;ll receive and what each one means
- [ ] Payment failure alert tested (or understood)
- [ ] AI quality alert cron runs without error

### A.20 Review Monitoring

1. Click **Optimization** &rarr; **Reputation**
2. If Google reviews exist, verify: AI drafts a response, contractor can approve/edit in the contractor portal under **Reviews**
3. If no reviews yet, understand the flow: negative review &rarr; operator gets SMS alert &rarr; AI generates draft response &rarr; contractor approves in portal &rarr; posted to Google

- [ ] I understand the review approval flow

### A.21 SMS Commands (Full Verification)

Test every command the contractor will use, from their perspective (Dev Phone #3):

1. Text `EST Sarah` to the business number (Dev Phone #1) &mdash; verify estimate follow-up starts
2. Text `WON 1` (or whatever ref code) &mdash; verify lead marked won, revenue logged
3. Text `LOST 2` &mdash; verify lead marked lost, sequences cancelled
4. Text `WINS` &mdash; verify list of pending leads with ref codes
5. Text `PAUSE` &mdash; verify AI mode turns off, scheduled messages cancelled
6. Text `RESUME` &mdash; verify AI mode returns to autonomous

- [ ] All 6 SMS commands tested from the contractor&apos;s phone
- [ ] I can explain each one to a contractor in 10 seconds
