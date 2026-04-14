# Managed Service Delivery Playbook

Last updated: 2026-04-08
Audience: Solo operator delivering ConversionSurgery at $1,000/mo
Purpose: Every business scenario a contractor generates, and exactly how you handle it.

---

## 1. Escalation Handling

**What triggers it:** AI encounters a frustrated customer, legal threat, pricing negotiation, complex technical question, or explicit request to speak to someone. Lead gets flagged `action_required` and enters the escalation queue.

**How you know:** Your daily triage starts at `/admin/escalations` — the cross-client escalation queue that surfaces unresolved items across all clients, sorted by priority. SLA clock starts ticking (priority 1 = respond same day, priority 2 = next business day). When you are already viewing a specific client, the per-client `/escalations` view shows only that client&apos;s queue.

**Process:**

1. Open `/admin/escalations` (morning triage) or the per-client escalations view when working inside a specific client. Review the conversation history for the flagged lead.
2. Determine if this needs the contractor or if you can handle it:
   - **You handle:** Lead is asking about scheduling, general process, follow-up timing. Draft a response in the conversation view, send it.
   - **Contractor handles:** Lead has a technical question about their specific property, wants to negotiate price, or is threatening legal action. If this is a knowledge gap (AI couldn&apos;t answer), use the &quot;Ask Contractor&quot; button on the gap card in the knowledge gap queue &mdash; it sends a formatted SMS and tracks the gap lifecycle automatically. Otherwise, text the contractor: &quot;[Lead name] is asking about [topic] &mdash; how do you want me to respond?&quot; Enter their answer as a response.
3. After responding, mark the escalation as resolved. Set the lead back to `ai` conversation mode if the issue was a one-off.
4. If the same type of escalation keeps recurring (e.g., 3 leads in a week asking about financing), that&apos;s a knowledge gap &mdash; add a KB entry so the AI handles it next time.

**Contractor communication template:**
> &quot;Hey [name], quick one &mdash; a lead ([lead name]) asked about [topic]. What should I tell them? Just a sentence or two is fine.&quot;

Keep it short. Contractors are on job sites. They&apos;ll reply in 10 seconds if the ask is specific.

---

## 1.5. At-Risk Detection &amp; Recovery

**What triggers it:** A client shows early churn signals &mdash; declining engagement, missed touchpoints, or negative sentiment. Unlike escalations (which are lead-level), at-risk detection operates at the **client level** &mdash; the contractor themselves is disengaging from the service.

**Signals (check during daily triage + bi-weekly report prep):**

| Signal | Where to see it | Severity |
|--------|----------------|:--------:|
| No estimate triggers for 14+ days | Lead pipeline &mdash; filter by `estimate_sent` with no recent activity | High |
| Missed Day 7 call (no-show, no reschedule) | Onboarding checklist | Critical (Week 1) |
| Contractor stops responding to operator texts within 24h | Conversation history | High |
| Zero inbound leads for 10+ days (not seasonal) | Lead dashboard &mdash; lead creation trend | Medium |
| Negative sentiment in contractor replies (&ldquo;not sure this is working&rdquo;, &ldquo;thinking about pausing&rdquo;) | Operator judgment during any interaction | Critical |
| Bi-weekly report shows declining engagement vs prior period | Report comparison | Medium |
| KB gaps accumulating without contractor responses | Knowledge gap queue &mdash; unresolved gaps older than 7 days | Medium |

**SLA:** Intervene within 48 hours of the first high/critical signal. Do not wait for the bi-weekly call.

**Process:**

1. **Acknowledge the friction specifically.** Do not open with &ldquo;how&apos;s it going?&rdquo; Open with the observation:
   > &ldquo;Hey [name], I noticed you haven&apos;t flagged any estimates in the last 2 weeks &mdash; wanted to check if the SMS trigger is working smoothly or if we should adjust how that&apos;s set up.&rdquo;
2. **Show concrete value delivered.** Pull 2-3 specific data points from their dashboard:
   > &ldquo;Quick context &mdash; in the last 2 weeks your system caught 8 missed calls, responded to 12 leads in under 10 seconds, and booked 2 estimate appointments. Want to jump on a 10-min call to talk through what&apos;s working and what isn&apos;t?&rdquo;
3. **Offer a concrete adjustment**, not vague reassurance. Examples:
   - Switch from SMS estimate trigger to notification quick-reply (lower friction)
   - Add a team member who handles estimates (if office manager exists but isn&apos;t connected)
   - Adjust AI tone if contractor got feedback from a lead
   - Pre-populate additional KB entries from their website/reviews if they haven&apos;t responded to gap questions
4. **If they agree to a call:** Run a compressed version of the bi-weekly call format. Capture wins, review pipeline, address the specific friction.
5. **If they don&apos;t respond within 48h:** Send one more text, then flag for the next bi-weekly call as a priority topic. Do not chase further via text.
6. **Track the outcome.** After intervention, note in your operator log: did they re-engage? What adjustment was made? Did it stick? This data feeds into calibrating which signals actually predict churn vs temporary busy periods.

**What this is NOT:**
- Not a discount offer. Never reduce price to retain a client.
- Not a guilt trip. &ldquo;We&apos;ve done a lot for you&rdquo; never works.
- Not a survey. &ldquo;How would you rate your experience?&rdquo; is for SaaS, not managed services.

**Source:** Pre-launch Markov simulation (2026-04-11) identified At-Risk &rarr; Churned as the single highest-leverage transition. Reducing it by 30% is worth +$80/client &mdash; 5x more impact than any upstream fix.

---

## 2. Quote Reactivation (First-Week Deliverable)

**When:** Day 1-2 of a new client, after phone number is assigned.

**Process:**

1. Ask the contractor: &quot;Can you send me a list of everyone you quoted in the last 90 days who never got back to you? Names and phone numbers is all I need.&quot;
2. Most will send a screenshot of their phone contacts, a spreadsheet, or just read them off. Accept any format.
3. Create a CSV with columns: `name`, `phone`, `status` (set all to `estimate_sent`), `projectType` (if they mentioned it), `notes` (e.g., &quot;Quoted $25k kitchen reno in January&quot;).
4. Import via `/leads` &rarr; Import CSV. Confirm the preview shows `estimate_sent` status.
5. After import, verify leads appear in the table filtered by source = CSV Import.

**What happens next:**
- The win-back cron will pick up these leads 25-35 days after import.
- For immediate reactivation (don&apos;t wait 25 days), you have two options:
  - **Option A:** Backdate the `createdAt` in the database so they fall within the win-back window now.
  - **Option B:** Manually trigger the estimate follow-up sequence for each lead via the API (`POST /api/sequences/estimate` with `{ leadId, clientId }`).

**Reporting back to contractor:**
After 3-5 days, text them: &quot;We texted your 30 old quotes. [X] responded so far. [Lead name] is interested in rebooking &mdash; want me to set up a call?&quot;

This is the moment they realize the service works. Protect it.

---

## 3. AI Quality Monitoring + Smart Assist Operations

> For the high-level overview, see `docs/operations/01-OPERATIONS-GUIDE.md` Part 3.

**When:** Daily during Week 2 (Smart Assist mode), then 2-3 times/week once autonomous.

### Smart Assist — Operator-First Review (Week 2)

During Smart Assist mode, **you** (the operator) review AI drafts, not the contractor. This is how the "you don&apos;t manage anything" promise actually works.

**How it works in the code:** Smart Assist notifications (the `SEND/EDIT/CANCEL` SMS) are sent to the `operator_phone` configured in system settings. If `operator_phone` is not set, they fall back to the contractor&apos;s phone. Both the operator and the contractor are authorized to issue Smart Assist commands.

**Your Week 2 routine (per client, 3x/day, ~5 min each check):**

1. You receive SMS notifications for every AI-drafted response: `"AI draft for Sarah T.: 'Hi Sarah...' Ref ABC123. Auto-send in 5 min."`
2. Scan the draft. If it sounds right &mdash; do nothing. It auto-sends in 5 minutes.
3. If the tone is off or the info is wrong:
   - Reply `EDIT ABC123: [corrected message]` &mdash; sends your version immediately
   - Reply `CANCEL ABC123` &mdash; kills the draft, nothing sent
4. If you need the contractor&apos;s input: text them directly: &ldquo;Quick one &mdash; a lead asked about [topic]. What should I tell them?&rdquo; Then either edit the draft with their answer or add a KB entry.

**Browser-based alternative:** You can also review and manage pending drafts from the admin dashboard: client detail page &rarr; Campaigns tab &rarr; Pending Drafts card. The card polls every 15 seconds and provides approve, edit, and cancel actions without leaving the browser. Use this when you&apos;re at your desk; SMS commands are useful when you&apos;re on mobile.

**What the contractor experiences during Week 2:** Nothing changes for them. They don&apos;t receive draft notifications. They don&apos;t approve messages. From their perspective, the system just works. If you need their input, they get a normal text from you &mdash; not a system notification.

**Categories that NEVER auto-send (even if you don&apos;t act):**
- Estimate follow-up messages
- Payment reminder messages

These sit in `pending_manual` until explicitly approved. You must reply `SEND [ref]` for these. This prevents sensitive financial messages from going out without human review.

**When to switch from Smart Assist to Autonomous:** After you&apos;ve reviewed ~30+ AI interactions for this client and the KB is covering 90%+ of questions without escalation. Run `npm run test:ai` with their KB loaded. All Safety tests must pass. This is non-negotiable.

### General AI Quality Monitoring (ongoing)

1. Open `/admin/ai-quality` (or the AI quality section in the admin dashboard).
2. Review flagged messages from the past 24 hours. Each flag has a category: wrong tone, inaccurate, too pushy, hallucinated, off topic, other.
3. For each flagged message:
   - **Inaccurate / hallucinated:** This is a knowledge gap. Check if the KB entry exists but is wrong, or missing entirely. Fix the KB entry.
   - **Wrong tone / too pushy:** Check the AI settings for this client. Adjust tone (professional/friendly/casual) or update guardrail prompts.
   - **Off topic:** Usually a lead sending irrelevant messages. Not actionable unless the AI engaged with it (which it shouldn&apos;t per guardrails).
4. If you see patterns (same flag reason across multiple clients), the issue is in the system prompt or guardrails, not a single client&apos;s KB.

---

## 4. Bi-Weekly Strategy Call + Report Delivery

**When:** Every 2 weeks, timed to the bi-weekly report. 30 minutes per client.

**This is your #1 retention mechanism.** Not the report. Not the Monday SMS. The call. Every managed-service competitor either skips the call or makes it a cursory &ldquo;any questions?&rdquo; check-in. Your call is structured, data-driven, and closes every gap the automation can&apos;t.

### Pre-Call (10 min operator prep)

1. Review the bi-weekly report at `/admin/reports` for the client:
   - Are the numbers accurate? (Cross-check against the client dashboard.)
   - Is &quot;Jobs We Helped Win&quot; showing real value, or still $0? (If $0, prepare to capture wins on the call.)
   - Does the `pipelineProof` section show meaningful numbers? (Leads responded to, missed calls caught, appointments booked.)
   - Does the speed-to-lead metric look good? (Should be well under 5 minutes.)
2. Check the client&apos;s lead pipeline in admin &mdash; note any leads in `contacted` or `estimate_sent` that haven&apos;t been resolved. These are your &ldquo;did you close this?&rdquo; questions.
3. Check KB gaps queue &mdash; any unresolved gaps to discuss?
4. Check team member setup &mdash; are all team members configured? Getting notifications?
5. **Guarantee check (Day 80+ clients):** If the system sent you a Day 80 guarantee alert SMS for this client, review their guarantee status at Overview tab → Guarantee Status card before the call. Know the pipeline value vs. the $5,000 threshold and the days remaining. Be prepared to discuss what intervention options remain (Growth Blitz, import more past quotes, etc.).

### On the Call (30 min)

**Minute 0-5: Revenue capture (the most important 5 minutes)**

&gt; &quot;Let&apos;s go through your recent leads. Sarah T. &mdash; she had an appointment 2 weeks ago. Did you close that one?&quot;

Walk through every lead in `contacted` or `estimate_sent` with an appointment older than 7 days. For each:
- If WON: enter it in admin, note the revenue amount. &ldquo;Great &mdash; that&apos;s $42K. Your report will show that next cycle.&rdquo;
- If LOST: mark it. &ldquo;No worries. The follow-up ran for 14 days &mdash; at least we gave it a shot.&rdquo;
- If WAITING: note it, follow up next cycle.

This is how you keep the revenue dashboard honest. The WON/LOST SMS commands and auto-detect catch 70% automatically. The bi-weekly call catches the rest.

**Minute 5-15: Report walkthrough**

&gt; &quot;Here&apos;s what happened in the last 2 weeks.&quot;

Walk through:
- Leads captured (how many, after-hours vs. business hours)
- Response time (&ldquo;Your average response was 12 seconds. The industry average is almost 2 hours.&rdquo;)
- Estimates followed up (which ones, any responses?)
- Appointments booked
- Reviews generated
- Pipeline value (confirmed + probable)

The report auto-SMS includes inline stats, but the CALL is where the contractor actually absorbs the numbers. Frame everything as &ldquo;what happened&rdquo; not &ldquo;what we did.&rdquo;

**Minute 15-20: Action items**

- **EST check:** &ldquo;I see 4 estimates went out but only 2 triggered the follow-up. Let&apos;s make sure we catch all of them going forward. Remember &mdash; just text EST [name] when you send a quote.&rdquo;
- **KB gaps:** &ldquo;A lead asked about [topic] and the AI didn&apos;t have the answer. What should it say?&rdquo; (Fill the KB entry live on the call.)
- **Team setup:** (First 2-3 calls only) &ldquo;Is everyone on your team getting the notifications they need? Should we add anyone?&rdquo;
- **Calendar:** (Non-GCal clients) &ldquo;How&apos;s the booking confirmation working? Are the SMS approvals easy enough, or do you want to try Google Calendar?&rdquo;

**Minute 20-25: Business challenges**

&gt; &quot;Anything going on in the business I should know about? Slow period coming? New service you&apos;re adding? Anything the AI should handle differently?&quot;

This is where you learn about:
- Seasonal dips before they hit
- New services that need KB entries
- Pricing changes
- Team changes (hired someone, someone left)
- Frustrations with the system (better to hear it now than on the cancellation page)

**Minute 25-30: Next steps + close**

- Summarize action items (yours and theirs)
- Confirm next call date
- End with a specific number: &ldquo;You recovered $[X] this cycle. One more kitchen like Sarah&apos;s covers the whole year.&rdquo;

### Post-Call (5 min)

1. Enter any WON/LOST leads captured on the call
2. Fill any KB entries from the discussion
3. Update team member config if needed
4. Note any seasonal or business changes for next cycle

### Report Delivery

The report auto-delivers via email. The follow-up SMS is automated: &ldquo;[Business Name] &mdash; 2-week results: [X] leads responded, [Y] estimates followed up, [Z] appointments booked. Full report in your email or dashboard.&rdquo;

**Note:** Contractors can also view all past reports directly from their portal at `/client/reports`.

### Why the Call Matters More Than the Report

The report is data. The call is context. A contractor who reads &ldquo;$42K probable pipeline&rdquo; thinks &ldquo;probably not real.&rdquo; A contractor who hears &ldquo;Sarah T. came back after 3 weeks because the system followed up &mdash; that&apos;s $42K you would have lost&rdquo; thinks &ldquo;I can&apos;t cancel this.&rdquo;

**Triggering estimate follow-up from the admin dashboard:** When reviewing a client&apos;s leads during a call and the contractor confirms they sent a quote, open the client detail page &rarr; Overview tab &rarr; &ldquo;Leads Needing Follow-up&rdquo; card. Click &ldquo;Start Follow-up&rdquo; next to the lead. The system starts the estimate follow-up sequence immediately &mdash; no need to ask the contractor to text EST.

---

## 5. Guarantee Evaluation

**When:** Day 30 (Layer 1) and Day 90 (Layer 2).

**Guarantee terms:** 30-Day Proof (5 qualified lead engagements) and 90-Day Recovery (1 booked estimate from cold lead OR $5,000 probable pipeline). Full terms, volume conditions, and extension formula: see `docs/business-intel/OFFER-APPROVED-COPY.md` Section 3.

### Layer 1: 30-Day Check

The guarantee cron checks daily. At day 30:

1. Open the client&apos;s guarantee status at `/admin/clients/[id]` &rarr; Guarantee section.
2. Check: did 5+ leads have a two-way interaction (lead replied at least once after system response)?
3. **If yes:** Proof of life passed. Billing starts Day 31 at $1,000/month. No action needed.
4. **If no:** Proof of life failed. The contractor owes nothing. They walk away with every lead captured.
   - Before letting them go, investigate: Did they have any lead volume? If zero inbound in 30 days, the issue is their marketing. Have an honest conversation.
   - If they had leads but the system didn&apos;t engage them, that&apos;s a real failure. Apologize and fix the root cause. Offer to extend the free period.

### Layer 2: 90-Day Check

**Evaluation process:**

1. Check the client&apos;s guarantee progress in the admin dashboard: client detail page &rarr; Overview tab &rarr; Guarantee Status card. It shows the current phase (`proof_pending` / `recovery_pending`), progress against thresholds (QLE count and pipeline value), days remaining, and an on-track/at-risk/failing status badge. Use this daily to catch at-risk clients before the window closes.
2. Check Criterion A: is there a logged attributed opportunity?
3. If not, check Criterion B: did `probablePipelineValue` reach $5,000? (visible in the client dashboard pipeline summary and bi-weekly reports)
4. **If either passes:** Guarantee met. Use in retention pitch: &quot;In 90 days, the system built $X in your pipeline.&quot;
5. **If neither passes:** Refund most recent month. Provide full data export. Have an exit conversation — either fix and re-engage, or part professionally.

---

## 6. Contractor Wants to Pause

**When:** Contractor going on vacation, seasonal slowdown, or cash flow issue.

**Process:**

1. Go to `/admin/clients/[id]` &rarr; Edit &rarr; set status to **Paused**.
2. This automatically blocks all outbound messages for this client only (other clients unaffected). The compliance gateway checks client status before every send.
3. Pause the subscription in Stripe if billing should also stop (or the contractor pauses from `/client/billing`).
4. Text the contractor: &quot;Your account is paused. No charges until you resume. Your leads are still being captured &mdash; we&apos;ll follow up with them when you&apos;re back.&quot;
5. Set a calendar reminder for their expected return date.
6. On return: set status back to **Active**, resume subscription if paused, text them: &quot;Welcome back. [X] leads came in while you were away. Here&apos;s the summary.&quot;

---

## 7. Contractor Wants to Cancel

**When:** Client dissatisfied, budget issues, or business closing.

**Process:**

1. The cancellation flow has a 30-day notice period (per the offer terms).
2. **Before accepting:** Have a retention conversation. Ask what&apos;s not working. Common issues and fixes:
   - &quot;I&apos;m not seeing results&quot; &rarr; Check reports together. Show the pipeline value. Often they don&apos;t realize the system recovered $X.
   - &quot;The AI said something wrong&quot; &rarr; Fix the KB entry. Offer to re-train. This is a knowledge gap, not a system failure.
   - &quot;Too expensive&quot; &rarr; Show ROI math. One recovered $15k project covers 15 months. If they truly have zero ROI after 90 days, the guarantee covers them.
3. If they confirm cancel:
   - Process via `/client/cancel` (contractor) or admin dashboard.
   - Data export is generated within 5 business days (CSV: leads, conversations, pipeline).
   - Final billing runs at period end.
   - Text: &quot;Your data export is ready. Thanks for giving us a shot. If anything changes, we&apos;re here.&quot;

---

## 8. Lead Opts Out / Compliance Complaint

**When:** Lead texts STOP, or contractor reports a complaint.

**Process:**

1. STOP/opt-out is handled automatically by the compliance gateway. Lead is marked `opted_out`, all scheduled messages cancelled, confirmation sent.
2. If a lead complains to the contractor directly (&quot;why am I getting texts?&quot;):
   - Check the lead&apos;s conversation history. Verify consent basis (missed call reply, form submission, etc.).
   - If consent was valid: explain to the contractor that the lead opted in by contacting them first.
   - If consent is questionable: opt the lead out manually and add a note.
3. If the complaint escalates (regulatory inquiry, legal threat):
   - The audit trail has full consent records. Export from the lead detail page.
   - See `docs/legal/01-LEGAL-COUNSEL-BRIEF.md` for compliance framework.
   - Never argue with the lead. Opt out immediately and document.

---

## 9. Wrong Number / Misrouted Lead

**When:** Someone texts the business line who isn&apos;t a real lead (wrong number, spam, existing customer with a non-lead question).

**Process:**

1. The AI should detect non-lead messages via guardrails and either ignore or politely redirect.
2. If the AI engages with a non-lead:
   - Mark the lead as `opted_out` or `lost` with a note.
   - Block the number if it&apos;s spam (`/admin/clients/[id]/phone` &rarr; blocked numbers).
   - If it&apos;s an existing customer: note that the system is for new inquiries. The contractor can handle existing customer communication directly.

---

## 10. Onboarding Call Script (30-45 Minutes)

**When:** Day 0-1, immediately after signing.

**The psychology:** Each step resolves a specific pain in the order the contractor feels them. Missed calls are the visceral, daily pain (this SELLS). Dead quotes are the chronic, demoralizing pain (this RETAINS). Resolve Pain 1 first, then Pain 2. Payment capture happens at the emotional peak &mdash; right after the wow moment, before setup.

---

**Minute 0-3: Anchor in Their Pain**

&gt; &quot;You mentioned you lose jobs when you can&apos;t pick up the phone on site. Let&apos;s make sure that stops today &mdash; before we hang up.&quot;

Do NOT start with a product tour or a features walkthrough. Start with the pain they told you about on the sales call. This sets the frame: we&apos;re solving YOUR problem, not demoing software.

---

**Minute 3-8: PAIN 1 &mdash; Missed Call Text-Back + Voice AI (LIVE DEMO)**

**Pre-check (30 sec):** If you did NOT already run the live test during the sales call (ICP qualifier Q5), do it now before any setup. Send a test SMS from your Twilio number to their business line while on the call. Watch for: (a) did it arrive? (b) how long did it take? (c) did it land on their cell or a separate app (Google Voice inbox, VoIP portal)? If the text never arrives, you have a carrier filtering or wrong-number issue &mdash; resolve it before proceeding. This 30-second check prevents the #1 Day 1 setup failure.

**Phone setup (2 min):** Set up conditional call forwarding from their business number (XYZ) to the Twilio number (ABC). This means their phone still rings first &mdash; if they answer, it&apos;s a normal call. If they don&apos;t answer, it forwards to the system.

1. **Determine their phone type first:**
   - &quot;Is your business number a cell phone, a home landline, or through a phone service like RingCentral?&quot;
   - **Cell phone (most common):** Dial `*61*[Twilio number]*11*20#` for conditional forward after 20 seconds (3 rings). If that doesn&apos;t work on their carrier, fall back to `*61*[Twilio number]#` or `*72[Twilio number]` (unconditional).
   - **Landline:** Same `*61` codes, but confirm with a test call.
   - **VoIP/PBX (RingCentral, Ooma, Bell Fibe):** Walk through their admin portal to set forwarding. This takes 5-10 min &mdash; consider doing it post-call if time is tight.
   - **Google Voice:** Cannot forward. Use the Twilio number directly for everything.

2. **Disable carrier voicemail (critical):** Carrier voicemail competes with the forward &mdash; whichever has a shorter timeout wins. If voicemail answers before the forward triggers, the system never sees the call. Have them dial their carrier&apos;s voicemail disable code (Rogers/Telus/Bell: usually `##004#` or call carrier support). This is the #1 setup failure point &mdash; test it before moving on.

3. **Test it live:** Have them call their own business number from another phone (spouse&apos;s phone, your phone). Their phone rings 3 times. They don&apos;t answer. Two things happen:
   - **Voice AI picks up:** &quot;Hi, thanks for calling [Business Name]. I&apos;m the scheduling assistant &mdash; how can I help?&quot;
   - **5-second text-back fires** on the caller&apos;s phone.

4. **The wow moment:** Say nothing for 4 seconds after the text arrives. Let them sit with it. Then:

&gt; &quot;That&apos;s what happened to the call you missed last Tuesday while you were on the roof. Except now, the AI picked up AND the homeowner got a text. Two safety nets instead of voicemail.&quot;

5. **Voice AI demo (second beat):** &quot;Call again and stay on the line this time.&quot; They hear the Voice AI qualify the lead, ask about the project, and offer to book an estimate. Point out: &quot;Your customers get a professional greeting and an appointment booked &mdash; even at 9pm on a Sunday.&quot;

**What the contractor needs to understand:**
- &quot;Your phone still rings first. You answer when you can. When you can&apos;t &mdash; and we both know that&apos;s half the day on a job site &mdash; the AI picks up, qualifies the lead, and books the estimate. Nothing falls through the cracks.&quot;
- Family/personal calls: &quot;If your wife or someone personal calls, your phone rings first and you answer normally. If you miss it, the AI will take a message and text you &mdash; it won&apos;t try to sell them a renovation.&quot;

**Time to first value: 8 minutes into the call.**

### Listing Migration Pre-Commitment (Still on the Onboarding Call)

After the wow moment and before moving to payment capture, plant the Day 7 listing migration:

&gt; &ldquo;Right now this catches every call to your new business line. But your Google listing still sends people to your cell &mdash; if you miss those, they call the next contractor. On our check-in next week, I&rsquo;ll update your Google listing so every Google lead gets this same safety net. It takes 5 minutes and you&rsquo;ll watch me do it on screen share. Sound good?&rdquo;

**If they say &ldquo;just do it now&rdquo;:** Do it immediately. Share your screen, update the Google Business Profile together, then HomeStars. Do not manufacture friction where none exists.

**If they hesitate:** Do not push. Say: &ldquo;No rush &mdash; let&rsquo;s get you running this week and we&rsquo;ll talk about it when you&rsquo;ve seen the system in action.&rdquo; Schedule the Day 7 check-in and revisit then.

**Before hanging up:** Confirm the Day 7 check-in is on both calendars. This is a scheduled deliverable, not a suggestion.

**Hand them the exit document** (see Appendix: What We Changed): &ldquo;This is everything we set up today. Your original number, what we changed, and how to undo it in 5 minutes if you ever want to. Keep it somewhere you can find it.&rdquo;

**Timing calibration note (clients 1-5):** The Day 7 default is based on 10-agent consensus analysis. If by Day 6 the system has caught zero missed calls (slow week or contractor answered everything), push the listing migration to Day 10 &mdash; do not walk into the migration conversation with no data to show. Track what timing works for your first 2 clients and adjust the default accordingly.

### Progressive Phone Strategy (Day 14+)

The conditional forward (*61) is Phase 1. After the contractor trusts the system (Day 14 check-in), show them the data:

&gt; &quot;You answered 11 calls this week. The AI caught 4 you missed &mdash; 2 of those booked estimates. But 1-2 callers hung up during the ring before the AI could pick up. Those leads are gone. Want to tighten the window so the AI catches them faster?&quot;

**Phase 2 options (Day 14-30, contractor chooses):**
- **Shorter ring window:** Reduce from 20 seconds to 10 seconds (2 rings). AI catches more, contractor still gets first crack.
- **AI-first with ring-through (Option D):** All calls go to Twilio first &rarr; Twilio rings the contractor&apos;s cell for 15 seconds &rarr; if no answer, Voice AI picks up. Benefit: every call is logged, zero hang-up loss. The contractor still answers when available.
- **Full AI receptionist (for the right contractor):** Voice AI answers every call, qualifies, and either books an estimate or offers a live transfer to the contractor. The contractor only talks to qualified leads. &quot;Like having a receptionist who answers on the first ring.&quot;

Do not push Phase 2 on Day 0. Let the data make the argument.

---

**Minute 8-12: PAYMENT CAPTURE (Emotional Peak)**

Capture the card NOW &mdash; while the contractor is seeing the system work. Do not wait until the end of the call.

&gt; &quot;Let me get the billing out of the way so we can focus on the fun stuff. I&apos;m texting you a link right now &mdash; first month completely free. Card is just so billing starts automatically on [exact date] if you decide to keep it. Cancel anytime before then, zero charge.&quot;

Stay on the line. Confirm in Stripe. See Payment Capture section below for hesitation/refusal scripts.

**Do not proceed to KB setup before payment is captured or explicitly declined.**

---

**Minute 12-15: Exclusion List + Old Quotes Setup**

4. **Exclusion list (1 min, mandatory):** &quot;Before we fire anything &mdash; are there any contacts you want us to skip? Family, close friends, anyone you have a personal relationship with? We&apos;ll keep them off all automated messages.&quot; Record the names. Frame it as protecting their relationships, not a product limitation. Add each excluded number in the admin dashboard: client detail page &rarr; Configuration tab &rarr; Exclusion List card &rarr; Add Number.

5. **Old quotes (3 min):** &quot;Now &mdash; those old quotes you never heard back from. How many from the last 6 months?&quot; Get the list on the call &mdash; don&apos;t assign it as homework. Have them scroll through their phone contacts or Jobber and read off names while you type. Build the first reactivation message live:

   &gt; &quot;Hey [Name], it&apos;s [Contractor] &mdash; you got a quote from us a few months back. Still thinking about the project? Happy to revisit if the timing works.&quot;

   Schedule reactivation to go out that afternoon. Tell them: &quot;You&apos;re going to see replies within 24 hours, probably sooner.&quot;

   **Pre-onboarding priming:** 24-48 hours before this call, the system automatically sent the contractor an SMS asking them to think of 5 dead quotes. Reference this if they already have a list ready: &ldquo;You may have already gotten a text from us about this &mdash; great, let&apos;s work through the list you prepped.&rdquo; If they didn&apos;t act on it, proceed as normal.

   **Onboarding call reminder:** The system auto-sent a reminder 2 hours before this call. If the contractor mentions receiving it, confirm: &ldquo;Yes, that&apos;s automated &mdash; we&apos;ll do the same for Day 7 and any future calls.&rdquo;

---

**Minute 15-25: KB + Services Setup**

6. **Business basics + KB (10 min):** Confirm business name, services, service area, team size (you already have this from signup &mdash; just verify). Then deep-dive:
   - &quot;Walk me through your most common job types. What do you typically charge for each?&quot;
   - &quot;What&apos;s your warranty?&quot;
   - &quot;What DON&apos;T you do?&quot;
   - &quot;When a lead asks for a price, what do you want the system to say?&quot; (Most contractors: &quot;Don&apos;t quote prices, get them to book an estimate.&quot;)
   - &quot;What makes you different from the next contractor?&quot;

   **Pricing ranges are mandatory.** The onboarding quality gate now requires at least 1 service with a pricing range (e.g., &quot;Drain cleaning: $150-$400&quot;). Without this, the AI defers every pricing question and the #1 homeowner question goes unanswered. If the contractor says &quot;it depends,&quot; push for a ballpark: &quot;What&apos;s the cheapest drain cleaning you&apos;ve done? And the most expensive? Great &mdash; I&apos;ll use that range so the AI can give them a rough idea.&quot; Set the service to &quot;Discuss price range&quot; with those values.

   Enter into KB as they talk. Read back the AI persona summary and get verbal approval: &quot;This is how your system will talk to homeowners. Sound like you?&quot;

   **Critical:** The messages must sound like THEM. This is identity protection, not a feature request.

7. **Jobber setup (optional, 2 min):** If the client uses Jobber, ask for their Jobber webhook URL. Configure in the admin dashboard: client detail page &rarr; Configuration tab &rarr; Integrations card &rarr; Add Integration &rarr; select Jobber. Two-way sync: CS fires appointment bookings to Jobber, Jobber&apos;s job_completed triggers CS review requests.

---

**Minute 25-30: Expectations + Day 7 Booking**

8. **Expectations (2 min):**

   &gt; &quot;Week 1: missed call text-back is live, your old quotes are getting followed up. Week 2: the system starts responding to new web form leads &mdash; I review every message before it goes out, so nothing hits your customers without a human check first. Week 3: fully autonomous &mdash; you&apos;ll get a text when that happens, and if you ever want to pause it, just text PAUSE. After every completed job, it asks for a Google review with a direct link. I check in every 2 weeks with a report showing exactly what happened. You don&apos;t manage any of this.&quot;

   **Two things I need from you (and ONLY these two things):**

   &gt; &quot;When you send someone a quote, text EST [their name] to your business number. That starts the follow-up clock. And when a job closes, text WON [name] or LOST [name] &mdash; that&apos;s how we track your results for the guarantee. Takes 2 seconds from your truck.&quot;

9. **Book Day 7 check-in BEFORE hanging up:**

   &gt; &quot;Let&apos;s lock in a quick check-in for [day, 7 days out]. 10 minutes. I&apos;ll show you what the system did in the first week and we can tune anything that needs it. [Tuesday or Wednesday] work?&quot;

   Put it in your calendar. This is mandatory, not optional.

---

**Minute 30-33: Trust Neutralizer (Closing)**

&gt; &quot;Last thing &mdash; I know you&apos;ve probably tried something like this before and it didn&apos;t work out. This is month-to-month. No contract. You can cancel by texting me. The only reason you&apos;d stay is because it&apos;s working. Every two weeks you get a report your accountant can look at. If the math doesn&apos;t work, we stop. Fair?&quot;

This addresses the agency trauma directly, at the end, after they&apos;ve already seen the system work. It&apos;s not a sales tactic &mdash; it&apos;s honest reassurance after proof.

### Payment Capture (During Onboarding Call)

**Why now:** Getting the card during the onboarding call &mdash; while the contractor is excited and engaged &mdash; is standard managed-service practice. Trial-to-paid conversion is 60-80% with card upfront vs. 20-30% when you invoice later. You also avoid a second awkward &quot;time to pay&quot; conversation on Day 31.

**The script (after the &quot;wow moment&quot;, before expectations):**

&gt; &quot;Alright, everything&apos;s looking great. Let me get the billing piece out of the way so we can focus on results. I&apos;m going to send you a quick link right now &mdash; your first month is completely free. The card is just so billing starts automatically on [exact date, 30 days out] if you decide to keep it. You can cancel anytime before then and you&apos;ll never be charged.&quot;

**How to do it:**

1. While on the call, go to the contractor&apos;s client detail page in admin.
2. Click **&ldquo;Send Payment Link&rdquo;** in the page header &mdash; select the plan, click Send. The system creates a Stripe Checkout Session with the 30-day free trial and texts + emails the link to the contractor instantly. No portal login needed &mdash; they tap the link, enter their card on Stripe&apos;s page, done. Takes 30 seconds.
3. Confirm you see the subscription created: &quot;Perfect, I can see that went through. Your free month starts today, and if everything&apos;s working like we planned, billing kicks in on [date]. Sound good?&quot;

**If they hesitate:**

&gt; &quot;Totally understand. Think of it like a gym membership with a 30-day money-back guarantee &mdash; except you keep everything we set up. The card is just a placeholder. If you don&apos;t see results in 30 days, cancel from your dashboard or just text me and I&apos;ll cancel it for you. Zero charge.&quot;

**If they refuse to put a card down:**

Don&apos;t force it. Say:

&gt; &quot;No problem at all. Let&apos;s get everything set up and I&apos;ll send you the link after. You can do it when you&apos;re ready.&quot;

Then follow up in 24-48 hours with the link. Most contractors who refuse on the call will convert after seeing the system work for a day. If they still don&apos;t add a card by Day 7, they&apos;re unlikely to convert &mdash; don&apos;t invest heavy ops time.

**After the call (operator, same day, 30 min max):**
- Complete all KB entries from call notes (or encourage the self-serve KB wizard at `/client/onboarding`). Note: the admin onboarding wizard also prompts for KB setup on completion &mdash; if you ran onboarding setup from the admin side, the KB wizard link appears automatically when you finish.
- Set AI tone based on their communication style.
- Configure business hours from the call.
- **Fire the outbound quote reactivation batch** &mdash; send the messages to the dead quotes collected on the call. This is the highest-ROI action on Day 0. Do it before anything else.
- **Run Voice AI Playground QA:** Open `/admin/voice-ai`, expand the client. Preview the greeting (hear it in their voice). Run the KB Test (all 10 questions should be answered or deferred, not gapped). Run the Guardrail Test (all 8 should pass). Complete QA Checklist &rarr; click &ldquo;Go Live.&rdquo;
- **KB embedding:** After saving structured knowledge, entries are automatically embedded for semantic search. No action needed &mdash; the system handles this in the background. If the Voyage AI service is down, search falls back to keyword matching until embeddings complete.
- Verify call forwarding with a test call to XYZ &mdash; confirm it rings 3 times then forwards to Twilio.
- Verify subscription was created in Stripe Dashboard (trial active, card on file).
- Add exclusion list contacts to the DNC/skip list in admin.
- Send a recap text: &quot;You&apos;re live. Missed-call text-back is on, and I just sent follow-ups to [X] of your old quotes. You&apos;ll start seeing replies by tomorrow. Portal login: [link].&quot;

**Revenue Leak Audit (48-hour deliverable):**
Within 48 business hours of the onboarding call, complete and send the Revenue Leak Audit. This is the first tangible proof the managed service is real &mdash; do not skip it.

Use the template at `docs/operations/templates/REVENUE-LEAK-AUDIT-TEMPLATE.md`. It covers six sections: speed-to-lead, missed call rate, outstanding quotes, review gap vs. competitors, current follow-up system, and a conservative revenue impact estimate. The template includes operator research notes (internal only) and the client-facing finding for each section. Budget 30&ndash;45 minutes per client.

Send the completed audit via plain-text email or PDF with the subject line: &quot;[Business Name] &mdash; Your Revenue Leak Audit.&quot;

**Day 3-4 Check-in SMS (send from agency number):**

&gt; &quot;System update for [Business Name]: [X] leads captured, missed-call text-back fired [Y] times since Monday. We&apos;re building your AI knowledge base this week &mdash; full Smart Assist goes live [day]. Any questions before then?&quot;

Purpose: Manages contractor expectations during the 3-week ramp, creates a natural touchpoint before the first bi-weekly report, and prevents &quot;is anything happening?&quot; anxiety.

**Day 2-3: Quote Import Call (15 Minutes, Operator-Led)**

This call is standard for every client who could not provide a complete old-quote list during the onboarding call (the majority of clients).

**Pre-call SMS (send same day as onboarding):**

&gt; &quot;One more thing before our next quick call &mdash; think of 5 people you gave a quote to in the last 6 months that never got back to you. Just first name and what the project was. That&apos;s all I need.&quot;

**On the call:**

1. Contractor reads names, you type. Accept any format: names from phone contacts, Jobber export, screenshots, paper lists.
2. For each name, capture: first name, phone number, project type (if known), approximate quote date.
3. Minimum viable batch: 10&ndash;15 names. Even 5 is worth sending.
4. Import via CSV with `status: estimate_sent`.
5. Fire the reactivation batch immediately after import &mdash; same day.

**For contractors who genuinely have zero dead quotes:**

Replace quote reactivation with &quot;past customer check-in&quot; using a different script:

&gt; &quot;Hey [Name], it&apos;s [Contractor]. Been a while &mdash; do you have any projects coming up? Happy to take a look.&quot;

**For contractors with very few quotes (&lt;5):**

Batch ALL historical contacts (past customers, not just dead quotes). Volume compensates for the smaller list. Set expectations: &quot;Even 5 names is a solid start.&quot;

**After the call, text the contractor:**

&gt; &quot;Just sent follow-ups to [X] of your old quotes. You&apos;ll start seeing replies within 24&ndash;48 hours.&quot;

---

**Day 7-10: Listing Migration Call (15 Minutes, Operator-Led)**

This is the pre-scheduled call from the onboarding commitment. The goal: update Google Business Profile and HomeStars to the Twilio number so 75-85% of inbound leads flow through the system with a single, clean communication thread.

**Day 6 data check:** Before the call, check the client&rsquo;s dashboard. Has the system caught at least one missed call? If yes, proceed. If zero missed calls (slow week or contractor answered everything), push to Day 10. Do not walk into this conversation with no data.

**On the call (15 min):**

1. **Open with their data (2 min):** &ldquo;Quick update from your first week &mdash; you missed [X] calls while on site. The AI picked up [Y] of those, and [Z] leads replied to the text-back. Here&rsquo;s what those conversations look like.&rdquo; Show them the specific conversations in the dashboard.

2. **Name the gap (1 min):** &ldquo;Right now, we only catch calls that miss on your cell and forward to us. Your Google leads &mdash; which is where most of your inquiries come from &mdash; those still go to your cell first. If you answer, great. If you miss one, it goes to voicemail and the homeowner calls the next contractor. We have no way to catch those yet.&rdquo;

3. **The ask (30 sec):** &ldquo;Let me update your Google listing right now &mdash; takes about 5 minutes. Every Google lead will still ring your phone first. The only difference is if you miss it, the AI catches it instead of voicemail. Want to do it?&rdquo;

4. **Do it live on screen share (5-8 min):**
   - Open their Google Business Profile together (they log in, you walk them through it)
   - Change the phone number to the Twilio number
   - Then HomeStars (if they have a profile)
   - Then Facebook page (if they have one)
   - Confirm each change is saved

5. **Test it (2 min):** Call the Twilio number from your phone. Their cell rings. Let it go to voicemail. Voice AI picks up. Text-back fires. &ldquo;That&rsquo;s what every Google lead sees now when you&rsquo;re in a basement.&rdquo;

**If they say no:** Do not push. Say: &ldquo;No problem &mdash; the system is still catching your missed calls from forwarding. We can revisit this anytime.&rdquo; Note it in the operator log. Revisit at the Day 14 check-in with more data. If they still decline at Day 14, accept it &mdash; conditional forwarding is better than nothing.

**After the call, update the exit document** with the listings changed (URLs, original numbers, dates).

**What this unlocks:**
- Single-number experience for 75-85% of leads (Google + HomeStars + Facebook)
- Full pipeline visibility in reporting &mdash; the biweekly report now captures all system-touched leads
- Text-back comes from the same number the lead called &mdash; no &ldquo;who is this?&rdquo; confusion
- Contractor&rsquo;s cell still works for existing contacts, crew, family &mdash; nothing changes for them

---

**Day 7-14 Referral Ask (at the first visible win):**

Do NOT ask for referrals during onboarding. Ask at the moment of a visible win &mdash; when the contractor sees a recovered lead, a booked appointment from a dormant quote, or a specific dollar amount in their pipeline SMS. That emotional peak is when the referral story writes itself.

When a contractor texts you something like &quot;that old quote just replied!&quot; or you see a recovered appointment in their data, respond:

&gt; &quot;That&apos;s the kind of result that gets people talking. Know any other contractors who&apos;d want to see this? I&apos;m taking one or two more in [city] right now.&quot;

Why this timing works:
- They have a specific story with a dollar amount (&quot;a $40K kitchen I&apos;d given up on came back&quot;)
- They feel like an early adopter, not a late follower
- The capacity signal (&quot;one or two more&quot;) creates urgency without pressure
- Telling the story to a peer makes them look like a savvy business operator

Do not offer a referral incentive yet. At this stage the social currency (&quot;I found this thing that works&quot;) is more motivating than a discount. Add a formal referral credit structure after you have 5+ clients and can measure referral conversion.

---

## 10b. Day 45 Proactive Retention Call

**When:** Day 45 of the client relationship &mdash; midpoint between 30-day proof and 90-day guarantee. This is NOT a reactive call triggered by a problem &mdash; it is a PROACTIVE call that prevents Month 2-4 churn.

**Why Day 45:** The 8-agent consensus simulation identified this as the decision point. Every contractor who locks in before Day 60 becomes a 12+ month client. Every contractor who drifts past Day 60 without a strong retention anchor is at risk.

**Agenda (15-20 minutes):**

**1. Guarantee progress check (3 min):**

&gt; &quot;Quick update on your guarantee &mdash; you&apos;re at [X] qualified engagements out of 5 for the 30-day proof. [That passed on Day [X] / You&apos;re on track.] For the 90-day guarantee, your probable pipeline is at $[X] &mdash; we need $5K, so you&apos;re [on track / ahead / let&apos;s push on this].&quot;

Show the guarantee status card in the admin dashboard. Make the progress visible and concrete.

**2. ROI summary so far (5 min):**

&gt; &quot;In the first 45 days, your system responded to [X] leads, followed up on [Y] estimates, and booked [Z] appointments. That&apos;s $[pipeline value] in your pipeline right now. If even one of those closes, that&apos;s [X] months of the service paid for.&quot;

Use the bi-weekly report data. Frame as &quot;what would have happened without us&quot; &mdash; these leads would have gone to the next contractor on Google.

**3. What&apos;s working, what&apos;s not (3 min):**

&gt; &quot;Is there anything the AI is saying that doesn&apos;t sound right to you? Any leads that got a response you weren&apos;t happy with?&quot;

This surfaces tone or KB issues before they become silent churn drivers.

**4. Expansion opportunity (2 min):**

If they have team members not yet on the platform:
&gt; &quot;You mentioned your crew lead handles some site visits. Want to add them so they get booking notifications directly?&quot;

If they&apos;re on booking confirmation mode (Path C):
&gt; &quot;How&apos;s the booking confirmation working? Would you like to try Google Calendar so bookings go straight to your schedule?&quot;

**5. Referral ask (if results are strong) (2 min):**

Only if they have a visible win (recovered lead, booked appointment, or confirmed WON):
&gt; &quot;That&apos;s the kind of result that gets people talking. Know any other basement contractors who&apos;d want to see this? I&apos;m taking one or two more in Calgary right now.&quot;

If no visible win yet, skip the referral ask. Don&apos;t force it.

**Post-call:** Note any issues raised. Update client health in ClickUp. If referral was given, follow up within 48 hours.

---

## 11. Monthly Health Check (Internal)

**When:** First of every month, per client.

**Review:**

| Metric | Where to check | Action if bad |
|--------|---------------|---------------|
| Response time avg | Client revenue dashboard | If &gt;5 min, investigate delays (AI mode, compliance queuing) |
| Lead engagement rate | Leads table (new vs contacted) | If &lt;50% of leads get a response, check automation configs |
| Escalation frequency | Escalation queue | If &gt;20% of conversations escalate, KB is too thin |
| Knowledge gaps open | Gap queue | If &gt;10 open, dedicate 30 min to clear them |
| Win rate (quoted to won) | Revenue dashboard | If declining, review AI follow-up messaging quality |
| Guarantee status | Client detail | If approaching deadline without hitting threshold, investigate |
| Churn signals | Conversation tone, report engagement | If contractor stopped replying to check-ins, proactive call |

---

## 12. Sales Conversation Guide

**When:** Before and during a sales call with a prospective contractor.

### The Pain Hierarchy (Memorize This)

| Pain | Intensity | Role | How to use it |
|------|:---------:|------|---------------|
| **Missed calls on job sites** | 10/10 | **SELLS** (closes the deal) | Lead with this on cold calls. Every contractor has a specific memory of THE call they missed. &quot;Do you ever lose jobs because you can&apos;t answer your phone on a job site?&quot; |
| **Dead quotes going silent** | 8/10 | **RETAINS** (keeps them paying) | Pivot to this after opening. The $40K kitchen that walked back through the door is what makes them a believer and a referrer. |
| **Burned by agencies before** | 9/10 | **Trust wound** (not sellable) | Don&apos;t sell against this. Neutralize it: month-to-month early, guarantee before price, show results before asking for trust. |

**The flow:** Lead with missed calls to OPEN. Pivot to dead quotes to CLOSE. The guarantee neutralizes the trust wound.

### Language Rules

| Never say | Say instead |
|-----------|-------------|
| &ldquo;Automated follow-up&rdquo; | &ldquo;Your leads get followed up on even when you&apos;re mid-job&rdquo; |
| &ldquo;AI platform&rdquo; | &ldquo;The system&rdquo; or &ldquo;your response team&rdquo; |
| &ldquo;You need to fix your follow-up&rdquo; | &ldquo;You can&apos;t be texting leads from a roof &mdash; that&apos;s a capacity problem, not a you problem&rdquo; |
| &ldquo;Our automation handles it&rdquo; | &ldquo;We handle it&rdquo; |

---

### Pre-Sale Preparation (Before Every Sales Call)

**Run the Pre-Sale Revenue Leak Audit first.** Using publicly available data only, complete the lightweight audit template at `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`. It takes 15-20 minutes and gives you specific numbers to open with.

What you&apos;re looking for:
- Google review count vs. top 3 competitors in their area
- Website response mechanism (do they have a form? What happens when you submit it?)
- Any visible signals of missed calls or slow follow-up (GBP Q&amp;A with unanswered questions, low review recency, etc.)

Call opener when you have audit data: &ldquo;I did some research before reaching out &mdash; you have [X] Google reviews and the top contractor in [City] has [Y]. I can show you what that review gap is probably costing you, and what it would take to close it.&rdquo;

**Have the ROI Calculator ready.** During the call, when price comes up (and it will), use `POST /api/public/roi-calculator` with their numbers. If you&apos;re not at a computer, use the worksheet at `docs/operations/templates/REACTIVATION-ROI-WORKSHEET.md`. The goal is to shift the conversation from &ldquo;$1,000/month is expensive&rdquo; to &ldquo;I&apos;m leaving $X/month on the table.&rdquo;

---

### Who Gets 5-10x ROI (Sign Them)

These contractors will get massive value. Prioritize them. **Primary ICP: Calgary basement development contractors** &mdash; see `docs/business-intel/ICP-DEFINITION.md` for the canonical profile and sub-segment priority.

| Signal | Why it works | Basement-specific note | Expected ROI |
|--------|-------------|------------------------|:------------:|
| **15+ leads/month** from any source (calls, forms, referrals) | System has volume to work with. Speed-to-lead advantage kicks in. | Basement contractors in Calgary typically see 15&ndash;25/mo inbound | 10-25x |
| **15+ dead quotes** sitting unanswered from last 6 months | Day 1 quote reactivation delivers visible wins in Week 1. | Basement quotes are large &mdash; even 1 recovery = months of ROI | 5-15x |
| **Average project $50K+** (basements, legal suites) | One recovered project&rsquo;s profit ($10&ndash;16K at 20% margin) covers 10&ndash;16 months of the service. | Basement $50&ndash;100K; legal suite $80&ndash;120K | 10-20x |
| **Currently does zero systematic follow-up** on estimates | The 4-touch sequence over 14 days is pure incremental value. | Basement contractors are underground &mdash; no signal to reply | 10-20x |
| **Phone goes to voicemail on job sites** | Speed-to-lead gap is massive. System responds in 2&ndash;8 seconds. | &ldquo;Underground = no cell signal&rdquo; is the core pitch | 15-25x |
| **Has a Google Business Profile** with fewer than 60 reviews | Review generation compounds over 6&ndash;12 months. | Most Calgary basement contractors have 10&ndash;60 reviews | Long-term |
| **Owner + 1&ndash;3 crew, no office manager** | Right-size for $1K/month, nobody else handling follow-up | This IS the primary ICP profile | 10-20x |

**The ideal client has 3+ of these signals.** One signal is enough if the project value is high enough (one $80K basement suite = $16K profit = 16 months of the service).

### Who Will NOT Get ROI (Do Not Sign Them)

Be honest with these prospects. Signing them wastes their money and your time, and generates negative word-of-mouth.

| Signal | Why it fails | What to say |
|--------|-------------|-------------|
| **Fewer than 5 leads/month** with no dead quote backlog | System has nothing to work with. Guarantee window extends to 90+ days. | &ldquo;At your current volume, the system needs more time to prove itself. Let&apos;s revisit when your pipeline picks up, or start with importing your old quotes to see if there&apos;s recovery potential.&rdquo; |
| **Average project under $10K** (handyman, small repairs) | Break-even requires 1.2 projects/year at $10K &mdash; achievable but the margin is too thin to feel like a win. | &ldquo;At your project size, the math is tight. This service is built for contractors doing $25K+ jobs where one recovery covers the year.&rdquo; |
| **100% word-of-mouth, zero inbound, zero estimates sent** | No digital lead flow = no SMS conversations = AI has nothing to do. | &ldquo;Your business runs on relationships, which is great. This system works on leads that come through your phone or website. If you ever start getting inbound inquiries, we&apos;d be a great fit.&rdquo; |
| **Already has a receptionist or office manager handling all follow-ups** | Incremental value is low if follow-up is already systematic. Speed advantage is the only differentiator. | &ldquo;It sounds like you&apos;ve already solved the follow-up problem. The main value for you would be the after-hours speed advantage and review automation. Worth discussing, but only if those gaps are real for you.&rdquo; |
| **Contractor who doesn&apos;t use a smartphone or text** | The system communicates via SMS. A contractor who only uses phone calls has no interaction path. | &ldquo;The system works through text messaging. Voice AI is included and handles calls too, but the follow-up and conversation engine runs on SMS. If your customers only use phone calls and never text, the system still catches missed calls via Voice AI.&rdquo; |
| **Contractor in active financial distress** | $1,000/month when they can&apos;t make payroll is irresponsible to sell. | &ldquo;I&apos;d rather wait until your cash flow stabilizes. This service pays for itself, but not if the $1,000 is money you need for materials this week.&rdquo; |

**The rule:** If you wouldn&apos;t feel good explaining to their spouse why they should pay $1,000/month, don&apos;t sign them.

### The Gray Zone (Proceed with Caution)

| Signal | Approach |
|--------|----------|
| **8-12 leads/month** (below guarantee floor but not zero) | Sign them, but disclose the extended guarantee window upfront. Lead with dormant quote reactivation, not speed-to-lead. |
| **Referral-only but sends 8+ estimates/month** | Great fit for estimate follow-up + review generation. Skip the speed-to-lead pitch entirely. |
| **Seasonal contractor** (roofing, concrete, landscaping) | Discuss the seasonal pause option upfront. Sign them in spring when volume is high, not in November. |
| **Contractor with existing CRM** (Jobber, ServiceTitan) | Position as front-of-funnel complement. Webhook integration sends won leads to their CRM. Not a replacement. |
| **Contractor doing $1M+** with a full office staff | The managed service at $1,000/mo may feel low-touch for their expectations. Consider whether they need a higher-touch engagement or if the automation alone is enough. |

---

### Pre-Call Qualification

**Start with the 30-second qualifier** (from `docs/business-intel/ICP-DEFINITION.md`). All three must be YES before investing time in the call:

1. &ldquo;Do you do basement development or finishing?&rdquo; &mdash; if no, pass
2. &ldquo;How many inquiries do you get a month?&rdquo; &mdash; looking for 15+
3. &ldquo;When you&rsquo;re on a job site and your phone rings, what happens?&rdquo; &mdash; looking for &ldquo;voicemail&rdquo; or &ldquo;I call back later&rdquo;

Then answer these two questions before the call. If either is a hard no, adjust your pitch &mdash; don&rsquo;t waste a call.

**1. Minimum lead volume check**

> &ldquo;Do you get at least 15 new inquiries per month &mdash; calls, form fills, Google leads?&rdquo;

Below 15/month: the guarantee windows will extend substantially, and Week 1 reactivation results may be thin. Not a disqualifier, but manage expectations upfront. The dormant reactivation pitch is more important than the speed-to-lead pitch for low-volume contractors.

**Required disclosure for sub-15 lead volume prospects:**
If the contractor reports fewer than 15 inbound leads per month, explicitly state the adjusted guarantee window during the close:
- 10 leads/month &rarr; 30-day proof becomes 45 days, 90-day guarantee becomes 135 days
- 8 leads/month &rarr; 30-day proof becomes 56 days, 90-day guarantee becomes 168 days
- Below 8: &ldquo;We&rsquo;ll review your situation individually&rdquo;

Say it plainly: &ldquo;At your lead volume, the guarantee window extends to [X] days instead of 30. That&rsquo;s built into the terms so you&rsquo;re never penalized for a slow period.&rdquo;

**2. Referral vs. inbound ratio**

Ask: &ldquo;Where do most of your jobs come from &mdash; referrals, Google, HomeStars, yard signs?&rdquo;

- Mostly referrals (60%+): lead with estimate follow-up + review generation + win-back, not speed-to-lead. See Objection 3 in the full playbook. (Referral Veterans are AVOID as primary &mdash; see ICP sub-segment table.)
- Mixed or mostly inbound: lead with speed-to-lead and the missed-call text-back. Use basement-specific framing: &ldquo;You&rsquo;re underground, no signal &mdash; homeowner calls the next guy.&rdquo;
- Purely referrals + already has staff handling calls: the pitch is about follow-up depth and payment collection, not response time.

---

### The "Call Your Own Number" Demo

Move this from the onboarding call (Section 10) into the sales call when possible. Do it toward the end after you&apos;ve described the missed call text-back feature.

> &ldquo;Before I let you go &mdash; want to try it right now? Call the demo number. Let it ring to voicemail. Watch what happens.&rdquo;

When the text-back arrives in 10&ndash;15 seconds, say nothing. Let them react.

**Basement-specific framing after the demo lands:**

> &ldquo;That text just went out in 5 seconds. Picture this: you&rsquo;re down in a basement, no signal, framing a wall. A homeowner calls for a suite quote. They don&rsquo;t leave a voicemail &mdash; they call the next guy on Google. With this, they get a text before they even hang up. You just stole the lead from whoever was going to answer.&rdquo;

This is the most effective demo in the sales sequence. It costs you nothing to run and converts skeptics immediately. If they&apos;re with you in person, show it from across the table. If you&apos;re on a video call, have them text the number and screen-share the response.

---

### Objection Quick-Reference

Full scripts are in `docs/business-intel/SALES-OBJECTION-PLAYBOOK.md`. This is the cheat sheet for the call.

| Objection | Core reframe | Section |
|-----------|-------------|---------|
| "What if the AI says something wrong?" | Show Smart Assist review window and correction loop | Tier 1, #1 |
| "I got burned by a similar tool/agency" | Managed vs. software; lead with guarantee, not features | Tier 1, #2 |
| "I work from referrals" | Estimate follow-up + reviews + win-back — not speed-to-lead | Tier 2, #3 |
| "I already respond fast / have someone answering" | Consistency gap (3-hour job site window); follow-up depth | Tier 2, #4 |
| "I don&apos;t want a robot talking to my customers" | Show disclosure, show escalation, emphasize 80/20 split | Tier 3, #5 |
| "I&apos;ll look at this in spring" | Outstanding quote ROI math; setup takes one 30-min call | Tier 3, #6 |
| "I already use Jobber/HubSpot" | Front-of-funnel complement, not replacement | Tier 3, #7 |
| "$1,000/month is expensive" | ROI math on outstanding quotes; risk is one month | Tier 3, #8 |
| "I don&apos;t have many leads right now" | Dormant reactivation is the pitch | Tier 3, #9 |
| "Customers have my personal cell" | Supplement not replace; call forwarding setup | Tier 3, #10 |

---

### Post-Call Follow-Up Templates

**Day 25 billing reminder (automated):** At Day 25 of the trial, the system automatically sends the contractor an SMS via the agency line: &ldquo;Your free trial ends in 5 days. Your card on file will be charged [amount] on [date]. Reply HELP to reach us.&rdquo; This is automated — you do not need to send a manual outreach at Day 25. However, if the contractor calls or texts with billing questions after receiving this reminder, handle it proactively: confirm the trial end date, offer to walk through the plan, and remind them they can cancel anytime.

**If card was captured on the sales/onboarding call (preferred path):**

Send within two hours. Confirm next steps &mdash; no payment ask needed.

> Subject: ConversionSurgery &mdash; you&apos;re all set
>
> [Name],
>
> Good talking today. Quick recap:
>
> - Your number is live &mdash; missed call text-back is already working.
> - [One sentence on what resonated most &mdash; estimate follow-up, reactivation, or response speed based on their profile]
> - Your free month runs through [date]. I&apos;ll check in every two weeks with a report showing exactly what the system is doing.
> - Next from you: send me those old quotes when you get a chance. I&apos;ll get them working this week.
>
> Questions anytime &mdash; reply here or text [your number].
>
> [Your name]

**If card was NOT captured (follow-up needed):**

Send within two hours of the sales call. Include the payment link.

> Subject: ConversionSurgery &mdash; what we covered
>
> [Name],
>
> Good talking today. Here&apos;s a quick summary:
>
> - [One sentence on what resonated most &mdash; estimate follow-up, reactivation, or response speed based on their profile]
> - First month is completely free. Month-to-month after that, cancel anytime.
> - Next step: [payment link] &mdash; takes 60 seconds. Once that&apos;s done, I&apos;ll schedule your 30-minute onboarding call and your number goes live within 24 hours.
>
> If you have questions, reply here or text [your number].
>
> [Your name]

**Text follow-up if no card after 24 hours:**

&gt; Hey [Name] &mdash; just checking in from yesterday. Here&apos;s the link to get started whenever you&apos;re ready: [payment link]. First month is free, and I&apos;ll have your number live within 24 hours of setup. No rush.

**Final follow-up at Day 3 (if still no card):**

&gt; Last nudge from me on this &mdash; the link is here if you want to get started: [payment link]. If the timing isn&apos;t right, totally understand. Just let me know either way.

Do not send more than 2 follow-ups for payment. If they don&apos;t convert by Day 7, move them to a &quot;warm nurture&quot; list and check back in 30 days.

Adjust the middle bullet to the specific objection they raised. If they were skeptical about AI quality, link to the sample conversation in the playbook and paste it into the email. If they were referral-heavy, lean into the estimate follow-up line.

---

## Process Map: When Something Happens

| Scenario | Who acts | Process |
|----------|----------|---------|
| New lead texts in | AI (automatic) | AI responds, logs conversation, scores lead |
| Lead asks question AI can&apos;t answer | AI defers, gap queued | You fill KB entry from contractor input (Section 1, Knowledge Gap) |
| Lead wants an estimate | AI books appointment or notifies contractor | Contractor sends estimate, triggers follow-up via SMS command |
| Estimate sent, no response | System (automatic) | 4-touch follow-up over 14 days |
| Lead no-shows appointment | System (automatic) | Same-day AI follow-up + rebook attempt |
| Lead goes dormant (25+ days) | System (automatic) | Win-back AI message, up to 2 attempts |
| Lead opts out | System (automatic) | Compliance gateway handles STOP, cancels scheduled messages |
| Lead complains | You handle | Check consent, opt out if needed (Section 8) |
| AI says something wrong | You handle | Fix KB entry, review flagged messages (Section 3) |
| Contractor asks &quot;is this working?&quot; | You handle | Bi-weekly strategy call covers this &mdash; walk through pipeline and revenue on the call (Section 4) |
| Bi-weekly strategy call due | You schedule | 30-min call: revenue capture, report walkthrough, action items, business challenges (Section 4) |
| Contractor wants to pause | You handle | Pause subscription + automations (Section 6) |
| Contractor wants to cancel | You handle | Retention call, then process if confirmed (Section 7) |
| 30-day guarantee check | System flags, you review | Check 5 qualified engagements (Section 5) |
| 90-day guarantee check | System flags, you review | Check 1 attributed opportunity (Section 5) |
| Old quotes not collected on Day 1 | Operator schedules Day 2-3 | Quote Import Call &mdash; 15 min (Section 10) |
| Old quotes imported | You handle | CSV import with estimate_sent status (Section 2) |
| New month starts | You review | Monthly health check (Section 11) |
| Cron job fails | System alerts operator via SMS | Check reliability dashboard, investigate failed job |
| Sales call booked | You prep | Run pre-call qualification (Section 12) |
| Prospect raises objection | You handle | Follow Section 12 quick-reference |
| Negative review comes in | System alerts, you review | Check AI draft in admin, approve or edit (Section 13) |
| Quarterly campaign recommended | You review | Launch or customize per Section 14 |
| Voice transfer fails | System handles, you monitor | P1 escalation created, contractor alerted (Section 15) |
| Contractor reports calendar sync issue | You handle | Check errors count, reconnect if needed (Section 16) |
| Contractor texts WON or LOST | System (automatic) | Lead status updated, review request triggered on WON, sequences cancelled on LOST (Section 17) |
| Contractor texts WINS | System (automatic) | Lists recent leads with pending outcomes and ref codes (Section 17) |
| Contractor texts PAUSE | System (automatic) | AI mode off, scheduled messages cancelled, confirmation sent (Section 17) |
| Contractor texts RESUME | System (automatic) | AI mode restored to autonomous, confirmation sent (Section 17) |
| Contractor asks about outcome texts | You explain | Auto-detect probable wins + WON/LOST commands (Section 17) |
| Non-GCal contractor gets a booking request | System sends confirmation SMS | Booking confirmation mode &mdash; contractor replies YES or suggests new time (Section 16) |
| Contractor asks &ldquo;how do I set up the AI myself?&rdquo; | You direct | KB wizard at `/client/onboarding` (Section 10) |
| Contractor wants to approve review responses without calling you | You direct | Portal review approval at `/client/reviews` (Section 13) |
| AI mode advances to Smart Assist or Autonomous without operator action | System (automatic) | AI auto-progression cron — contractor receives SMS notification |
| Contractor gets email instead of SMS for booking | You explain | Email fallback (Section 18) |
| Lead or contractor asks about STOP vs. permanent block | You handle | DNC vs opt-out (Section 19) |
| Homeowner calls contractor&apos;s number, contractor answers | Contractor (normal) | System never sees it. Contractor handles directly. |
| Homeowner calls contractor&apos;s number, contractor misses | System (automatic) | Call forwards to Twilio. Voice AI answers + text-back fires (Section 23) |
| Contractor&apos;s call forwarding breaks silently | System alerts operator | Zero-activity alert fires after 48hr of no calls (Section 23) |
| Contractor asks &ldquo;can the AI just answer everything?&rdquo; | You offer Phase 3 | Progressive phone strategy (Section 23) |
| Contractor wants to port their number | You initiate | Number porting process (Section 23, Day 30+) |
| Family member calls business number, contractor misses | Voice AI handles | AI takes a message, texts contractor: &ldquo;Personal call, not a lead&rdquo; (Section 23) |

---

## 13. Review Monitoring &amp; Response

**What it does:** The system syncs Google reviews hourly. AI drafts a response for each new review automatically.

**Review approval modes (SPEC-UX-05):** Each client has a `reviewApprovalMode` setting:

- **operator_managed** (default for managed-service clients): Positive reviews (3+ stars) are auto-approved and posted to Google automatically &mdash; no operator action needed. Negative reviews (1-2 stars) are held for operator review. Operator gets an SMS alert for each negative review.
- **client_approves** (default for self-serve): All drafts go to the contractor&apos;s portal for approval.

**Operator daily workflow (operator_managed clients):**

1. Positive reviews: no action &mdash; auto-posted.
2. Check `/admin/clients/[id]/reviews` &rarr; &ldquo;Pending Responses&rdquo; section for negative reviews.
3. For each negative review:
   - **Approve &amp; Post** if the AI draft is appropriate.
   - **Edit** the draft to adjust tone or add context, then approve.
   - **Forward to Client** if the review needs the contractor&apos;s personal input (e.g., specific job site incident). The response will appear on their portal at `/client/reviews`.
4. Use &ldquo;Approve All Positive&rdquo; batch button if any positive reviews weren&apos;t auto-posted (edge case).
5. For sensitive reviews (legal threats, health/safety claims): do NOT approve. Contact the contractor first.

**Contractor portal (managed clients):** Contractors only see reviews that the operator explicitly forwarded. Empty state reads: &ldquo;Your account manager handles review responses.&rdquo;

**During onboarding:** explain the review system during the Section 10 call.

Script:
> &quot;We monitor your Google reviews automatically. Positive reviews get a professional response posted on your behalf within hours. For negative reviews, I review the response personally before anything goes public. If a negative review needs your personal touch &mdash; I&apos;ll forward it to you for editing. You don&apos;t need to check anything unless I send it your way.&quot;

If the contractor asks about control: they can always request `client_approves` mode to review every response themselves. Toggle in admin client settings.

---

## 14. Quarterly Growth Blitz Delivery

**What it is:** Each quarter, a cron recommends a campaign type based on the client&apos;s data. This runs on top of always-on automation &mdash; it is a supplementary manual push, not a replacement.

| Quarter | Default campaign | Goal |
|---------|-----------------|------|
| Q1 | Dormant lead reactivation | Re-engage past inquiries who never converted |
| Q2 | Review acceleration | Targeted push to increase Google review count |
| Q3 | Pipeline builder | Reach out to past inquiries ahead of fall season |
| Q4 | Year-end review + 30-min strategy call | Annual planning and retention |

**Operator steps:**

1. Check the quarterly campaign recommendation in the admin dashboard: client detail page &rarr; Campaigns tab &rarr; Quarterly Campaigns card. The contractor also sees a conditional campaign card on their own dashboard when a campaign is scheduled or launched (not during the &ldquo;planned&rdquo; state).
2. Review the suggested copy. Customize if the tone or offer needs adjustment for this contractor.
3. Launch the campaign and note the send date.
4. After 2 weeks, report results to the contractor: engagements, replies, appointments booked.

**Expected outcomes per quarter:** 3-8 additional qualified engagements; 2-5 additional reviews (Q2); 1-2 recovered projects (Q1/Q3).

If the contractor prefers a different campaign type than the recommendation, accommodate the request from the available menu &mdash; the recommendation is a default, not a mandate.

---

## 15. Voice AI Delivery

**Included by default.** Voice AI is part of every plan — there are no per-minute charges to the contractor. It is typically activated at Week 3 or later once the KB is solid and the client is in Autonomous mode.

**Activation modes:**

| Mode | Behavior |
|------|----------|
| Always on | AI answers every inbound call |
| After-hours | AI answers only outside configured business hours |
| Overflow | AI answers only when the call rings past a timeout with no answer |

**During onboarding (if voice is enabled):** ask which mode the contractor prefers and configure it in admin settings.

**Missed transfer recovery:** when the AI attempts a hot transfer to a team member and no one answers, three things happen automatically: (1) the homeowner receives an SMS saying someone will call them back, (2) a P1 escalation appears in the triage dashboard, and (3) the team member receives an alert SMS. You do not need to manually intervene &mdash; but monitor the triage queue to confirm the contractor follows up.

Explain this to the contractor before enabling voice:
> &quot;If our AI answers a call and the customer wants to talk to a person, we transfer them to your team. If nobody picks up, we text the customer that you&apos;ll call back and alert your team immediately.&quot;

**Kill switch:** if the contractor reports unexpected call behavior, toggle the Voice AI kill switch in admin settings. Calls will forward directly to the owner until the issue is resolved.

---

## 16. Calendar Sync Support

**What it does:** Connects the contractor&apos;s Google Calendar. Platform appointments push to Google Calendar as events. Google Calendar events block booking slots so the AI never double-books.

**During onboarding &mdash; three calendar paths:**

Ask during the call: &ldquo;Do you use Google Calendar daily for scheduling?&rdquo;

- **Path A (Yes, uses GCal):** Connect now. &ldquo;Connect your Google Calendar so we can see when you&apos;re busy. When we book an appointment, it shows up in your calendar automatically. And if you block time in Google Calendar, we won&apos;t book over it.&rdquo;
- **Path B (No, but can adopt):** Help migrate on the call (5 min). &ldquo;Let me help you set up Google Calendar for your business. We&apos;ll add your current schedule. Takes 3 minutes.&rdquo;
- **Path C (No digital calendar / paper):** Enable booking confirmation mode. &ldquo;No problem &mdash; when we get a booking request, we&apos;ll text you first: &apos;Sarah wants Tuesday at 2pm. Reply YES or suggest another time.&apos; We won&apos;t confirm anything without you.&rdquo; Set `bookingConfirmationRequired = true` in admin client settings.

**Troubleshooting sync issues:**

1. Go to admin client detail &rarr; Configuration tab. Check the `consecutiveErrors` count on the calendar integration card.
2. If errors &gt; 3: red &ldquo;Sync failed&rdquo; banner is showing on the contractor&apos;s portal. Have them disconnect and reconnect via Settings &gt; Features.
3. If sync is stale (&gt;30 minutes since last sync): verify the calendar-sync cron is running on the reliability dashboard.
4. If the token expired: the contractor needs to re-authenticate via Google OAuth. Disconnect and reconnect resolves this.

Sync runs every 15 minutes via the `calendar-sync` cron. Connection requires Google OAuth with calendar read/write permissions.

---

## 17. Probable Wins Nudge + WON/LOST Commands

**What it is:** A daily automated SMS (10am UTC) to the contractor asking about leads that had appointments 7+ days ago but no outcome recorded. Up to 5 leads per client are batched into a single SMS with numbered options.

**Message format (single lead):**
> Sarah T. &mdash; basement dev. Did you win it?
> W = Won  L = Lost  0 = Skip

**Message format (multiple leads):**
> 3 jobs &mdash; won or lost?
> 1. Sarah &mdash; basement dev
> 2. Kyle &mdash; legal suite
> 3. Mike &mdash; basement finish
> W + numbers = won, L + numbers = lost
> e.g. W13 L2. Reply 0 to skip.

**Contractor reply syntax (replies work on EITHER phone number):**

| Reply | Example | What happens |
|-------|---------|-------------|
| W + numbers | W1 or W13 | Marks those leads as won, triggers review request + revenue prompt |
| L + numbers | L2 | Marks those leads as lost, cancels follow-up sequences |
| W or L (bare) | W | All leads won / all lost |
| Mixed | W13 L2 | Won 1 and 3, lost 2 &mdash; all in one reply |
| 0 | 0 | Skip all &mdash; leads roll to next week |
| PAUSE | PAUSE | Pauses all automation |
| RESUME | RESUME | Resumes automation |

**Legacy commands still work:** `WON 4A`, `LOST 4A`, `WINS` &mdash; for contractors who prefer the old format or are replying from the portal conversation view.

**Cross-route:** Contractors can reply to the nudge on either the agency number or the business number. The system detects pending prompts on both channels and handles the reply correctly. No training needed &mdash; contractors reply to whichever thread is open on their phone.

**Why it matters:** Without this, pipeline reports show $0 confirmed revenue even when contractors are winning jobs. The numbered replies let them report outcomes in 1-5 characters from their truck &mdash; no ref codes to remember, no portal login needed.

**During onboarding:** explain the system briefly: &ldquo;You&apos;ll get a text each week asking about your recent appointments. Reply W for won, L for lost &mdash; one character. That&apos;s how we track results for the guarantee.&rdquo;

Script:
> &quot;Every week, the system will text you a numbered list of recent appointments and ask if you won or lost them. Just reply W1, L2 &mdash; whatever the outcome is. Takes 2 seconds. This is how we track your wins and make sure the reports show real numbers.&quot;

If a contractor asks to stop receiving these nudges, they can be disabled per-client in admin settings. Note that disabling them will cause win-rate reporting to drift unless the contractor updates outcomes manually.

---

## 18. Email Fallback for Booking Notifications

**What it is:** When a booking notification SMS is blocked for all recipients (quiet hours, all recipients opted out, or compliance hold), the system falls back to email to ensure the contractor is notified.

**Contractor may ask:** &ldquo;Why did I get an email instead of a text about a new booking?&rdquo;

Response:
> &quot;The SMS was blocked by quiet hours or a compliance rule, so we sent an email to make sure you didn&apos;t miss the booking. If you prefer to receive these in a different way, we can adjust your notification settings.&quot;

This is expected behavior, not an error. No action needed unless the contractor wants notification routing adjusted.

---

## 19. DNC vs. Opt-Out

Two distinct mechanisms with different scopes. Use the right one.

| Mechanism | Trigger | Effect | Can reverse? |
|-----------|---------|--------|-------------|
| **Opt-out (STOP)** | Lead texts STOP | Commercial messages stop; transactional messages (booking reminders) continue | Yes &mdash; lead texts START to re-opt in |
| **DNC (Do Not Contact)** | Operator adds to global DNC list | ALL messages blocked (commercial + transactional) | No &mdash; DNC cannot be overridden by re-opt-in |

**When to use DNC:** a homeowner contacts the contractor directly to demand all contact cease; any legal or harassment concern is raised; contractor explicitly requests someone be permanently removed.

**When opt-out applies:** standard &ldquo;stop texting me&rdquo; requests. The system handles these automatically when the lead texts STOP.

**To add a number to DNC:** operator adds it via admin &rarr; the compliance gateway blocks all subsequent sends regardless of client or message type.

**During onboarding:** mention this distinction briefly so the contractor knows there are two levels of protection.

Script:
> &quot;If someone texts STOP, we stop immediately &mdash; that&apos;s automatic. If you need someone permanently removed &mdash; say a difficult customer situation &mdash; let me know and I&apos;ll add them to the do-not-contact list. That blocks everything, even transactional texts.&quot;

---

## 20. What the Contractor Experiences (End-to-End Journey)

Understand this before your first sales call. This is what you are promising.

**Day 0 &mdash; Signing:**
Contractor signs the service agreement. You create their account, assign an Alberta phone number. They see an onboarding dashboard with 3 steps: phone (done), AI setup, and old quotes.

**Day 1 &mdash; Onboarding call (30 min):**
You fill their KB, they call their own number and watch the missed-call text arrive in 3-5 seconds. This is the &ldquo;holy shit&rdquo; moment. You import their old quotes. They leave the call knowing the system is live.

**Day 1-2 &mdash; Revenue Leak Audit delivered:**
They receive a one-page assessment showing where money is leaking: slow response times, dead quotes, review gap vs competitors. This is the first proof the service is personalized, not generic.

**Day 2-5 &mdash; AI starts responding to real leads:**
The AI is in Smart Assist mode (5-min delay). The operator reviews every draft via SMS before it sends &mdash; the contractor doesn&apos;t see notifications or manage anything. If the operator needs input on a specific response, they text the contractor directly. Most drafts are fine and auto-send after 5 minutes untouched.

**Week 1 &mdash; Old quotes come alive:**
Their imported dead quotes start getting re-engaged. They get a text: &ldquo;[Lead name] responded to your follow-up.&rdquo; One or two responses in Week 1 validates the entire service. This is the retention moment.

**Week 2 &mdash; KB sprint:**
The AI encounters questions it can&apos;t answer. They get SMS nudges: &ldquo;A customer asked about [topic] and the AI didn&apos;t know. Add the answer here: [link].&rdquo; They tap the link, type the answer, done. The AI improves in real time.

**Week 3+ &mdash; Autonomous:**
The AI handles conversations end to end. The contractor&apos;s phone buzzes only when: (a) a lead needs human attention (escalation), (b) a job needs to be marked won/lost (daily auto-detect prompt), or (c) a Google review needs their approval. Time commitment drops to under 15 min/week.

**Bi-weekly &mdash; Performance report:**
Every 2 weeks they get an email report showing: leads captured, response times, estimates followed up, revenue impact. The &ldquo;Leads at Risk&rdquo; estimate shows the estimated pipeline at stake based on their response times and lead volume. An auto-SMS follows up.

**Quarterly &mdash; Growth Blitz:**
You launch a proactive campaign: dormant lead reactivation (Q1), review push (Q2), pipeline builder (Q3), strategy review (Q4). Results reported within 2 weeks.

**Ongoing &mdash; What they see daily:**
Their portal dashboard shows: Since Last Visit activity summary, Voice AI status card, System Activity (auto-tracked pipeline proof: leads responded to, missed calls caught, dead quotes re-engaged, appointments booked &mdash; no contractor input needed), and Jobs We Helped Win (the single confirmed-revenue card; shows $0 nudge when no wins recorded). A conditional Quarterly Growth Blitz card appears when a campaign is active. When everything is working the dashboard is quiet; when something needs attention a clear CTA surfaces it. The Help page shows an Account Manager card with the operator&apos;s name and phone when configured.

---

## 21. What Can Go Wrong (Honest Risk Table)

Know these before you sell. Each risk has a built-in mitigation, but you must understand the failure mode so you never oversell.

| Risk | Likelihood | What happens | What you do | How bad is it |
|------|:----------:|--------------|-------------|:-------------:|
| **AI gives wrong answer to a homeowner** | Medium (Week 1-2) | Lead gets incorrect info about services, pricing, or availability | Smart Assist catches it before sending (Week 2). Fix KB entry. If it got through, the operator correction loop fixes it same-day. | Low &mdash; fixable in minutes, AI learns immediately |
| **AI is too generic / defers too much** | High (Week 1) | Lead gets &ldquo;I&apos;ll have someone get back to you&rdquo; on basic questions | KB is thin. Fill more entries from the gap queue. This is normal and expected in Week 1 &mdash; tell the contractor upfront. | Low &mdash; expected cold-start, resolves by Week 2-3 |
| **Double-booking an appointment** | Low | AI books into a time slot the contractor blocked on Google Calendar | Calendar sync checks both appointments + Google Calendar events. If sync token expired (>60 days), sync fails silently. Monitor `consecutiveErrors`. | Medium &mdash; embarrassing but recoverable. Reconnect calendar. |
| **Sending a message during quiet hours** | Very Low | Lead gets an SMS between 9 PM - 10 AM | STRICT mode prevents this. Messages queue until 10 AM. The system will NOT send during quiet hours unless the INBOUND_REPLY_ALLOWED mode is enabled (it is not). | Very Low &mdash; system prevents it |
| **Contractor never flags estimates** | High | Estimate follow-up never fires, the highest-value automation is silent | 24-hour fallback nudge fires automatically. Proactive quote prompt at 3 days catches the rest. Portal has &ldquo;Mark Estimate Sent&rdquo; button. Explain EST command during onboarding. | Medium &mdash; automation depends on this habit. Nudges help but don&apos;t guarantee it. |
| **Contractor never marks jobs won** | High | Jobs We Helped Win shows $0 &mdash; but System Activity card and `pipelineProof` in reports auto-track pipeline activity without contractor input | Auto-detect probable wins (daily, 7-day silence after appointment) prompts contractor with ref code. WON/LOST SMS commands. Bi-weekly strategy call captures remaining wins. Portal has &ldquo;Mark Won&rdquo; button. | Low &mdash; mitigated by auto-detect + strategy call + pipeline proof. |
| **Lead volume is very low (&lt;8/month)** | Depends on client | System works but results are thin. Guarantee windows extend. | Disclose adjusted windows during sales. Lead with dormant reactivation, not speed-to-lead. | Low &mdash; the system works, just slower |
| **Twilio webhook goes down** | Very Low | Inbound SMS stops processing, leads go unanswered | Operator gets SMS alert from reliability cron. Check `/admin/reliability`. Redeploy or fix webhook URL. | High if undetected &mdash; but alerting is built |
| **Anthropic API goes down** | Very Low | AI can&apos;t generate responses, conversations stall | AI kill switch in admin. Missed-call text-back still fires (template-based, no AI). Resume when API recovers. | Medium &mdash; temporary, manual handling needed |
| **Contractor&apos;s Google review gets a bad AI-drafted response** | Low | Inappropriate or inaccurate response posted to Google Business Profile | Every response requires human approval (admin or contractor portal). Operator reviews negative-review drafts. Responses cannot auto-post. | Low &mdash; gated by approval. If posted, can be edited on Google. |

**The honest summary for your own conscience:** The worst realistic scenario is the AI giving a generic or slightly wrong answer to a homeowner in Week 1-2, which Smart Assist catches before sending. The worst unlikely scenario is a stale calendar sync causing a double-booking. Neither is catastrophic. The system is built defensively &mdash; it defers rather than guesses, it escalates rather than wings it, and it has human checkpoints at every critical moment.

---

## 22. Honest Boundaries (What This System Does NOT Do)

Know these so you never overpromise in a sales conversation.

| What contractors might expect | What actually happens | How to frame it |
|-------------------------------|----------------------|-----------------|
| &ldquo;24/7 instant response&rdquo; | Messages queue during quiet hours (9 PM - 10 AM). Response at 10 AM. | &ldquo;Monitors 24/7, responds during compliant hours. Your lead gets a response before any competitor &mdash; first thing in the morning.&rdquo; |
| &ldquo;It replaces my receptionist&rdquo; | Handles text inquiries AND answers missed calls via Voice AI (included by default). Covers the hours and moments a full-time receptionist wouldn&apos;t. Does not replace a person for every possible interaction. | &ldquo;It handles text inquiries and answers calls you miss &mdash; with a professional greeting, qualification, and appointment booking. It&apos;s a receptionist who&apos;s always on when you can&apos;t be.&rdquo; |
| &ldquo;It does my marketing&rdquo; | No lead generation. No Google Ads, SEO, social media. It converts leads you already get. | &ldquo;We handle what happens after someone reaches out. Getting them to reach out is your marketing &mdash; that&apos;s a different service.&rdquo; |
| &ldquo;AI will know everything about my business&rdquo; | AI knows what&apos;s in the KB. Week 1 will have gaps. | &ldquo;The AI starts with what you tell it on the onboarding call. It gets smarter every week as we fill gaps. By Week 3 it handles 90%+ of questions.&rdquo; |
| &ldquo;I never have to do anything&rdquo; | Contractor must: flag estimates, mark wins/losses, respond to escalations, approve review responses occasionally. Under 15 min/week. | &ldquo;You do 4 things: flag when you send a quote (one text), mark when you win or lose a job (one tap), respond when the AI escalates something to you, and approve review responses. Total: under 15 minutes a week.&rdquo; |
| &ldquo;It integrates with Jobber&rdquo; | Webhook fires on lead status change. Contractor can connect via Zapier. No native integration. | &ldquo;We fire a webhook when leads change status. If you use Zapier, you can connect it to Jobber in 5 minutes. We don&apos;t have a native Jobber plugin yet.&rdquo; |
| &ldquo;Guaranteed results&rdquo; | Guarantee is 5 engagements in 30 days (Layer 1) and 1 attributed project in 90 days (Layer 2). Both are platform-verified, not subjective. | &ldquo;The guarantee is specific: 5 real lead conversations in 30 days, or your first month is free. One project the system helped you win in 90 days, or your most recent month is refunded. Both are verified from our logs, not my opinion.&rdquo; |

---

## 23. Phone Number Handling

### How It Works

The contractor keeps their existing business number (XYZ). A local Twilio number (ABC, same 403/780 area code) is provisioned before the onboarding call. Conditional call forwarding routes missed calls from XYZ to ABC.

```
Homeowner calls XYZ (contractor&apos;s number on Google/truck/cards)
        |
Contractor&apos;s phone rings (3 rings, ~15-20 sec)
        |
   +----+----+
   |         |
ANSWERED   NOT ANSWERED
   |              |
Normal call.   Forwards to Twilio (ABC)
System never        |
sees it.       +----+----+
               |         |
         Voice AI    5-sec text-back
         picks up    fires to homeowner
               |         |
         Qualifies    &quot;Hi, this is [Business]
         lead, books  - you just called us at
         appointment  [XYZ]. What project are
               |      you looking at?&quot;
         Contractor
         gets summary
         text
```

### What the Contractor Experiences

- **Their phone rings normally.** If they answer, it&apos;s a regular call &mdash; the system is invisible.
- **If they miss a call:** They see a missed call notification AND a text from the platform: &quot;New lead from [number] &mdash; Voice AI handled it. Estimate booked for Thursday.&quot;
- **Family/personal calls:** Their phone rings first. They answer. The AI only activates on missed calls. If a family member does reach the AI, it takes a message and texts the contractor: &quot;Personal call from [number] &mdash; not a lead.&quot;

### What the Homeowner Experiences

- They call the contractor&apos;s number from Google. It rings 3 times.
- If answered: normal conversation with the contractor.
- If not answered: Voice AI picks up with a professional greeting using the contractor&apos;s business name. Qualifies the project, answers questions from the KB, books an estimate.
- AND: they get a text-back from a local number within 5 seconds, referencing the number they called.

### Carrier-Specific Setup

All major Alberta carriers use the same codes:

| Carrier | Conditional Forward | Unconditional | Cancel |
|---------|-------------------|---------------|--------|
| Rogers/Fido | `*61*[number]*11*20#` | `*72[number]` | `*73` |
| Telus/Koodo | `*61*[number]*11*20#` | `*72[number]` | `*73` |
| Bell/Virgin | `*61*[number]*11*20#` | `*72[number]` | `*73` |
| Shaw/Freedom | `*61*[number]*11*20#` | `*72[number]` | `*73` |

If `*61` syntax fails on their carrier, fall back to `*72` (unconditional &mdash; all calls go to Twilio, phone never rings). Some carriers require calling support to enable conditional forwarding.

### VoIP / PBX Decision Tree

```
&quot;Is your business number a cell phone, landline, or office system?&quot;
  Cell        -> *61 setup (standard)
  Landline    -> *61 with confirmation tones
  VoIP/PBX    -> Admin portal forwarding (need login)
  Google Voice -> Cannot forward. Use Twilio number directly.
```

### Voicemail Conflict (Critical)

Carrier voicemail and conditional forwarding race each other &mdash; whichever has a shorter timeout wins. If voicemail answers before the forward triggers, the system never sees the call.

**Fix:** Disable carrier voicemail during onboarding. Common codes: `##004#` (deactivates all conditional forwards + voicemail on most GSM carriers) then re-enable just the forward. Or call carrier support. Test with a real call before considering setup complete.

### SMS Gap (Phase 1 only)

SMS to XYZ does NOT forward &mdash; this is a structural telecom limitation. Texts sent to the contractor&apos;s existing number go to their personal phone, not the system. During Phase 1 (conditional forwarding), acknowledge this openly:

&gt; &quot;Texts to your old number still go to your phone. The system handles calls and sends follow-ups from its own local number. Most leads call first anyway &mdash; and once they&apos;re in the system, everything is on the platform.&quot;

**This gap is resolved by Phase 1.5 (listing migration).** Once Google/HomeStars point to the Twilio number, 75-85% of new leads call and text the Twilio number directly. The split-number problem only persists for leads who find the contractor&apos;s original number on old business cards or referrals (&lt;5% of inbound).

### Progressive Strategy (Phase 1 &rarr; 2 &rarr; 3)

| Phase | When | What Changes | Why |
|:-----:|------|-------------|-----|
| 1 | Day 0 | Conditional forward (*61). Phone rings first, AI catches misses. | Lowest friction. Contractor stays in control. Trust is earned. |
| 1.5 | Day 7-10 | **Listing migration.** Update Google Business Profile + HomeStars to Twilio number. Contractor&rsquo;s cell still rings first. | Eliminates split-number confusion for 75-85% of leads. System sees the full pipeline. Done live on screen share during Day 7 check-in. |
| 2 | Day 14+ | Shorter ring window (10 sec / 2 rings) OR Twilio-first ring-through (all calls logged). | Data from Phase 1.5 shows hang-up losses. Contractor is ready to tighten. |
| 3 | Day 30+ (optional) | Full AI receptionist. Voice AI answers all calls. Live transfer for qualified leads. | For contractors who want to focus on building, not answering phones. &quot;Like hiring a receptionist.&quot; |

Phase 1.5 is pre-committed on the onboarding call (see Listing Migration Pre-Commitment above). Phases 2 and 3 are offered, never pushed. Let the data make the argument.

### Optional: Number Porting (Day 30+)

If the contractor wants XYZ itself to be the Twilio number (full voice + SMS, no forwarding dependency):

1. Collect: carrier name, account number, PIN, billing address
2. Sign LOA (digital signature OK)
3. Submit port via Twilio (5-12 business days in Canada)
4. **Warn about carrier confirmation SMS:** &quot;You&apos;ll get a text from your carrier in a few days. Reply YES within 90 minutes or the port fails and we restart.&quot;
5. During port: conditional forward stays active as bridge
6. After port: XYZ is Twilio. Cancel *61/*72. Update Google listing if needed.

**Do NOT port for clients 1-5** unless they specifically request it. The risk of a port failure damaging trust outweighs the benefit.

**Cancellation safeguard:** Service agreement includes: &quot;Upon cancellation, we will port your number back to any carrier you specify within 10 business days, at no charge.&quot;

### Monitoring

Build a zero-activity alert: if a client with prior call activity shows zero inbound for 48+ hours, send the operator an SMS alert. This catches silent forwarding failures before the contractor notices.

---

## 24. ICP Psychology &amp; Sales Language

### Pain Hierarchy (Use This Order in Every Conversation)

| Rank | Pain | Role | Intensity |
|:----:|------|------|:---------:|
| 1 | **Missed calls on job sites** | This SELLS. Open with it. | 10/10 |
| 2 | **Dead quotes going silent** | This RETAINS. Deliver it Day 0-1. | 8/10 |
| 3 | **Burned by agencies before** | Not sellable &mdash; it&apos;s a trust filter. Neutralize, don&apos;t pitch against. | 9/10 |
| 4 | **No Google reviews** | Value stacking for Week 2-3. | 6/10 |
| 5 | **No visibility into business** | Spouse buy-in via bi-weekly reports. | 4/10 |

### Words to AVOID (Hard Rule)

Never say these to a contractor. They trigger agency trauma, tech anxiety, or identity threat.

| Never Say | Why | Say Instead |
|-----------|-----|-------------|
| &quot;AI&quot; | They think ChatGPT hallucinations. | &quot;The system&quot; or &quot;your assistant&quot; |
| &quot;Automation&quot; | Sounds like a tool they have to manage. | &quot;It runs in the background&quot; |
| &quot;Platform&quot; | Sounds like SaaS. They hate SaaS. | &quot;The service&quot; or just describe what it does |
| &quot;Algorithm&quot; | Means nothing to them. | Skip entirely |
| &quot;Automated follow-up&quot; | Sounds like spam. | &quot;Your leads get followed up on&quot; |
| &quot;Twilio&quot; | Vendor name they don&apos;t know. | &quot;Your dedicated business line&quot; |
| &quot;Bot&quot; | Sounds cheap and unreliable. | &quot;Your scheduling assistant&quot; |

### Words to USE

| Say This | Why It Works |
|----------|-------------|
| &quot;Your leads get followed up on even when you&apos;re mid-job&quot; | Paints the picture. No jargon. |
| &quot;Texts back missed calls in 5 seconds&quot; | Specific, tangible, measurable |
| &quot;Month-to-month, cancel anytime&quot; | Neutralizes agency trauma immediately |
| &quot;Runs in the background&quot; | No management burden implied |
| &quot;You built the estimate. You shouldn&apos;t have to beg for the job.&quot; | Names the dignity issue of follow-up |
| &quot;Like having a receptionist who answers on the first ring&quot; | Mental model they understand |

### Framing Rules

- **Additive, not corrective:** &quot;This doesn&apos;t replace what you&apos;re doing. It catches what falls through the cracks.&quot; Never imply they&apos;re doing something wrong.
- **Guarantee before price, every time:** State the guarantee first, then the cost. &quot;If we don&apos;t recover at least 5 real leads in 30 days, you don&apos;t pay. The service is $1,000/month after the free first month.&quot;
- **Loss frame for urgency, gain frame for aspiration:** &quot;You left $20K on the table last month from missed calls&quot; (loss) &rarr; &quot;What would a full calendar through winter look like?&quot; (gain).
- **Externalize the problem:** &quot;The follow-up gap isn&apos;t a contractor problem &mdash; it&apos;s a capacity problem. You can&apos;t text leads from a roof.&quot; Preserve their identity as a competent tradesman.

### The Contractor&apos;s 5 Questions (Answer All Before They Ask)

Every contractor is running these through their head during the pitch:

1. &quot;Is this person going to waste my time and money like the last agency?&quot; &rarr; Month-to-month, cancel anytime. Guarantee.
2. &quot;Does this person actually understand my business?&quot; &rarr; Mention their trade, city, and a specific detail from their Google listing.
3. &quot;Is this going to make me look more professional or less?&quot; &rarr; Show the message copy. &quot;Sound like you?&quot;
4. &quot;Is this going to require me to manage another thing?&quot; &rarr; &quot;You do nothing different. 15 minutes a week, max.&quot;
5. &quot;Can I get out if it doesn&apos;t work?&quot; &rarr; &quot;Text me and I cancel it. That&apos;s it.&quot;

### The Referral Story (What Spreads)

&gt; &quot;I was on a job, missed a call, and 5 seconds later the system texted the homeowner. But the crazy part &mdash; he also found 12 old quotes in my phone. Three replied. One&apos;s a $40K kitchen. I paid five grand to a marketing company last year for nothing. This costs a thousand and it&apos;s already paid for itself twice over.&quot;

**Why this spreads:** Specific dollar amount, zero-effort narrative, competitor contrast, no jargon, ends with a referral action.

### Value Stacking Timeline (Set These Expectations)

| Time | What Happens | Contractor Feels |
|------|-------------|-----------------|
| **8 min** (on the call) | Live text-back demo, Voice AI demo | &quot;OK, this actually does something&quot; |
| **24-48 hours** | First replies from dead quote reactivation | &quot;That guy from March just texted back!&quot; |
| **3-5 days** | Estimate follow-up sequence firing on new quotes | &quot;It just... does it for me?&quot; |
| **7-14 days** | First automated review request, new Google review | &quot;My wife is going to love this&quot; |
| **14 days** | First bi-weekly report with pipeline value | &quot;This is paying for itself&quot; |

---

## Appendix: What We Changed (Exit Document)

Hand this to the contractor on the onboarding call. Update it after the Day 7 listing migration. The purpose: make exit feel safe, which increases willingness to commit.

**Template** (fill in per client, send as PDF or plain-text email):

---

**[Business Name] &mdash; ConversionSurgery Setup Summary**

Hi [Name], here&rsquo;s a record of everything we set up for your account. Keep this somewhere you can find it &mdash; if you ever cancel, you can reverse everything in 5 minutes.

**Your original business number:** [contractor&rsquo;s cell]
**Your ConversionSurgery business line:** [Twilio number]

**What we changed:**

| What | Original | Changed to | URL to revert |
|------|----------|-----------|---------------|
| Google Business Profile phone | [original] | [Twilio] | business.google.com &rarr; Edit profile &rarr; Phone |
| HomeStars phone | [original] | [Twilio] | homestars.com/pro/settings (or contact support) |
| Facebook page phone | [original] | [Twilio] | facebook.com/[page]/settings |
| Call forwarding | Not set | *61*[Twilio]*11*20# | Dial *73 to cancel |
| Carrier voicemail | Active | Disabled | Dial carrier to re-enable |

**To revert everything if you cancel:**
1. Update Google, HomeStars, Facebook phone back to [original] (5 min total)
2. Dial *73 to cancel call forwarding
3. Call your carrier to re-enable voicemail
4. Done &mdash; your phone works exactly like it did before

**Date set up:** [date]
**Set up by:** [operator name]

---

**Source:** 10-agent phone onboarding consensus (2026-04-12). Full analysis: `active/consensus/phone-onboarding-consensus.md`
