# ConversionSurgery Build Plan — Revenue Recovery Features + Compliance

> **Status**: I-1 Compliance Gateway IN PROGRESS (core done, 15 internal files remaining)
> **Last updated**: 2026-02-13
> **Session**: Feature gap analysis + compliance audit + UX refinement + execution started
> **Nav cleanup**: ✅ DONE (committed but not pushed)

---

## Context

ConversionSurgery is a $997/mo managed service for contractors (plumbers, roofers, HVAC, electricians). It captures missed calls and form submissions, follows up via AI-powered SMS, and tries to book appointments. The operator (Mashrur) manages 20+ client accounts.

### What was accomplished this session
1. ✅ Admin nav UX cleanup — restructured into 4 groups (Clients, Optimization, Reporting, Settings), renamed confusing labels, added missing pages
2. ✅ Full product audit — identified 6 missing features that could cause churn
3. ✅ Architecture audit — schema is extensible (JSONB, event sourcing), services are tightly coupled but fine for current stage
4. ✅ Compliance audit — scored 45/100 for Canadian law (CASL/CRTC/PIPEDA/PIPA), identified 5 critical gaps
5. ✅ Deep UX refinement on each feature based on ICP behavior

### What needs to be built (in order)

---

## Infrastructure Layer (build first)

### I-1: Compliance Gateway (~1 day)
**File to create**: `src/lib/compliance/compliance-gateway.ts`

Single `sendCompliantMessage()` function. Every outbound SMS in the entire system goes through it. No exceptions.

**Checks (in order):**
1. Is number opted out? → Block
2. Is number on DNC (internal + DNCL)? → Block
3. Is there valid, non-expired consent? → If first contact from inbound call/form, auto-record implied consent. If no consent found, block.
4. Is it quiet hours (9pm–9:30am recipient local time)? → Queue for 10am
5. Frequency limits exceeded for this number? → Queue
6. Monthly client message limit exceeded? → Block + alert operator

**Consent auto-recording:**
- Missed call → implied consent (6 months), evidence = Twilio Call SID
- Form submission → implied consent (6 months), evidence = form submission ID
- Lead replies to our text → upgrade to express consent (no expiry unless revoked)
- Existing customer (job completed) → implied consent (2 years from last transaction)
- At 5 months (inquiry) or 22 months (customer), send re-confirmation: "Reply YES to keep receiving updates"
- No reply to re-confirmation → consent expires → no more messages → lead marked dormant

**Audit logging:**
- Every send attempt logged (pass or fail): phone hash, client ID, message type, consent ID, all check results
- Kept 3 years per CASL record-keeping requirement

**Message content compliance:**
- Append sender contact info (business name + city) to templates
- Ensure opt-out instructions present periodically (every 3rd message, not every message)

**Files to modify:**
- `src/lib/automations/missed-call.ts` — replace `sendSMS()` with `sendCompliantMessage()`
- `src/lib/automations/form-response.ts` — same
- `src/lib/automations/incoming-sms.ts` — same for AI responses
- `src/lib/services/flow-execution.ts` — same for flow steps
- `src/app/api/cron/process-scheduled/route.ts` — same for scheduled messages
- `src/lib/automations/appointment-reminder.ts` — same
- `src/lib/automations/estimate-followup.ts` — same
- `src/lib/automations/payment-reminder.ts` — same
- `src/lib/automations/review-request.ts` — same

**Quiet hours fix:**
- Change default `quietEndHour` from 8 to 10 (9:30am rounded up for safety)
- Update existing records if any

**DNCL integration (can be Phase 2):**
- Register with CRTC DNCL (https://lnnte-dncl.gc.ca/)
- Monthly cron job to download and bulk import via existing `DncService.bulkImport()`

---

### I-2: AI Context Pipeline + Guardrails (~1-2 days)
**File to create**: `src/lib/agent/context-builder.ts`

Standard context bundle assembled for EVERY AI-generated message (not just the LangGraph agent — also legacy AI, no-show recovery, win-back, booking).

**Context bundle:**
| Layer | Source |
|-------|--------|
| Customer identity | `leads` table (name, phone, source) |
| Conversation history | `conversations` table (all messages in order) |
| Customer intent | `leadContext` (projectType, urgency, sentiment, stage) |
| Customer history | `jobs`, `appointments`, `flowExecutions` (past interactions) |
| Matched service | `leadContext.matchedServiceId` → `clientServices` |
| Business identity | `clients` + `businessHours` (name, owner, hours, timezone) |
| Business knowledge | `knowledgeBase` (vector search for relevant entries) |
| Agent settings | `clientAgentSettings` (tone, goals, limits) |
| Current time context | Computed: time of day, business hours status, day of week, season |
| Compliance state | Opt-out status, consent type, message count, quiet hours |

**Guardrails (enforced in system prompt for all AI generation):**

Hard rules:
- NEVER guess when knowledge base doesn't have the answer → defer to human: "Let me have {ownerName} get back to you on that"
- NEVER promise pricing, timelines, or guarantees the business hasn't authorized
- NEVER provide medical, legal, or financial advice
- NEVER claim to be human — if asked, acknowledge AI assistance
- NEVER reference other customers' information
- NEVER use high-pressure tactics or urgency/scarcity language
- NEVER reference weather, current events, market conditions, or any unverifiable real-world claims
- NEVER send more than 3 messages without a response (prevents harassment)
- If customer says "leave me alone" / "stop texting" / any opt-out intent → treat as STOP

Tone rules:
- Match agent tone setting (professional / friendly / casual)
- If customer frustrated → de-escalate, offer human handoff
- For win-back: sound like a person texting, not a marketer (see F-4 details)

Confidence scoring:
- High (answer directly from knowledge base) → respond normally
- Medium (partial match, inference) → soften language ("Typically...", "Usually...") + flag for review
- Low (no knowledge base match) → defer to human, never guess

**Knowledge gap detection:**
- Track every question where AI confidence was low
- Weekly report to operator: "These questions came up that aren't in the knowledge base" with client name, question, times asked
- Operator fills the gap → knowledge base improves

---

### I-3: Structured Knowledge Collection (~3-4 hours)
**File to create**: `src/app/(dashboard)/admin/clients/new/wizard/steps/step-knowledge.tsx` (new wizard step)
**Also create**: `src/app/(dashboard)/admin/clients/[id]/knowledge/page.tsx` (edit existing client's knowledge)

Guided interview form for onboarding (replaces free-text knowledge base entry):

**Sections:**
1. **Services & Boundaries**
   - "What services do you offer?" (add multiple, each with name + avg price range)
   - "What do people commonly ask for that you DON'T do?" (critical — AI needs hard boundaries)

2. **Service Area**
   - "What areas do you cover?" (cities/neighborhoods)
   - "Anywhere you won't go?" (distance limits, exclusions)

3. **Pricing Guidance**
   - Per service: "Should AI discuss pricing?" (yes with range / defer to estimate / never discuss)
   - Global: "Should AI ever give exact quotes?" (almost always no)

4. **Process & Logistics**
   - "Do you offer free estimates?" (yes/no, conditions)
   - "What happens after booking?" (arrival process, what to expect)
   - "Payment terms?" (deposit, payment on completion, financing)
   - "Warranty?" (parts, labor, duration)

5. **Common Questions**
   - "What do people ask most?" (minimum 5 Q&A pairs)
   - Pre-populated suggestions based on industry

6. **Things AI Must Never Say**
   - "Anything the AI should never promise or discuss?"
   - Pre-populated: never guarantee same-day, never discuss competitor pricing, never discuss insurance claims

System generates structured knowledge base entries from form answers. Each entry categorized and linked to specific services.

**Industry presets** — when client selects their trade during onboarding, pre-populate:
- Common services with typical price ranges
- Common FAQs
- Common "don't do" boundaries
- Operator adjusts, doesn't start from scratch

---

## Feature Layer (build after infrastructure)

### F-1: Multi-Service Catalog + Revenue Attribution (~3-4 hours)

**Schema:**
- New table `clientServices`: id, clientId, name, avgValueCents, category (optional), isActive, sortOrder
- OR JSONB field on `clients` table (simpler, but less queryable for cross-client analytics)
- Recommendation: separate table — enables "which service types generate most leads across all clients" analytics
- Add `previousResponseTimeMinutes` to `clients` schema (for speed-to-lead before/after)
- Add `matchedServiceId` to `leadContext` (links lead to classified service)

**Onboarding wizard update:**
- New section in Step 1 (Business Info) or new Step 2
- Industry presets: select trade → pre-populated service list → adjust prices
- Must add at least 1 service to proceed

**AI classification:**
- During conversation, AI extracts project type (already does via `projectType` in leadContext)
- New step: match extracted project type to client's defined services
- Store `matchedServiceId` on leadContext + populate `estimatedValue` from service's avgValueCents
- If AI can't classify confidently → ask qualifying question naturally ("Is this more of a repair or a full replacement?")
- If still can't classify → fall back to average across all client services

**Reports update:**
- Revenue pipeline by service: "5 water heater jobs ($12,500) + 8 drain cleanings ($2,800) = $15,300 total"
- ROI calculation: total pipeline / $997 = Xx return

**Dashboard update:**
- Big number: "$42,000 pipeline recovered this month"
- Breakdown by service type

---

### F-2: Speed-to-Lead (~2-3 hours)

**Computation:**
- `responseTime = firstOutboundConversation.createdAt - lead.createdAt`
- Average across all leads for the period
- Add to daily stats aggregation or compute on-the-fly

**Dashboard card:**
```
⚡ Your Response Time: 47 seconds
Before ConversionSurgery: ~3 hours (est.)
Industry average: 42 minutes
Your leads hear back 54x faster than average

78% of customers buy from whoever responds first. You're always first.
```

**Onboarding: capture "before" baseline:**
- Add `previousResponseTimeMinutes` to clients schema
- Wizard question: "Before us, how long did it usually take to return a missed call?"
- Options: "Within 30 min / 1-2 hours / Same day / Next day or later / Often never"
- Maps to minutes: 30, 90, 480, 1440, null (use "often never" as qualitative)

**Reports:**
- One line item with industry context
- No artificial data gathering — use industry benchmarks only

---

### F-3: No-Show Recovery (~3-4 hours)

**Trigger:**
- Cron job (runs with existing scheduled message processor)
- Checks: appointments where `appointmentDate + appointmentTime + 2 hours < now()` AND status = `scheduled`
- Auto-updates status to `no_show`

**AI-personalized messages:**
- NOT a static flow template — AI generates each message using full context pipeline (I-2)
- Pulls: lead name, conversation history, project type, matched service, appointment details
- AI writes a personalized follow-up that references their specific situation

**Sequence:**
- Same evening (or next morning if appointment was late): first AI-generated message
- 2 days later if no reply: second AI-generated message, different angle
- Stop after 2 attempts — no third message

**If lead replies:**
- AI picks up conversation naturally (has full history)
- Can reschedule, answer questions, handle objections
- Goes through compliance gateway

**Example output:**
- Furnace repair: "Hey Sarah, hope everything's okay! We had you down for a furnace check today at 2pm. No worries at all — want to pick another day this week?"
- Deck build: "Hey Mike, we missed you today for the deck estimate. I know these projects take a lot of planning — happy to reschedule whenever works for you."

---

### F-4: Win-Back Sequences (~2-3 hours)

**Trigger:**
- Cron job identifies stale leads:
  - Status: `contacted` (engaged but didn't progress)
  - Last message: 25-35 days ago (RANDOMIZED, not exactly 30)
  - Not opted out, not won, not lost, not dormant
  - Consent still valid (within 6-month window)

**AI-personalized messages:**
- AI generates from conversation context — references their specific project
- System prompt enforces human-like tone (see rules below)
- Current date + season passed to AI for calendar-factual statements only

**Tone rules (in AI system prompt):**
```
You're writing a casual follow-up text from {ownerName} at {businessName}.
Write like a real person texting — not a marketer, not a chatbot.

Rules:
- 1-2 short sentences maximum
- Reference their specific project from conversation history
- Give them an easy out — "no rush", "whenever you're ready"
- NEVER mention how long it's been since you last talked
- NEVER use "just checking in"
- NEVER use urgency, scarcity, or promotional language
- NEVER reference weather, news, or unverifiable external claims
- Sound slightly informal — contractions, short sentences
- End with a soft ask, not a hard CTA

Good: "Hey Mike, just wanted to follow up on the deck project. Let me know if you'd like to get that estimate set up."
Bad: "Hi Michael! Just checking in about your recent inquiry. We'd love to help!"
```

**Timing:**
- Day: randomized 25-35 day window
- Time: 10am-2pm on a weekday (when a real person would text between jobs)
- Never Monday morning, never Friday afternoon
- Never two win-backs same day to same lead

**Sequence:**
- First attempt: AI-generated, personalized
- Second attempt: 20-30 days later if no reply, even shorter ("Hey Mike — still here if you need us for the deck. No rush at all.")
- After 2 no-replies: mark lead `dormant`, no more outreach
- If they ever text back on their own → AI resumes conversation naturally

---

### F-5: Client ROI Dashboard (~3-4 hours)
**Depends on: F-1 (service values) + F-2 (speed-to-lead)**

Update the client-facing `/dashboard` (Overview) page to lead with ROI:

```
┌─────────────────────────────────────────────┐
│  Revenue Recovered          Response Time    │
│  $42,000 this month         47 seconds avg   │
│  ▲ 15% vs last month        Industry: 42min  │
├─────────────────────────────────────────────┤
│  23 Missed Calls Captured                    │
│  12 Appointments Booked                      │
│  3 Leads Re-engaged                          │
│  $997 invested → 42x return                  │
└─────────────────────────────────────────────┘
```

- Revenue = appointments × matched service avg value (from F-1)
- Speed = computed from timestamps (from F-2)
- Month-over-month comparison from daily stats history
- Same data feeds bi-weekly reports (one source of truth)

---

### F-6: Conversational Booking (~2-3 days)
**Most complex feature. Benefits from all above being in place.**

**AI booking flow:**
1. Lead expresses intent to book during SMS conversation
2. AI checks availability: business hours minus Google Calendar events (next 7 days)
3. AI suggests 2-3 time slots conversationally: "Would Tuesday morning or Thursday afternoon work?"
4. Lead picks one via text reply
5. AI creates: appointment record + calendar event + schedules reminders for both parties
6. Confirmation SMS to lead + notification SMS to contractor

**Reminders (both parties):**
- Lead: day before 10am + 2 hours before
- Contractor: evening before ("Tomorrow: Sarah Johnson, furnace, 10am, 123 Main St, her #: 403-555-1234") + 1 hour before

**Rescheduling from lead:**
- Lead texts "something came up, can we move?"
- AI detects reschedule intent → checks new availability → offers times
- Updates: cancel old appointment, create new one, update calendar, new reminders, notify contractor

**Rescheduling from contractor:**
- Contractor texts system or uses dashboard
- System texts lead: "Hi Sarah, {contractorName} needs to shift your appointment. Would [time] or [time] work?"
- Lead picks → system updates everything

**Edge cases:**
- Stalled booking: lead says "let me check my schedule" → 24hr nudge, 48hr second nudge, then stop
- Double-booking: first confirmed gets slot, second offered next available
- Same-day booking: check today's availability, skip day-before reminder, only send 1-hour reminder
- Cancellation (not reschedule): acknowledge gracefully, cancel everything, mark lead lost, no follow-up
- Contractor no-show: lead texts "I'm here but nobody is" → immediate priority-1 escalation, urgent SMS to contractor, apology to lead

---

## Compliance Summary (Canadian Law)

### CASL (Canada's Anti-Spam Legislation)
- ✅ Implied consent from inbound calls/forms (6 months)
- ✅ Express consent when lead replies (no expiry unless revoked)
- ✅ Auto-record consent events with evidence
- ✅ Consent expiry tracking + re-confirmation flow
- ✅ Sender ID + contact info + unsubscribe in messages
- ✅ Unsubscribe functional 60+ days

### CRTC Telemarketing Rules
- ✅ Quiet hours 9pm-9:30am (fix current 8am default to 10am)
- ✅ DNCL integration (monthly sync)
- ✅ Internal DNC list (already exists)
- ✅ Identity disclosure in messages

### PIPEDA / Alberta PIPA
- ✅ Consent for collecting phone numbers (recorded)
- ✅ Audit trail for 3 years
- ⬜ Phone number encryption at rest (Phase 2)
- ⬜ Data retention policy / right-to-erasure (Phase 2)

---

## Build Order

```
Week 1:
  I-1 Compliance Gateway ──────────┐
  I-2 AI Context Pipeline ─────────┤
  I-3 Knowledge Collection ────────┤
                                    ↓
Week 2:                        Foundation ready
  F-1 Service Catalog + Revenue ───┐
  F-2 Speed-to-Lead ───────────────┤  (parallel)
                                    ↓
  F-3 No-Show Recovery ───────────┐
  F-4 Win-Back ────────────────────┤  (parallel, same pattern)
                                    ↓
Week 3:
  F-5 Client ROI Dashboard ────────  (depends on F-1 + F-2)
  F-6 Conversational Booking ──────  (most complex, benefits from all above)
```

---

## Key UX Decisions Made

1. **Revenue attribution**: Multi-service catalog per client (not single average), AI classifies during conversation
2. **Speed-to-lead**: Industry benchmarks + before/after contrast, no artificial data gathering
3. **No-show recovery**: AI-generated personalized messages (not templates), full conversation context
4. **Win-back**: Human-like tone, randomized timing (25-35 days), no "just checking in", no weather/world-state claims, 2 attempts max
5. **Booking**: Conversational over SMS (no external links), both-party reminders, reschedule from either side
6. **Knowledge base**: Structured interview (not free-text), industry presets, gap detection, guardrails against guessing
7. **Compliance**: Gateway pattern — every message goes through one function, auto-record consent on inbound events, implied consent is legally defensible for missed calls under CASL
8. **AI guardrails**: Never guess without knowledge base backing, never hallucinate real-world claims, defer to human on low confidence

---

## Execution Progress

### Commits made this session
1. `9c20081` — Admin nav restructured (4 groups, renamed labels, added missing pages)
2. `04c23a4` — Compliance gateway created + missed-call + form-response migrated
3. `273c216` — CASL consent expiry (6mo/2yr) + quiet hours fixed (10am) + Canadian holidays
4. `89d94c1` — Flow execution + scheduled message processor migrated to gateway

### I-1 Compliance Gateway — Progress
**Core gateway**: ✅ DONE (`src/lib/compliance/compliance-gateway.ts`)
**Lead-facing automations migrated**: ✅ 4/4
- ✅ `missed-call.ts` — auto-records implied consent from CallSid
- ✅ `form-response.ts` — auto-records implied consent from form submission
- ✅ `flow-execution.ts` — uses existing_consent basis
- ✅ `process-scheduled/route.ts` — uses existing_consent basis

**CASL compliance fixes**: ✅ DONE
- ✅ 6-month implied consent expiry for inquiries
- ✅ 2-year implied consent expiry for existing customers
- ✅ 30-day expiry warning
- ✅ Quiet hours default changed to 10am (CRTC requires 9:30am)
- ✅ Canadian federal holidays (Canada Day, Remembrance Day, etc.)

**Internal/team notification files NOT YET migrated** (lower priority — these send to team members, not leads):
- `incoming-sms.ts` (7 sendSMS calls — AI responses to leads ARE high priority)
- `orchestrator.ts` (1 call — AI agent responses to leads)
- `escalation.ts`, `team-escalation.ts`, `ring-group.ts` — team notifications
- `review-monitoring.ts`, `voice-summary.ts`, `weekly-summary.ts` — admin notifications
- `flow-suggestions.ts`, `usage-alerts.ts`, `magic-link.ts` — system messages
- API routes: `leads/[id]/reply`, `payments/[id]/send`, `client/conversations/[id]/send`
- Webhooks: `stripe`, `member-answered`

**Next step for I-1**: Migrate `incoming-sms.ts` and `orchestrator.ts` (AI responses to leads), then mark I-1 as done. The team/admin notification files can be migrated incrementally.

## Legal Note

Consult a Canadian telecommunications lawyer to validate CASL interpretation — especially "missed call = implied consent as inquiry." Technical implementation is straightforward, but legal interpretation should be confirmed by counsel.
