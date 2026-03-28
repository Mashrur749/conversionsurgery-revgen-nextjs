# Platform Capabilities

Last updated: 2026-03-27
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

### Speed-to-Lead Tracking

- Response time measured per lead: `first outbound message - lead creation`
- Bucketed into: &lt;1 min, 1-5 min, 5-15 min, 15-60 min, 1hr+
- Industry benchmark comparison: calculates multiplier vs. 42-minute industry average
- Surfaced in bi-weekly reports and client revenue dashboard

---

## 2. Follow-Up Automation (Never Drop a Lead)

### Estimate Follow-Up

Triggered when owner flags an estimate as sent (SMS keyword `EST`, dashboard action, or API call).

| Touch | Timing | Message tone |
|-------|--------|-------------|
| 1 | Day 2, 10am | Checking in — any questions? |
| 2 | Day 5, 10am | Booking up — want to get on the schedule? |
| 3 | Day 10, 10am | Circling back, still available |
| 4 | Day 14, 10am | Last check-in, no hard feelings |

**Fallback nudge:** Cron identifies stale leads (5+ days, no estimate sequence) and prompts the owner: "Did you send an estimate to [name]? Reply YES to start follow-up."

Cancellation: new sequence auto-cancels prior unsent messages for the same lead.

### Appointment Reminders

- **Day-before reminder** to homeowner
- **2-hour reminder** to homeowner
- **Contractor reminder** to business owner (via reminder routing policy — configurable primary/fallback chain)
- Sent through compliance gateway with quiet-hours queueing

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

- Targets leads with `status=contacted` and 25-35 days since last contact
- AI-personalized win-back message with project context
- Randomized send timing (10am-2pm weekdays, avoids Monday morning/Friday afternoon)
- Follow-up 20-30 days later
- After 2 attempts with no response, lead transitions to `dormant`

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

### Bulk Lead Import

- CSV upload with automatic column mapping (supports common aliases: "Phone Number", "Mobile", "First Name", "Service Type", etc.)
- Validates phone format, normalizes numbers, deduplicates against existing leads
- Up to 1,000 leads per import with per-row error reporting
- Preview table before import with column mapping summary
- Source tracked as `csv_import` for attribution

### Team Coordination

- **Ring group:** simultaneous dial to all available team members during business hours
- **Escalation queue:** priority-ranked (1-5) with SLA deadlines, assignment, and claim tokens
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
| **Dashboard** | Lead summary, recent activity, help articles, onboarding checklist |
| **Conversations** | All leads with message history, mode badges, action-required highlights |
| **Revenue** | 30-day stats, pipeline value, speed-to-lead metrics, service breakdown |
| **Knowledge Base** | Business info the AI uses — editable by owner |
| **Flows** | Automation flows (estimate, payment, review, win-back) — view and manage |
| **Billing** | Current plan, usage, add-on charges, invoice history, CSV export, payment methods |
| **Team** | Add/remove team members, toggle escalation/hot transfer, manage permissions |
| **Settings** | AI settings, notification preferences, feature toggles, business hours |
| **Cancel** | Cancellation request with 30-day notice + data export |

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
- Versioned output — shows `ready` or `insufficient_data` (never fabricates)

### Delivery Infrastructure

- Report delivery lifecycle: generated &rarr; queued &rarr; sent &rarr; failed
- Retry cron with exponential backoff
- Terminal failure alerts to admin
- Client portal download link

### Funnel Tracking

Full conversion funnel: lead_created &rarr; first_response &rarr; qualified &rarr; appointment_booked &rarr; quote_sent &rarr; quote_accepted &rarr; job_won &rarr; payment_received &rarr; review_requested &rarr; review_received

Each event: source attribution, campaign attribution, value in cents.

### Daily/Weekly/Monthly Aggregation

- Response time averages, message volumes, AI response counts
- Template performance metrics (which messages get replies)
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

- SLA cron monitors and creates alerts for overdue milestones
- Activity trail logs all events (draft, delivery, completion)
- Revenue Leak Audit: structured findings with priority, impact ranges, and artifact URLs

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

### Client Management

- Client creation wizard (6 steps: business info, phone, hours, team, compliance, review)
- 18 per-client feature toggles
- AI settings: mode, tone, guardrails, smart assist delay, send policy
- Team management with role-based access
- Phone number provisioning and webhook configuration

### Kill Switches

Three platform-wide circuit breakers (toggle in admin settings, no deploy required):

| Switch | Effect |
|--------|--------|
| **Outbound automations** | Blocks all automated outbound messages |
| **Smart Assist auto-send** | Forces manual approval on all drafts |
| **Voice AI** | Bypasses AI, forwards calls to owner |

### Observability

- **Reliability dashboard:** failed crons, webhook failures (24h), escalation SLA breaches, report delivery queue, unresolved errors
- **Error telemetry:** internal error log with source, context, resolution status
- **Audit log:** all admin actions searchable by person, client, action, timestamp
- **Webhook logs:** inbound event viewer with filtering

### Cron Orchestrator

28 scheduled jobs covering: message processing (5 min), review sync (hourly), analytics aggregation (daily), win-back campaigns (daily), report generation (bi-weekly), guarantee checks (daily), SLA monitoring (hourly), compliance queue replay, and more.

### Agency Communication

- Weekly digest to owner: lead count, conversations, estimates followed, revenue impact
- Action prompts via SMS (approve drafts, confirm estimates, respond to escalations)
- Quiet hours enforcement on all agency &rarr; owner notifications
- Dedicated agency phone number (separate from client business lines)

### Knowledge Gap Queue

- Tracks gaps between what leads ask and what the AI knows
- Priority scoring, owner assignment, resolution lifecycle
- Stale gap alerts via cron
- Resolution requires KB link + note (&ge;10 chars)
- High-priority items require reviewer verification

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
- Admin approval required before posting

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
