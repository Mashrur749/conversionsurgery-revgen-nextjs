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
   - Business name: &ldquo;Peak Basements YYC&rdquo; (use a basement company name &mdash; this is what you&apos;ll sell to)
   - Owner name, email, phone: use your Dev Phone #3 (Owner) number for the phone
   - Twilio number: select Dev Phone #1 (Business Line)
3. Complete the wizard. Click through each step.
4. **Load the basement KB preset:** open `docs/operations/templates/BASEMENT-KB-PRESET.md` and enter the 21 preset entries into the Knowledge Base. Customize the 5 REQUIRED entries (pricing range, warranty, service area, trades, scope exclusions) for your test company. This simulates what you&apos;ll do for every real client.
4. Click **Clients** &rarr; **Clients** in the nav &mdash; your new client should appear.

- [ ] Client shows in the list with status &ldquo;active&rdquo;

### 2.2 Test the Core Loop: Lead Texts In, AI Responds

This is the product&apos;s core value. A homeowner texts, the AI replies.

1. Open Dev Phone #2 (Lead) in your browser (port 3001)
2. Send a text to the Business Line (#1): &ldquo;Hi, I&apos;m looking to get my basement finished. About 800 square feet. What would something like that cost?&rdquo;
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
3. Say: &ldquo;I&apos;m looking to finish my basement &mdash; about 1,000 square feet&rdquo; &mdash; AI should respond conversationally using the KB preset data
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
5. Go to the client&apos;s **Campaigns tab** &rarr; look for **Pending Drafts** card
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
2. Click the **Configuration** tab &rarr; find the **AI Preview** panel
3. Type a question a homeowner might ask: &ldquo;How much does a roof replacement cost?&rdquo;
4. AI should respond based on the client&apos;s knowledge base

> **Deeper test:** From the client detail page, click **Knowledge Base** (top-right link or Overview tab link) &rarr; this opens the Knowledge page with a side-by-side KB editor and test chat. Use the &ldquo;Test AI&rdquo; button at top-right for a full knowledge chat session.

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

### 2.15 Payment and Billing

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

### 2.18 Weekly Activity Digest

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

### 3.1 Day 0: The Full Close Flow

You&apos;re simulating the moment a contractor says &ldquo;yes&rdquo; &mdash; practice the ENTIRE close flow from Sales Toolkit Section 14.

**Step 1: Create the client**

1. Click **Clients** &rarr; **Clients** &rarr; **+ New Client** (use the wizard)
2. Create &ldquo;Peak Basements YYC&rdquo; (managed service model &mdash; simulate a Calgary basement contractor, your target ICP)
   - Owner phone: Dev Phone #3
   - Twilio number: Dev Phone #1

**Step 2: Practice the close script OUT LOUD**

Open `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` Section 14. Say these out loud as if you&apos;re on the call:

1. &ldquo;Awesome. Let&apos;s get you set up.&rdquo;
2. Walk through the 5 key terms (say them out loud):
   - First month free
   - Month-to-month, cancel anytime with 30 days notice
   - 90-day guarantee
   - Your data is yours, full export if you leave
   - $1,000/month flat, no hidden fees
3. &ldquo;I&apos;m sending you the payment link now. The full terms are on the checkout page.&rdquo;

**Step 3: Send payment link + verify**

4. Click **Clients** &rarr; **Clients** &rarr; click Peak Basements YYC &rarr; click **Send Payment Link**
5. On Dev Phone #3, open the Stripe link. Verify: Terms of Service checkbox appears on checkout page.
6. Pay with test card `4242 4242 4242 4242`.
7. Check: welcome email arrived? Welcome SMS with login link?

**Step 4: Practice the post-close script OUT LOUD**

8. Say out loud: &ldquo;Perfect, I can see that went through. Your free month starts today. Billing kicks in on [date]. Sound good?&rdquo;
9. Say: &ldquo;Now let&apos;s get you live. I need 30 minutes with you to set up your business number and train the AI on your business. What works &mdash; [time options]?&rdquo;
10. Say: &ldquo;Here&apos;s what happens next. On our onboarding call I&apos;ll set up your business number, train the AI with your services, and import your old quotes so we can start following up immediately. You&apos;ll start catching leads the same day.&rdquo;

**Step 5: Send the welcome text**

11. Practice sending this text to Dev Phone #3 (or say it out loud):
    &ldquo;Hey [Name], welcome to ConversionSurgery. Your free month starts today. Onboarding call: [day] at [time]. Before that call, think of 5 people you quoted in the last 6 months that never got back to you &mdash; just first names and what the project was. Talk soon. &mdash; Mashrur&rdquo;

- [ ] Close script practiced out loud &mdash; I can say the 5 key terms without reading
- [ ] Payment link sent and checkout completed with ToS acceptance
- [ ] Welcome email + SMS received
- [ ] Post-close script practiced &mdash; I can book the onboarding call naturally
- [ ] Welcome text practiced

### 3.2 Day 1: Practice the Onboarding Call

Read `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10 (the call script). Then practice it **out loud** &mdash; not silently. You need to hear yourself say these words.

**Step 1: KB Questionnaire**

1. Open the call script (Playbook Section 10)
2. Say the intro out loud: &ldquo;Thanks for signing up, let me walk you through...&rdquo;
3. Click **Clients** &rarr; **Clients** &rarr; click Peak Basements YYC &rarr; click **Knowledge Base** (link in the top-right area of the client detail page, or via the &ldquo;Configure&rdquo; link in the onboarding checklist on the Overview tab)
4. Fill in the knowledge base while &ldquo;asking&rdquo; Peak Basements YYC:
   - What services do you offer?
   - What&apos;s your service area?
   - What are your hours?
   - What&apos;s your pricing range? (or &ldquo;we provide custom quotes&rdquo;)
   - Any current promotions?

- [ ] KB has at least 5 entries covering the basics

**Step 2: Exclusion List**

Practice this exact phrase out loud: &ldquo;Before we turn anything on &mdash; anyone you want us to skip? Family, close friends, personal numbers that might be in your contacts?&rdquo;

1. Click **Clients** &rarr; **Clients** &rarr; click Peak Basements YYC &rarr; **Configuration** tab
2. Find **Exclusion List** card &rarr; add 2-3 fake numbers

This is mandatory for every real client. Skipping it means the AI could text a contractor&apos;s wife or best friend.

- [ ] Exclusion list practiced &mdash; I know the script and where to add numbers

**Step 3: Voice AI QA**

Before any real client goes live, you QA their voice AI.

1. Click **Settings** &rarr; **Voice AI** &rarr; expand Peak Basements YYC
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

### 3.2b Day 2-3: Practice the Quote Import Call

This is the 15-minute follow-up call to collect old quotes. See Playbook Section 10.

1. Practice the pre-call SMS out loud: &ldquo;One more thing before our next quick call &mdash; think of 5 people you gave a quote to in the last 6 months that never got back to you. Just first name and what the project was.&rdquo;
2. Simulate the call: pretend you&apos;re on the phone with the contractor. They read off 5 names. You type them into a CSV.
3. Import the CSV via **Client View** &rarr; **Leads** &rarr; **Import** with `status=estimate_sent`.
4. Verify follow-up sequences are scheduled for the imported leads.
5. Practice the post-import text: &ldquo;Just sent follow-ups to 5 of your old quotes. You&apos;ll start seeing replies within 24-48 hours.&rdquo;

- [ ] Quote Import Call script practiced out loud
- [ ] Old quotes imported and follow-ups firing

### 3.2c Day 7: Practice the Check-In Call

This is the 10-minute Day 7 check-in. Simulate it.

1. Say out loud: &ldquo;Hey [Name], quick check-in. Let me show you what the system did this week.&rdquo;
2. Open **Client View** &rarr; **Leads** &mdash; note how many leads came in, how many responded.
3. Practice walking through the numbers: &ldquo;You had X leads come in. We responded to all of them in under 10 seconds. Y of your old quotes replied.&rdquo;
4. Practice the EST reinforcement: &ldquo;Quick reminder &mdash; when you send an estimate, text EST [name] to your business number. That starts the follow-up.&rdquo;
5. Practice WON/LOST introduction: &ldquo;And when a job closes, text WON [name] so we can track your results for the guarantee.&rdquo;
6. Book the next check-in: &ldquo;Let&apos;s do a 30-minute strategy call in two weeks. I&apos;ll walk you through a full report with your numbers.&rdquo;

- [ ] Day 7 check-in script practiced out loud
- [ ] I know where to find the data to walk through

### 3.2d Practice the Bi-Weekly Strategy Call

This is your #1 retention touchpoint. See Playbook Section 4.

1. Open the strategy call agenda from `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 4.
2. Practice out loud (pretend you have 2 weeks of data):
   - **Revenue capture (5 min):** &ldquo;Let&apos;s go through your recent leads. Sarah T. had an appointment 2 weeks ago. Did you close that one?&rdquo; Practice entering WON in admin.
   - **Report walkthrough (10 min):** Walk through leads captured, response time, appointments, reviews, pipeline.
   - **Action items (5 min):** &ldquo;I see 3 estimates went out but only 1 triggered follow-up. Let&apos;s make sure we catch all of them.&rdquo;
   - **Business challenges (5 min):** &ldquo;Anything going on in the business I should know about?&rdquo;
   - **Close (5 min):** &ldquo;You recovered $X this cycle. One more basement like Sarah&apos;s covers the whole year.&rdquo;

- [ ] Strategy call flow practiced out loud
- [ ] I can walk through the report and capture revenue data naturally

### 3.2e Practice SMS Commands (Contractor Perspective)

Test every command the contractor will use, from their perspective (Dev Phone #3):

1. Text `EST Sarah` to the business number (Dev Phone #1) &mdash; verify estimate follow-up starts
2. Text `WON 1` (or whatever ref code) &mdash; verify lead marked won, revenue logged
3. Text `LOST 2` &mdash; verify lead marked lost, sequences cancelled
4. Text `WINS` &mdash; verify list of pending leads with ref codes
5. Text `PAUSE` &mdash; verify AI mode turns off, scheduled messages cancelled
6. Text `RESUME` &mdash; verify AI mode returns to autonomous

- [ ] All 6 SMS commands tested from the contractor&apos;s phone
- [ ] I can explain each one to a contractor in 10 seconds

### 3.3 Day 1-2: Revenue Leak Audit

This is the deliverable you give every client within 48 hours. Practice on a real business.

1. Open Google Maps. Search &ldquo;basement development Calgary&rdquo; &mdash; pick a real basement contractor.
2. Open `docs/operations/templates/BASEMENT-REVENUE-LEAK-AUDIT.md` (the basement-specific audit template)
3. Follow the 5-step research checklist (10-15 min). Fill in every section using what you find: their Google reviews vs competitors, estimated response time, secondary suite listing, follow-up gap estimate, missed call revenue.
4. Do this for 3 different real basement contractors. By the third one, you&apos;ll be fast. These become your first 3 outreach targets.

- [ ] Revenue Leak Audit completed for 3 real Calgary basement contractors
- [ ] I can complete one in under 15 minutes

### 3.4 Week 1-2: Daily Operations

Simulate what your daily routine looks like with an active client.

**Simulate homeowner conversations (10 min):**

1. From Dev Phone #2, text the business number as different &ldquo;homeowners&rdquo; (use basement-specific questions &mdash; this is what your real clients&apos; leads will ask):
   - &ldquo;Hi, we just bought a house in Airdrie and want to finish the basement. About 900 sq ft. What would that run?&rdquo;
   - &ldquo;Do you do secondary suites? We want to add a legal suite for rental income.&rdquo;
   - &ldquo;How long does a full basement development take? We&apos;re hoping to be done by fall.&rdquo;
   - &ldquo;Can I book an estimate for next Tuesday?&rdquo; (tests appointment booking)
   - &ldquo;I want to speak to someone &mdash; the quote I got seems really high.&rdquo; (tests escalation)
   - &ldquo;Do you need a permit to finish a basement in Calgary?&rdquo; (tests KB preset knowledge)
2. Watch the AI respond to each. Note which responses are good and which need KB improvement.

**Check your daily operator dashboard (5 min):**

3. Click **Clients** &rarr; **Triage** &mdash; does Peak Basements YYC show as needing attention?
4. Click **Client View** &rarr; **Escalations** (per-client queue) &mdash; the &ldquo;complaint&rdquo; text should have created an escalation. Click it. Read the AI&apos;s notes. Click **Resolve** with a note. With multiple clients, use **Clients** &rarr; **Escalations** for the cross-client queue (same as `/escalations` in the nav).
5. Click **Clients** &rarr; **AI Flagged Responses** &mdash; any flagged messages? If so, review them.
6. Click **Clients** &rarr; **Clients** &rarr; Peak Basements YYC &rarr; **Knowledge Base** (page link) &rarr; **Gap Queue** tab &mdash; any KB gaps? Add the answer.

**Generate a report:**

7. Trigger the cron:
   ```bash
   curl -X POST http://localhost:3000/api/cron -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```
8. Click **Reporting** &rarr; **Reports** &mdash; open the report. Even with fake data, understand the layout: recovered revenue, lead pipeline, AI effectiveness.

**Check the contractor&apos;s view:**

9. Log in as Summit&apos;s contractor (http://localhost:3000/client-login in incognito)
10. Check: Voice AI card, System Activity card (probable pipeline), Jobs We Helped Win card (numbers may be $0 with test data)
11. Go to **Settings** &rarr; Billing &mdash; you should see: current plan (read-only), trial countdown, guarantee status card with progress bar. No &ldquo;Change Plan&rdquo; button (managed client). Note: Billing is in Settings, not a top-level nav item for managed clients.
12. Switch to admin view &rarr; **Clients** &rarr; **Clients** &rarr; Peak Basements YYC &rarr; Overview tab &mdash; check guarantee phase, pipeline value, days remaining.

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

1. Click **Clients** &rarr; **Clients** &rarr; Peak Basements YYC &rarr; pause the subscription
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

**The close:**
- [ ] Say the 5 key terms out loud without reading
- [ ] Send a payment link and verify ToS acceptance on checkout
- [ ] Say the post-close script naturally (book onboarding, set expectations, send welcome text)

**The onboarding:**
- [ ] Walk a contractor through the full onboarding call (KB preset + 5 custom Qs, exclusion list, calendar path, team members, EST walkthrough, Voice AI QA, expectations)
- [ ] Run the Day 2-3 Quote Import Call
- [ ] Run the Day 7 check-in with real data

**The ongoing delivery:**
- [ ] Run a bi-weekly strategy call (revenue capture, report walkthrough, action items, business challenges)
- [ ] Handle daily operations in 5-10 minutes per client
- [ ] Resolve an escalation
- [ ] Fill a KB gap
- [ ] Explain what the report shows

**SMS commands:**
- [ ] All 6 commands tested (EST, WON, LOST, WINS, PAUSE, RESUME)
- [ ] Can explain each to a contractor in 10 seconds

**Edge cases:**
- [ ] Handle opt-outs, pauses, and cancellations confidently
- [ ] Explain DNC vs opt-out
- [ ] Deliver a Revenue Leak Audit in under 15 minutes

If you can check all of those, you&apos;ve practiced the ENTIRE client lifecycle: close &rarr; onboard &rarr; deliver &rarr; retain. Move to Phase 4.

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

### 4.2 Practice Sales Out Loud

Don&apos;t skip this. Reading scripts silently is not the same as saying them. Open `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md`.

**The pitch (20 min):**

1. Follow the Practice Call Guide (Section 6 of the Sales Toolkit): read the script out loud 5 times, record yourself, listen back
2. Practice ALL 6 cold call branches: engage, send me something, not interested, what does it cost, too busy, awkward silence
3. Practice the close: &ldquo;First month is free. I set everything up. You pay nothing until you see results.&rdquo;
4. Have someone play the contractor &mdash; have them use these 5 responses: (a) &ldquo;yeah tell me more&rdquo; (b) &ldquo;not interested&rdquo; (c) &ldquo;what does it cost?&rdquo; (d) &ldquo;I&apos;m busy&rdquo; (e) awkward silence
5. Your first 3 REAL calls are practice calls &mdash; pick the 3 lowest-priority prospects on your list

- [ ] I can deliver the opener without reading it

**The demo (20 min):**

5. Open your local environment. Walk through a demo as if a prospect is screen-sharing with you.
6. The &ldquo;wow moment&rdquo;: call the business number. Text-back fires in 5 seconds. If they let it ring, Voice AI answers. Practice saying: &ldquo;Call this number right now.&rdquo;
7. Practice using the Voice AI Simulator during screen-share &mdash; type homeowner questions, show AI responses in real time. This works even without a live Twilio call.

- [ ] I can walk through a live demo confidently

**Pre-outreach prep (30 min):**

8. Pick 3 real Calgary basement contractors from Google Maps (&ldquo;basement development Calgary&rdquo;)
9. For each one, fill out `docs/operations/templates/BASEMENT-REVENUE-LEAK-AUDIT.md` using only public data (10-15 min each)
10. Run the ROI calculator with 3 basement profiles: 15 leads/$60K avg, 25 leads/$50K avg, 12 leads/$90K avg (suite specialist). Check that numbers feel credible.
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

**All 28 answered? You&apos;re ready.**

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
6. Configure external health monitor (Cloudflare Health Checks, BetterUptime, or equivalent) to `GET /api/health` every 5 minutes. Alert when HTTP status is not 200.

- [ ] App deployed &mdash; `/login`, `/signup`, `/client-login` all load
- [ ] Voice Agent Worker deployed
- [ ] Cron running every 5 minutes
- [ ] External health monitor pinging `/api/health` every 5 minutes

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
- [ ] Prospect list built (80+ Calgary basement contractors &mdash; see ICP Definition for sources)
- [ ] Basement Revenue Leak Audit completed for first 3 prospects (`docs/operations/templates/BASEMENT-REVENUE-LEAK-AUDIT.md`)
- [ ] Cold call script practiced out loud 5+ times (Sales Toolkit Section 1)
- [ ] Top 5 objection responses practiced (Sales Toolkit Section 4)
- [ ] 3 practice calls done on lowest-priority prospects

### 6.2 Start Outreach

**Open:** `docs/operations/templates/SALES-TOOLKIT-BASEMENT.md` &mdash; your primary sales doc with scripts, DM templates, demo flow, and objection handlers.

Also reference: `docs/operations/ACQUISITION-PLAYBOOK-0-TO-5.md` for the broader strategy of landing your first 5 Calgary basement clients.

**Your ICP:** `docs/business-intel/ICP-DEFINITION.md` &mdash; the 30-second qualifier, where to find prospects, and which sub-segments to prioritize.

### 6.3 When They Say Yes

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

### 6.4 Daily Routine (5-10 min per client)

This is your entire daily workload per client once they&apos;re onboarded:

1. `/admin/triage` &mdash; who needs attention? (red = act now, yellow = check soon)
2. `/escalations` &mdash; any hot leads the AI couldn&apos;t handle? (cross-client queue; per-client is under Client View &rarr; Escalations)
3. Knowledge gap queue &mdash; any questions the AI couldn&apos;t answer? Add the answer. (**Clients** &rarr; **Clients** &rarr; client &rarr; **Knowledge Base** &rarr; **Gap Queue** tab)
4. `/admin/ai-quality` (**Clients** &rarr; **AI Flagged Responses**) &mdash; any flagged messages? Review and dismiss or fix.
5. New clients only (Week 1): run Voice AI KB Test again after adding answers from real calls.

That&apos;s it. The system handles everything else.
