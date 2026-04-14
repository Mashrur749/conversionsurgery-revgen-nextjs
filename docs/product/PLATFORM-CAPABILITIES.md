# Platform Capabilities

Last updated: 2026-04-12 (Phase 4: AI eval system — comprehensive evaluation coverage across all 13 AI features, 6 categories, HTML report + baseline tracking)
Purpose: Complete inventory of what ConversionSurgery can do today — organized by value delivered, not by technical area.

---

## 1. Speed-to-Lead (Near-Instant Response)

The core promise: every inquiry gets a response in seconds, not hours.

### Inbound Channels

| Channel | What happens | Response time |
|---------|-------------|---------------|
| **SMS/MMS** | Webhook receives message, creates/updates lead, AI generates contextual response. **Soft rejection detection:** messages like &ldquo;not interested&rdquo; or &ldquo;went with someone else&rdquo; auto-transition lead to `lost`, cancel active sequences, and send a polite acknowledgment. | 2-8 seconds (autonomous mode) |
| **Missed call** | Detects unanswered call, auto-sends personalized SMS to caller. **Known leads** get contextual SMS referencing their name and project; new leads get the standard template. **Vendor/spam screening:** first reply with vendor keywords (marketing, SEO, home warranty, etc.) gets redirected to email &mdash; AI never engages. | 2-3 seconds |
| **Web form** | Receives submission, creates lead, sends template-based confirmation | 1-2 seconds |
| **Voice call** | AI answers, converses in real-time, books appointments or transfers to human | Immediate (live call) |

### AI Response Modes

| Mode | Behavior | Use case |
|------|----------|----------|
| **Autonomous** | Full AI agent (LangGraph + Anthropic) generates and sends response automatically | Weeks 3+ of client onboarding |
| **Smart Assist (immediate)** | AI generates and sends instantly | Speed-critical clients |
| **Smart Assist (delayed)** | AI generates, owner has 1-60 min window to review/edit/cancel before auto-send | Week 2 onboarding (default 5 min) |
| **Smart Assist (manual)** | AI generates draft, waits for owner approval via SMS command (SEND/EDIT/CANCEL + reference code) | Conservative clients |

### Dynamic Model Routing

The respond node (which generates the actual customer-facing message) dynamically selects between fast (Haiku) and quality (Sonnet) model tiers based on conversation context:

| Trigger | Condition | Model tier |
|---------|-----------|------------|
| **Low confidence** | AI decision confidence &lt; 60 | Quality |
| **High-value lead** | Composite lead score &ge; 70 | Quality |
| **Strong buying intent** | Intent score &ge; 80 | Quality |
| **Frustrated + urgent** | Sentiment = frustrated AND urgency &ge; 60 | Quality |
| **Standard** | None of the above | Fast |

Both the analyze-and-decide node and respond node use dynamic model routing based on lead signals. High-value leads (&ge;70 score), high-intent (&ge;80), or frustrated+urgent leads get quality-tier processing for both decision-making and response generation. The routing decision and reason are logged in `agent_decisions.actionDetails` for observability. When the strategy resolver determines a high-stakes stage (proposing, closing, objection handling), the respond node upgrades to quality tier regardless of lead score.

### Composable Agent Architecture

The AI conversation agent uses a 6-layer composable architecture:

1. **Sales Methodology (Layer 1):** 8-stage conversation strategy (greeting &rarr; qualifying &rarr; educating &rarr; proposing &rarr; objection handling &rarr; closing &rarr; nurturing &rarr; post-booking) with deterministic stage transitions and emergency bypass
2. **Locale Context (Layer 2):** Region-specific communication norms, regulatory context (CASL/CRTC), and buying psychology (currently: Canadian Alberta)
3. **Industry Playbook (Layer 3):** Trade-specific expertise including vocabulary mapping, objection patterns, qualifying sequences, and example conversations (currently: basement development)
4. **Channel Adaptation (Layer 4):** Per-medium constraints (SMS: 300 char max, 1 question per message; Voice: real-time, filler words; Web Chat: formatting, links)
5. **Conversation Entry Context (Layer 5):** Source-aware opening strategy (missed call &rarr; empathetic; form submission &rarr; reference data; referral &rarr; warm; dormant &rarr; gentle)
6. **Client Personality (Layer 6):** Per-contractor identity, tone, KB, and settings (existing system)

The strategy resolver computes a deterministic conversation plan each turn &mdash; the LLM executes the strategy rather than inventing one. Prompt caching reduces latency by caching the stable prefix (Layers 1&ndash;4 + guardrails).

### Speed-to-Lead Tracking

- Response time measured per lead: `first outbound message - lead creation`
- Bucketed into: &lt;1 min, 1-5 min, 5-15 min, 15-60 min, 1hr+
- Industry benchmark comparison: calculates multiplier vs. 42-minute industry average
- Surfaced in bi-weekly reports and client revenue dashboard

### Post-Generation Safety Guard

After every AI-generated message, a deterministic output guard checks for three critical violations before the message is sent:

1. **Pricing leak** — detects dollar amounts or pricing patterns when `canDiscussPricing` is disabled
2. **Opt-out retention** — detects persuasion/retention language after a customer says &ldquo;stop&rdquo; or &ldquo;unsubscribe&rdquo;
3. **AI identity denial** — detects claims of being human when a customer directly asks &ldquo;are you a bot?&rdquo;

If any check fails, the response is blocked, a safe fallback message is sent, and the violation is logged in `agent_decisions` for quality analysis.

Applied to: Agent orchestrator, win-back automation, no-show recovery automation.

### Response Length Control

AI responses are truncated at sentence boundaries instead of mid-word. This ensures messages sent to homeowners always end with complete sentences, even when the AI exceeds the configured maximum response length. Win-back messages are capped at 160 characters (SMS optimal). No-show recovery at 200 characters.

### Semantic Knowledge Retrieval

Knowledge base entries are embedded using Voyage AI `voyage-3-lite` (1024-dimensional vectors) and searched using pgvector cosine similarity. This replaces keyword matching and handles:
- Synonym matching (&ldquo;leaky faucet&rdquo; matches &ldquo;tap repair&rdquo;)
- Conceptual matching (&ldquo;my basement is flooding&rdquo; matches &ldquo;Emergency Services&rdquo;)
- Multi-word queries without exact phrase requirements

As a bridge layer, trade-aware synonym expansion (40+ synonym groups) runs before any search &mdash; both ILIKE fallback and semantic search benefit from expanded query terms.

Example synonym mappings:

| Customer says | Also searches |
|--------------|--------------|
| leaky faucet | tap repair, dripping tap, faucet dripping |
| legal suite | secondary suite conversion, in-law suite, basement suite |
| hot water tank | water heater, HWT, water heater replacement |
| re-roof | shingle replacement, new roof, roofing job |
| panel upgrade | electrical panel, breaker box, service upgrade |
| heat pump | HVAC, mini split, ductless |

Coverage groups: plumbing, renovation, electrical, HVAC, roofing, and transactional intent (quote, estimate, pricing, cost).

Context is split into two tiers:
- **Structural** (always included): Company overview, service area, hours, restrictions, high-priority entries (priority &ge; 9)
- **Search-matched** (per-message): Top 3 semantically relevant entries for the customer&apos;s question

Fallback: If Voyage AI is unavailable or entries have not been embedded yet, the system falls back to ILIKE keyword search with synonym expansion automatically.

Embedding is asynchronous &mdash; entries are usable immediately on create/update. A backfill cron processes pending embeddings hourly (50 per run).

### Estimate Auto-Detection

The AI monitors inbound lead messages for signals that a quote was already sent. When detected, the 4-touch estimate follow-up sequence starts automatically — no contractor action required.

Trigger phrases include: &ldquo;waiting on the quote&rdquo;, &ldquo;comparing prices&rdquo;, &ldquo;got your estimate&rdquo;, &ldquo;still thinking about your quote&rdquo;, &ldquo;haven&apos;t heard back&rdquo;.

- Auto-trigger is logged in `audit_log` as `estimate_auto_triggered`
- Deduped per lead — only fires once per lead regardless of how many trigger messages are received
- Applies only to leads in `new` or `contacted` status with no active estimate flow

### Booking Aggressiveness Calibration

The 1-10 booking aggressiveness slider produces four concrete behavioral tiers:

| Tier | Range | Behavior |
|------|-------|----------|
| **Conservative** | 1-3 | Wait for the customer to ask about booking; never suggest times proactively |
| **Balanced** | 4-5 | Gentle booking offer after the lead has qualified interest (e.g., confirmed scope, asked about availability) |
| **Proactive** | 6-7 | Suggest specific times within 1-2 exchanges once basic interest is established |
| **Aggressive** | 8-10 | Lead with availability immediately — first or second message includes booking offer |

Default is 5 (balanced). Adjust in client Settings &rarr; AI Behavior.

### Conversation Memory

For conversations exceeding 20 messages, older messages are automatically summarized using AI and stored in `leadContext.conversationSummary`. When a lead re-engages after 24+ hours, the summary is regenerated to capture &ldquo;where we left off.&rdquo; The AI prompt structure becomes:

- **Earlier Conversation Summary** &mdash; AI-generated paragraph covering project details, pricing discussed, objections, appointments, and current status
- **Recent Messages** &mdash; last 15 raw messages for immediate context

This ensures returning leads don&apos;t have to repeat project details, pricing discussions, or scheduling preferences from previous conversations. Summary updates are triggered by:
- First time message count exceeds 20
- Re-engagement after 24+ hour gap
- 10+ new messages since last summary

Summarization uses Haiku (fast tier) for cost efficiency. Non-blocking &mdash; if summarization fails, the AI continues with raw messages only.

---

## 2. Follow-Up Automation (Never Drop a Lead)

### KB Empty Nudge (48-Hour)

Targets new clients who have not populated their knowledge base within the first 48-72 hours.

- Daily cron at 10am UTC, fires once per client
- Condition: client created 48-72 hours ago and has fewer than 3 KB entries
- Message to contractor: &ldquo;Your AI needs your business info. Takes 10 min: [link]&rdquo;
- Deduped via audit_log — only one nudge per client regardless of KB entry count

### Day 3 Check-in SMS

Automated check-in to the contractor shortly after signup with real activity data.

- Daily cron at 7am UTC
- Fires at 66-78 hours post-signup
- Message includes live lead count and conversation count since signup
- Deduped via audit_log

### KB Gap Auto-Notify

When the AI encounters questions it cannot answer, the contractor is automatically notified.

- Daily cron at 10am UTC
- Sends contractor SMS for each new unanswered question
- Max 2 notifications per client per day
- Deduped per gap via audit_log (no repeat for the same gap)
- **Deep link:** each notification SMS includes a `?add=` query parameter with the gap question URL-encoded. Tapping the link opens the portal Knowledge Base page with the add-entry form pre-filled with the question — contractor types the answer and submits without any copy/paste.

### Estimate Follow-Up

Triggered when owner flags an estimate as sent (SMS keyword `EST`, dashboard action, or API call), OR automatically when the AI detects conversation signals implying a quote was sent (see Section 1: Estimate Auto-Detection).

| Touch | Timing | Message tone |
|-------|--------|-------------|
| 1 | Day 2, 10am | Checking in — any questions? |
| 2 | Day 5, 10am | Booking up — want to get on the schedule? |
| 3 | Day 10, 10am | Circling back, still available |
| 4 | Day 14, 10am | Last check-in, no hard feelings |

**Fallback nudge:** Cron identifies stale leads (24+ hours, no estimate sequence) and prompts the owner: "Did you send an estimate to [name]? Reply YES to start follow-up." (Window shortened from 48h to 24h to reduce EST trigger adoption decay.)

Cancellation: new sequence auto-cancels prior unsent messages for the same lead. When the lead is marked `won` or `lost`, all pending estimate follow-up messages are automatically cancelled.

**Pause-and-resume on reply:** when a homeowner replies during the sequence (e.g., &ldquo;still thinking&rdquo;), only the next unsent step is cancelled and remaining steps are delayed by 3 days &mdash; the sequence continues at a gentler pace rather than being killed permanently. Soft rejections (&ldquo;not interested&rdquo;, &ldquo;went with someone else&rdquo;) cancel ALL sequences (estimate, payment, review, referral, appointment reminders).

**Stuck estimate nudge:** weekly cron (Wednesday) alerts the contractor when leads have been in `estimate_sent` for 21+ days without any status update. SMS names up to 3 leads and prompts the contractor to mark them won or lost so ROI reporting stays accurate.

### Appointment Booking — Address Required

The AI requires an address before confirming any booking. When no address is on file, the AI asks for it before completing the booking (not after). The chosen time slot is held in `leadContext` until the address arrives.

- **Address already on file:** booking proceeds immediately with the address on the appointment record.
- **No address on file:** AI responds &ldquo;Great choice! Before I confirm, what&apos;s the address for the estimate?&rdquo; The pending slot is stored. The next inbound reply completes the booking with the address, stored on both the appointment and lead records.

### Appointment Reminders

- **Day-before reminder** to homeowner
- **2-hour reminder** to homeowner
- **Contractor reminder** to business owner AND assigned team member (via reminder routing policy — configurable primary/fallback chain). Booking notifications also CC the `assistant` role (office managers).
- **2-hour context brief:** the contractor/estimator reminder includes project type, budget estimate, sentiment, urgency score, and AI conversation summary &mdash; the estimator walks in informed, not cold
- Sent through compliance gateway with quiet-hours queueing
- **Email fallback:** if compliance blocks all SMS recipients for a booking notification (e.g., quiet hours, opt-out), the system falls back to email notification so the contractor is never left uninformed

### Appointment Duration &amp; Multi-Day Jobs

Appointments support configurable duration (default 60 minutes). Multi-day jobs (e.g., 3-day HVAC install) can span multiple dates with `endDate`.

- `durationMinutes` field on appointments &mdash; AI booking and manual booking both save the actual duration
- `getAvailableSlots()` blocks the full duration window, not just 1 hour
- Calendar events use actual duration for Google Calendar sync (`endTime = startTime + durationMinutes`)
- Multi-day: when `endDate` is set, all days in range are blocked from slot generation

### Booking Confirmation Mode (Non-Google-Calendar Contractors)

A per-client toggle (`bookingConfirmationRequired`) that changes how AI booking works for contractors who do not use Google Calendar or who want to manually approve each booking before the homeowner is confirmed.

**When enabled:**

1. AI collects the homeowner&apos;s preferred time as normal.
2. Instead of auto-confirming, creates the appointment in `pending_confirmation` status.
3. Sends the contractor an SMS: &ldquo;Booking request: [Lead name] for [project], [date] at [time]. Reply YES to confirm, or suggest a new time (e.g., THU 2PM).&rdquo; Accepts: `YES`, `CONFIRM`, `Y`, `1`, `OK`.
4. Sends the homeowner a holding message: &ldquo;I&apos;m checking availability. You&apos;ll hear back shortly to confirm!&rdquo;
5. When the contractor replies YES, the appointment is confirmed and the homeowner is notified with full confirmation details.
6. When the contractor replies with a new time (e.g., &ldquo;THU 2PM&rdquo;), the old appointment is cancelled, a new pending request is created, and the homeowner is informed of the proposed new time.

**Timeout escalation:**
- 2 hours with no response: contractor receives a reminder SMS.
- 4 hours with no response: operator alert SMS (uses agency `operatorPhone`; falls back to contractor if no operator phone configured).

**Schema:** `clients.booking_confirmation_required` (boolean, default false). Appointments use status `pending_confirmation` while awaiting contractor approval. Timeout messages stored as `scheduled_messages` rows with `sequenceType = 'booking_confirmation_reminder'` or `'booking_confirmation_escalation'` — cancelled automatically when the contractor confirms.

**Service:** `src/lib/services/booking-confirmation.ts` (`createPendingBooking`, `confirmPendingBooking`, `suggestNewTimeForPendingBooking`, `findPendingConfirmationForContractor`, `parseContractorTimeSuggestion`).

### Google Calendar Two-Way Sync

Contractors and team members can connect their Google Calendar so platform appointments and external calendar events stay in sync automatically.

**Per-member calendar integration:** each team member can connect their own Google Calendar from the portal. The system checks ALL connected calendars (business-level + all member calendars) when generating available slots. When booking for a specific member, only that member&apos;s calendar is checked.

| Capability | Detail |
|------------|--------|
| **OAuth connection** | Contractor or team member connects via Google OAuth. `membershipId` on `calendar_integrations` identifies per-member connections (null = business-level). |
| **Bidirectional sync** | Platform appointments push to Google Calendar as events. Google Calendar events pull into the platform and block booking slots. |
| **Per-member availability** | `getAvailableSlots(membershipId)` checks that member&apos;s calendar + their `workSchedule` (per-day start/end times stored as jsonb on `clientMemberships`). Falls back to client `businessHours` when no member schedule is set. |
| **Auto-sync cadence** | Cron job (`/api/cron/calendar-sync`) runs every 15 minutes, syncing all active integrations. |
| **Event lifecycle** | Create, update, and delete operations propagate both directions. |
| **Admin connection** | Operator can connect/disconnect a client&apos;s calendar from the client detail page (Configuration tab). |
| **Portal connection** | Contractor can connect/disconnect from Settings &gt; Features in the client portal. OAuth callback redirects back to `/client/settings` (not admin). |
| **Portal sync status** | Portal card shows `consecutiveErrors` count. If errors &gt; 3: red &ldquo;Sync failed multiple times — reconnect&rdquo; banner. If sync is stale (&gt;30 min) and has errors: yellow &ldquo;May be disconnected&rdquo; warning. |
| **Feature toggle** | Controlled by the `calendarSyncEnabled` per-client feature flag. |
| **Schema** | `calendar_integrations` (OAuth tokens, sync state, `consecutiveErrors`) and `calendar_events` (events with external IDs for sync). |

- **Timezone handling:** All calendar operations use the client&apos;s configured timezone (defaults to America/Edmonton for Alberta-based contractors). No hardcoded timezone assumptions.
- **Timezone-aware availability:** Slot generation evaluates &ldquo;today&rdquo; and past-slot cutoffs in the client&apos;s local timezone, preventing slots from being incorrectly filtered for clients in later time zones
- **Sync error tracking:** Calendar sync failures are recorded per-event (lastSyncError field) and per-integration (consecutiveErrors counter). After 5 consecutive sync failures, an operator alert is sent via SMS
- **Event change notifications:** When a contractor cancels or reschedules an appointment via Google Calendar, the homeowner receives an SMS notification through the compliance gateway with updated details or cancellation confirmation
- Calendar event creation failures during booking are logged for operator visibility without blocking the appointment from being confirmed

### No-Show Recovery

Cron detects appointments 2+ hours past scheduled time with no completion.

| Step | Timing | Action |
|------|--------|--------|
| 0 | Immediately | Contractor AND assigned crew member notified via SMS with lead name, appointment time, and direct lead phone number. Both owner and assigned estimator receive the alert (deduped if same person). |
| 1 | +2 hours | AI-personalized homeowner recovery SMS (warm, short, offers reschedule) — delayed to give contractor time to act first |
| 2 | Day +2, 10am local time | Second AI-personalized homeowner follow-up (shorter, gives easy out) |

Hard stop at 2 homeowner SMS attempts. Contractor notification is non-fatal (logged on failure, does not block scheduled recovery messages). Quiet hours respected. AI uses conversation history and project context for personalization.

### Payment Collection

Triggered via `POST /api/sequences/payment` with invoice details. Auto-generates Stripe payment link.

| Touch | Timing | Message |
|-------|--------|---------|
| 1 | Due date, 10am | Friendly reminder + payment link |
| 2 | Day 3, 10am | Past due, link to pay |
| 3 | Day 7, 10am | 7 days past due |
| 4 | Day 14, 10am | Final reminder |

Stripe webhook confirms payment &rarr; cancels remaining reminders &rarr; sends confirmation SMS to both lead and owner. Supports partial payments. All payment templates include &ldquo;To pay by phone, call [businessPhone]&rdquo; alternative for non-tech-savvy homeowners.

**Deposit &rarr; final payment chain:** invoices have a `milestoneType` (deposit, progress, final, standard) and `parentInvoiceId` for chaining. When a deposit invoice is marked paid, the system auto-creates a final invoice for the remaining balance and starts the payment reminder sequence for it. This eliminates manual tracking of split payments for $5K+ jobs.

**Portal invoice creation:** contractors can create invoices from the portal (`POST /api/client/invoices`) with amount, due date, milestone type, and optional job link. Mark Paid (cash/check) available for non-Stripe payments.

### Review Generation

Triggered when lead status changes to `completed` (contractor marks the job done in the portal). This fires the review + referral sequence automatically — no manual trigger required.

**Three safety gates before scheduling:**
1. **Sentiment gate:** checks lead sentiment (last 14 days) and unresolved escalations. Suppressed if negative/frustrated or open escalation.
2. **Rate cap:** deferred if the lead received &gt;5 outbound messages in the past 7 days (CTIA compliance).
3. **Consent upgrade:** on job completion, lead consent is upgraded to `existing_customer` (2-year CASL scope).

| Touch | Timing | Message |
|-------|--------|---------|
| 1 | Day 1, 10am | Review request with direct Google link, referencing specific project type |
| 2 | Day 4, 10am | Referral request (auto-cancelled if a negative review &le;2 stars is synced before Day 4) |

### Win-Back (Dormant Lead Reactivation)

Always-on continuous automation (separate from Quarterly Growth Blitz campaigns).

- Targets leads with `status=contacted` or `status=estimate_sent` and 25-35 days since last activity (last message, or creation date for imported leads with no conversations)
- **Excludes leads with active sequences:** leads with any unsent, uncancelled scheduled messages from other automations (estimate follow-up, payment reminders, etc.) are skipped to prevent double-messaging
- AI-personalized win-back message with project context
- Timezone-aware send timing (10am-2pm weekdays in recipient&apos;s local time, avoids Monday before 11am/Friday after 1pm). Evaluated using IANA timezone, not server UTC.
- Follow-up 20-30 days later (skipped for `estimate_sent` leads with inbound reply in past 45 days &mdash; prevents premature re-engagement after active dialogue)
- After 2 attempts with no response, lead transitions to `dormant`
- **Freshness gate for deferred messages:** AI-generated follow-ups check lead context before generation &mdash; cancelled if lead stage changed to booked/lost, or if lead had inbound activity within 7 days
- **Dormant lead auto-promotion:** when a dormant lead texts back, status automatically promoted to `contacted` so they appear in the active pipeline

### Probable Wins Nudge

Daily cron (`/api/cron/probable-wins-nudge`, runs at 10am UTC) identifies leads that have had a completed or confirmed appointment **7+ days ago** but have not been marked won or lost.

- **Batched numbered list:** Up to 5 leads per client are grouped into a single SMS with numbered options. Single lead: &ldquo;Sarah T. &mdash; basement dev. Did you win it? W = Won, L = Lost, 0 = Skip.&rdquo; Multiple leads: numbered list with compact reply syntax.
- **Compact reply syntax:** Contractor replies `W1` (won #1), `L2` (lost #2), `W13 L2` (won 1 and 3, lost 2), `W` (all won), `0` (skip all). Parsed by `src/lib/services/numbered-reply-parser.ts`.
- **Outcome reference codes:** each lead also has a short alphanumeric code (e.g., &ldquo;4A&rdquo;) stored in `leads.outcome_ref_code` for backward compatibility with the old `WON [ref]` / `LOST [ref]` commands.
- If the contractor marks a lead as won, a follow-up asks for the job value so confirmed revenue can be recorded.
- 7-day cooldown per client &mdash; at most one nudge cycle per 7 days regardless of how many qualifying leads exist
- Deduped per lead: one nudge per lead per run, no duplicate sends. Max 5 leads per batch; overflow rolls to next week.
- Skips clients with no active phone number, paused clients, and leads already marked won/lost/closed

### WON / LOST / WINS SMS Commands

Contractors can report outcomes directly via SMS to the agency line. Two formats are supported:

**Numbered replies** (preferred &mdash; from nudge prompts):

| Reply | Example | Action |
|-------|---------|--------|
| `W` + numbers | `W1` or `W13` | Marks those leads as `won`; triggers review request and revenue prompt |
| `L` + numbers | `L2` | Marks those leads as `lost`; cancels all pending follow-up |
| `W` / `L` (bare) | `W` | Marks ALL listed leads as won / lost |
| `0` | `0` | Skip all &mdash; leads roll to next week&apos;s nudge |
| Mixed | `W13 L2` | Won 1 and 3, lost 2 &mdash; all in one reply |

**Legacy ref code commands** (still supported):

| Command | Example | Action |
|---------|---------|--------|
| `WON [ref]` | `WON 4A` | Marks the matching lead as `won`; triggers a follow-up asking for confirmed job value |
| `LOST [ref]` | `LOST 4A` | Marks the matching lead as `lost`; cancels all pending follow-up messages for that lead |
| `WINS` | `WINS` | Replies with a list of recent leads (last 14 days) that have appointments but no outcome, with their ref codes |

**Schema:** `leads.outcome_ref_code` — short alphanumeric code generated on lead creation, used to match SMS replies to specific leads.

**Files:** `src/lib/services/numbered-reply-parser.ts` (compact reply parser), `src/lib/services/outcome-ref-codes.ts` (code generation/lookup), `src/lib/services/outcome-command-parser.ts` (parses legacy WON/LOST/WINS text), `src/lib/services/outcome-commands.ts` (command dispatch and lead update logic).

### Auto-Detect Probable Wins

A companion to the Probable Wins Nudge. Runs daily at 10am UTC alongside the nudge cron.

- Finds leads where: the most recent appointment was 7+ days ago, the lead has not been marked won or lost, **and the lead has had no inbound or outbound messages in the last 7 days** (silence after appointment = likely closed)
- Prompts the contractor with the same outcome ref code format as the nudge
- Fires once per lead (tracked via audit_log — no repeat prompts for the same lead)
- Intent: catch probable wins that the regular nudge may miss due to its 7-day per-client cooldown

### Proactive Quote SMS at 3 Days

Automated prompt to the contractor when a new lead has been waiting too long for a quote.

- Daily cron at 10am UTC (`/api/cron/proactive-quote-prompt`)
- Condition: lead in `new` or `contacted` status for 3+ days with no EST trigger recorded
- Contractor receives via agency channel: &ldquo;[Lead Name] &mdash; 3 days, no quote yet. 1 = Yes (start follow-up)  2 = Not yet&rdquo;
- Reply `1` or `YES` triggers the standard estimate follow-up sequence; reply `2` or `NO` defers (lead stays eligible for future nudge)
- Fires once per lead (deduped via audit_log)
- **File:** `src/lib/automations/proactive-quote-prompt.ts`

### Dormant Re-Engagement (6-Month Stage)

Follow-on stage after standard win-back for leads that have been dormant 6+ months.

- Targets leads with `status=dormant` and 180+ days since last activity
- Fresh AI-personalized outreach — acknowledges the time gap, low-pressure tone
- Single-touch attempt with no additional follow-up
- Runs weekly on Wednesdays via `engagement-health-check` and `dormant-reengagement` cron jobs
- Send window is timezone-aware (same rules as win-back: 10am-2pm local time, Monday/Friday constraints)
- Prevents permanent loss of re-contact opportunity once the initial win-back pool is exhausted

---

## 3. Voice AI

Included by default for all new clients — `voiceEnabled` defaults to `true` on client creation. Voice AI is part of the base $1,000/month price; there are no per-minute charges for new clients. Usage is measured internally for cost monitoring but is not invoiced separately. Existing clients who had voice AI disabled before April 2026 are unchanged — they can opt in from portal Settings or the admin client detail page.

Voice AI answers inbound calls with a natural-sounding conversational AI powered by Twilio ConversationRelay.

### Architecture

Built on **Twilio ConversationRelay** with a Cloudflare Durable Object backend:

| Component | Provider | Purpose |
|-----------|----------|---------|
| **Speech-to-Text** | Deepgram (via ConversationRelay) | Real-time caller transcription |
| **Text-to-Speech** | ElevenLabs (via ConversationRelay) | Natural voice synthesis from streamed tokens |
| **LLM** | Anthropic Claude Haiku | Conversation intelligence, tool use |
| **WebSocket Server** | Cloudflare Durable Objects | Stateful session per call |
| **Call Routing** | Twilio Programmable Voice | TwiML, transfer, dial-complete |

Persistent WebSocket connection for the entire call duration. Claude responses stream token-by-token to ElevenLabs TTS &mdash; first audio plays within ~1 second of the caller finishing their sentence.

### Call Flow

1. Caller dials the business line
2. Twilio hits `/api/webhooks/twilio/voice/ai` &mdash; client lookup, business hours check, lead creation
3. TwiML returns `<Connect><ConversationRelay>` pointing at the Durable Object WebSocket
4. ConversationRelay plays `welcomeGreeting` in the configured ElevenLabs voice
5. Multi-turn conversation: caller speaks &rarr; Deepgram transcribes &rarr; DO streams to Claude &rarr; Claude tokens stream to ElevenLabs TTS &rarr; caller hears response
6. **Natural interruptions:** caller can speak mid-response; ConversationRelay stops TTS and sends the new utterance
7. **Tool use:** Claude can check calendar availability, book appointments, capture project details, or initiate transfer &mdash; all mid-conversation
8. Transfer to human: Claude sends `end` message with handoff data &rarr; action URL returns `<Dial>` TwiML

### Capabilities

- **Streaming responses:** token-by-token Claude &rarr; ElevenLabs TTS (~1s to first audio, vs 2-5s with legacy Gather/Say)
- **Interruption handling:** built-in via ConversationRelay; conversation history truncated to what caller actually heard
- **Intent detection:** quote, schedule, question, complaint, transfer, other
- **Knowledge-grounded responses:** uses client knowledge base, service catalog, and SMS conversation history
- **Appointment booking:** Claude tool_use checks Google Calendar availability and books estimate appointments mid-call
- **Project capture:** Claude tool_use saves caller name, project type, address, and notes to the lead record
- **Callback scheduling:** when transfer fails or owner unavailable, schedules callback and notifies contractor. Cron (`/api/cron/voice-callbacks`) runs every 30 minutes and sends SMS to the contractor for any callbacks due or within the next 2 hours, with a tap-to-call link.
- **Guardrails:** won&apos;t make pricing promises (unless `canDiscussPricing` enabled), won&apos;t guess unknowns, escalates when unsure, never promises specific callback times (rule 12), offers phone callback for confused/short replies (rule 11)
- **Mandatory disclosure:** every voice call opens with &ldquo;This call may be recorded and uses AI-assisted technology&rdquo; &mdash; non-configurable, always prepended before the business greeting (CA SB 1001 + two-party consent states)
- **Three activation modes:** always on, after-hours only, overflow. Overflow dials the contractor first (20s timeout) &mdash; if no-answer/busy/failed, Twilio redirects the live call to Voice AI automatically. No homeowner ever hears &ldquo;no one available&rdquo; in overflow mode.
- **Voice selection:** ElevenLabs voice personas with admin preview &mdash; selected voice is used in live calls via ConversationRelay `voice` attribute
- **Fallback:** Amazon Polly (Matthew-Neural) when no ElevenLabs voice is configured
- **Kill switch:** prominent global toggle on the admin Voice AI page &mdash; one click to pause all voice AI across all clients, one click to resume. Per-client `voiceEnabled` toggle also available. Both fall back to direct owner forwarding.
- **Pricing discussion control:** `canDiscussPricing` toggle on admin voice settings per client &mdash; when off (default), AI deflects pricing questions to the owner; when on, AI shares knowledge-base price ranges
- **Max call duration:** configurable per client (2&ndash;15 minutes, default 5) &mdash; AI wraps up gracefully at the limit
- **Business hours visibility:** admin voice settings show configured business hours inline when mode is &ldquo;after hours&rdquo; so the operator sees exactly what schedule the AI follows
- **Operator visibility into contractor settings:** `agentTone` badge shown on admin voice page per client so the operator can see what the contractor configured without switching context

### Contractor Portal &mdash; Voice AI Visibility

Contractors see a read-only Voice AI status card on their portal dashboard:

- Status badge: Active / Off
- Current mode: &ldquo;Answering after hours&rdquo; / &ldquo;Always answering&rdquo; / &ldquo;Answering when you can&apos;t&rdquo;
- Phone number the AI covers
- This week&apos;s call stats: calls handled, appointments booked, transfers completed
- No configuration controls &mdash; the operator manages voice settings as part of the managed service

API: `GET /api/client/voice-status` (portal permission: `DASHBOARD`)

### Missed Transfer Recovery

When a hot transfer fails (busy, no-answer, failed, or canceled status from Twilio):

1. **Homeowner SMS:** the platform sends the homeowner an SMS via the compliance gateway: &ldquo;[Business] tried to connect you with a team member but they&apos;re currently unavailable. Someone will call you back shortly.&rdquo;
2. **P1 escalation:** a critical-priority escalation entry is created and surfaces immediately in the triage dashboard.
3. **Team notification:** a `sendAlert` SMS is sent to the team member who was dialled: &ldquo;Missed transfer: [Lead Name] called and was transferred to you but the call was not answered. Please call them back at [phone].&rdquo;

All three side effects run in the background (fire-and-forget) &mdash; the TwiML response is never delayed.

File: `src/app/api/webhooks/twilio/voice/ai/dial-complete/route.ts`

### Post-Call

- Full transcript stored from the Durable Object session via HandoffData
- AI summary generated (via `generateCallSummary`)
- Contractor notified via SMS with call summary, duration, intent, and callback flag
- Outcome tracked: qualified, scheduled, transferred, voicemail, dropped
- Voice usage aggregated for billing (per-minute via `voice-usage-rollup` cron)

### Voice AI Playground (Admin QA &amp; Demo)

Built into the admin `/admin/voice-ai` page per client. Lets operators test, QA, and demo voice AI without making a real Twilio call.

| Feature | What it does | Cost |
|---------|-------------|------|
| **QA Checklist** | 5 auto-checks (greeting, voice, KB, hours, tone) + 3 manual checks. Gates &ldquo;Go Live&rdquo; behind all-green. | Free |
| **Greeting Preview** | Synthesizes the actual greeting in the selected ElevenLabs voice. One button next to the greeting textarea. | ~$0.01 per play |
| **Voice A/B Comparison** | Same text in 2-3 voices side-by-side. &ldquo;Compare All&rdquo; for sequential playback. | ~$0.03 per comparison |
| **Text Simulator** | Chat UI &mdash; operator types as homeowner, AI responds using real KB + guardrails + tone. Multi-turn. Sample prompt pills for common questions. | LLM tokens only |
| **KB Gap Test** | 10 canned homeowner questions. Shows answered / deferred / gap per question. &ldquo;Add to KB&rdquo; link for gaps. | LLM tokens only |
| **Guardrail Stress Test** | 8 adversarial inputs (pricing, competitor, AI disclosure, opt-out, etc.). Pass/fail per guardrail. Failures shown inline. | LLM tokens only |

Per-response &ldquo;Play&rdquo; button on simulator messages synthesizes audio on demand (opt-in, not auto-play).

API: `POST /api/admin/clients/[id]/voice-simulate` (multi-turn, uses `buildVoiceSystemPrompt` from `src/lib/services/voice-prompt-builder.ts`).

### Deployment

The voice WebSocket server is a separate Cloudflare Worker (`packages/voice-agent/`):

- `wrangler deploy` from `packages/voice-agent/`
- Secrets: `ANTHROPIC_API_KEY`, `DATABASE_URL` (Neon connection string)
- Worker URL configured as `VOICE_WS_URL` env var in the Next.js app
- Each active call creates one Durable Object instance (auto-cleaned on disconnect)

---

## 4. Communication Hub (Lead CRM)

Replaces text threads, sticky notes, and memory with one unified system.

### Lead Pipeline

Stages: `new` &rarr; `contacted` &rarr; `estimate_sent` &rarr; `appointment_scheduled` &rarr; `won` &rarr; `in_progress` &rarr; `completed` / `lost`

Job lifecycle: `won` &rarr; `in_progress` (sets startDate, fires `job_started` funnel event) &rarr; `completed` (sets completedDate, triggers review request). Status guard prevents invalid transitions.

Special states: `action_required` (needs human attention), `opted_out`, `dormant` (auto-promoted to `contacted` on inbound reply)

### Lead Intelligence

Every lead accumulates:

- **AI scoring** (0-100): urgency, budget, intent, engagement signals
- **Temperature:** hot / warm / cold
- **Sentiment tracking** with history (per-message confidence)
- **Project details:** type, size, estimated value, property type
- **Objections:** tracked with resolution status
- **Conversation summary** and key facts (AI-maintained)
- **Recommended next action** (AI-generated)

### Multi-Channel Inbox

- All SMS, voice transcripts, form submissions, and system messages in one timeline per lead
- Delivery status tracking (queued, sent, delivered, failed)
- Conversation mode indicator (AI / human / paused)
- Human takeover and handback controls
- Media attachment support (MMS)
- **Message pagination** &mdash; initial load fetches the 50 most recent messages per conversation. &quot;Load earlier messages&quot; button loads older history on demand. Delta polling for new messages is unchanged.
- **AI message flagging** &mdash; operators can flag any AI-generated message as problematic with a category (wrong tone, inaccurate, too pushy, hallucinated, off topic, other) and optional note. Flags are visible inline and surfaced in admin AI quality view.

### Bulk Lead Import

- CSV upload with automatic column mapping (supports common aliases: "Phone Number", "Mobile", "First Name", "Service Type", etc.)
- Optional `status` column: import leads at their actual pipeline stage (`new`, `contacted`, `estimate_sent`) — enables quote reactivation workflows for imported old estimates
- Validates phone format, normalizes numbers, deduplicates against existing leads
- Up to 1,000 leads per import with per-row error reporting
- Preview table before import with column mapping summary
- Source tracked as `csv_import` for attribution
- **CASL consent attestation:** both the admin CSV import route and the portal quote import require the importer to confirm: &ldquo;I confirm all contacts have made an inquiry to my business under CASL.&rdquo; Import is rejected (400) if the attestation checkbox is not checked. The attestation is **persisted to the database** — each imported lead row receives `casl_consent_attested = true` and `casl_consent_attested_at` timestamp, providing an auditable record of consent beyond the response body. Schema: `leads.caslConsentAttested` (boolean, default false), `leads.caslConsentAttestedAt` (timestamp).

### Team Coordination

- **Ring group:** simultaneous dial to available team members during business hours. Filters by `availabilityStatus = 'available'` (members set to `busy` or `off_duty` are excluded). Prefers owner-flagged members for quote calls; falls back to all if none qualify.
- **Escalation queue:** priority-ranked (1-5) with SLA deadlines, live countdown timers (color-coded: green/sienna/red by urgency), assignment, claim tokens, and 30-second auto-refresh with &quot;Updated X ago&quot; timestamp. **3-stage re-notification:** unclaimed escalations re-notify at 15 min, 30 min, and 60 min (inferred from elapsed time, capped at 3 attempts). After 60 min unclaimed, escalates to the owner directly. **Atomic assignment guard:** `assignEscalation` uses a status-conditional UPDATE (only succeeds when status is `pending` or `assigned`) so concurrent claims cannot silently overwrite each other — the second requester receives an error. `takeOverConversation` similarly blocks takeover on `resolved` or `dismissed` escalations.
- **Hot transfer:** Voice AI detects urgency &rarr; dials team immediately &rarr; SMS heads-up ("Hot lead calling!")
- **Missed transfer fallback:** SMS to team ("Missed hot transfer — call back ASAP") + SMS to lead ("Sorry we missed you")
- **Owner notification:** Smart Assist drafts with reference codes for SEND/EDIT/CANCEL approval. Contractor notification SMS capped at 5/hour per client to prevent notification fatigue during surge.
- **Team member SMS commands:** any active team member can text EST [name] (trigger estimate follow-up), NOSHOW [name] (mark appointment no-show), WON [ref] / LOST [ref] (report job outcome), or WINS (list pending leads with ref codes) from their personal phone &mdash; not just the owner. Command auth checks `clientMemberships` for the sender&apos;s phone.
- **PAUSE / RESUME commands:** contractor texts PAUSE to their business number &rarr; AI mode set to `off`, all pending scheduled messages cancelled, all active flow executions cancelled. Texts RESUME &rarr; AI mode restored to `autonomous`. Gives contractors a sense of control over automation. Notification fires when AI auto-progresses to autonomous mode: &ldquo;Your system is now fully automated. Reply PAUSE to this number to pause at any time.&rdquo;
- **Escalation batching:** when 3+ escalations fire within 30 minutes, team members receive a single summary SMS instead of individual notifications per lead
- **Escalation acknowledgment:** When the AI escalates, the homeowner receives an immediate SMS acknowledgment before the handoff to prevent silence during the transition window
- **Auto-cancel on outbound (Smart Assist):** If any outbound message is sent for a lead after a Smart Assist draft was queued, the draft is automatically cancelled to prevent redundant messages
- **Crew availability toggle:** `availabilityStatus` field on team memberships (available/busy/off_duty). Busy or off-duty members are automatically excluded from ring groups and escalation routing.
- **Per-member work schedule:** admin can set per-day working hours (start/end time, working flag) for each team member via the team edit dialog. Stored as `workSchedule` jsonb. Used by `getAvailableSlots()` when booking for a specific member.
- **Dispatch/schedule view:** visual 7-day grid at `/admin/clients/[id]/schedule` showing all team members&apos; appointments color-coded by member. Inline reassignment via native select dropdown. Unassigned appointments highlighted. Linked from client detail header.
- **Appointment reassignment:** `PATCH /api/admin/clients/[id]/appointments/[appointmentId]` with `{ assignedTeamMemberId }`. Cascades to linked calendar events.
- **Operator &rarr; team member messaging:** admin can send SMS to any team member via &ldquo;Message&rdquo; button on team page. Routes through compliance gateway.
- **Bulk lead messaging:** `POST /api/admin/clients/[id]/leads/bulk-message` sends to leads matching status/source filter. Capped at 50 per request.
- **Escalation reassignment:** When a team member is deactivated or removed, their pending escalations are automatically reassigned to the next available team member via round-robin. Falls back to the client owner if no other active members exist.

### Conversation Modes

| Mode | Behavior |
|------|----------|
| **AI** | AI handles all responses autonomously |
| **Human** | Owner/team member took over — AI paused |
| **Paused** | No responses sent (manual hold) |

Takeover/handback is per-lead and tracked with timestamps.

---

## 5. Client Portal

The business owner&apos;s view &mdash; everything they need, nothing they don&apos;t.

### Service Model

Each client has a `serviceModel` field (`managed` or `self_serve`) that controls what the portal shows:

| Feature | Managed | Self-Serve |
|---------|:-------:|:----------:|
| Dashboard, Conversations, Reviews, Revenue, Reports, Team, Settings (General + Notifications), Help &amp; Support | Yes | Yes |
| Flows (automation management) | Hidden (redirect) | Shown |
| Knowledge Base (KB management) | Hidden (redirect) | Shown |
| Leads Import (CSV upload) | Hidden (redirect) | Shown |
| Settings &gt; AI, Phone, Features tabs | Hidden | Shown |
| Billing &gt; Plan picker / Upgrade | Hidden (redirect) | Shown |
| Review approval | Operator manages (auto-post positive, forward negative) | Contractor approves all |
| Payment setup | Operator sends link | Self-serve checkout |

**Managed clients** see a scoreboard + inbox. The operator configures all automation settings via the admin panel.

**Self-serve clients** see the full control panel and manage everything themselves.

Default: `managed`. Operator can change per client from the admin detail page.

**Operator payment link (managed only):** Admin client detail page has a &ldquo;Send Payment Link&rdquo; button that creates a Stripe Checkout Session with the plan pre-selected, sends the link via SMS + email. Contractor clicks &rarr; Stripe page &rarr; enters card &rarr; done. No portal navigation or plan comparison needed.

### Pages

The contractor nav has 10 items: **Dashboard | Conversations | Appointments | Reviews | Revenue | Reports | Flows | Team | Settings | Help &amp; Support**. Knowledge Base and Billing are accessible via Settings (not top-level nav). Discussions is merged into Help &amp; Support.

| Page | What it shows |
|------|--------------|
| **Dashboard** | Lead summary, recent activity, help articles. **Voice AI Status card** (read-only: ON/OFF status, mode, phone number, this week&apos;s call stats &mdash; see Section 3). **Since Your Last Visit card** (see below). **System Activity card** (auto-tracked pipeline proof &mdash; see below). **Jobs We Helped Win card** &mdash; the single confirmed-revenue money card (contractor-confirmed wins; shows $0 nudge when no wins recorded). **Account Manager card** (when operator phone is configured — shows operator name, phone, and a single CTA). New-client setup banner (phone + plan checklist, auto-hides when complete). Sticky header keeps page title visible while scrolling. **&ldquo;Set up your AI&rdquo; CTA** when KB has fewer than 5 entries &mdash; links to the onboarding wizard. |
| **Conversations** | All leads with message history, mode badges, action-required highlights. Sienna numeric badge on nav item shows action-required count; polls every 30 seconds. |
| **Appointments** | Chronological list of all booked appointments with lead name, date/time, address, status badge (scheduled/confirmed/completed/no_show/cancelled). &ldquo;Mark Complete&rdquo; button on active appointments triggers review request. Mobile card layout, desktop table. |
| **Reviews** | Pending AI-drafted Google review responses — inline edit and approve before posting (see below). |
| **Revenue** | 4-column ROI summary card at top (Your Investment, Revenue Recovered, Net Return, ROI percentage), followed by 30-day stats, pipeline value, speed-to-lead metrics, and service breakdown. |
| **Reports** | Past bi-weekly (and monthly) performance reports — list in reverse chronological order with period, type, delivery status badge, and download button. Empty state explains reports arrive within two weeks of activation. API: `GET /api/client/reports`. Download: `GET /api/client/reports/[id]/download`. |
| **Flows** | Automation flows (estimate, payment, review, win-back) — view and manage. Shown for both managed and self-serve clients. |
| **Team** | Add/remove team members, toggle escalation/hot transfer, manage permissions |
| **Settings** | Phone number management, AI settings, notification preferences, feature toggles, business hours. Knowledge Base and Billing are accessible from Settings. |
| **Help &amp; Support** | Account Manager card at top (operator name and phone when configured). Help articles organized by category. &ldquo;Need more help?&rdquo; link to Discussions for async threads. Discussions merged into Help &amp; Support — no separate nav item. |
| **Lead Import** | Self-serve CSV lead import with drag-and-drop, header auto-detection, preview, and downloadable template (see below). |
| **Cancel** | Cancellation request with 30-day notice + data export |

### KB Onboarding Wizard (Contractor Self-Serve)

Contractors can populate the AI knowledge base themselves via a guided 4-step wizard at `/client/onboarding`, eliminating cold-start AI deferrals without requiring operator data entry.

| Step | Fields |
|------|--------|
| 1. Services | Service types *(required)*, service area *(required)*, what the business does NOT do |
| 2. Business | Business name, years in business, warranties, competitive advantages |
| 3. Hours &amp; Pricing | Business hours, pricing approach, typical ranges |
| 4. Booking | Booking process, response time, how leads should get in touch |

- 12 fields total across 4 steps; Step 1 enforces required fields (mainServices, serviceArea) with inline validation, red asterisks, and a disabled Next button until both fields are filled
- Submitting creates KB entries automatically via `POST /api/client/kb-questionnaire`
- Requires `PORTAL_PERMISSIONS.KNOWLEDGE_EDIT`
- Dashboard shows &ldquo;Set up your AI&rdquo; CTA when KB has fewer than 5 entries

### Portal Quote Import

Contractors can import their own lead list via CSV without operator help.

- Drag-and-drop CSV upload at `/client/leads/import` with automatic header detection
- Preview table before import; downloadable CSV template for correct format
- Accepts `status` column — import leads at `estimate_sent` stage to trigger estimate follow-up immediately
- API: `POST /api/client/leads/import` with `PORTAL_PERMISSIONS.LEADS_EDIT`
- Auto-triggers estimate follow-up sequence for any `estimate_sent` leads imported

### Lead Action Buttons (Contractor Portal)

Contractors can update lead status directly from the conversation detail view in the portal — no admin intervention required.

| Button | Action | Detail |
|--------|--------|--------|
| **Mark Estimate Sent** | Sets lead status to `estimate_sent` | Triggers the 4-touch estimate follow-up sequence automatically |
| **Mark Won** | Sets lead status to `won` | Opens a dialog to enter confirmed revenue (dollar value recorded for ROI reporting). Fires `job_won` funnel event for AI attribution. |
| **Mark Lost** | Sets lead status to `lost` | AlertDialog confirmation prevents accidental dismissal |
| **Mark Paid (Cash/Check)** | Marks an invoice as paid without Stripe | Cancels all pending payment reminder messages. Accepts optional payment method (cash, check, bank transfer, other). |

- API: `PATCH /api/client/leads/[id]/status` via `portalRoute` with `PORTAL_PERMISSIONS.LEADS_EDIT`
- Mark Paid API: `POST /api/client/invoices/[invoiceId]/mark-paid` via `portalRoute`
- Won and Lost status changes cancel all unsent scheduled messages for the lead
- Won status fires `job_won` funnel event for AI attribution and effectiveness tracking
- Won and Lost status changes also fire the `lead.status_changed` webhook (if configured) for Jobber/Zapier integrations

### Review Response Approval (Contractor Portal)

Contractors review and approve AI-drafted Google review responses before they are posted.

- Page at `/client/reviews` shows a card per pending AI draft
- Each card displays: star rating, reviewer name, review text, and the AI-generated draft
- Inline edit mode to modify the draft before approval
- AlertDialog confirmation on approve to prevent accidental posting
- APIs: `GET /api/client/reviews/pending`, `POST /api/client/reviews/[responseId]/approve`

### Revenue Leak Audit Card

Shown on the contractor portal dashboard (`/client`) for the first 30 days after account creation. Surfaces the onboarding deliverable the operator promised at signup.

- **Before delivery:** shows "Being prepared by your account manager — you'll receive it within 48 business hours."
- **After delivery:** shows the delivery date ("Delivered on [date] by your account manager.") once the operator marks the audit as delivered via the admin day-one activation panel.
- Automatically disappears after day 30 to keep the dashboard uncluttered.
- Data source: `revenue_leak_audits` table (queried server-side; status `delivered` + `delivered_at`).

### Guarantee Progress Indicator

Shown on the contractor portal dashboard (`/client`) when the client&apos;s subscription is actively in a guarantee window (`proof_pending` or `recovery_pending`). Displays a slim one-line card linking to the Billing page for full details.

- **30-Day Proof phase:** shows "30-Day Proof: X/5 qualified leads &middot; Y days remaining"
- **90-Day Recovery phase:** shows "90-Day Recovery: $X pipeline &middot; Y days remaining" (pipeline estimated from attributed opportunities &times; average job value)
- Disappears once the guarantee phase exits the active window (passed, failed, or completed).
- Links to `/client/billing` for the full guarantee status breakdown.
- Data source: `subscriptions` table fields — `guarantee_status`, `guarantee_proof_qualified_lead_engagements`, `guarantee_recovery_attributed_opportunities`, and relevant date fields.

### System Activity Card (Pipeline Proof)

Shown on the contractor portal dashboard (`/client`). Displays auto-tracked metrics that require zero contractor action — proving system ROI before any wins are manually confirmed.

**6 stat tiles:**

| Tile | What it measures |
|------|-----------------|
| Leads responded to | Inbound leads where the AI sent at least one automated response |
| Estimates in follow-up | Leads currently in an active estimate follow-up sequence |
| Missed calls caught | Calls that triggered the missed-call text-back automation |
| Dead quotes re-engaged | Win-back or dormant reactivation sequences completed |
| Appointments booked | Appointments created via the AI booking flow |
| Avg response time | Median time from lead creation to first automated reply |

**Probable Pipeline Value:** Calculated automatically as (appointments booked + reactivated quotes) &times; average project value. Uses the actual average confirmed win value from the client&apos;s history; falls back to $40,000 if no confirmed wins exist yet.

This card solves the &ldquo;$0 on the dashboard for 60 days&rdquo; churn risk. The Jobs We Helped Win card handles contractor-confirmed wins (manual input required). The System Activity card shows proof automatically, with no contractor effort.

Data source: `GET /api/client/activity-summary` (same endpoint as the Since Your Last Visit card).

### Since Your Last Visit Card

Shown on the contractor portal dashboard (`/client`). Surfaces activity since the contractor last visited, so they know exactly what happened without scrolling through conversations.

- Tracks last visit timestamp via localStorage key `cs-last-dashboard-visit-{clientId}` — private to the browser, no server storage
- Displays: leads responded to, estimates followed up, appointments booked, and any actions needing attention
- When no attention items exist, shows a green &ldquo;All caught up&rdquo; state
- Data source: `GET /api/client/activity-summary`

Component: `src/app/(client)/client/since-last-visit-card.tsx`

### Webhook Integration (Zapier / Jobber)

Clients can configure a webhook URL to receive real-time notifications when a lead status changes to `won` or `lost`. This enables no-code integration with Jobber, Zapier, and other tools without a native integration.

| Detail | Value |
|--------|-------|
| **Trigger** | Lead status changes to `won` or `lost` (via `PATCH /api/leads/[id]`) |
| **Event name** | `lead.status_changed` |
| **Payload fields** | `leadId`, `name`, `phone`, `email`, `status`, `confirmedRevenue` (dollars), `projectType`, `address` |
| **Security** | HMAC-SHA256 signature in `X-Webhook-Signature` header |
| **Config** | Client sets `webhookUrl` and `webhookEvents` (must include `"lead.status_changed"`) in admin settings |

Dispatch is non-blocking: webhook failures do not affect the lead status update.

### Navigation and Orientation

- **Breadcrumbs** on deep portal pages (billing, revenue, knowledge base, team, help, discussions) showing &quot;Dashboard &gt; Page Name&quot; with clickable links
- **Inline help tooltips** on settings fields (Quiet Hours, Review Before Sending, AI Tone, AI Lead Response, Auto-send delay) via info icons
- **Unsaved changes warning** on settings forms (notification, AI, feature toggles) &mdash; browser prompts before navigating away with unsaved edits
- **Command palette** &mdash; Cmd+K (Mac) / Ctrl+K (Windows/Linux) opens a command palette for quick navigation. Client portal includes 10 page items. Uses search-as-you-type filtering.
- **Discussions CTA** &mdash; empty state on the discussions page includes a &quot;Start a Conversation&quot; button

### Permissions

Role-based access: `business_owner` (full), `team_member` (scoped). Granular permissions across dashboard, conversations, leads, revenue, knowledge, settings, team, and billing.

Business switcher for people who belong to multiple businesses.

---

## 6. Compliance

CASL and CRTC compliant by default — the contractor never has to think about it.

### Message Compliance

- **Consent tracking:** express (never expires), implied from inquiry (6 months), implied from customer (2 years)
- **Opt-out handling:** STOP, UNSUBSCRIBE, CANCEL, END, QUIT &rarr; instant opt-out, confirmation sent
- **Re-opt-in:** START, YES, SUBSCRIBE, OPTIN &rarr; re-consent recorded, lead status restored to contacted
- **HELP/INFO keywords:** auto-reply with business name, owner phone, and STOP instructions (sent even to opted-out numbers)
- **Quiet hours:** 9pm-10am recipient local time. Two modes: strict (all outbound queued) and inbound-reply-allowed (direct replies sent, proactive outreach queued)
- **DNC list:** global + per-client do-not-contact registry with expiry and source tracking
- **Platform-level DNC:** if a homeowner opts out from any client on the platform, all other clients are blocked from texting them too &mdash; prevents the same number being re-contacted by a different contractor after opting out
- **Blocked numbers:** per-client number blocking
- **Per-client automation pause:** setting a client&apos;s status to &quot;paused&quot; blocks all outbound messages for that client only (other clients unaffected). Used for contractor vacations or temporary holds without touching the platform-wide kill switch.

### CASL Consent Attestation on Import

- Both the admin CSV import (`POST /api/leads/import`) and the portal quote import (`POST /api/client/leads/import`) require an explicit consent attestation before import is processed
- Required attestation text: &ldquo;I confirm all contacts have made an inquiry to my business under CASL&rdquo;
- Import returns 400 if the attestation field is absent or false — no leads are created
- Attestation is echoed back in the import response for audit purposes

### Audit Trail

- Every compliance decision (sent, queued, blocked, expired, opt-out) logged with full context
- Compliance check cache (5-minute TTL) for performance
- Consent records with evidence URLs and scope
- All compliance-exempt sends (HELP, opt-in/out confirmations) produce audit events

### Compliance Gateway

Every outbound message in the entire system routes through `sendCompliantMessage()` which enforces:

1. Kill switch check
2. Monthly message limit
3. Quiet hours resolution
4. Consent validation
5. Opt-out check
6. DNC check
7. Actual send + audit log

No message can bypass this path.

- **Subscription enforcement:** Proactive outbound automations are blocked for clients with past_due subscription status. Inbound replies continue to prevent ghosting homeowners.

---

## 7. Reporting &amp; Analytics

### Bi-Weekly Performance Report

Auto-generated and delivered to clients every 2 weeks:

- Leads captured, response times, conversations handled
- Estimates followed up, appointments booked
- Revenue impact estimate
- **&ldquo;Leads at Risk&rdquo; model:** Conservative/Likely/Optimistic directional estimate of leads that would have waited 40+ minutes for a response (with disclaimer). The response-time baseline used for the &ldquo;without us&rdquo; comparison is per-client: if the client has a `previousResponseTimeMinutes` value set, it overrides the platform default (42 min), making the comparison accurate to what that contractor was actually doing before.
- **Confirmed Won revenue:** reports show &quot;Confirmed Won: $X&quot; alongside pipeline estimates, based on contractor-entered actual job values when marking leads &quot;won&quot;
- **Pipeline Proof (`pipelineProof` in `roiSummary`):** 6 auto-tracked metrics added to every report — leads responded to, estimates in follow-up, missed calls caught, dead quotes re-engaged, appointments booked, and average response time. `probablePipelineValue` is calculated automatically as (appointments booked + reactivated quotes) &times; avg project value ($40K default). These metrics require zero contractor action and prove system value even before any wins are confirmed.
- **Per-member team breakdown:** for clients with &gt;1 active team member, reports include a `teamBreakdown` section showing per-member job counts and revenue totals (based on `jobs.assignedMembershipId`). Omitted for solo operators. Non-fatal &mdash; failure to compute breakdown does not block report generation.
- Versioned output — shows `ready` or `insufficient_data` (never fabricates)

### Weekly Activity Digest

Every Monday morning, the system sends the contractor an SMS activity summary. Cadence adapts to activity level:

| Activity level | Cadence | Message style |
|---|---|---|
| Active week (new leads or appointments) | Weekly | Full digest: leads, appointments, follow-ups, won jobs, jobs to close out |
| Quiet week (no new leads, but active follow-ups) | Biweekly | Short: &ldquo;quiet week, X estimates being followed up automatically&rdquo; |
| Slow period (3+ weeks zero new leads) | Monthly | Reassurance: &ldquo;leads have been slow, AI is ready when volume picks up&rdquo; |
| Zero everything + no follow-ups | Don&apos;t send | Operator investigates directly |
| First 7 days of client | Don&apos;t send | Day-one activation updates handle this |

**Message format** (contractor-friendly, not operator metrics):
&ldquo;Hey [name], your week: 2 new leads, 1 appointment booked, 3 estimates in follow-up. Won: $8,500 from 1 job. 1 job to mark complete for review requests.&rdquo;

**Stuck estimate callout:** when leads have been in `estimate_sent` &gt;21 days, the digest appends: &ldquo;N estimates need an update &mdash; mark them won or lost to keep your ROI accurate.&rdquo;

Sent from the client&apos;s business line (same thread as AI conversations). Per-client toggle: `weeklyDigestEnabled`. **Per-membership opt-in:** team members with `receiveWeeklyDigest = true` on their `clientMemberships` record also receive the digest SMS. Cron: `/api/cron/weekly-digest` on Monday 7am UTC.

### Delivery Infrastructure

- Report delivery lifecycle: generated &rarr; queued &rarr; sent &rarr; failed
- Retry cron with exponential backoff
- Terminal failure alerts to admin
- **Auto-follow-up SMS:** after report delivery, the system auto-sends an SMS to the contractor via the agency number that includes inline stats from the report period &mdash; leads responded to, estimates followed up, and appointments booked &mdash; so key numbers land in the message thread even if the contractor never opens the email. Fire-and-forget; does not affect delivery state.
- **Weekly activity digest:** Monday SMS with activity summary, adaptive cadence (see above). The active-week message now includes activity metrics (inquiries, estimates, appointments) alongside pipeline dollars. When confirmed pipeline is $0, the SMS appends a &ldquo;Reply WON [name]&rdquo; CTA to prompt the contractor to confirm any actual wins.
- Client portal download link

### Bi-Weekly Strategy Call (Managed Service)

The primary retention mechanism. 30-minute call with each client every 2 weeks, timed to the report delivery.

**Structured agenda:**
1. **Revenue capture (5 min):** Walk through leads with pending outcomes. Mark WON/LOST from admin UI live on the call. This closes the gap the automation can&apos;t &mdash; the contractor tells the operator what closed, operator records it.
2. **Report walkthrough (10 min):** Speed-to-lead, follow-up activity, appointments, reviews, pipeline. Frame as &ldquo;what happened&rdquo; not &ldquo;what we did.&rdquo;
3. **Action items (5 min):** EST habit check, KB gap resolution, team member setup, calendar review.
4. **Business challenges (5 min):** Seasonal changes, new services, pricing updates, frustrations.
5. **Next steps + close (5 min):** Summarize, confirm next call, end with a specific dollar number.

**Why it matters:** Resolves 4 of 6 remaining yellow-grade friction points (revenue data, WON/LOST adoption, team setup, EST adoption) through direct operator intervention rather than automation. Competitors either skip the call or make it a perfunctory check-in. This call is structured, data-driven, and the single biggest differentiator of the managed service.

**Operator time:** 30 min call + 15 min prep/post = 45 min per client per cycle = ~22.5 min/week per client. At 15 clients: 5.6 hr/week for strategy calls.

### Funnel Tracking

Full conversion funnel: lead_created &rarr; first_response &rarr; qualified &rarr; appointment_booked &rarr; quote_sent &rarr; quote_accepted &rarr; job_won &rarr; payment_received &rarr; review_requested &rarr; review_received

Each event: source attribution, campaign attribution, value in cents.

### AI Attribution

Every funnel event is automatically linked to the agent decision that contributed to it:

- When a conversion event fires (booking, job won, payment), the system traces back to the most recent AI decision for that lead (within a 7-day window)
- The link is stored as a direct FK on the funnel event
- The agent decision&apos;s outcome is updated: positive (bookings, wins, payments), negative (losses), or neutral (progression events)
- Outcome upgrades only &mdash; a positive outcome is never downgraded to neutral
- Attribution is best-effort and never blocks the conversion flow

### Report Browsing

- Admin reports table filterable by client (dropdown) and date range (7d/30d/90d/All presets) with result count indicator

### Daily/Weekly/Monthly Aggregation

- Response time averages, message volumes, AI response counts
- Template performance metrics (which messages get replies)
- **Flow reply-rate tracking:** when an inbound SMS arrives for a lead with an active flow execution, the system records the reply in `templateMetricsDaily.leadsResponded` and `templateStepMetrics`. Response time (minutes since flow start) is also captured. This means estimate follow-up, win-back, and all flow-based reply rates populate automatically from real conversations. Fire-and-forget — never blocks message processing.
- Review collection and sentiment trends

---

## 8. Billing &amp; Subscriptions

### Plans

- Month-to-month, no contract, no setup fee
- Configurable plan tiers with included quotas (leads, SMS, team members, phone numbers)
- **Pre-subscription usage:** usage limits (team members, phone numbers, leads) are not enforced until a plan is assigned. This allows the admin setup wizard to configure team members, provision numbers, etc. before billing is active. Limits take effect once a subscription is created.
- Free first month (30-day trial); billing starts day 31. Configurable trial days, waived for returning clients.
- **Trial billing notification:** Before billing starts (Day 28 and Day 30), the contractor receives both an SMS notification and an email with their plan details, pricing, and a link to manage billing
- **Trial reminder emails:** automated cron sends at days 7, 14, 25, 28, and 30. Days 28 and 30 also send an SMS alert via the agency communication channel.
- Pause/resume capability
- Coupon system (percentage/fixed, one-time/recurring, plan restrictions)

### Add-On Billing

| Add-on | Pricing | Tracking |
|--------|---------|----------|
| Extra team members | $20/month each (above included) | Per-seat ledger event |
| Extra phone numbers | $15/month each (above included) | Per-number ledger event |
| Voice AI minutes | $0.15/minute (usage billed when voice is active — included by default for new clients) | Usage rollup cron |

- Immutable billing event ledger with idempotency keys
- Add-on charges visible on client billing page with CSV export
- Admin dispute/provenance workflow (reviewing &rarr; resolved)
- Invoice line items with `Add-on:` labels

### Stripe Integration

- **Subscription checkout:** Stripe Checkout redirect for new subscriptions (handles 3D Secure, all card types, SCA compliance)
- **Operator payment link (managed service):** admin client detail page has a &ldquo;Send Payment Link&rdquo; button that creates a Stripe Checkout Session with the plan and trial pre-configured, sends the link via SMS + email. Contractor clicks &rarr; Stripe page &rarr; enters card &rarr; done. API: `POST /api/admin/clients/[id]/payment-link`.
- **Plan changes:** In-app plan upgrade/downgrade for existing subscribers with proration (self-serve only &mdash; hidden for managed clients)
- Payment methods on file with add/remove/default management
- One-time payment links for lead invoices (deposits, progress payments, final)
- **Webhook deduplication:** All Stripe webhook handlers (invoice, payment method, dispute, payment action) use `billingEvents.stripeEventId` for idempotent processing — duplicate webhook deliveries are silently skipped
- **Missing metadata detection:** If a checkout session completes without required metadata (clientId, planId), the subscription is not provisioned locally and an admin alert email is sent with full session details for manual intervention
- **Orphan prevention:** Subscription cancellation webhooks without a clientId in metadata are blocked before updating client status — prevents a cancelled Stripe subscription from leaving the client record in active state
- **Orphaned subscription alerting:** If a subscription is created in Stripe but the local DB transaction fails, and the compensating cancellation also fails, a CRITICAL admin email alert is sent to prevent the client from being silently billed
- **Payment link retry:** Stripe payment link creation retries up to 3 times with exponential backoff. After all retries fail, an operator alert is sent and reminder messages continue with manual payment instructions
- Webhook handler with dedup protection
- Payment confirmation SMS to both lead and owner
- Reconciliation cron syncs subscription status daily
- **Payment failure notification:** When a subscription payment fails, the contractor receives an SMS notification with a link to update their payment method. An admin email alert is also sent.
- Payment reminders scheduled at 10 AM in the recipient&apos;s local timezone (uses IANA timezone from client settings, defaults to America/Edmonton)

### Guarantee Workflow

| Phase | Window | Threshold | Outcome if not met |
|-------|--------|-----------|-------------------|
| **30-Day Proof** | First 30 days | 5 qualified lead engagements | Refund first month |
| **90-Day Recovery** | Next 90 days | 1 attributed project opportunity OR $5,000+ probable pipeline value | Refund most recent month |

- **Layer 2 has two passing criteria (OR logic):** the guarantee passes if EITHER (1) 1 attributed project opportunity is confirmed via platform logs, OR (2) the auto-calculated `probablePipelineValue` reaches $5,000 or more within the window. The pipeline floor gives contractors with longer renovation sales cycles a concrete, measurable standard even before a job is formally won.
- **Layer 2 attribution is fully log-based:** attribution requires platform logs showing the system engaged the lead through automated response or follow-up before the opportunity progressed. No subjective contractor confirmation is required.
- Volume condition: if &lt;15 leads/month, windows extend proportionally
- State machine with automatic daily evaluation via cron
- Metrics tracked: qualified engagements, attributed opportunities, probable pipeline value
- **Contractor-facing guarantee card:** billing page shows plain-English status per phase (e.g., &ldquo;We need to see 5 leads engage with your AI. You have 3/5 so far.&rdquo;), progress bars for proof (X/5 engagements) and recovery (X/1 opportunities or $/pipeline), a 3-column timeline strip (Free Month / Proof Window / Recovery Window) with extension notices, and a loading skeleton during fetch

### Cancellation

- 30-day notice period
- **Cancellation value summary:** shows both confirmed revenue AND estimated revenue, plus count of stuck estimates with prompt to update. Prevents churn from misleadingly low ROI numbers.
- **Operator cancellation alert:** URGENT SMS sent to operator immediately on cancellation request, including reason and business name. Enables proactive retention call scheduling.
- Data export within 5 business days (CSV: leads, conversations, pipeline jobs)
- Export download with time-limited token
- Retention call scheduling option
- **Automated grace-period reminders:** daily cron sends email reminders at 20 days left, 7 days left, and 3 days left — each fired at most once per client, deduplicated via audit_log. Grace-period reminders target both pending cancellation requests and those with a scheduled save call (status: pending or scheduled_call)
- **Post-cancellation win-back:** personalized email sent 7 days after grace period ends. Includes months active, leads captured, messages sent, and revenue tracked from the stored `valueShown` snapshot. Falls back to generic copy if data unavailable.

---

## 9. Onboarding &amp; Day-One Activation

### Pre-Sale: Revenue Leak Audit + ROI Calculator

Before the sales call, the operator runs a lightweight pre-sale audit using publicly available data (Google Business Profile, website, competitor review counts). This produces a personalized opener and pre-qualifies the prospect.

- **Pre-Sale Revenue Leak Audit:** 15-20 minute research process. Template at `docs/operations/templates/PRESALE-REVENUE-LEAK-AUDIT-TEMPLATE.md`. Spec: `docs/specs/SPEC-07.md`.
- **ROI Calculator:** Public endpoint `POST /api/public/roi-calculator` accepts contractor inputs (lead volume, avg project value, follow-up gap) and returns annual revenue at risk, monthly recovery potential, and months-to-break-even. Used live during the sales call to replace manual math.

### Day-One Milestones

| Milestone | SLA |
|-----------|-----|
| Business number live | 24 business hours |
| Revenue Leak Audit delivered | 48 business hours |
| Call-your-own-number proof | Day 1 |

**Service agreement:** a fill-in-the-blanks contract template is provided at `docs/legal/SERVICE-AGREEMENT-TEMPLATE.md` (11 sections, using clause language from `docs/legal/02-LEGAL-CLAUSE-REDLINES.md`). The signed agreement must be received before platform setup begins.

- SLA cron monitors and creates alerts for overdue milestones
- Activity trail logs all events (draft, delivery, completion)
- Revenue Leak Audit: structured findings with priority, impact ranges, and artifact URLs
- **Self-serve phone provisioning:** clients can search and purchase a local number from `/client/settings/phone` — no admin intervention required. Milestones auto-complete on purchase.
- **Auto-login after signup:** public signup flow establishes a portal session automatically &mdash; contractor lands on the client dashboard with setup guidance, no separate login step required.
- **Welcome communications:** signup triggers a fire-and-forget welcome email (using `onboardingWelcomeEmail` template) and welcome SMS with login link. Contractor receives both within seconds of signing up.
- **Phone setup prompt:** if the `number_live` milestone goes overdue (Day 1-2), the day-one SLA check cron sends the contractor an SMS reminder with a direct link to `/client/settings/phone`.
- **Subscription-gated phone purchase:** phone provisioning requires an active subscription. Clear prompt to choose a plan if attempted without one.
- **Day 2-3 Quote Import Call:** operator schedules a follow-up call 24-48 hours after go-live to collect the contractor&apos;s existing open quotes. These are imported via the portal quote import (`POST /api/client/leads/import`) so the estimate follow-up sequence can activate immediately on past-due opportunities. This step is now a standard onboarding milestone — see `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` Section 10.

### Onboarding Checklist

- **Actionable steps:** each incomplete checklist item links directly to the relevant settings page (phone setup, business hours, team configuration, etc.)
- **Tutorials as links:** tutorial items are clickable links, not plain text
- **Start Here banner:** shows the single most important next action for the contractor
- **Quality gates simplified:** hidden when passing; shown in plain language when failing (no technical jargon)

### Onboarding Quality Gates

- Multi-criteria evaluation: knowledge base populated, business hours set, team configured, etc.
- **Business hours gate (critical):** AI activation is blocked if no business hours are configured &mdash; prevents booking failures from empty slot availability
- **KB activation gate:** when policy mode is `enforce`, the AI orchestrator checks quality gate readiness before generating responses. If critical gates fail (e.g., empty KB), AI returns `no_action` and logs which gates are failing. Degrades gracefully on check failure.
- **Pricing coverage gate (critical):** at least one service must have pricing ranges configured (`canDiscussPrice = 'yes_range'` with valid min/max). Without this, the AI cannot answer the most common homeowner question ("how much does it cost?") and defers every pricing inquiry. Contractors with all services set to "defer" fail this gate.
- Critical vs. standard gates with pass/fail scoring
- Three enforcement modes: enforce (blocks autonomous), warn (allows with notice), off
- Override capability with audit trail (reason required, &ge;10 chars)
- Recommended actions ranked by priority and impact

### Progressive AI Activation

| Week | Mode | Owner involvement |
|------|------|-------------------|
| 1 | Missed call text-back + form responses | None |
| 2 | Smart Assist (delayed auto-send, 5 min) | Review AI responses (10-15 min/day) |
| 3+ | Autonomous | Escalations only |

### AI Auto-Progression (Self-Serve)

The platform advances contractors through AI modes automatically based on time and quality signals — no operator intervention required.

| Trigger | Condition | Action |
|---------|-----------|--------|
| **Day 7** | Quality gates pass | Advance from `off` &rarr; `assist` (Smart Assist enabled) |
| **Day 14** | No AI flags in the last 7 days | Advance from `assist` &rarr; `autonomous` |

- Never downgrades &mdash; manual overrides are preserved and not overwritten
- Each advancement sends an SMS notification to the contractor with specific, actionable context: assist mode explains the 5-minute review window and links to `/client/conversations`; autonomous mode explains instant responses and how to take over conversations
- All transitions are logged to audit_log
- Cron: `/api/cron/ai-mode-progression` runs daily at 10am UTC
- **Quality gate re-evaluation:** Quality gates are checked on every AI mode progression step (not just initial activation). If a client in autonomous mode has critical quality gate failures (e.g., KB emptied), the system auto-regresses to Smart Assist mode and alerts the operator.

### Self-Serve KB Onboarding Wizard

New contractors are guided through a 4-step KB wizard at `/client/onboarding` that pre-populates the AI with business information before the first lead arrives. See Section 5 (Client Portal) for details.

On completion, a celebration screen shows a green checkmark with &ldquo;Your AI is ready&rdquo; heading, an explanation that the AI will use the submitted knowledge to answer homeowner questions, and a &ldquo;Return to Dashboard&rdquo; CTA.

### Contractor Portal Feature Toggle Clarity

The Settings &gt; Features page uses clear, contractor-friendly labels:

| Toggle | Label | Description |
|--------|-------|-------------|
| Missed call text-back | &ldquo;Missed Call Text-Back&rdquo; | Automatically text back when you miss a call |
| AI responses | &ldquo;AI Lead Response&rdquo; | AI responds to incoming leads on your behalf (tooltip warns about disabling) |
| Smart assist | &ldquo;Review Before Sending&rdquo; | Preview AI responses before they send (inverted framing for clarity) |

When &ldquo;Review Before Sending&rdquo; is enabled, a &ldquo;How it works&rdquo; explanation card appears above the delay selector describing the draft &rarr; review window &rarr; auto-send flow.

---

## 10. Quarterly Growth Blitz

Operator-initiated campaigns beyond the always-on automation. Planner cron recommends campaign type based on account data.

| Quarter | Default campaign | Trigger |
|---------|-----------------|---------|
| Q1 | Dormant client reactivation | Dormant count &ge; 20 |
| Q2 | Review acceleration | Review rate below target |
| Q3 | Pipeline builder (past inquiries) | Fall pipeline prep |
| Q4 | Year-end review + strategy call | Annual planning |

Lifecycle: planned &rarr; scheduled &rarr; launched &rarr; completed. Invalid jumps blocked. Alert and weekly digest crons for ops visibility.

> **Note:** Q1 "Dormant reactivation" is a targeted manual push *on top of* the always-on win-back automation. Win-back runs continuously; the quarterly campaign is supplementary.

---

## 11. Agency Operations (Admin Tools)

### Operator Alerting

- **Cron failure SMS:** when any cron job fails, the operator receives an SMS alert to the phone number configured in `operator_phone` (stored in the `agencies` table). Alerts are sent from the agency number.
- **Deduplication:** at most 1 alert per subject per hour to prevent alert storms.
- **Setup:** configure `operator_phone`, `operator_name`, and `twilio_number` in the `agencies` table via `/admin/agency` (Agency Settings in the Settings nav group).

### Agency Voice Webhook

- Inbound voice calls to the agency number (#5) are answered with a TwiML message: &quot;This number is for text messages only.&quot;
- Endpoint: `/api/webhooks/twilio/agency-voice`
- Requires webhook configuration in Twilio Console for the agency number&apos;s voice URL.

### Command Palette (Admin)

- Cmd+K (Mac) / Ctrl+K (Windows/Linux) opens a command palette for quick navigation across admin pages and client records.
- Search-as-you-type filtering for clients and admin navigation items.

### Escalation Queue Auto-Refresh

- The escalation queue polls for updates every 30 seconds without manual page refresh.
- &quot;Updated X ago&quot; timestamp shows data freshness.

### Admin Nav Structure

The admin nav has 5 groups. `/admin` redirects to `/admin/triage`. Updated 2026-04-09 per UX platform audit.

| Group | Items |
|-------|-------|
| **Clients** | Triage, Clients, Escalations, AI Flagged Responses, Support |
| **Reporting** | Billing, Reports, Platform Health, Costs &amp; Usage, TCPA Compliance, **Agency Summary** (cross-client weekly stats) |
| **Optimization** | Flow Templates, Flow Analytics (with All Variants toggle), A/B Tests, Reputation, AI Performance, **KB Gap Queue** (cross-client knowledge gaps with duplicate detection) |
| **Team &amp; Access** | Team (with Members/Roles/Portal Users sub-tabs), Audit Log |
| **Settings** | Agency Settings, Phone Numbers (with Twilio balance badge), Twilio Account, Voice AI (client selector + Settings/Testing tabs), Webhook Logs, Email Templates, API Keys, System Settings (diagnostics collapsed by default) |

**Key changes (2026-04-09):** Template Performance merged into Flow Analytics. Compliance moved from Settings to Reporting. Roles/Users collapsed into Team sub-tabs. Discussions renamed to Support. AI Quality renamed to AI Flagged Responses. AI Effectiveness renamed to AI Performance. Platform Analytics no longer duplicates MRR/churn from Billing. Voice AI uses client selector instead of per-client accordion.

**Key changes (2026-04-10):** Agency Summary added to Reporting (cross-client weekly stats). KB Gap Queue added to Optimization (cross-client knowledge gaps). Client detail: Schedule page added (visual dispatch/calendar view with team member appointment reassignment).

### Admin Client Detail Page Structure

The client detail page uses 5 tabs. The Overview tab is lifecycle-aware: onboarding panels (quality gates, day-one activation) auto-hide for established clients in autonomous mode, so ROI dashboard is visible above the fold. Triage-aware back navigation: when navigating from the triage page, breadcrumb and back button link to `/admin/triage` instead of the client list.

| Tab | Key cards |
|-----|-----------|
| **Overview** | Engagement Health badge, Onboarding checklist (conditional), ROI Dashboard, Guarantee Status (conditional), Day-One Activation (conditional), Onboarding Quality (conditional &mdash; hidden when autonomous mode) |
| **Knowledge** | KB entries, gap queue |
| **Configuration** | Smart Assist settings, Exclusion List (DNC), Integrations (Jobber etc.) |
| **Team &amp; Billing** | Team members, subscription, usage, invoice history |
| **Campaigns** | Smart Assist Pending Drafts (15-second polling), Quarterly Campaigns |

The service model badge (Managed/Self-Serve) in the client header is clickable &mdash; operator can toggle the service model per client. Payment Link and Export Data buttons are in the header.

### Client Management

- Client creation wizard (6 steps: business info, phone, hours, team, compliance, review)
- **Client onboarding card:** new clients show a setup checklist at top of detail page (assign phone, import quotes, configure knowledge base) — auto-hides when all three are complete
- 18 per-client feature toggles
- AI settings: mode, tone, guardrails, smart assist delay, send policy
- Team management with role-based access
- Phone number provisioning and webhook configuration (admin and self-serve client portal). All number writes (purchase, assign, release, reassign) go through the `client-phone-management` service, which keeps `clients.twilioNumber` and the `client_phone_numbers` table in sync. UI labels distinguish &ldquo;Owner&apos;s Phone&rdquo; (private, for escalation alerts) from &ldquo;AI Business Line&rdquo; (lead-facing Twilio number).

### AI Preview / Sandbox

Available on the admin client detail page — lets the operator test how the AI would respond to a homeowner question without sending any real message.

- **Panel:** &ldquo;Test the AI&rdquo; panel on the client detail page (`src/app/(dashboard)/admin/clients/[id]/ai-preview-panel.tsx`)
- **API:** `POST /api/admin/clients/[id]/ai-preview` — runs the full agent pipeline in dry-run mode; response is returned to the UI, not sent to any lead
- **Use cases:** verify KB quality during onboarding, run a live sales demo for the contractor, smoke-test after a KB update
- No side effects: no messages created, no lead state changed, no compliance gateway call

### Kill Switches

Three platform-wide circuit breakers (toggle in admin settings, no deploy required):

| Switch | Effect |
|--------|--------|
| **Outbound automations** | Blocks all automated outbound messages |
| **Smart Assist auto-send** | Forces manual approval on all drafts (portal label: &ldquo;Review Before Sending&rdquo;) |
| **Voice AI** | Bypasses AI, forwards calls to owner. Prominent toggle on `/admin/voice-ai` page + per-client toggle in voice settings. |

### Observability

- **Reliability dashboard:** failed crons, webhook failures (24h), escalation SLA breaches, report delivery queue, unresolved errors
- **AI quality monitoring:** flagged AI messages by category, flag rate trends per client, admin-wide review page at `/admin/ai-quality` (shows all flagged messages across clients with reason badges, notes, and lead links)
- **Pre-launch scenario tests:** 102 deterministic tests covering 12 conversation scenarios (happy path, objection handling, escalation safety nets, harassment prevention, model routing boundaries, adversarial guardrails). Run via `npx vitest run src/lib/agent/`.
- **AI criteria tests:** 29 real-LLM tests via `npm run test:ai` &mdash; 23 single-turn criteria (safety, quality, adversarial) + 6 multi-turn conversation scenarios (smooth booking, price objection recovery, frustrated escalation, slow nurture, knowledge boundaries, mid-conversation opt-out). Safety and scenario failures are launch blockers.

### AI Eval System

Comprehensive evaluation system covering all 13 AI-powered features across 6 categories:

| Category | What It Tests | Test Count | Threshold |
|----------|--------------|:----------:|:---------:|
| Safety | Guardrails hold across all features | 20+ | 100% pass |
| Quality | Tone, length, relevance, human-likeness | 35+ | 85%+ pass |
| Accuracy | Signal detection, booking extraction, voice summaries | 40+ | 85%+ pass |
| Grounding | AI stays within KB boundaries | 15 | 100% on boundary Qs |
| Coherence | Output completeness, no truncation, no formatting leaks | 7 | 100% pass |
| Retrieval | Synonym expansion bridges vocabulary gaps | 20 | 90%+ coverage |

Commands:
- `npm run test:ai` &mdash; existing agent criteria + scenarios (~$0.15, ~2min)
- `npm run test:ai:full` &mdash; all categories with HTML report + baseline tracking (~$0.30, ~4min)

Eval results saved to `.scratch/eval-history.json` (rolling 50 runs). HTML report at `.scratch/eval-report.html`. Regression detection: safety has zero tolerance, other categories allow 10pp drop before flagging.
- **AI effectiveness dashboard** (`/admin/ai-effectiveness`): outcome distribution (positive/negative/neutral/pending), action effectiveness breakdown, confidence band analysis, model tier ROI (fast vs quality), daily trend lines, top escalation reasons. Filterable by 7/14/30/60/90-day windows. Client-level AI summary automatically embedded in biweekly reports via `roiSummary.aiEffectiveness`.
- **Error telemetry:** internal error log with source, context, resolution status
- **Audit log:** all admin actions searchable by person, client, action, timestamp
- **Webhook logs:** inbound event viewer with filtering

### Cron Orchestrator

36 scheduled jobs covering: message processing (5 min), calendar sync (15 min), review sync (hourly), analytics aggregation (daily), win-back campaigns (daily), KB empty nudge (daily), day 3 check-in (daily), KB gap auto-notify (daily), AI auto-progression (daily), probable wins nudge (weekly), dormant re-engagement (Wednesdays), engagement health check (Mondays), report generation (bi-weekly), guarantee checks (daily), SLA monitoring (hourly), compliance queue replay, and more. Failed jobs trigger operator SMS alerts (see Operator Alerting above).

### Help Center Seed Articles

The platform ships with 12 pre-written help articles seeded via `npm run db:seed -- --lean`. Articles cover the topics contractors ask about most in their first two weeks.

| Category | Articles |
|----------|---------|
| Getting Started (3) | Setting up your AI, importing quotes, connecting Google Calendar |
| AI &amp; KB (3) | AI response modes, flagging estimates for follow-up, won/lost tracking |
| Leads &amp; Follow-Up (3) | How follow-up works, probable wins nudge, understanding lead stages |
| Billing (2) | Plans and pricing, pausing or cancelling |
| Compliance (1) | Quiet hours and CASL consent |

Articles appear in the contractor portal Help section and reduce first-week support volume. Seeded on every fresh deploy — no manual data entry required.

### Agency Communication

- Weekly digest to owner: lead count, conversations, estimates followed, revenue impact
- Action prompts via SMS (approve drafts, confirm estimates, respond to escalations)
- Quiet hours enforcement on all agency &rarr; owner notifications
- Dedicated agency phone number (separate from client business lines)

### Knowledge Gap Queue

- **Auto-detection:** when the AI defers to the owner (confidence &lt;60) or escalates due to uncertainty, the customer&apos;s question is automatically recorded as a knowledge gap. Both the LangGraph agent and legacy SMS response paths are wired in.
- **Deduplication:** repeat questions increment occurrences on the same gap instead of creating duplicates
- Priority scoring based on occurrences + confidence level, with auto-calculated due dates
- Owner assignment, resolution lifecycle (new &rarr; in_progress &rarr; resolved &rarr; verified)
- Resolution requires linking to a KB entry + note (&ge;10 chars)
- High-priority items (score &ge;8) require reviewer verification
- **Auto-reopen:** if a resolved gap recurs (AI still can&apos;t answer), it reopens automatically
- **&quot;Ask Contractor&quot; button:** each gap card has a button that sends an SMS to the contractor: &quot;[Business Name] &mdash; a customer asked about [question]. How should we answer this?&quot; Sets the gap to `in_progress`. API: `POST /api/admin/clients/[id]/knowledge/gaps/[gapId]/ask`.
- Stale gap alerts via daily cron email to agency owners
- **KB Intake Questionnaire:** structured onboarding questionnaire on the admin client detail page (Overview tab) that pre-populates the knowledge base at client setup — reduces cold-start AI deferrals in Weeks 1-2. Answers are converted to KB entries automatically.

### Operator Triage Dashboard

Unified cross-client triage view at `/admin/triage` (Clients group in admin nav). `/admin` redirects here.

- Surfaces the highest-priority action items across all clients in a single prioritized list: open escalations (P1 first), knowledge gaps past due, onboarding SLA breaches, stale guarantee states, failed report deliveries
- **Trigger detail on each card:** shows the specific reason for flagging with threshold context (e.g., &ldquo;Last estimate sent: 22d ago, threshold: 21d&rdquo;) and duration at status (&ldquo;Flagged for 3 weeks&rdquo; vs &ldquo;Just flagged today&rdquo;)
- **Pending Drafts column:** shows the Smart Assist pending draft count per client in both the table view and mobile card layout
- **Batch escalation acknowledge:** `POST /api/admin/escalations/batch` accepts multiple escalation IDs for bulk resolve/dismiss
- Designed as a daily starting point for the solo operator — open this before the full daily checklist
- Replaces the need to open each client separately to find what needs attention
- Accessible via admin nav: Clients &rarr; Triage

### Engagement Health Monitoring

Automated detection of per-client engagement decay before it becomes visible churn risk.

- `engagement-health-check` cron (Mondays) evaluates each active client: response rates, AI deferral frequency, escalation volume, and lead activity trends
- **Root cause analysis:** when a client is flagged, the system computes: inbound call volume trend (7d vs prior 7d), AI conversation success rate, unanswered missed calls, and suggests a specific intervention (&ldquo;Check voice routing &mdash; inbound calls dropped 60%&rdquo; or &ldquo;Consider launching a Growth Blitz campaign&rdquo;)
- Flags clients where engagement has declined for 3+ consecutive weeks — operator receives an alert with the specific health signal and suggested intervention
- **Digest preview:** `GET /api/admin/clients/[id]/digest-preview` returns exactly what Monday&apos;s weekly digest SMS will say for a client, including stats and message type
- Feeds into the Triage dashboard so declining clients surface automatically
- `dormant-reengagement` cron (Wednesdays) re-contacts leads eligible for 6-month follow-up (see Section 2: Dormant Re-Engagement)
- **Per-client engagement health badge:** server component on the admin client detail page (Overview tab) shows `at_risk` or `disengaged` status with signal bullets (days since last estimate flag, days since last won/lost update). Surfaces the per-client decay signal without opening the Triage dashboard.

### DNC/Exclusion List Management

- Per-client Do Not Contact list manageable directly from the admin client detail page (Configuration tab). Operator adds excluded phone numbers during onboarding — compliance gateway blocks all outbound to those numbers automatically.
- API: `GET /POST /DELETE /api/admin/clients/[id]/dnc`
- Distinct from the global DNC: per-client exclusions protect personal relationships (family, friends); global DNC covers permanent legal/harassment blocks.

### Smart Assist Pending Drafts Admin View

- Pending AI drafts visible in the admin dashboard (Campaigns tab on the client detail page) with 15-second polling. Operator can approve, edit, or cancel drafts directly from the browser during Week 2 instead of relying solely on SMS commands.
- API: `GET /api/admin/clients/[id]/smart-assist`, `POST /api/admin/clients/[id]/smart-assist/[messageId]` (approve/edit/cancel actions)
- Complements the existing SMS-based `SEND/EDIT/CANCEL` workflow — both methods are valid.

### Guarantee Status Dashboard

- Server component on the admin client detail page (Overview tab). Displays the current guarantee phase (`proof_pending` / `recovery_pending`), QLE count vs. target, pipeline value vs. $5K floor, days remaining in the window, and an on-track/at-risk/failing status badge (green/yellow/red).
- No new API — loads server-side from existing guarantee data.
- Replaces the need to navigate to a separate guarantee section; visible at a glance on the client overview.

### Integration Webhook Config UI

- Per-client webhook configuration in the admin dashboard (Configuration tab). Operator configures Jobber, ServiceTitan, Housecall Pro, Zapier, and generic provider webhooks with provider type, direction, event type, URL, and secret key. Card shows last triggered time and failure count; integrations auto-disable after 10 consecutive failures.
- API: CRUD at `GET /POST /api/admin/clients/[id]/integrations` and `PATCH /DELETE /api/admin/clients/[id]/integrations/[webhookId]`

### Admin Data Export Trigger

- Admin-triggered data export from the client detail page header (Export Data button), with AlertDialog confirmation. Generates a CSV bundle (leads, conversations, pipeline) for compliance or cancellation delivery. The Actions card has been removed; Payment Link and Export Data are now in the client detail header.
- API: `POST /api/admin/clients/[id]/export`

---

## 12. Review Monitoring &amp; Response

Beyond the review *request* automation (Section 2), the platform monitors and responds to reviews.

### Review Sync

- Google Places integration: hourly sync of new reviews
- Auto-detect sentiment: positive (&ge;4), neutral (3), negative (&le;2)
- **Negative review alert:** instant SMS to owner when &le;2 star review detected — alert fires in the same sync run (not the next cron batch); idempotent via `alertSent` flag to prevent duplicate notifications

### Auto-Response

- AI-generated response drafts (tone varies by rating)
- Template matching with keyword scoring (before AI fallback)
- Draft &rarr; approved &rarr; posted lifecycle
- Auto-post to Google Business Profile via OAuth (with token refresh)

### Review Approval Modes (SPEC-UX-05)

Each client has a `reviewApprovalMode` field controlling who approves AI-drafted review responses:

| Mode | Positive reviews (&ge;4 stars) | Neutral/negative reviews (&le;3 stars) | Default for |
|------|-------------------------------|-------------------------------|-------------|
| **operator_managed** | Auto-approved and posted to Google immediately | Held as `pending_approval`; operator notified via SMS | Managed-service clients |
| **client_approves** | Draft stays for contractor approval at `/client/reviews` | Same &mdash; contractor reviews all drafts | Self-serve clients |

**Operator workflow (operator_managed):**
1. Positive reviews (&ge;4 stars) auto-post &mdash; no action needed
2. Neutral/negative reviews (&le;3 stars) appear in &ldquo;Pending Responses&rdquo; section on `/admin/clients/[id]/reviews`
3. Operator can: **Approve &amp; Post**, **Edit** the draft then post, or **Forward to Client** for personal input
4. &ldquo;Approve All Positive&rdquo; batch button for bulk operations
5. Forwarded reviews appear on the contractor&apos;s `/client/reviews` page

**Contractor portal (operator_managed):** Only shows reviews explicitly forwarded by the operator. Empty state: &ldquo;Your account manager handles review responses. Reviews that need your personal touch will appear here.&rdquo;

**Contractor portal (client_approves):** Shows all draft/pending responses for editing and approval (legacy behavior).

---

## 13. External Integrations

### Jobber Webhook Integration (SPEC-12)

Basic bidirectional webhook integration with Jobber for clients who use it for job management.

| Direction | Trigger | What happens |
|-----------|---------|-------------|
| **CS &rarr; Jobber (outbound)** | Appointment booked in CS | CS fires `appointment_booked` event to the client&apos;s configured Jobber webhook URL |
| **Jobber &rarr; CS (inbound)** | Job marked complete in Jobber | Jobber sends `job_completed` event to `POST /api/webhooks/jobber/job-completed`; CS triggers review generation for the associated lead |

- Integration is off by default; enabled per client via admin settings (requires `webhookUrl` configuration)
- Architecture: generic `integration_webhooks` table supports future providers (HubSpot, ServiceTitan, Housecall Pro) with the same pattern
- Non-blocking: integration failures do not affect core platform operations
- **Webhook signature enforcement:** All Jobber webhook deliveries require HMAC-SHA256 signature verification. Webhooks without a configured secret key are rejected.

**Sales positioning:** CS is the front end of the contractor&apos;s pipeline. Jobber handles job management; CS handles getting the work and closing the loop on reviews. The Jobber integration makes this concrete — no duplicate data entry, no manual review requests.

### ROI Calculator (SPEC-11)

Public API endpoint for pre-sale conversations:

- **Endpoint:** `POST /api/public/roi-calculator`
- **Inputs:** monthly lead volume, average project value, estimated follow-up gap (%), quote-to-win rate
- **Output:** annual revenue at risk, monthly recovery potential, months-to-break-even
- **Auth:** public (no auth required — intended for use during sales calls or embedded in marketing)

Use during sales calls to replace manual ROI math. Enter the prospect&apos;s numbers live; show the output on screen. Converts the price objection from &ldquo;$1,000 is expensive&rdquo; to &ldquo;I&apos;m leaving $X per month on the table.&rdquo;

### Existing: Zapier / Webhook Export

Clients can configure a webhook URL to receive `lead.status_changed` events when a lead is marked won or lost. See Section 5 (Client Portal) for details.

---

## What&apos;s NOT in the Platform

Per the offer doc (Section 8):

- Website design or development
- Paid advertising management
- Social media management
- Email newsletters (beyond automated follow-up)
- SEO services
- Project management or accounting software
- Custom workflow builds beyond the standard suite
- 24/7 live human support (AI monitors around the clock; human escalation during business hours)
