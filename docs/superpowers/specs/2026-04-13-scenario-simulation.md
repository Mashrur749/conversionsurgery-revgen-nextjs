# Scenario-Based Simulation — AI System Stress Test

**Date:** 2026-04-13
**Purpose:** Trace every realistic lead scenario through the full system — current + proposed redesign — to find gaps the audit missed.
**Method:** Simulate 20 scenarios. For each: the lead's journey, every system touchpoint, every state transition, and every gap or failure mode discovered.
**Companion docs:** `2026-04-13-ai-audit-issues.md`, `2026-04-13-ai-orchestration-redesign.md`

---

## Simulation Results Summary

| # | Scenario | Gaps Found | Severity |
|---|----------|-----------|----------|
| 1 | Happy path: inquiry → book | 2 | Low |
| 2 | Price objection → recovery | 1 | Medium |
| 3 | Slow nurture → win-back → rebook | 2 | Medium |
| 4 | Multi-decision-maker ("ask my wife") | 1 | High — NEW |
| 5 | Emergency/urgent basement issue | 1 | High — NEW |
| 6 | Competitor comparison ("getting 3 quotes") | 1 | Medium |
| 7 | Missed call → SMS → qualify → book | 0 | Clean |
| 8 | Form submission with project details | 1 | Medium — NEW |
| 9 | MMS photo of basement | 1 | Medium (known: AUDIT vision gap) |
| 10 | Long conversation (25+ messages) | 1 | Medium (known: AUDIT-13) |
| 11 | Opt-out mid-conversation | 1 | High — NEW (bug) |
| 12 | Frustrated escalation → human | 1 | Medium |
| 13 | Dormant reactivation (6 months) | 1 | Medium (known: AUDIT-02) |
| 14 | Evening/weekend inquiry | 1 | Low |
| 15 | Voice call → SMS follow-up | 1 | Medium — NEW |
| 16 | Estimate follow-up 4-touch sequence | 2 | Medium — NEW |
| 17 | No-show recovery | 1 | Medium (known: AUDIT-01) |
| 18 | Payment → review generation | 0 | Clean |
| 19 | Strategic handoff (high-value lead) | 1 | Medium (designed in redesign) |
| 20 | Knowledge gap → operator notified | 0 | Clean |

**New issues discovered: 7** (not in original 13 audit issues)

---

## Scenario 1: Happy Path — Inquiry → Qualify → Book

**Lead:** Sarah texts "Hi, I'm looking to finish my basement. About 1200 sq ft. How much would something like that cost?"

**Trace:**
```
1. Twilio webhook → handleIncomingSMS()
2. Lead created: status='new'
3. LeadContext created: stage='new'
4. Not a command sender → continue
5. Not STOP/HELP → continue
6. Not blocked → continue
7. Lead scoring: quickScore() assigns initial scores
8. conversationMode != 'human' → continue
9. No active sequences to manage
10. detectHotIntent(): no hot keywords → continue
11. detectBookingIntent(): no booking keywords → continue
12. aiAgentMode === 'autonomous' → processIncomingMessage() [LangGraph]
13. Orchestrator:
    a. Quality gate check → passes (KB populated)
    b. buildSmartKnowledgeContext("finish my basement 1200 sq ft cost")
       → semantic search matches KB entries about basement finishing
    c. buildGuardrailPrompt() → includes "canDiscussPricing: false"
    d. analyzeAndDecide():
       → sentiment: neutral, urgency: 40, budget: 50, intent: 60
       → stage: qualifying, action: respond
       → extractedInfo: { projectType: "basement finishing", projectSize: "1200 sq ft" }
    e. generateResponse():
       → strategy: "Answer their question helpfully" ← GAP: too generic (AUDIT-04)
       → produces response about process, avoids pricing
    f. Output guard: passes (no pricing, no opt-out retention, no identity denial)
    g. sendCompliantMessage(): consent=lead_reply, classification=inbound_reply → sends
14. Conversation logged, agentDecision logged
15. estimateAutoTrigger: no estimate signal detected → no-op
16. Lead scoring: full scoreLead() async
```

**Current behavior:** Agent responds helpfully but generically. Doesn't systematically qualify (may ask about timeline, may not). No plan for next steps.

**With redesign:**
```
Strategy resolver:
  stage: 'greeting' (first message)
  objective: "Acknowledge their project, ask one qualifying question"
  requiredInfo: ["timeline", "decision_makers"]
  suggestedAction: "ask_qualifying_question"
  guidance: "They mentioned 1200 sq ft finishing. Acknowledge that. Ask about their timeline."

Response: "Hey Sarah! 1200 sq ft is a great-sized project. To give you a sense of what's involved, are you looking to get this done in the next couple months, or is this more of a planning stage?"
```

**Gaps found:**
- **GAP-S1 (Low):** `leads.status` stays `'new'` after first AI response. Should transition to `'contacted'` — currently only some paths do this. The LangGraph orchestrator doesn't update `leads.status`, only `leadContext.stage`.
- **GAP-S2 (Low):** Strategy resolver doesn't exist yet — agent defaults to generic strategy. Addressed by AUDIT-04 / redesign Layer 1.

---

## Scenario 2: Price Objection → Recovery

**Lead:** After 3 qualifying messages, Sarah says "That sounds like a lot of work. I got a quote from another company for $45K, can you beat that?"

**Trace:**
```
1. Message arrives, existing lead found
2. processIncomingMessage() → analyzeAndDecide()
   → sentiment: neutral, budget: 30 (price sensitive), intent: 50
   → objections: ["price_comparison", "competing_quote"]
   → action: respond
3. generateResponse():
   → canDiscussPricing: false → guardrail blocks specific pricing
   → strategy: "Answer their question helpfully. Also address their concern about: price_comparison"
4. Output guard: scans for $ amounts → blocks if any leaked
5. Response sent
```

**With redesign:**
```
Strategy resolver:
  stage: 'objection_handling'
  objective: "Address price comparison without quoting a number"
  guidance: "Acknowledge their research. Reframe on value (quality, warranty, communication).
             DON'T: say 'we can match that' or give a number.
             DO: propose a free estimate visit where they can see the difference."
  nextMoveIfSuccessful: "propose_estimate_visit"

Playbook injects:
  objectionPattern: "price_comparison"
  handlingStrategy: "reframe on value — basement development is a 20-year investment"
  neverSay: ["we're the cheapest", "we can beat that", "you get what you pay for"]
```

**Gap found:**
- **GAP-S3 (Medium):** When `canDiscussPricing: false`, the agent can't address the price objection at all — it just deflects. But the playbook knows that the RIGHT response isn't a price quote, it's a value reframe + estimate visit proposal. Currently the guardrail treats all pricing discussion the same way (block), but there's a difference between "quoting a price" and "addressing a price concern." The redesign's strategy layer needs to distinguish: `canDiscussPricing: false` should block QUOTING prices, not block DISCUSSING price-related concerns.

---

## Scenario 3: Slow Nurture → Win-Back → Rebook

**Lead:** Mark inquires, gets qualified, goes silent for 30 days.

**Trace:**
```
Days 1-3: Normal conversation, stage reaches 'qualifying'
Day 4+: Mark stops replying
Day 25-35: win-back cron detects Mark as eligible
  → status IN ('contacted','estimate_sent'), last activity 25-35 days ago
  → hasActiveSequenceSet check passes (no other active sequences)
  → processWinBacks() → generateWinBackMessage()
     → temperature: 0.9 ← (AUDIT-03: too high)
     → 160 char limit
  → sendCompliantMessage() with proactive_outreach
  → isWithinSendWindow() uses server UTC ← (AUDIT-02: timezone bug)
Day 26: Message sent. Mark doesn't reply.
Day 46-56: 2nd win-back attempt scheduled via __AI_GENERATE__ sentinel
  → process-scheduled cron dequeues it
  → No freshness check ← (AUDIT-01)
  → processWinBackFollowUp() generates 2nd message
  → leads.status → 'dormant'
Day 180+: dormant re-engagement cron
  → CASL consent check: was consent from missed_call 6 months ago? If implied consent expired, skip.
```

**With redesign:** Strategy resolver would track turn count per stage. After `maxTurnsInStage` exceeded with no response, the system transitions to `nurturing` and schedules a win-back — rather than waiting for a dumb time-based cron.

**Gaps found:**
- **GAP-S4 (Medium):** Win-back triggers on calendar time (25-35 days), not on conversation state. A lead who had an active, productive conversation that just paused (e.g., "I'll get back to you after my vacation") gets the same win-back as a lead who ghosted after one message. The strategy layer should distinguish "went quiet after engagement" from "never engaged."
- **GAP-S5 (Medium):** When Mark eventually DOES reply (say, Day 40, after the 1st win-back), `incoming-sms.ts` cancels win-back sequences and sets status to `contacted`. But `leadContext.stage` is NOT reset — it's still whatever the AI last set (maybe `qualifying`). The AI will resume with stale stage context. The redesign's strategy resolver should detect "returning after gap" and reset to `greeting` with the conversation summary as context.

---

## Scenario 4: Multi-Decision-Maker ("Ask My Wife")

**Lead:** Dave says "Sounds good, but I need to check with my wife first. She handles the budget decisions."

**Trace:**
```
1. analyzeAndDecide():
   → detectedObjections: ["partner_approval"]
   → intent drops (maybe 40)
   → action: 'respond' or 'wait'
   → stage: 'objection' or 'nurturing'
2. Agent responds... but HOW?
   → Current strategy: "Answer their question helpfully. Also address concern about: partner_approval"
   → No guidance on WHAT to do with this information
```

**Gap found:**
- **GAP-S6 (High — NEW):** The system has no concept of "decision-maker mapping." In Calgary basement renovation, ~60-70% of projects involve a couple. When one partner says "I need to check with my wife," the optimal response isn't to back off OR to push — it's to offer to include the partner: "Totally understand! Would it be helpful if I texted her a quick summary of what we discussed, or would you prefer to loop her in at the estimate visit?"

  This is a trade-specific pattern (Layer 3 playbook knowledge). The current system treats "need to check with my wife" as a generic objection. The playbook should encode this as a **decision-stage pattern** with specific handling:
  1. Acknowledge it's a shared decision (not a stall)
  2. Offer to help include the partner (via text, via joint estimate visit)
  3. Set a check-back timeline ("I'll follow up in a couple days — no pressure")
  4. Don't count this as a failed booking attempt

  The strategy resolver should recognize `partner_approval` objection and NOT advance `bookingAttempts` — it's not a rejection, it's a stage in the buying process.

---

## Scenario 5: Emergency/Urgent Basement Issue

**Lead:** "HELP my basement is flooding!! Do you do waterproofing??"

**Trace:**
```
1. detectHotIntent(): checks for emergency keywords
   → likely matches "flooding" as hot intent
   → Within business hours: initiateRingGroup() → hot transfer call
   → Outside hours: send ACK + escalation
```

**If hot intent NOT detected (keyword not in list):**
```
2. processIncomingMessage() → analyzeAndDecide()
   → urgency: 95, intent: 90 → quality tier (Sonnet)
   → action: 'respond' or 'book_appointment'
3. Agent responds with... appointment booking attempt?
```

**Gap found:**
- **GAP-S7 (High — NEW):** The sales methodology has no "emergency mode." The standard qualifying → educating → proposing flow is wrong for emergencies. A flooding basement needs:
  1. Immediate acknowledgment ("We're on it")
  2. Instant escalation to contractor (this is a CALL, not a booking)
  3. Safety information if relevant ("Turn off power to the basement if safe to do so")
  4. NO qualifying questions ("How big is your basement?" is absurd when it's flooding)

  The strategy resolver needs an **emergency bypass**. When `urgencyScore >= 90` OR emergency keywords detected, skip the methodology entirely and go to immediate human notification + safety acknowledgment. This isn't an escalation (nothing went wrong with the AI) — it's a recognition that emergencies need humans, not chatbots.

  The industry playbook should define emergency signals per trade:
  - Basement: "flooding," "water," "leak," "burst pipe," "sewage"
  - Plumbing: "no water," "backed up," "overflowing," "gas smell"
  - Electrical: "sparking," "no power," "burning smell," "shock"
  
  The redesign's Layer 3 playbook needs an `emergencySignals` field.

---

## Scenario 6: Competitor Comparison

**Lead:** "We're getting quotes from 3 other companies. What makes you guys different?"

**Trace:**
```
1. analyzeAndDecide():
   → objections: ["comparing_quotes"]
   → intent: 60 (they're shopping but engaged)
   → action: respond
2. generateResponse():
   → guardrail: "Don't disparage competitors"
   → strategy: generic "address concern about comparing_quotes"
3. Agent responds... with what differentiator?
   → KB may have "why choose us" entries, but no structured differentiation framework
```

**Gap found:**
- **GAP-S8 (Medium):** The system has no structured **competitive differentiation** framework. The agent can only parrot whatever's in the KB. But differentiation in home services follows predictable patterns:
  - Communication speed: "You're texting with us right now — how fast did the other companies respond?"
  - Transparency: "We'll send you a detailed estimate breakdown, not just a number"
  - Follow-through: "We follow up on every step — you won't be left wondering what's happening"

  The playbook should include a `differentiators` section with approved talking points the agent can draw from. These aren't KB entries (which are factual) — they're strategic positioning arguments. The agent should know WHEN to deploy them (when "comparing quotes" objection is active) and HOW (as natural conversation, not a sales pitch).

---

## Scenario 7: Missed Call → SMS → Qualify → Book

**Trace is clean.** `missed-call.ts` creates the lead, sends template with contextual variant for known leads. Agent picks up from there. Entry context (Layer 5) correctly identifies `source: 'missed_call'` and adjusts opening.

**No new gaps.**

---

## Scenario 8: Form Submission with Detailed Project Info

**Lead:** Submits web form: Name: "Lisa Chen", Phone: "+14035551234", Message: "Looking to develop our basement into a 2-bedroom legal suite. House is 1987 built, about 1400 sq ft basement. Budget around $100K. Looking to start in June."

**Trace:**
```
1. form-response.ts: creates lead, logs form content as inbound conversation
2. Sends template-based form_response acknowledgment
3. Next inbound from Lisa → processIncomingMessage()
   → But: the form content was logged as a conversation message
   → analyzeAndDecide() sees it in history
   → SHOULD extract: projectType, projectSize, timeline, budget signals
```

**Gap found:**
- **GAP-S9 (Medium — NEW):** The form acknowledgment is a static template — it doesn't reference what Lisa told us. "Thanks for reaching out! We'll get back to you shortly" is generic when she gave us everything: suite type, sq footage, age, budget, timeline.

  With the redesign, Layer 5 (entry context) should detect `source: 'form_submission'` with rich data and produce an opening that references it: "Hey Lisa! A 2-bedroom legal suite in a 1987 home — great project. With 1400 sq ft to work with and a June start, the timing works well. Want to book a free site assessment this week so [contractor] can take a look and put together a detailed plan?"

  This is a **one-shot qualify-and-propose**. Lisa gave us everything. Don't re-qualify — propose the estimate visit immediately. The strategy resolver should detect "all requiredInfo already provided" and skip straight to `proposing` stage.

---

## Scenario 9: MMS Photo of Basement

**Lead:** Sends a photo of their unfinished basement with message "what would it cost to do something with this?"

**Trace:**
```
1. MMS processing: processIncomingMedia() → generates aiDescription
   → Something like "a photo of an unfinished basement with concrete walls and floor"
2. mediaContext appended: "The customer also sent 1 photo(s) showing: a photo of an unfinished basement"
3. Agent receives text description, NOT the image itself
```

**Gap:** Known — covered in redesign spec section 6.3 (Vision). The agent should process the actual image via Anthropic vision API. A concrete basement with exposed joists, visible plumbing, and a window well tells the agent: "this is a development project, egress window present, plumbing rough-in needed." A text description saying "unfinished basement" misses all of that.

---

## Scenario 10: Long Conversation (25+ Messages)

**Lead:** Back-and-forth over 5 days, 28 total messages.

**Trace:**
```
Message 21: shouldUpdateSummary() triggers (totalMessages > 20)
→ updateConversationSummary(): compresses messages 1-13 into ~200 word summary
→ Agent sees: summary + messages 14-28

Message 28: conversation context is:
  - Summary (compressed, potentially lossy)
  - 15 raw messages
  - Agent may have forgotten objections from messages 3-5
```

**Gap:** Known — AUDIT-13. Summary loses structured signals. Redesign adds structured extraction alongside narrative.

---

## Scenario 11: Opt-Out Mid-Conversation

**Lead:** Engaged for 5 messages, then finds a competitor. Sends: "found someone else, please stop texting me"

**Trace:**
```
1. incoming-sms.ts: checks STOP words
   → "stop" appears in "please stop texting me"
   → handleOptOut() triggered
   → leads.status → 'opted_out', optedOut=true
   → All unsent scheduled messages cancelled
   → Compliance auto-reply sent: "You've been unsubscribed..."
2. ALSO: soft rejection check (step 4 in routing)
   → "found someone else" matches soft rejection phrases
   → Would set leads.status = 'lost'
   → Would cancel all unsent scheduled messages
   → BUT: the STOP handler already returned at step 1
```

**Gap found:**
- **GAP-S10 (High — NEW — Bug):** If the message is "I found someone cheaper, stop texting me" — the STOP keyword handler catches it and processes opt-out. But the STOP keyword check is a simple regex against the ENTIRE message body. What about: "Can you stop by on Tuesday?" or "I need to stop the leak" — these contain "stop" but are NOT opt-out requests.

  Checking the code: the STOP check in `incoming-sms.ts` is for exact matches of opt-out keywords, not substring. Need to verify: does it check for `messageBody.trim().toUpperCase() === 'STOP'` (exact match — correct) or `messageBody.includes('STOP')` (substring — bug)?

  **UPDATE after code review:** The opt-out check is in `opt-out-handler.ts` and uses a keyword list with exact-match logic (`STOP`, `UNSUBSCRIBE`, `CANCEL`, etc.) against the trimmed, uppercased full message body. "Can you stop by Tuesday" would NOT trigger opt-out. However, "STOP TEXTING ME" might, depending on whether the check is exact-word or includes-word. If the lead texts exactly "STOP" it works correctly. If they text "please stop" it depends on implementation details.

  **Remaining gap:** Even with correct opt-out handling, the lead's sentiment and reason for leaving are not captured. "Found someone cheaper" is valuable competitive intelligence. The system should log the opt-out reason (LLM-extracted from the final message) for analytics: why are leads leaving? Price? Speed? Service scope? This feeds into the data flywheel (redesign section 6.9).

---

## Scenario 12: Frustrated Escalation → Human Takeover

**Lead:** "This is ridiculous. I've been waiting 3 days for a quote and nobody has called me back. I want to speak to the owner."

**Trace:**
```
1. processIncomingMessage() → analyzeAndDecide()
   → sentiment: frustrated, urgency: 80
   → escalationNeeded: true, escalationReason: 'requested_human'
   → action: 'escalate'
2. Orchestrator: creates escalation queue entry, priority 1
3. Agent does NOT send a response (needsEscalation blocks response)
4. Notification sent to contractor/owner via escalation system
```

**Gap found:**
- **GAP-S11 (Medium):** When escalation triggers, the agent sends NO response. The homeowner's last message goes into a void. Best practice: send an acknowledgment BEFORE escalating — "I completely understand your frustration. Let me get [ownerName] to call you directly — expect a call within the hour." Then escalate.

  Currently, the orchestrator checks `if (finalState.responseToSend && !finalState.needsEscalation)` — the `!finalState.needsEscalation` condition suppresses the response. The redesign should send an escalation acknowledgment (deterministic template, not AI-generated) before creating the escalation queue entry.

---

## Scenario 13: Dormant Reactivation (6 Months)

**Lead:** Was `dormant` for 200 days. Dormant re-engagement cron fires.

**Trace:**
```
1. runDormantReengagement(): finds leads 180-210 days dormant
2. CASL consent check: was consent from missed_call? If implied, 6-month expiry
   → If expired: skip (correct — CASL compliance)
   → If express: send
3. Template-based message (no LLM)
4. isWithinSendWindow(): server UTC ← (AUDIT-02: timezone bug)
5. sendCompliantMessage(): proactive_outreach
```

**Gap:** Known — AUDIT-02 timezone. Otherwise clean.

---

## Scenario 14: Evening/Weekend Inquiry

**Lead:** Texts at 11:30pm Saturday: "Hey, wondering about getting my basement done"

**Trace:**
```
1. Message arrives, lead created
2. processIncomingMessage() runs
3. Agent generates response
4. sendCompliantMessage():
   → quietHours check: 11:30pm > 9pm → QUIET HOURS
   → mode: 'STRICT_ALL_OUTBOUND_QUEUE' → message queued for 10am next morning
   → OR mode: 'INBOUND_REPLY_ALLOWED' (pending legal) → sends immediately
```

**Gap found:**
- **GAP-S12 (Low):** If quiet hours QUEUE the response, the lead doesn't hear back until 10am. That's ~10.5 hours of silence for a lead who texted on Saturday night. By 10am Sunday, they may have contacted 3 competitors.

  Layer 5 (entry context) should recognize `timeOfDay: 'late_night'` and adjust expectations. If sending is allowed (inbound-reply mode), the response should acknowledge the late hour: "Hey! Getting your message — we'll have more detail for you in the morning, but happy to chat if you're up."

  If sending is blocked (strict mode), no fix — compliance wins. But the queued response (delivered at 10am) should NOT start with "Hey, thanks for reaching out!" as if they just texted. It should acknowledge the delay: "Morning! Got your text last night about your basement..."

---

## Scenario 15: Voice Call → SMS Follow-Up

**Lead:** Calls, Voice AI answers, qualifies the project, books an appointment. Post-call SMS sent.

**Trace:**
```
1. Voice AI: Twilio ConversationRelay → Cloudflare DO → Claude Haiku → ElevenLabs
2. Call ends, transcript stored in voiceCalls
3. generateCallSummary() → AI summary
4. notifyClientOfCall() → SMS to contractor with summary
5. Lead was created/updated during voice call
6. Next: if lead texts, conversation continues via SMS
```

**Gap found:**
- **GAP-S13 (Medium — NEW):** When a lead transitions from Voice to SMS, the SMS agent has NO awareness of what happened on the voice call. The voice call transcript is in `voiceCalls`, but `processIncomingMessage()` only loads `conversations` table history. The agent doesn't know "I already talked to this person on the phone, they told me about their 1500 sq ft basement, and I booked them for Tuesday."

  The conversation summary should incorporate voice call transcripts, not just SMS conversations. Either: (a) insert a synthetic `conversations` record summarizing the voice call, so it appears in the agent's history; or (b) load `voiceCalls` transcripts alongside `conversations` in the orchestrator and include them in context.

  Without this, the SMS agent will re-qualify a lead that was already qualified by Voice AI. Terrible experience.

---

## Scenario 16: Estimate Follow-Up 4-Touch Sequence

**Lead:** Contractor marks estimate sent. Sequence begins.

**Trace:**
```
Day 0: startEstimateFollowup() → leads.status = 'estimate_sent'
  → 4 scheduled messages: Day 2, Day 5, Day 10, Day 14
Day 2: process-scheduled sends touch 1
Day 3: Lead replies "still thinking about it"
  → incoming-sms.ts step 13: estimate_followup detected
  → NEXT step cancelled, remaining steps delayed +3 days
  → New schedule: Day 8, Day 13, Day 17
Day 8: Touch 2 sent (delayed)
Day 13: Touch 3 sent
Day 17: Touch 4 (final) sent
Day 21: processStuckEstimateNudges (Wednesday cron)
  → If no response after touch 4: nudge to contractor
```

**Gaps found:**
- **GAP-S14 (Medium — NEW):** The estimate follow-up messages are template-based, not AI-generated. They don't adapt to what was discussed. Touch 1 says something generic like "Just checking in on the estimate we sent..." But the agent knows from the conversation that Sarah is comparing 3 quotes and her main concern is timeline. Touch 1 should reference that: "Hey Sarah, just checking in on the estimate. I know timeline was important to you — [contractor] can start as early as [date] if that works."

  The follow-up sequence should be contextual. Either: (a) make the messages AI-generated using conversation context, or (b) have the strategy resolver select from variant templates based on the lead's objections/concerns.

- **GAP-S15 (Medium — NEW):** The pause-and-resume logic (cancel next step, delay remaining) is correct for "still thinking" replies. But what if the lead replies with a POSITIVE signal? "Yes, we'd like to go ahead!" — the estimate follow-up sequence should STOP entirely and the agent should transition to appointment booking. Currently the sequence just delays — it doesn't check whether the lead has progressed past `estimate_sent` stage.

---

## Scenario 17: No-Show Recovery

**Lead:** Appointment at 2pm Tuesday. No one shows up.

**Trace:**
```
1. NOSHOW command from contractor or cron detection
2. appointments.status → 'no_show'
3. No-show recovery:
   → Immediate: contractor notified, crew notified
   → +2 hours: homeowner recovery SMS (__AI_GENERATE__ sentinel)
   → Day+2: second attempt (__AI_GENERATE__)
4. process-scheduled dequeues __AI_GENERATE__
   → No freshness check ← (AUDIT-01)
   → processNoShowFollowUp() generates message
```

**Gap:** Known — AUDIT-01. No freshness check before generating. Lead could have replied, rebooked, or opted out between scheduling and generation.

---

## Scenario 18: Payment Collection → Review Request

**Trace is clean.** Payment collection is template-based, 4-touch sequence. Review request triggers on `completed` status with sentiment gate, rate cap, and consent upgrade. No new gaps.

---

## Scenario 19: Strategic Handoff (High-Value Lead)

**Lead:** Lisa (from scenario 8) is now fully qualified: $100K legal suite, ready to start June, no objections.

**With current system:** No strategic handoff concept. Agent keeps texting.

**With redesign:**
```
Strategy resolver detects:
  → estimatedValue > $50K (from extractedInfo or playbook scope heuristics)
  → stage: 'hot'
  → objections.length === 0
  → all requiredInfo collected
→ Triggers strategic handoff notification:
  "HOT LEAD: Call Lisa Chen now. $100K legal suite, 1400 sq ft, 1987 home. 
   Wants to start June. No objections. She's ready to book a site visit."
```

**Gap:** This is designed in the redesign but not yet built. No new gap — just confirming the design handles it.

---

## Scenario 20: Knowledge Gap → Operator Notified

**Trace is clean.** Low confidence → `trackKnowledgeGap()` → `kb-gap-auto-notify` cron → operator alerted with deep link. No new gaps.

---

## New Issues Discovered (Not in Original 13 Audit Issues)

### SIM-01: leads.status Not Updated on First AI Response

**Severity:** Low
**Scenario:** 1

`leads.status` stays `'new'` after the AI responds. Only some code paths (booking, dormant revival, opt-in) update to `'contacted'`. The LangGraph orchestrator updates `leadContext.stage` but never touches `leads.status`.

**Impact:** Automations keyed on `leads.status === 'new'` may re-trigger. Reporting shows leads as "new" when they've had a full conversation.

**Fix:** Orchestrator should update `leads.status` to `'contacted'` after first successful AI response, if current status is `'new'`.

---

### SIM-02: leads.status and leadContext.stage Diverge

**Severity:** Medium
**Scenario:** Multiple (4, 11, 15, 16)

Two parallel state dimensions (`leads.status` and `leadContext.stage`) are updated by different code paths and frequently diverge. A lead can be `status='contacted'` with `stage='booked'`, or `status='won'` with `stage='qualifying'`.

**Impact:** Automations use `leads.status`. The AI uses `leadContext.stage`. They can disagree about where a lead is. The strategy resolver (redesign) needs to reconcile these.

**Fix:** Define authoritative source per decision type:
- AI behavior → `leadContext.stage` (authoritative)
- Automation eligibility → `leads.status` (authoritative)
- On every state change, sync the other dimension where applicable
- Consider: should these be unified? Or is the split intentional (business pipeline vs conversation state)?

---

### SIM-03: No Decision-Maker Tracking

**Severity:** High
**Scenario:** 4

The system has no concept of "who's involved in this decision." For Calgary basement projects, 60-70% involve a couple. The agent needs to know: is this person the sole decision-maker? Is there a partner? Have they consulted the partner yet?

**Fix:** Add to `leadContext` or `extractedInfo`:
```typescript
decisionMakers: {
  primary: string;                    // "Dave"
  secondary?: string;                 // "Dave's wife"
  secondaryConsulted: boolean;        // false
  partnerApprovalNeeded: boolean;     // true — detected from "need to check with my wife"
}
```
Strategy resolver uses this to avoid counting "need to ask my wife" as a booking rejection, and to prompt the agent to offer partner-inclusion strategies.

---

### SIM-04: No Emergency Mode in Sales Methodology

**Severity:** High
**Scenario:** 5

The sales methodology assumes a considered purchase flow (qualify → educate → propose → close). Emergencies bypass this entirely. A flooding basement needs: instant acknowledgment, immediate human notification, safety guidance. NOT qualifying questions.

**Fix:** Add to Layer 1 (sales methodology):
```typescript
emergencyBypass: {
  triggers: string[];                  // Matched from playbook emergencySignals
  urgencyThreshold: number;            // >= 90
  action: 'immediate_human_notification';
  acknowledgmentTemplate: string;      // "We're on it. [ownerName] will call you back ASAP."
  safetyGuidance?: string;             // Trade-specific safety tips
}
```
Add to Layer 3 (industry playbook):
```typescript
emergencySignals: {
  keywords: string[];                  // ["flooding", "water damage", "sewage backup"]
  urgencyFloor: number;                // Minimum urgencyScore to assign
}
```

---

### SIM-05: Form Submission Data Not Used for Fast-Track Qualifying

**Severity:** Medium
**Scenario:** 8

Form submissions include rich project details, but the first AI response doesn't reference them. The agent re-qualifies from scratch. A homeowner who filled out a detailed form and then gets asked "What kind of project are you thinking about?" will feel unheard.

**Fix:** Layer 5 (entry context) should parse form data, map it to `requiredInfo` fields, and mark them as `skipQualifying`. The strategy resolver should advance past `qualifying` if all required info is already available and jump to `proposing`.

---

### SIM-06: Voice → SMS Handoff Loses Context

**Severity:** Medium
**Scenario:** 15

Voice call transcripts are stored in `voiceCalls` table but NOT loaded by the SMS agent's `processIncomingMessage()`. A lead who spoke to Voice AI for 5 minutes gets re-qualified from zero when they text.

**Fix:** In the orchestrator, after loading `conversations` history, also load the most recent `voiceCalls` transcript for this lead. Include a compressed summary in the agent's context: "PRIOR VOICE CALL: [summary]. Do not re-ask questions that were already answered."

---

### SIM-07: Estimate Follow-Up Not Contextual

**Severity:** Medium
**Scenario:** 16

The 4-touch estimate follow-up uses static templates. They don't reference the lead's specific project, concerns, or conversation history. A personalized follow-up converts better than a generic "checking in on the estimate."

**Fix:** Two options:
1. **AI-generated follow-ups:** Use `__AI_GENERATE__` pattern (already exists for win-back/no-show) but with conversation context
2. **Variant selection:** Define template variants per objection type and have the strategy resolver select the best match

Option 1 is more powerful but costs more (LLM call per follow-up). Option 2 is cheaper and more predictable. Recommend starting with Option 2 and adding Option 1 if template variants don't move conversion.

---

### SIM-08: No Escalation Acknowledgment

**Severity:** Medium
**Scenario:** 12

When the agent escalates, the homeowner receives NO response. Their frustrated message goes into silence until the contractor responds (which may take hours). The agent should send an acknowledgment before escalating.

**Fix:** In orchestrator, when `finalState.needsEscalation === true`, send a deterministic (not AI-generated) acknowledgment:
```
"I hear you, and I want to make sure this gets handled properly. I'm connecting you with {ownerName} directly — expect to hear from them shortly."
```
Then create the escalation queue entry. The acknowledgment goes through compliance gateway like any other message.

---

### SIM-09: Opt-Out Reason Not Captured for Analytics

**Severity:** Low
**Scenario:** 11

When a lead opts out, the system processes the STOP keyword but doesn't analyze WHY they're leaving. "Found someone cheaper" vs "bad experience" vs "project cancelled" are very different signals.

**Fix:** When opt-out is detected alongside non-STOP text ("I found someone else, stop texting me"), run a lightweight classification (or regex) on the accompanying message to extract the reason. Store in `leads.optOutReason`. Feed into analytics for churn analysis.

---

### SIM-10: `leads.status = 'active'` Bug Confirmed

**Severity:** Medium
**Scenario:** 11

`opt-out-handler.ts` line 81 sets `leads.status = 'active'` on re-subscribe. This is not a valid status value. Should be `'contacted'`. The `incoming-sms.ts` opt-in path (line 608) correctly uses `'contacted'`.

**Fix:** Change `opt-out-handler.ts` line 81 from `status: 'active'` to `status: 'contacted'`.

---

## Automation Race Conditions Discovered

### RACE-01: Estimate Auto-Trigger vs EST Command

**Severity:** Low (unlikely but possible)

No DB-level lock between `maybeAutoTriggerEstimateFollowup()` and `triggerEstimateFollowupFromSmsCommand()`. Both check `getActiveEstimateSequenceCount()` before inserting. Two concurrent requests could both pass the check and create duplicate estimate follow-up sequences.

**Fix:** Add a unique partial index: `CREATE UNIQUE INDEX ON scheduled_messages (lead_id, sequence_type) WHERE sent = false AND cancelled = false AND sequence_type = 'estimate_followup'`.

### RACE-02: Smart Assist Draft vs Manual Reply

**Severity:** Medium

If contractor manually replies while a Smart Assist draft is pending, the draft still fires at its scheduled time. No auto-cancel on outbound conversation message.

**Fix:** In `processDueSmartAssistDrafts()`, before sending, check if there's been an outbound message from the contractor since the draft was created. If yes, auto-cancel the draft.

### RACE-03: PAUSE Doesn't Cancel Flow Executions

**Severity:** Medium

PAUSE command cancels `scheduledMessages` but not `flowExecutions`. Active flow steps stored in `flowStepExecutions` may still fire.

**Fix:** PAUSE command should also cancel all active `flowExecutions` for the client: `UPDATE flow_executions SET status = 'cancelled' WHERE client_id = ? AND status = 'active'`.

---

## Summary: All Issues by Priority

### Pre-Launch Critical (fix before first client)
| ID | Issue | Source |
|----|-------|--------|
| AUDIT-01 | No freshness gate for __AI_GENERATE__ | Audit |
| AUDIT-02 | Timezone bug in win-back/dormant | Audit |
| AUDIT-03 | Win-back temperature 0.9 | Audit |
| SIM-10 | `leads.status = 'active'` bug | Simulation |
| RACE-02 | Smart Assist draft vs manual reply | Simulation |
| RACE-03 | PAUSE doesn't cancel flow executions | Simulation |

### First 30 Days
| ID | Issue | Source |
|----|-------|--------|
| AUDIT-04 | No conversation strategy | Audit |
| AUDIT-05 | Smart Assist edits wasted | Audit |
| AUDIT-11 | Signal detection no validation | Audit |
| SIM-01 | leads.status not updated on first response | Simulation |
| SIM-02 | Status/stage divergence | Simulation |
| SIM-04 | No emergency mode | Simulation |
| SIM-06 | Voice→SMS context loss | Simulation |
| SIM-08 | No escalation acknowledgment | Simulation |

### Architecture Redesign (Layer System)
| ID | Issue | Source |
|----|-------|--------|
| SIM-03 | No decision-maker tracking | Simulation |
| SIM-05 | Form data not used for fast-track | Simulation |
| SIM-07 | Estimate follow-up not contextual | Simulation |
| SIM-09 | Opt-out reason not captured | Simulation |
| GAP-S3 | Price objection vs pricing discussion | Simulation |
| GAP-S4 | Win-back doesn't distinguish pause vs ghost | Simulation |
| GAP-S5 | Returning lead stage not reset | Simulation |
| GAP-S8 | No competitive differentiation framework | Simulation |

### Post-Scale (5+ clients)
| ID | Issue | Source |
|----|-------|--------|
| AUDIT-06 | No A/B testing | Audit |
| AUDIT-07 | No conversation analytics | Audit |
| AUDIT-08 | No lead scoring calibration | Audit |
| AUDIT-09 | No outcome feedback loop | Audit |
| RACE-01 | Estimate auto-trigger race condition | Simulation |
