# Platform Capabilities

Last updated: 2026-04-01 (Wave 7 + post-launch additions)
Purpose: Complete inventory of what ConversionSurgery can do today — organized by value delivered, not by technical area.

---

## 1. Speed-to-Lead (Near-Instant Response)

The core promise: every inquiry gets a response in seconds, not hours.

### Inbound Channels

| Channel | What happens | Response time |
|---------|-------------|---------------|
| **SMS/MMS** | Webhook receives message, creates/updates lead, AI generates contextual response | 2-8 seconds (autonomous mode) |
| **Missed call** | Detects unanswered call, auto-sends personalized SMS to caller | 2-3 seconds |
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

The analyze-and-decide node always runs on fast tier (structured classification task). The routing decision and reason are logged in `agent_decisions.actionDetails` for observability.

### Speed-to-Lead Tracking

- Response time measured per lead: `first outbound message - lead creation`
- Bucketed into: &lt;1 min, 1-5 min, 5-15 min, 15-60 min, 1hr+
- Industry benchmark comparison: calculates multiplier vs. 42-minute industry average
- Surfaced in bi-weekly reports and client revenue dashboard

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

Triggered when owner flags an estimate as sent (SMS keyword `EST`, dashboard action, or API call).

| Touch | Timing | Message tone |
|-------|--------|-------------|
| 1 | Day 2, 10am | Checking in — any questions? |
| 2 | Day 5, 10am | Booking up — want to get on the schedule? |
| 3 | Day 10, 10am | Circling back, still available |
| 4 | Day 14, 10am | Last check-in, no hard feelings |

**Fallback nudge:** Cron identifies stale leads (48+ hours, no estimate sequence) and prompts the owner: "Did you send an estimate to [name]? Reply YES to start follow-up."

Cancellation: new sequence auto-cancels prior unsent messages for the same lead.

### Appointment Reminders

- **Day-before reminder** to homeowner
- **2-hour reminder** to homeowner
- **Contractor reminder** to business owner (via reminder routing policy — configurable primary/fallback chain)
- Sent through compliance gateway with quiet-hours queueing
- **Email fallback:** if compliance blocks all SMS recipients for a booking notification (e.g., quiet hours, opt-out), the system falls back to email notification so the contractor is never left uninformed

### Google Calendar Two-Way Sync

Contractors can connect their Google Calendar so platform appointments and external calendar events stay in sync automatically.

| Capability | Detail |
|------------|--------|
| **OAuth connection** | Contractor connects via Google OAuth (read/write scope). Tokens stored securely and refreshed automatically. |
| **Bidirectional sync** | Platform appointments push to Google Calendar as events. Google Calendar events pull into the platform and block booking slots. |
| **Availability checking** | `getAvailableSlots()` checks both the `appointments` table and `calendar_events` table — Google Calendar events prevent double-booking. |
| **Auto-sync cadence** | Cron job (`/api/cron/calendar-sync`) runs every 15 minutes, syncing all active integrations. |
| **Event lifecycle** | Create, update, and delete operations propagate both directions. |
| **Admin connection** | Operator can connect/disconnect a client&apos;s calendar from the client detail page (Configuration tab). |
| **Portal connection** | Contractor can connect/disconnect from Settings &gt; Features in the client portal. OAuth callback redirects back to `/client/settings` (not admin). |
| **Portal sync status** | Portal card shows `consecutiveErrors` count. If errors &gt; 3: red &ldquo;Sync failed multiple times — reconnect&rdquo; banner. If sync is stale (&gt;30 min) and has errors: yellow &ldquo;May be disconnected&rdquo; warning. |
| **Feature toggle** | Controlled by the `calendarSyncEnabled` per-client feature flag. |
| **Schema** | `calendar_integrations` (OAuth tokens, sync state, `consecutiveErrors`) and `calendar_events` (events with external IDs for sync). |

### No-Show Recovery

Cron detects appointments 2+ hours past scheduled time with no completion.

| Step | Timing | Action |
|------|--------|--------|
| 1 | Same day | AI-personalized follow-up SMS (warm, short, offers reschedule) |
| 2 | Day +2, 10am | Second AI-personalized follow-up (shorter, gives easy out) |

Hard stop at 2 attempts. Quiet hours respected. AI uses conversation history and project context for personalization.

### Payment Collection

Triggered via `POST /api/sequences/payment` with invoice details. Auto-generates Stripe payment link.

| Touch | Timing | Message |
|-------|--------|---------|
| 1 | Due date, 10am | Friendly reminder + payment link |
| 2 | Day 3, 10am | Past due, link to pay |
| 3 | Day 7, 10am | 7 days past due |
| 4 | Day 14, 10am | Final reminder |

Stripe webhook confirms payment &rarr; cancels remaining reminders &rarr; sends confirmation SMS to both lead and owner. Supports partial payments.

### Review Generation

Triggered via `POST /api/sequences/review` when job is marked complete.

| Touch | Timing | Message |
|-------|--------|---------|
| 1 | Day 1, 10am | Review request with direct Google link |
| 2 | Day 4, 10am | Referral request |

### Win-Back (Dormant Lead Reactivation)

Always-on continuous automation (separate from Quarterly Growth Blitz campaigns).

- Targets leads with `status=contacted` or `status=estimate_sent` and 25-35 days since last activity (last message, or creation date for imported leads with no conversations)
- AI-personalized win-back message with project context
- Randomized send timing (10am-2pm weekdays, avoids Monday morning/Friday afternoon)
- Follow-up 20-30 days later
- After 2 attempts with no response, lead transitions to `dormant`

### Probable Wins Nudge

Weekly cron (`/api/cron/probable-wins-nudge`) identifies leads that have had a completed or confirmed appointment 14+ days ago but have not been marked won or lost.

- Sends a contractor SMS via the agency channel (operator-to-contractor, not compliance gateway): "Did you win [Lead Name]'s [project type]? Reply YES or NO to this number, then we'll ask for the value."
- If the contractor replies YES, a follow-up asks for the job value so confirmed revenue can be recorded
- 14-day cooldown per client — at most one nudge cycle per 14 days regardless of how many qualifying leads exist
- Deduped per lead: one nudge per lead per run, no duplicate sends
- Skips clients with no active phone number, paused clients, and leads already marked won/lost/closed

### Dormant Re-Engagement (6-Month Stage)

Follow-on stage after standard win-back for leads that have been dormant 6+ months.

- Targets leads with `status=dormant` and 180+ days since last activity
- Fresh AI-personalized outreach — acknowledges the time gap, low-pressure tone
- Single-touch attempt with no additional follow-up
- Runs weekly on Wednesdays via `engagement-health-check` and `dormant-reengagement` cron jobs
- Prevents permanent loss of re-contact opportunity once the initial win-back pool is exhausted

---

## 3. Voice AI

Optional add-on ($0.15/minute). Answers inbound calls with a conversational AI.

### Call Flow

1. Caller dials the business line
2. AI answers with custom greeting (per-client configurable)
3. **Two-step flow:** filler phrase ("One moment please...") plays immediately while AI processes, then response plays — caller never hears dead silence
4. Multi-turn conversation: AI answers questions, qualifies the project, books appointments
5. Transfer to human: if caller requests or AI detects it should escalate, warm transfer to team member

### Capabilities

- **Intent detection:** quote, schedule, question, complaint, transfer, other
- **Sentiment analysis:** positive, neutral, negative
- **Knowledge-grounded responses:** uses client knowledge base, service catalog, and conversation history
- **Guardrails:** won&apos;t make pricing promises, won&apos;t guess unknowns, escalates when unsure
- **Three activation modes:** always on, after-hours only, overflow (when owner doesn&apos;t answer)
- **Voice selection:** ElevenLabs voice personas with admin preview
- **Kill switch:** global disable that falls back to direct owner forwarding

### Missed Transfer Recovery

When a hot transfer fails (busy, no-answer, failed, or canceled status from Twilio):

1. **Homeowner SMS:** the platform sends the homeowner an SMS via the compliance gateway: "[Business] tried to connect you with a team member but they&apos;re currently unavailable. Someone will call you back shortly."
2. **P1 escalation:** a critical-priority escalation entry is created and surfaces immediately in the triage dashboard.
3. **Team notification:** a `sendAlert` SMS is sent to the team member who was dialled: "Missed transfer: [Lead Name] called and was transferred to you but the call was not answered. Please call them back at [phone]."

All three side effects run in the background (fire-and-forget) — the TwiML response is never delayed.

File: `src/app/api/webhooks/twilio/voice/ai/dial-complete/route.ts`

### Post-Call

- Call transcript and AI summary stored
- Outcome tracked: qualified, scheduled, transferred, voicemail, dropped
- Callback requests flagged for follow-up
- Voice usage aggregated for billing (per-minute)

---

## 4. Communication Hub (Lead CRM)

Replaces text threads, sticky notes, and memory with one unified system.

### Lead Pipeline

Stages: `new` &rarr; `contacted` &rarr; `estimate_sent` &rarr; `appointment_scheduled` &rarr; `won` / `lost`

Special states: `action_required` (needs human attention), `opted_out`, `dormant`

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
- **CASL consent attestation:** both the admin CSV import route and the portal quote import require the importer to confirm: &ldquo;I confirm all contacts have made an inquiry to my business under CASL.&rdquo; Import is rejected (400) if the attestation checkbox is not checked. The attestation is recorded in the import response audit trail.

### Team Coordination

- **Ring group:** simultaneous dial to all available team members during business hours
- **Escalation queue:** priority-ranked (1-5) with SLA deadlines, live countdown timers (color-coded: green/sienna/red by urgency), assignment, claim tokens, and 30-second auto-refresh with &quot;Updated X ago&quot; timestamp
- **Hot transfer:** Voice AI detects urgency &rarr; dials team immediately &rarr; SMS heads-up ("Hot lead calling!")
- **Missed transfer fallback:** SMS to team ("Missed hot transfer — call back ASAP") + SMS to lead ("Sorry we missed you")
- **Owner notification:** Smart Assist drafts with reference codes for SEND/EDIT/CANCEL approval

### Conversation Modes

| Mode | Behavior |
|------|----------|
| **AI** | AI handles all responses autonomously |
| **Human** | Owner/team member took over — AI paused |
| **Paused** | No responses sent (manual hold) |

Takeover/handback is per-lead and tracked with timestamps.

---

## 5. Client Portal

The business owner&apos;s view — everything they need, nothing they don&apos;t.

### Pages

| Page | What it shows |
|------|--------------|
| **Dashboard** | Lead summary, recent activity, help articles. **System Activity card** (auto-tracked pipeline proof — see below) positioned above the **Revenue Recovered card** (confirmed revenue, &ldquo;Confirmed by you&rdquo; subtitle — shows $0 nudge when no wins recorded). New-client setup banner (phone + plan checklist, auto-hides when complete). Sticky header keeps page title visible while scrolling. **Since Your Last Visit card** (see below). **&ldquo;Set up your AI&rdquo; CTA** when KB has fewer than 5 entries — links to the onboarding wizard. |
| **Conversations** | All leads with message history, mode badges, action-required highlights |
| **Revenue** | 30-day stats, pipeline value, speed-to-lead metrics, service breakdown |
| **Knowledge Base** | Business info the AI uses — editable by owner |
| **Flows** | Automation flows (estimate, payment, review, win-back) — view and manage |
| **Billing** | Current plan, usage, add-on charges, invoice history, CSV export, payment methods |
| **Team** | Add/remove team members, toggle escalation/hot transfer, manage permissions |
| **Settings** | Phone number management, AI settings, notification preferences, feature toggles, business hours |
| **Reviews** | Pending AI-drafted Google review responses — inline edit and approve before posting (see below). |
| **Lead Import** | Self-serve CSV lead import with drag-and-drop, header auto-detection, preview, and downloadable template (see below). |
| **Cancel** | Cancellation request with 30-day notice + data export |

### KB Onboarding Wizard (Contractor Self-Serve)

Contractors can populate the AI knowledge base themselves via a guided 4-step wizard at `/client/onboarding`, eliminating cold-start AI deferrals without requiring operator data entry.

| Step | Fields |
|------|--------|
| 1. Services | Service types, service area, what the business does NOT do |
| 2. Business | Business name, years in business, warranties, competitive advantages |
| 3. Hours &amp; Pricing | Business hours, pricing approach, typical ranges |
| 4. Booking | Booking process, response time, how leads should get in touch |

- 12 fields total across 4 steps
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
| **Mark Won** | Sets lead status to `won` | Opens a dialog to enter confirmed revenue (dollar value recorded for ROI reporting) |
| **Mark Lost** | Sets lead status to `lost` | AlertDialog confirmation prevents accidental dismissal |

- API: `PATCH /api/client/leads/[id]/status` via `portalRoute` with `PORTAL_PERMISSIONS.LEADS_EDIT`
- Won and Lost status changes also fire the `lead.status_changed` webhook (if configured) for Jobber/Zapier integrations

### Review Response Approval (Contractor Portal)

Contractors review and approve AI-drafted Google review responses before they are posted.

- Page at `/client/reviews` shows a card per pending AI draft
- Each card displays: star rating, reviewer name, review text, and the AI-generated draft
- Inline edit mode to modify the draft before approval
- AlertDialog confirmation on approve to prevent accidental posting
- APIs: `GET /api/client/reviews/pending`, `POST /api/client/reviews/[responseId]/approve`

### System Activity Card (Pipeline Proof)

Shown on the contractor portal dashboard (`/client`) above the Revenue Recovered card. Displays auto-tracked metrics that require zero contractor action — proving system ROI before any wins are manually confirmed.

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

This card solves the &ldquo;$0 on the dashboard for 60 days&rdquo; churn risk. The Revenue Recovered card remains for contractor-confirmed wins (manual input required). The System Activity card shows proof automatically, with no contractor effort.

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
- **Inline help tooltips** on settings fields (Quiet Hours, Smart Assist Auto-Send, AI Tone, Auto-send delay) via info icons
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
- **Re-opt-in:** START, YES, SUBSCRIBE, OPTIN &rarr; re-consent recorded
- **HELP/INFO keywords:** auto-reply with business name, owner phone, and STOP instructions (sent even to opted-out numbers)
- **Quiet hours:** 9pm-10am recipient local time. Two modes: strict (all outbound queued) and inbound-reply-allowed (direct replies sent, proactive outreach queued)
- **DNC list:** global + per-client do-not-contact registry with expiry and source tracking
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

---

## 7. Reporting &amp; Analytics

### Bi-Weekly Performance Report

Auto-generated and delivered to clients every 2 weeks:

- Leads captured, response times, conversations handled
- Estimates followed up, appointments booked
- Revenue impact estimate
- **"Without Us" model:** low/base/high directional estimate of what would have happened without the system (with disclaimer)
- **Confirmed Won revenue:** reports show &quot;Confirmed Won: $X&quot; alongside pipeline estimates, based on contractor-entered actual job values when marking leads &quot;won&quot;
- **Pipeline Proof (`pipelineProof` in `roiSummary`):** 6 auto-tracked metrics added to every report — leads responded to, estimates in follow-up, missed calls caught, dead quotes re-engaged, appointments booked, and average response time. `probablePipelineValue` is calculated automatically as (appointments booked + reactivated quotes) &times; avg project value ($40K default). These metrics require zero contractor action and prove system value even before any wins are confirmed.
- Versioned output — shows `ready` or `insufficient_data` (never fabricates)

### Delivery Infrastructure

- Report delivery lifecycle: generated &rarr; queued &rarr; sent &rarr; failed
- Retry cron with exponential backoff
- Terminal failure alerts to admin
- **Auto-follow-up SMS:** after report delivery, the system auto-sends an SMS to the contractor via the agency number: &quot;[Business Name] &mdash; your bi-weekly performance report is ready. Check your email or view it in the dashboard. Questions? Just reply to this text.&quot; Fire-and-forget; does not affect delivery state.
- Client portal download link

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
- Trial system with configurable days (waived for returning clients)
- Pause/resume capability
- Coupon system (percentage/fixed, one-time/recurring, plan restrictions)

### Add-On Billing

| Add-on | Pricing | Tracking |
|--------|---------|----------|
| Extra team members | $20/month each (above included) | Per-seat ledger event |
| Extra phone numbers | $15/month each (above included) | Per-number ledger event |
| Voice AI minutes | $0.15/minute | Usage rollup cron |

- Immutable billing event ledger with idempotency keys
- Add-on charges visible on client billing page with CSV export
- Admin dispute/provenance workflow (reviewing &rarr; resolved)
- Invoice line items with `Add-on:` labels

### Stripe Integration

- **Subscription checkout:** Stripe Checkout redirect for new subscriptions (handles 3D Secure, all card types, SCA compliance)
- **Plan changes:** In-app plan upgrade/downgrade for existing subscribers with proration
- Payment methods on file with add/remove/default management
- One-time payment links for lead invoices (deposits, progress payments, final)
- Webhook handler with dedup protection
- Payment confirmation SMS to both lead and owner
- Reconciliation cron syncs subscription status daily

### Guarantee Workflow

| Phase | Window | Threshold | Outcome if not met |
|-------|--------|-----------|-------------------|
| **30-Day Proof** | First 30 days | 5 qualified lead engagements | Refund first month |
| **90-Day Recovery** | Next 90 days | 1 attributed project opportunity | Refund most recent month |

- **Layer 2 attribution is fully log-based:** attribution requires platform logs showing the system engaged the lead through automated response or follow-up before the opportunity progressed. No subjective contractor confirmation is required.
- Volume condition: if &lt;15 leads/month, windows extend proportionally
- State machine with automatic daily evaluation via cron
- Metrics tracked: qualified engagements, attributed opportunities

### Cancellation

- 30-day notice period
- Data export within 5 business days (CSV: leads, conversations, pipeline jobs)
- Export download with time-limited token
- Retention call scheduling option

---

## 9. Onboarding &amp; Day-One Activation

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
- **Auto-login after signup:** public signup flow establishes a portal session automatically — contractor lands on the client dashboard with setup guidance, no separate login step required.
- **Subscription-gated phone purchase:** phone provisioning requires an active subscription. Clear prompt to choose a plan if attempted without one.

### Onboarding Checklist

- **Actionable steps:** each incomplete checklist item links directly to the relevant settings page (phone setup, business hours, team configuration, etc.)
- **Tutorials as links:** tutorial items are clickable links, not plain text
- **Start Here banner:** shows the single most important next action for the contractor
- **Quality gates simplified:** hidden when passing; shown in plain language when failing (no technical jargon)

### Onboarding Quality Gates

- Multi-criteria evaluation: knowledge base populated, business hours set, team configured, etc.
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

- Never downgrades — manual overrides are preserved and not overwritten
- Each advancement sends an SMS notification to the contractor explaining the new mode
- All transitions are logged to audit_log
- Cron: `/api/cron/ai-mode-progression` runs daily at 10am UTC

### Self-Serve KB Onboarding Wizard

New contractors are guided through a 4-step KB wizard at `/client/onboarding` that pre-populates the AI with business information before the first lead arrives. See Section 5 (Client Portal) for details.

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

- **Cron failure SMS:** when any cron job fails, the operator receives an SMS alert to the phone number configured in `operator_phone` (system_settings). Alerts are sent from the agency number.
- **Deduplication:** at most 1 alert per subject per hour to prevent alert storms.
- **Setup:** set `operator_phone` in system_settings via `/admin/settings`.

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

### Client Management

- Client creation wizard (6 steps: business info, phone, hours, team, compliance, review)
- **Client onboarding card:** new clients show a setup checklist at top of detail page (assign phone, import quotes, configure knowledge base) — auto-hides when all three are complete
- 18 per-client feature toggles
- AI settings: mode, tone, guardrails, smart assist delay, send policy
- Team management with role-based access
- Phone number provisioning and webhook configuration (admin and self-serve client portal)

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
| **Smart Assist auto-send** | Forces manual approval on all drafts |
| **Voice AI** | Bypasses AI, forwards calls to owner |

### Observability

- **Reliability dashboard:** failed crons, webhook failures (24h), escalation SLA breaches, report delivery queue, unresolved errors
- **AI quality monitoring:** flagged AI messages by category, flag rate trends per client, admin-wide review page at `/admin/ai-quality` (shows all flagged messages across clients with reason badges, notes, and lead links)
- **Pre-launch scenario tests:** 102 deterministic tests covering 12 conversation scenarios (happy path, objection handling, escalation safety nets, harassment prevention, model routing boundaries, adversarial guardrails). Run via `npx vitest run src/lib/agent/`.
- **AI criteria tests:** 29 real-LLM tests via `npm run test:ai` &mdash; 23 single-turn criteria (safety, quality, adversarial) + 6 multi-turn conversation scenarios (smooth booking, price objection recovery, frustrated escalation, slow nurture, knowledge boundaries, mid-conversation opt-out). Safety and scenario failures are launch blockers.
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
- **KB Intake Questionnaire:** structured onboarding questionnaire on the admin client detail page (Knowledge tab) that pre-populates the knowledge base at client setup — reduces cold-start AI deferrals in Weeks 1-2. Answers are converted to KB entries automatically.

### Operator Triage Dashboard

Unified cross-client triage view at `/admin/triage` (Optimization group in admin nav).

- Surfaces the highest-priority action items across all clients in a single prioritized list: open escalations (P1 first), knowledge gaps past due, onboarding SLA breaches, stale guarantee states, failed report deliveries
- Designed as a daily starting point for the solo operator — open this before the full daily checklist
- Replaces the need to open each client separately to find what needs attention
- Accessible via admin nav: Optimization &rarr; Triage

### Engagement Health Monitoring

Automated detection of per-client engagement decay before it becomes visible churn risk.

- `engagement-health-check` cron (Mondays) evaluates each active client: response rates, AI deferral frequency, escalation volume, and lead activity trends
- Flags clients where engagement has declined for 3+ consecutive weeks — operator receives an alert with the specific health signal
- Feeds into the Triage dashboard so declining clients surface automatically
- `dormant-reengagement` cron (Wednesdays) re-contacts leads eligible for 6-month follow-up (see Section 2: Dormant Re-Engagement)

---

## 12. Review Monitoring &amp; Response

Beyond the review *request* automation (Section 2), the platform monitors and responds to reviews.

### Review Sync

- Google Places integration: hourly sync of new reviews
- Auto-detect sentiment: positive (&ge;4), neutral (3), negative (&le;2)
- **Negative review alert:** instant SMS to owner when &le;2 star review detected

### Auto-Response

- AI-generated response drafts (tone varies by rating)
- Template matching with keyword scoring (before AI fallback)
- Draft &rarr; approved &rarr; posted lifecycle
- Auto-post to Google Business Profile via OAuth (with token refresh)
- Admin approval required before posting (admin dashboard)
- **Contractor portal approval:** Contractors can view pending AI-drafted responses at `/client/reviews`, edit the draft inline, and approve — posts to Google without operator involvement. See Section 5 for portal detail.

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
