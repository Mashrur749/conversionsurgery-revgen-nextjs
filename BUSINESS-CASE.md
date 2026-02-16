# ConversionSurgery - Complete Business Case & Feature Specification

## Product Overview

**ConversionSurgery** is a revenue recovery system for home service contractors (plumbers, electricians, HVAC, roofers, landscapers, etc.) that automatically captures, engages, and converts leads via SMS and AI.

**Business Model:** Managed service — the platform operator (admin) runs the system on behalf of clients. Contractors get a hands-off experience with bi-weekly reports proving ROI.

**Price:** $997/month (Professional plan)

**Core Value Proposition:** "Stop losing $50K+/year to missed calls and forgotten follow-ups"

---

## Target Customer

**Who:** Established contractors doing $500K-$3M+ annually

**Pain Points:**

- Miss 40-60% of incoming calls (on job sites, can't answer)
- Forget to follow up on estimates (busy, no system)
- Lose revenue to faster-responding competitors
- No time to manually text every lead
- Invoices go unpaid without reminders

**Why They Pay $997/month:**

- One recovered job pays for 6-12 months of service
- Time saved = 10+ hours/week on manual follow-up
- Professional image (instant responses)
- Peace of mind (nothing falls through cracks)

---

## System Actors

| Actor            | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| **Admin (You)**  | Platform operator. Manages all clients, billing, optimization, system config |
| **Agency Staff** | Admin team members managing client accounts via the dashboard view           |
| **Client**       | Contractor business. Has a solo contractor portal for self-service           |
| **Team Member**  | Client's employee with limited access (escalation claims, notifications)     |
| **Lead**         | Homeowner/customer who contacts the contractor                               |

---

## Implementation Status Key

All features are marked **[LIVE]** — fully implemented and working.

---

# COMPLETE FEATURE SPECIFICATION

## 1. ADMIN CAPABILITIES

### 1.1 Admin Authentication

| Feature            | Status | Behavior                                                                            |
| ------------------ | ------ | ----------------------------------------------------------------------------------- |
| Admin login        | [LIVE] | Email magic link via Resend (NextAuth v4)                                           |
| Session management | [LIVE] | Secure sessions with `isAdmin` flag on user record                                  |
| Admin access check | [LIVE] | `session.user.isAdmin` checked on all admin routes, 403 if not admin                |
| Role-based access  | [LIVE] | Super admin vs admin distinction. Sensitive routes gated with `requireSuperAdmin()` |

### 1.2 Client Management

| Feature            | Status | Behavior                                                                           |
| ------------------ | ------ | ---------------------------------------------------------------------------------- |
| Create client      | [LIVE] | 5-step wizard: business info, phone, team, hours, review & launch                  |
| Edit client        | [LIVE] | Inline form on client detail page                                                  |
| Delete client      | [LIVE] | Soft delete (status='cancelled') with confirmation dialog                          |
| View client list   | [LIVE] | Filterable table with status badges, phone assignment status                       |
| Client detail view | [LIVE] | ROI dashboard, phone, team, usage, feature toggles, actions                        |
| Setup wizard       | [LIVE] | Business Info -> Phone Number -> Team Members -> Business Hours -> Review & Launch |

### 1.3 Phone Number Management (Twilio)

| Feature                  | Status | Behavior                                                                         |
| ------------------------ | ------ | -------------------------------------------------------------------------------- |
| Search available numbers | [LIVE] | Search by area code, mock numbers in development                                 |
| Purchase number          | [LIVE] | Purchase from Twilio and auto-assign to client                                   |
| Assign existing number   | [LIVE] | Assign pre-owned Twilio number                                                   |
| Release number           | [LIVE] | Clear webhooks and pause client                                                  |
| View all numbers         | [LIVE] | Central console at /admin/phone-numbers                                          |
| Reassign across clients  | [LIVE] | Bulk reassignment support                                                        |
| Twilio account overview  | [LIVE] | Balance, owned numbers, assigned/available counts                                |
| Number assignment        | [LIVE] | Multi-number support via junction table, backward-compatible with `twilioNumber` |
| Webhook auto-config      | [LIVE] | Auto-configures SMS + Voice webhook URLs on purchase and assign                  |

### 1.4 Admin Dashboard

| Feature                 | Status | Behavior                                               |
| ----------------------- | ------ | ------------------------------------------------------ |
| Client overview         | [LIVE] | Total clients, active/pending breakdown, status colors |
| 7-day lead metrics      | [LIVE] | Missed calls, forms, messages, follow-ups              |
| Action items per client | [LIVE] | Clients needing attention with quick links             |
| Quick actions           | [LIVE] | Create client, manage numbers, view reports            |

### 1.5 Platform Health Analytics

| Feature             | Status | Behavior                             |
| ------------------- | ------ | ------------------------------------ |
| MRR tracking        | [LIVE] | Monthly recurring revenue with trend |
| Churn rate          | [LIVE] | Active subscription cancellations    |
| Active client count | [LIVE] | Subscriptions by status              |
| Gross margin        | [LIVE] | Revenue vs API costs                 |
| Health indicators   | [LIVE] | Platform-wide performance dashboard  |
| Funnel visualization | [LIVE] | Lead funnel with per-stage conversion rates (30 days) |
| Cohort retention     | [LIVE] | Monthly cohort analysis at 1/2/3/6/12 month milestones |

### 1.6 Billing Administration

| Feature                 | Status | Behavior                                                                          |
| ----------------------- | ------ | --------------------------------------------------------------------------------- |
| View all subscriptions  | [LIVE] | List with status, plan, amount, billing date                                      |
| Subscription management | [LIVE] | Pause, resume, cancel via Stripe                                                  |
| MRR with trend          | [LIVE] | Month-over-month change calculation                                               |
| Trial tracking          | [LIVE] | Count of clients in trial period                                                  |
| Failed payments         | [LIVE] | Clients with payment issues                                                       |
| Churn rate              | [LIVE] | Percentage cancelled this month                                                   |
| Plan management         | [LIVE] | Full CRUD at /admin/billing/plans with features, pricing, Stripe fields           |
| Overage configuration   | [LIVE] | Plan features editor supports quotas, per-lead/per-SMS overage pricing            |
| Coupon management       | [LIVE] | Create/edit/deactivate coupons with % discount, date limits, usage caps           |
| Invoice retry           | [LIVE] | Client-initiated retry for failed/uncollectible invoice payments                  |
| Usage enforcement       | [LIVE] | Lead, team member, and phone number creation gated by plan limits                 |

### 1.7 Flow Template Management

| Feature             | Status | Behavior                                                              |
| ------------------- | ------ | --------------------------------------------------------------------- |
| Create template     | [LIVE] | Multi-step message sequences                                          |
| Edit template       | [LIVE] | Modify steps, delays, conditions                                      |
| Publish template    | [LIVE] | Make available to all clients                                         |
| Push to client      | [LIVE] | Assign template to specific clients                                   |
| Delete template     | [LIVE] | Remove template                                                       |
| Template analytics  | [LIVE] | Usage across clients, performance metrics                             |
| Template versioning | [LIVE] | Version history, publish with change notes                            |
| Clone template      | [LIVE] | POST /api/admin/flow-templates/[id]/clone duplicates template + steps |

### 1.8 A/B Testing & Template Optimization

| Feature                     | Status | Behavior                                                  |
| --------------------------- | ------ | --------------------------------------------------------- |
| Create A/B test             | [LIVE] | Test types: messaging, timing, team, sequence             |
| Per-variant metrics         | [LIVE] | Delivery rate, engagement rate, conversion rate           |
| Winner determination        | [LIVE] | Auto-calculates best performing variant                   |
| Test lifecycle              | [LIVE] | active -> paused -> completed -> archived                 |
| Aggregate template testing  | [LIVE] | Test templates across ALL clients for faster significance |
| Template variant management | [LIVE] | Create, compare, and roll out variants                    |
| One-click rollout           | [LIVE] | Assign winning variant to 5+ clients at once              |
| Date range filtering        | [LIVE] | 7/30/90 day performance windows                           |

### 1.9 Reports

| Feature            | Status | Behavior                                                |
| ------------------ | ------ | ------------------------------------------------------- |
| Generate report    | [LIVE] | Bi-weekly, monthly, or custom date range                |
| Per-client reports | [LIVE] | Select client + date range                              |
| Metrics included   | [LIVE] | ROI summary, daily performance, A/B results, team stats |
| Report history     | [LIVE] | List and view past reports                              |

### 1.10 Agency Communications

| Feature                   | Status | Behavior                       |
| ------------------------- | ------ | ------------------------------ |
| Admin -> client messaging | [LIVE] | In-app message channel         |
| Message categories        | [LIVE] | Custom, action prompts, alerts |
| Weekly digest generation  | [LIVE] | Performance summary emails     |
| Urgency flags             | [LIVE] | Priority levels on messages    |
| Expiration dates          | [LIVE] | Up to 168 hours                |

### 1.11 Usage & Cost Tracking

| Feature                   | Status | Behavior                                                                    |
| ------------------------- | ------ | --------------------------------------------------------------------------- |
| Per-client cost breakdown | [LIVE] | OpenAI + Twilio costs per client per month                                  |
| Usage alerts              | [LIVE] | Threshold-based alerts when limits exceeded                                 |
| Alert acknowledgment      | [LIVE] | Admin can acknowledge and dismiss alerts                                    |
| API cost accounting       | [LIVE] | Tracks: OpenAI tokens, Twilio SMS/voice/numbers, Stripe fees, Google Places |
| Cost projections          | [LIVE] | Current month usage + projected total                                       |

### 1.12 Reputation Monitoring

| Feature                  | Status | Behavior                                       |
| ------------------------ | ------ | ---------------------------------------------- |
| Review aggregation       | [LIVE] | Per-client average ratings                     |
| Review source tracking   | [LIVE] | Google, Yelp, Facebook, etc.                   |
| Post responses to Google | [LIVE] | Google Business Profile API                    |
| Auto review response     | [LIVE] | AI drafts + auto-posting via cron every 30 min       |
| Review fetching          | [LIVE] | Hourly sync via main cron route                      |
| Google OAuth management  | [LIVE] | Connect/disconnect/reconnect with status indicator   |
| Google Place ID search   | [LIVE] | Admin endpoint for searching Google Places by name   |

### 1.13 Voice AI Configuration

| Feature                   | Status | Behavior                                                 |
| ------------------------- | ------ | -------------------------------------------------------- |
| Enable/disable per client | [LIVE] | `voiceEnabled` flag                                      |
| Voice mode                | [LIVE] | after_hours, always, manual                              |
| Custom greeting           | [LIVE] | Configurable text per client                             |
| Call history              | [LIVE] | Voice call records with duration, status, transcript     |
| AI voice synthesis        | [LIVE] | ElevenLabs TTS integration with voice picker and preview |

### 1.14 Compliance Dashboard

| Feature                 | Status | Behavior                                  |
| ----------------------- | ------ | ----------------------------------------- |
| Consent record tracking | [LIVE] | Active consents with source and scope     |
| Opt-out rate            | [LIVE] | 30-day opt-out percentage                 |
| DNC list management     | [LIVE] | Internal do-not-contact list              |
| Compliance score        | [LIVE] | 0-100 score based on risk factors         |
| Messages blocked        | [LIVE] | 30-day blocked message count with reasons |
| Audit log               | [LIVE] | Every compliance decision logged          |

### 1.15 Support Discussions

| Feature          | Status | Behavior                              |
| ---------------- | ------ | ------------------------------------- |
| Support threads  | [LIVE] | Client creates ticket, admin responds |
| Status filtering | [LIVE] | Open/resolved                         |
| Reply management | [LIVE] | Threaded conversation on each ticket  |

### 1.16 User Management

| Feature           | Status | Behavior                                          |
| ----------------- | ------ | ------------------------------------------------- |
| View all users    | [LIVE] | List with email, creation date, client assignment |
| Admin flag toggle | [LIVE] | Promote/demote admin access                       |
| Client assignment | [LIVE] | Link user to specific client                      |

### 1.17 Platform Settings

| Feature              | Status | Behavior                                                              |
| -------------------- | ------ | --------------------------------------------------------------------- |
| System settings      | [LIVE] | Admin CRUD at /admin/settings with key-value editor                   |
| API key management   | [LIVE] | Create/revoke API keys per client with scopes, SHA-256 hashed storage |
| Webhook logs         | [LIVE] | Admin viewer with filtering, SMS/voice events logged                  |
| Email templates      | [LIVE] | Admin CRUD editor with variable interpolation and live preview        |
| Client webhooks      | [LIVE] | HMAC-signed webhook dispatch to client URLs with retry and logging    |
| Quiet hours defaults | [LIVE] | CRTC-compliant 9pm-10am enforced platform-wide                        |

---

## 2. CLIENT CAPABILITIES

The platform provides two client interfaces:

### Client Access Paths

| Path                                 | For                            | Auth Method                                          |
| ------------------------------------ | ------------------------------ | ---------------------------------------------------- |
| **Agency Staff View** (`/dashboard`) | Team members managing accounts | NextAuth session (`session.user` + `session.client`) |
| **Solo Contractor View** (`/client`) | Independent contractors        | Cookie-based `getClientSession()`                    |

### 2.1 Client Authentication

| Feature             | Status | Behavior                                             |
| ------------------- | ------ | ---------------------------------------------------- |
| Magic link login    | [LIVE] | Email via Resend, no password needed                 |
| Link expiration     | [LIVE] | 15 minutes                                           |
| Session persistence | [LIVE] | 30-day sessions                                      |
| Logout              | [LIVE] | Clear session, return to login                       |
| Claim flow          | [LIVE] | Token-based claim for escalated leads (team members) |

### 2.2 Client Dashboard

| Feature           | Status | Behavior                                                                                            |
| ----------------- | ------ | --------------------------------------------------------------------------------------------------- |
| Agency dashboard  | [LIVE] | 7-day metrics: missed calls, forms, messages, follow-ups, scheduled                                 |
| Solo dashboard    | [LIVE] | Month-to-date: leads, messages, appointments, upcoming appointments                                 |
| Action items      | [LIVE] | Leads needing attention with links                                                                  |
| Revenue recovered | [LIVE] | ROI dashboard on admin client detail + client /revenue page with pipeline, speed, service breakdown |

### 2.3 Lead Management (CRM)

| Feature              | Status | Behavior                                                                   |
| -------------------- | ------ | -------------------------------------------------------------------------- |
| Lead list view       | [LIVE] | Paginated table with sortable columns (createdAt, updatedAt, score)        |
| Lead detail view     | [LIVE] | Contact info, conversation tabs, media, scheduled messages, inline editing |
| Lead status update   | [LIVE] | Mark won/lost/contacted/action_required                                    |
| Lead scoring         | [LIVE] | Automatic 0-100 score (quick pattern + full AI) with temperature           |
| Lead source tracking | [LIVE] | Missed call, inbound SMS, web form, manual                                 |
| Lead filters         | [LIVE] | Status, source, temperature, client (admin), date range                    |
| Lead search          | [LIVE] | Debounced search by name, phone, email (case-insensitive)                  |
| Create lead manually | [LIVE] | POST /api/leads + CreateLeadDialog on leads page                           |
| Edit lead details    | [LIVE] | Inline editing: status, temperature, notes, project type, quote value      |
| Bulk actions         | [LIVE] | Multi-select checkboxes with bulk status change                            |
| Export leads CSV     | [LIVE] | GET /api/leads/export with filter passthrough                              |

### 2.4 Conversation View

| Feature               | Status | Behavior                                                                 |
| --------------------- | ------ | ------------------------------------------------------------------------ |
| Full thread           | [LIVE] | All messages in chronological order                                      |
| Message direction     | [LIVE] | Clear inbound vs outbound indication                                     |
| AI vs human indicator | [LIVE] | Message type distinguishes AI-generated                                  |
| Timestamps            | [LIVE] | Per-message timestamps                                                   |
| Send reply            | [LIVE] | SMS reply form (max 1600 chars) with compliance check                    |
| MMS attachments       | [LIVE] | View received images/documents                                           |
| AI suggestions        | [LIVE] | API generates response suggestions (assist mode)                         |
| Conversation mode     | [LIVE] | Switch between AI, human, paused modes                                   |
| Human takeover        | [LIVE] | Take over from AI, hand back when done                                   |
| Quick replies         | [LIVE] | Template picker dropdown with common responses, populates reply textarea |
| Send photos           | [LIVE] | Outbound MMS via compliance gateway with mediaUrl                        |
| Read receipts         | [LIVE] | Twilio delivery status callbacks tracked                                 |
| Conversation notes    | [LIVE] | Lead-level notes field editable on lead detail page                      |
| Conversation tags     | [LIVE] | Add/remove tags on leads, visible in list                                |

### 2.5 Escalation Queue

| Feature          | Status | Behavior                                                        |
| ---------------- | ------ | --------------------------------------------------------------- |
| Escalation list  | [LIVE] | Queue of conversations needing human attention                  |
| Status filtering | [LIVE] | Pending, assigned, resolved                                     |
| Claim/assign     | [LIVE] | Team members claim via token-based SMS link                     |
| Resolve          | [LIVE] | Mark escalation as resolved                                     |
| Takeover         | [LIVE] | Human takes over from AI mid-conversation                       |
| Escalation rules | [LIVE] | Configurable triggers per client                                |
| Hot transfer     | [LIVE] | High-intent leads immediately ring team (within business hours) |

### 2.6 Automated Flows

| Feature                 | Status | Behavior                                                              |
| ----------------------- | ------ | --------------------------------------------------------------------- |
| Scheduled messages list | [LIVE] | View pending messages with send time and sequence type                |
| Flow templates          | [LIVE] | Admin creates and pushes templates to clients                         |
| Cron processing         | [LIVE] | Scheduled messages sent by cron every 5 minutes                       |
| Exit on reply           | [LIVE] | Flow paused when lead replies                                         |
| Exit on opt-out         | [LIVE] | Flow cancelled on STOP                                                |
| Client flow management  | [LIVE] | Client self-service at /client/flows with toggle on/off per flow      |
| Per-lead flow status    | [LIVE] | Lead detail sidebar shows active/paused flow executions with progress |

**Flow Types Implemented:**
| Flow | Trigger | Status | Steps |
|------|---------|--------|-------|
| Missed Call | Call not answered | [LIVE] | Immediate SMS via compliance gateway |
| Appointment Reminder | Appointment scheduled | [LIVE] | Day-before at 10am + 2-hours-before |
| No-Show Recovery | No-show detected (2hr+ past) | [LIVE] | AI-personalized follow-up, then 2nd attempt 2 days later |
| Win-Back | Lead stale 25-35 days | [LIVE] | AI-personalized re-engagement, 2nd attempt 20-30 days later |
| Estimate Follow-up | Estimate sent | [LIVE] | Configurable delay follow-ups |
| Payment Reminder | Payment pending | [LIVE] | Multiple attempts, Stripe payment links |
| Review Request | Job completed | [LIVE] | AI-personalized review request |
| Form Response | Web form submitted | [LIVE] | Auto-response SMS via compliance gateway |

### 2.7 Knowledge Base

| Feature                   | Status | Behavior                                                                      |
| ------------------------- | ------ | ----------------------------------------------------------------------------- |
| Structured interview form | [LIVE] | Guided form with sections: services, FAQs, don't do, never say                |
| Industry presets          | [LIVE] | 5 presets: plumbing, HVAC, electrical, roofing, general contractor            |
| Service catalog sync      | [LIVE] | Structured form auto-syncs to client_services table                           |
| Knowledge base entries    | [LIVE] | Category-based entries (faq, service, policy, hours, etc.)                    |
| AI context integration    | [LIVE] | All KB data available to AI via buildAIContext()                              |
| Knowledge gap tracking    | [LIVE] | AI logs when it lacks information to answer                                   |
| Client-side KB editing    | [LIVE] | Client portal at /client/knowledge with full CRUD (add, edit, delete entries) |

### 2.8 Team Management

| Feature               | Status | Behavior                                               |
| --------------------- | ------ | ------------------------------------------------------ |
| Team member list      | [LIVE] | View all members with name, email, phone, role, status |
| Add team member       | [LIVE] | Form with email, phone, role validation                |
| Edit team member      | [LIVE] | Update info and role                                   |
| Deactivate member     | [LIVE] | Set inactive (no hard delete)                          |
| Roles                 | [LIVE] | Manager, agent, specialist                             |
| Business hours config | [LIVE] | Per-day open/close times                               |
| Notification routing  | [LIVE] | Team members get escalation SMS/email alerts           |

### 2.9 Notifications

| Feature                   | Status | Behavior                                                                            |
| ------------------------- | ------ | ----------------------------------------------------------------------------------- |
| New lead alert            | [LIVE] | SMS/email notification                                                              |
| Escalation alert          | [LIVE] | SMS with claim link to team members                                                 |
| Weekly summary            | [LIVE] | Performance metrics email                                                           |
| Notification channels     | [LIVE] | SMS and email configurable separately                                               |
| Per-notification settings | [LIVE] | Toggle: new leads, escalations, summaries, flow approvals, negative reviews         |
| Quiet hours               | [LIVE] | Start/end time, urgent override                                                     |
| Daily summary email       | [LIVE] | Morning email with yesterday's stats, leads needing attention, today's appointments |

### 2.10 Settings

| Feature                  | Status | Behavior                                                                             |
| ------------------------ | ------ | ------------------------------------------------------------------------------------ |
| Business profile         | [LIVE] | View business name, owner, email, phone (read-only for clients)                      |
| Notification preferences | [LIVE] | Full SMS/email toggle configuration                                                  |
| Business hours           | [LIVE] | Per-day on/off with open/close times                                                 |
| Weekly summary settings  | [LIVE] | Enable/disable, preferred day and time                                               |
| AI settings              | [LIVE] | Admin + client self-service: tone, emojis, goals, quiet hours at /client/settings/ai |
| Feature toggles          | [LIVE] | Admin full control + client self-service safe subset at /client/settings/features    |

### 2.11 Billing (Solo Contractor View)

| Feature             | Status | Behavior                                                                      |
| ------------------- | ------ | ----------------------------------------------------------------------------- |
| Current plan        | [LIVE] | Plan name, price, billing cycle dates                                         |
| Invoice history     | [LIVE] | Past invoices with status and amounts                                         |
| Payment method      | [LIVE] | Card on file, add new method                                                  |
| Upgrade plan        | [LIVE] | Plan selector with monthly/annual pricing                                     |
| Cancel subscription | [LIVE] | Multi-step cancellation flow with value retention                             |
| Usage metrics       | [LIVE] | Messages sent, leads processed                                                |
| Cancellation flow   | [LIVE] | Value summary -> reason selection -> confirmation -> optional call scheduling |

### 2.12 Analytics (Client View)

| Feature               | Status | Behavior                                |
| --------------------- | ------ | --------------------------------------- |
| Lead metrics          | [LIVE] | Total leads, by source, conversion rate |
| Response metrics      | [LIVE] | Average response time distribution      |
| Revenue attribution   | [LIVE] | Estimated revenue from recovered leads  |
| Trend charts          | [LIVE] | Month-by-month performance              |
| Funnel view           | [LIVE] | new -> contacted -> estimate -> won     |
| Lead source breakdown | [LIVE] | Pie chart by source                     |
| Export analytics      | [LIVE] | CSV/JSON export                         |

### 2.13 Help & Support

| Feature            | Status | Behavior                                                           |
| ------------------ | ------ | ------------------------------------------------------------------ |
| Help button        | [LIVE] | Floating button on all non-admin pages, opens support ticket modal |
| Discussion threads | [LIVE] | Client creates ticket, admin responds, threaded replies            |
| Help articles      | [LIVE] | Admin editor + client-facing help center with search               |

### 2.14 Client ROI Dashboard (Admin View per Client)

| Feature                 | Status | Behavior                                                          |
| ----------------------- | ------ | ----------------------------------------------------------------- |
| Revenue pipeline        | [LIVE] | Total pipeline + confirmed value (30 days)                        |
| Month-over-month change | [LIVE] | Pipeline trend vs previous period                                 |
| Response time           | [LIVE] | Average with industry benchmark (42 min) comparison               |
| Speed improvement       | [LIVE] | Before/after CS comparison when `previousResponseTimeMinutes` set |
| Speed multiplier        | [LIVE] | "54x faster than industry average"                                |
| Missed calls captured   | [LIVE] | 30-day count                                                      |
| Appointments booked     | [LIVE] | 30-day count                                                      |
| Leads re-engaged        | [LIVE] | Win-back re-engagement count                                      |
| ROI multiplier          | [LIVE] | Won value / $997 investment                                       |
| Revenue by service      | [LIVE] | Per-service breakdown when multi-service catalog populated        |

### 2.15 Calendar Integration

| Feature               | Status | Behavior                                         |
| --------------------- | ------ | ------------------------------------------------ |
| Google Calendar OAuth | [LIVE] | Connect/disconnect, token refresh                |
| Calendar sync cron    | [LIVE] | Periodic sync job                                |
| Event creation        | [LIVE] | Calendar events created automatically on booking |

### 2.16 Payment Collection

| Feature                  | Status | Behavior                                |
| ------------------------ | ------ | --------------------------------------- |
| Stripe payment links     | [LIVE] | Generate payment link for invoice       |
| Deposit links            | [LIVE] | Partial payment (configurable %)        |
| SMS payment notification | [LIVE] | Send payment link to lead via SMS       |
| Payment success handling | [LIVE] | Updates invoice, notifies both parties  |
| Payment success page     | [LIVE] | Confirmation page after Stripe checkout |

---

## 3. LEAD EXPERIENCE (Homeowner)

### 3.1 Inbound Contact

| Scenario                        | Status | Behavior                                                    |
| ------------------------------- | ------ | ----------------------------------------------------------- |
| Lead calls, contractor answers  | N/A    | Normal call (system not involved)                           |
| Lead calls, no answer           | [LIVE] | Immediate SMS via compliance gateway, consent auto-recorded |
| Lead texts first                | [LIVE] | AI responds within seconds (LangGraph agent or legacy)      |
| Lead submits web form           | [LIVE] | Form webhook creates lead, sends auto-response SMS          |
| High-intent call (within hours) | [LIVE] | Hot transfer: ring group connects lead to team immediately  |
| High-intent call (after hours)  | [LIVE] | "We'll call first thing tomorrow" + team notification       |

### 3.2 AI Conversation

| Feature                | Status | Behavior                                                    |
| ---------------------- | ------ | ----------------------------------------------------------- |
| Instant response       | [LIVE] | Reply within 5-30 seconds                                   |
| Contextual             | [LIVE] | Knows business name, services, hours, policies via KB       |
| Goal-oriented          | [LIVE] | Pursues booking/estimate through goal hierarchy             |
| Multi-turn             | [LIVE] | Maintains state across messages (LangGraph state machine)   |
| Natural language       | [LIVE] | Configurable tone: professional, friendly, casual           |
| Escalation             | [LIVE] | Escalates on frustration, complex questions, low confidence |
| Time-aware             | [LIVE] | Different behavior in/out of business hours                 |
| Signal detection       | [LIVE] | Urgency, budget, intent, sentiment scored 0-100             |
| Harassment prevention  | [LIVE] | Stops after 2+ consecutive messages without reply           |
| Guardrails             | [LIVE] | 10 hard rules enforced in every AI prompt                   |
| Booking conversation   | [LIVE] | Detects booking intent, offers available slots, confirms    |
| Photo requests         | [LIVE] | Can request and receive MMS photos for estimates            |
| Service classification | [LIVE] | AI matches lead's project to client's service catalog       |

### 3.3 AI Guardrails (10 Rules)

Every AI response is governed by these absolute rules:

1. **Knowledge boundaries** — Don't guess. Defer to owner if not in KB
2. **No promises** — Never promise specific pricing, timelines, guarantees
3. **No professional advice** — No medical/legal/financial/safety advice
4. **Honesty** — Be transparent about being AI if asked
5. **Privacy** — Never reference other customers
6. **No pressure** — No urgency/scarcity tactics
7. **No real-world claims** — Can't reference weather, news, current events
8. **Opt-out respect** — Treat ANY desire to stop as a STOP keyword
9. **Pricing** — Either share ranges OR defer to owner (configurable per client)
10. **Stay in lane** — Represent business only, no competitor commentary

### 3.4 Example Conversation Flow

```
Lead: "Hi, do you do kitchen remodels?"
AI: "Hi! Yes, we specialize in kitchen remodels. I'm Sarah from ABC Contractors.
     Are you looking for a full remodel or specific updates? And what's your
     timeline looking like?"

Lead: "Full remodel, probably in the next 2-3 months"
AI: "Perfect timing! Full kitchen remodels are our specialty. To give you an
     accurate estimate, we'd need to see the space. Would you prefer an
     in-person visit or can you send some photos first?"

Lead: "Can someone come by this week?"
AI: "Absolutely! We have openings Thursday afternoon or Friday morning.
     Which works better for you?"

Lead: "Thursday works"
AI: "Great! Thursday afternoon it is. What's the best address for the
     estimate visit? And a name for our records?"
```

### 3.5 Conversational Booking

| Feature                    | Status | Behavior                                                                    |
| -------------------------- | ------ | --------------------------------------------------------------------------- |
| Intent detection           | [LIVE] | Keyword + context-aware: book, reschedule, cancel, select_slot, check_later |
| Available slot check       | [LIVE] | Queries business hours + existing appointments for next 7 days              |
| Slot suggestions           | [LIVE] | Offers 2-3 slots spread across different days, prefers mid-morning          |
| Time preference extraction | [LIVE] | AI matches "next Tuesday morning" to actual available slot                  |
| Direct booking             | [LIVE] | If lead specifies available time, books immediately                         |
| Rescheduling               | [LIVE] | Cancels old appointment, offers new slots                                   |
| Cancellation               | [LIVE] | Cancels with grace message                                                  |
| Contractor notification    | [LIVE] | Immediate SMS to contractor with lead details                               |
| Both-party reminders       | [LIVE] | Day-before + 2-hour-before for both lead and contractor                     |

### 3.6 Opt-Out Handling

| Scenario          | Status | Behavior                                                                   |
| ----------------- | ------ | -------------------------------------------------------------------------- |
| Lead texts "STOP" | [LIVE] | Immediate confirmation, all messaging stops, lead marked opted_out         |
| STOP variants     | [LIVE] | Recognizes: STOP, UNSUBSCRIBE, CANCEL, END, QUIT, STOPALL, OPT OUT, REMOVE |
| Lead re-opts in   | [LIVE] | Can text START, YES, UNSTOP, SUBSCRIBE, OPTIN to resume                    |
| Opted-out lead    | [LIVE] | All automations cancelled, reply form disabled, compliance gateway blocks  |

### 3.7 Quiet Hours

| Feature              | Status | Behavior                                                              |
| -------------------- | ------ | --------------------------------------------------------------------- |
| CRTC compliance      | [LIVE] | No messages 9 PM - 10 AM (Canadian regulation)                        |
| Queue on quiet hours | [LIVE] | Messages queued for next available window if `queueOnQuietHours=true` |
| Timezone respect     | [LIVE] | Based on client timezone configuration                                |

---

## 4. AUTOMATED SEQUENCES

### 4.1 Missed Call Sequence

| Step | Timing       | Status | Behavior                                                            |
| ---- | ------------ | ------ | ------------------------------------------------------------------- |
| 1    | Immediate    | [LIVE] | SMS via compliance gateway, consent auto-recorded from inbound call |
| 2+   | Configurable | [LIVE] | Follow-up via flow template if enabled                              |
| Exit |              | [LIVE] | Lead replies OR opts out OR booked                                  |

### 4.2 Appointment Reminder Sequence

| Step | Timing             | Status | Behavior                                    |
| ---- | ------------------ | ------ | ------------------------------------------- |
| 1    | Day before at 10am | [LIVE] | Templated reminder with appointment details |
| 2    | 2 hours before     | [LIVE] | "See you today" confirmation                |
| Exit |                    | [LIVE] | Appointment completed OR cancelled          |

### 4.3 No-Show Recovery Sequence

| Step      | Timing                    | Status | Behavior                                                    |
| --------- | ------------------------- | ------ | ----------------------------------------------------------- |
| Detection | 2+ hours past appointment | [LIVE] | Cron detects appointments still 'scheduled' past time       |
| 1         | Same day                  | [LIVE] | AI-personalized warm follow-up, references specific project |
| 2         | 2 days later              | [LIVE] | AI-generated shorter/casual message with easy out           |
| Exit      |                           | [LIVE] | Lead replies OR 2 attempts reached                          |

### 4.4 Win-Back Sequence

| Step          | Timing                        | Status | Behavior                                                     |
| ------------- | ----------------------------- | ------ | ------------------------------------------------------------ |
| Detection     | 25-35 days stale (randomized) | [LIVE] | Cron finds 'contacted' leads with no recent messages         |
| Timing window | Weekdays 10am-2pm only        | [LIVE] | Never Monday before 11am, never Friday after 1pm             |
| 1             | When detected                 | [LIVE] | AI-personalized human-like re-engagement referencing project |
| 2             | 20-30 days later (randomized) | [LIVE] | Final soft "still here if you need us" message               |
| Exit          |                               | [LIVE] | Lead replies OR 2 attempts -> mark dormant                   |

**Win-back tone rules:**

- Sound like a real person texting, not a marketer
- Reference their specific project naturally
- Give easy out ("no rush", "whenever you're ready")
- NEVER mention how long it's been
- NEVER use "just checking in"
- NEVER use urgency/scarcity language
- NEVER reference weather or unverifiable claims

### 4.5 Estimate Follow-Up Sequence

| Step | Timing       | Status | Behavior                                   |
| ---- | ------------ | ------ | ------------------------------------------ |
| 1    | Day 1        | [LIVE] | Follow-up on sent estimate                 |
| 2+   | Configurable | [LIVE] | Subsequent follow-ups via flow template    |
| Exit |              | [LIVE] | Lead replies OR opts out OR status changed |

### 4.6 Payment Reminder Sequence

| Step | Timing       | Status | Behavior                          |
| ---- | ------------ | ------ | --------------------------------- |
| 1    | Due date     | [LIVE] | Reminder with Stripe payment link |
| 2+   | Configurable | [LIVE] | Escalating reminders              |
| Exit |              | [LIVE] | Invoice paid OR opted out         |

### 4.7 Review Request Sequence

| Step | Timing               | Status | Behavior                                 |
| ---- | -------------------- | ------ | ---------------------------------------- |
| 1    | After job completion | [LIVE] | AI-personalized review request with link |
| Exit |                      | [LIVE] | Review submitted OR opted out            |

---

## 5. AI AGENT BEHAVIOR

### 5.1 Architecture

The AI agent uses a **LangGraph state machine** with three nodes:

1. **Analyze** — Extract signals (urgency, budget, intent, sentiment) from message
2. **Decide** — Route to action based on analysis + conversation state
3. **Respond** — Generate response using full context pipeline

### 5.2 Operating Modes

| Mode           | Status | Behavior                                             |
| -------------- | ------ | ---------------------------------------------------- |
| **Off**        | [LIVE] | No AI responses, human handles all                   |
| **Assist**     | [LIVE] | AI generates suggestions, human approves before send |
| **Autonomous** | [LIVE] | AI sends responses automatically via LangGraph agent |

### 5.3 AI Context Pipeline

Every AI generation assembles a standard context bundle (`buildAIContext()`):

| Layer          | Content                                                                  |
| -------------- | ------------------------------------------------------------------------ |
| Lead           | Name, phone, source, stage, sentiment, signals, project info, objections |
| Conversation   | Last N messages (role + content)                                         |
| Business       | Name, owner, timezone, business hours status                             |
| Agent settings | Tone, max length, primary goal, booking aggressiveness, pricing rules    |
| Knowledge      | Full KB + relevant search results                                        |
| Time context   | Time of day, day of week, season                                         |
| Compliance     | Consent type, message count, opt-out status                              |

### 5.4 Goal Hierarchy

The AI always pursues these goals in order:

1. **Understand need** — What does the lead want?
2. **Qualify** — Is this a real opportunity?
3. **Book** — Schedule estimate or appointment
4. **Collect info** — Name, address, project details
5. **Handle objections** — Price concerns, timing, competition

### 5.5 Agent Actions

| Action                 | Status | Behavior                             |
| ---------------------- | ------ | ------------------------------------ |
| respond                | [LIVE] | Generate and send AI reply           |
| book_appointment       | [LIVE] | Conversational booking flow          |
| send_quote             | [LIVE] | Generate quote message               |
| request_photos         | [LIVE] | Ask for photos/images                |
| escalate               | [LIVE] | Hand off to team member              |
| trigger_flow           | [LIVE] | Start automated sequence             |
| close_won / close_lost | [LIVE] | End conversation with status         |
| wait                   | [LIVE] | Don't respond, wait for next message |
| send_payment           | [LIVE] | Send payment link                    |

### 5.6 Escalation Triggers

| Trigger                           | Status | Behavior                       |
| --------------------------------- | ------ | ------------------------------ |
| Pricing with specific numbers     | [LIVE] | Humans handle quotes           |
| Complaints / angry tone           | [LIVE] | Detected via sentiment scoring |
| Complex technical questions       | [LIVE] | Beyond KB knowledge            |
| AI confidence < 60%               | [LIVE] | Low KB match count             |
| 3+ exchanges without progress     | [LIVE] | Stuck detection                |
| Lead requests human               | [LIVE] | "Can I talk to a person?"      |
| High-intent within business hours | [LIVE] | Hot transfer via ring group    |

### 5.7 Signal Detection & Lead Scoring

| Signal             | Status | Detection Method                                                   |
| ------------------ | ------ | ------------------------------------------------------------------ |
| Urgency            | [LIVE] | Keywords: ASAP, emergency, leak, broken, damage, insurance claim   |
| Budget             | [LIVE] | Keywords: money not issue, budget ready, approved, how much, price |
| Intent             | [LIVE] | Keywords: ready to start, let's proceed, interested, just looking  |
| Sentiment          | [LIVE] | AI analysis: positive, neutral, negative, frustrated               |
| Competitor mention | [LIVE] | Pattern matching                                                   |
| Timeline mention   | [LIVE] | Pattern matching                                                   |

Lead scoring: Quick score (pattern matching, instant) + Full AI score (GPT-4o-mini analysis, deeper). Score 0-100, temperature: hot/warm/cold.

### 5.8 Multi-Service Catalog & Revenue Attribution

| Feature                    | Status | Behavior                                                                |
| -------------------------- | ------ | ----------------------------------------------------------------------- |
| Per-client service catalog | [LIVE] | Services table with pricing, AI disclosure rules                        |
| AI service classification  | [LIVE] | Fuzzy match projectType to service catalog (high/medium/low confidence) |
| Revenue by service         | [LIVE] | Per-service pipeline and won value breakdown                            |
| Estimated value auto-fill  | [LIVE] | Uses service average value when AI doesn't extract one                  |
| Knowledge gap tracking     | [LIVE] | Logs when AI lacks info to answer a question                            |

---

## 6. COMPLIANCE & LEGAL

### 6.1 Compliance Gateway

All outbound lead-facing SMS passes through a single compliance gateway (`sendCompliantMessage()`).

**Gateway checks (in order):**

1. Monthly message limit
2. Auto-record implied consent (if first contact)
3. Opt-out check
4. DNC check (internal + DNCL)
5. Consent validation
6. Quiet hours enforcement
7. Message category validation
8. Send or queue

### 6.2 CASL/CRTC Compliance (Canada)

| Requirement             | Status | Implementation                              |
| ----------------------- | ------ | ------------------------------------------- |
| Prior consent           | [LIVE] | 4 auto-recording trigger types (see below)  |
| Opt-out honored         | [LIVE] | STOP immediately stops all messaging        |
| Quiet hours             | [LIVE] | 9 PM - 10 AM (CRTC-compliant)               |
| Business identification | [LIVE] | Business name in AI context                 |
| DNC respect             | [LIVE] | Internal DNC list checked before every send |

### 6.3 Consent Auto-Recording

| Trigger               | Consent Type           | Validity                 |
| --------------------- | ---------------------- | ------------------------ |
| Missed call (inbound) | Implied (inquiry)      | 6 months from call       |
| Form submission       | Implied (inquiry)      | 6 months                 |
| Lead SMS reply        | Express written        | Upgraded from implied    |
| Existing customer     | Implied (relationship) | 2 years from transaction |

### 6.4 Consent Tracking

| Data Captured     | Status | Purpose                                                        |
| ----------------- | ------ | -------------------------------------------------------------- |
| Consent timestamp | [LIVE] | When they opted in                                             |
| Consent source    | [LIVE] | web_form, text_optin, phone_recording, existing_customer, etc. |
| Consent scope     | [LIVE] | marketing, transactional, promotional, reminders               |
| Evidence          | [LIVE] | formUrl, recordingUrl, signatureImage, ipAddress, userAgent    |
| Expiration        | [LIVE] | Auto-calculated based on consent type                          |

### 6.5 Opt-Out Keywords

System recognizes: STOP, UNSUBSCRIBE, CANCEL, END, QUIT, STOPALL, OPT OUT, REMOVE

Re-opt-in keywords: START, YES, UNSTOP, SUBSCRIBE, OPTIN

### 6.6 Audit Trail

| Event            | Status | Data Logged                                         |
| ---------------- | ------ | --------------------------------------------------- |
| message_sent     | [LIVE] | To, from, content, timestamp, messageSid            |
| message_blocked  | [LIVE] | Reason (opt-out, DNC, quiet hours, consent expired) |
| message_queued   | [LIVE] | Queued for quiet hours delivery                     |
| opt_out          | [LIVE] | Timestamp, keyword, channel                         |
| consent_recorded | [LIVE] | Source, scope, evidence, expiration                 |
| consent_revoked  | [LIVE] | Timestamp, reason                                   |
| dnc_match        | [LIVE] | Number matched internal DNC list                    |

---

## 7. BILLING & SUBSCRIPTIONS

### 7.1 Plans

| Plan                                                                             | Price     | Included                                |
| -------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| Starter                                                                          | $497/mo   | 100 leads, 1K messages, 2 team members  |
| Professional (the managed service is our sole focus for now, ignore other plans) | $997/mo   | 500 leads, 5K messages, 5 team members  |
| Enterprise                                                                       | $1,997/mo | 2K leads, 20K messages, 20 team members |

Plans support monthly and yearly billing with separate Stripe price IDs.

### 7.2 Overages

| Resource                | Overage Price |
| ----------------------- | ------------- |
| Additional lead         | $0.50         |
| Additional message      | $0.03         |
| Additional team member  | $20/mo        |
| Additional phone number | $15/mo        |
| Voice AI minute         | $0.15         |

### 7.3 Billing Flows

| Flow             | Status | Behavior                                                         |
| ---------------- | ------ | ---------------------------------------------------------------- |
| New subscription | [LIVE] | Stripe checkout, immediate charge                                |
| Monthly renewal  | [LIVE] | Auto-charge on billing date                                      |
| Failed payment   | [LIVE] | Stripe auto-retry + client-initiated retry from billing page     |
| Upgrade          | [LIVE] | Prorated charge via Stripe                                       |
| Downgrade        | [LIVE] | Applied at next billing cycle                                    |
| Cancellation     | [LIVE] | Multi-step flow with value retention, continues until period end |
| Pause/Resume     | [LIVE] | No charges while paused, service suspended                       |
| Coupon codes     | [LIVE] | Discount percentage support                                      |

### 7.4 Stripe Webhook Events Handled

| Event                      | Status |
| -------------------------- | ------ |
| checkout.session.completed | [LIVE] |
| checkout.session.expired   | [LIVE] |
| charge.refunded            | [LIVE] |
| customer.subscription.\*   | [LIVE] |
| invoice.\*                 | [LIVE] |
| payment_method.attached    | [LIVE] |

### 7.5 Trial

| Feature         | Status | Behavior                                                        |
| --------------- | ------ | --------------------------------------------------------------- |
| Trial length    | [LIVE] | Configurable days per plan                                      |
| Trial limits    | [LIVE] | Full access to plan features                                    |
| Trial end       | [LIVE] | Convert to paid or service stops                                |
| Trial reminders | [LIVE] | Automated emails at day 7, 12, 14 via /api/cron/trial-reminders |

---

## 8. INTEGRATIONS

### 8.1 Core Integrations

| Integration         | Status | Purpose                                                                     |
| ------------------- | ------ | --------------------------------------------------------------------------- |
| **Twilio SMS**      | [LIVE] | Inbound/outbound SMS, delivery tracking                                     |
| **Twilio Voice**    | [LIVE] | Call routing, ring groups, hot transfer, missed call detection              |
| **Twilio Numbers**  | [LIVE] | Provisioning, purchase, assign, release                                     |
| **OpenAI**          | [LIVE] | AI conversation (gpt-4o-mini primary), lead scoring, service classification |
| **Stripe Payments** | [LIVE] | Payment links, deposits, invoices                                           |
| **Stripe Billing**  | [LIVE] | Subscriptions, plan management, webhooks                                    |
| **Resend**          | [LIVE] | Magic link auth, lead notifications, escalation alerts, weekly summaries    |

### 8.2 Optional Integrations

| Integration         | Status | Purpose                                           | Feature Flag                  |
| ------------------- | ------ | ------------------------------------------------- | ----------------------------- |
| **Google Calendar** | [LIVE] | OAuth done, sync cron, event creation on booking  | `calendarSyncEnabled`         |
| **Google Business** | [LIVE] | Post review responses, auto-fetch + auto-response | `reputationMonitoringEnabled` |
| **ElevenLabs**      | [LIVE] | TTS service, voice picker, audio preview          | `voiceEnabled`                |

### 8.3 API Cost Tracking

| Service            | Tracked Costs                               |
| ------------------ | ------------------------------------------- |
| OpenAI gpt-4o-mini | $0.00015/1K input, $0.0006/1K output        |
| OpenAI gpt-4o      | $0.0025/1K input, $0.01/1K output           |
| Twilio SMS         | $0.0079 per message                         |
| Twilio Voice       | $0.014 outbound, $0.0085 inbound per minute |
| Twilio Phone       | $1.15 local, $2.15 toll-free per month      |
| Stripe             | 2.9% + $0.30 per transaction                |
| Google Places      | $0.017 per request                          |
| Cloudflare R2      | $0.015/GB storage                           |

---

## 9. FEATURE FLAGS (Client-Level)

Every feature can be toggled per client:

| Flag                          | Default       | Status | Controls                      |
| ----------------------------- | ------------- | ------ | ----------------------------- |
| `missedCallSmsEnabled`        | true          | [LIVE] | Auto-text on missed calls     |
| `aiResponseEnabled`           | true          | [LIVE] | AI generates responses        |
| `aiAgentEnabled`              | true          | [LIVE] | AI conversation agent active  |
| `aiAgentMode`                 | "assist"      | [LIVE] | off / assist / autonomous     |
| `autoEscalationEnabled`       | true          | [LIVE] | Auto-escalate when stuck      |
| `voiceEnabled`                | false         | [LIVE] | Voice AI answering            |
| `voiceMode`                   | "after_hours" | [LIVE] | after_hours / always / manual |
| `flowsEnabled`                | true          | [LIVE] | Automated sequences           |
| `leadScoringEnabled`          | true          | [LIVE] | Auto-score leads              |
| `reputationMonitoringEnabled` | false         | [LIVE] | Google review tracking        |
| `autoReviewResponseEnabled`   | false         | [LIVE] | AI writes review responses    |
| `calendarSyncEnabled`         | false         | [LIVE] | Calendar integration          |
| `hotTransferEnabled`          | false         | [LIVE] | Live call transfers           |
| `paymentLinksEnabled`         | false         | [LIVE] | Send payment links            |
| `photoRequestsEnabled`        | true          | [LIVE] | Request photos from leads     |
| `multiLanguageEnabled`        | false         | [LIVE] | Non-English support           |
| `preferredLanguage`           | "en"          | [LIVE] | Language preference           |
| `notificationEmail`           | true          | [LIVE] | Email notifications           |
| `notificationSms`             | true          | [LIVE] | SMS notifications             |
| `weeklySummaryEnabled`        | true          | [LIVE] | Weekly summary emails         |

---

## 10. CRON JOBS

All jobs are dispatched by the master orchestrator at `/api/cron` (POST, Cloudflare Workers cron).

| Job                  | Schedule       | Status | Purpose                                           |
| -------------------- | -------------- | ------ | ------------------------------------------------- |
| process-scheduled    | Every 5 min    | [LIVE] | Send due scheduled messages (50 per batch)        |
| check-missed-calls   | Every 5 min    | [LIVE] | Backup missed call detection                      |
| auto-review-response | Every 30 min   | [LIVE] | AI draft + auto-post review responses             |
| calendar-sync        | Every 30 min   | [LIVE] | Sync appointments with calendars                  |
| usage-tracking       | Hourly         | [LIVE] | Update monthly summaries, check usage alerts      |
| sla-breach-check     | Hourly         | [LIVE] | Detect and alert on SLA breaches                  |
| review-sync          | Hourly         | [LIVE] | Fetch new reviews, alert on negatives             |
| expire-prompts       | Hourly         | [LIVE] | Expire old agency prompts                         |
| send-nps             | Hourly         | [LIVE] | Send NPS surveys 4h after completed appointments  |
| agent-check          | Hourly         | [LIVE] | Health check on conversation agent                |
| lead-scoring         | Daily midnight | [LIVE] | Re-score all active client leads                  |
| analytics            | Daily midnight | [LIVE] | Aggregate daily stats into analytics tables       |
| trial-reminders      | Daily midnight | [LIVE] | Trial reminder emails (day 7, 12, 14)             |
| no-show-recovery     | Daily midnight | [LIVE] | Detect no-shows, send AI follow-ups               |
| daily-summary        | Daily 7am      | [LIVE] | Send daily summary email to opted-in clients      |
| win-back             | Daily 10am     | [LIVE] | Re-engage stale leads (25-35 days)                |
| weekly-summary       | Weekly Mon 7am | [LIVE] | Compile and send weekly reports                   |
| agency-digest        | Weekly Mon 7am | [LIVE] | Agency performance summaries                      |
| cohort-update        | Monthly (1st)  | [LIVE] | Update client cohort retention metrics             |

---

## 11. SUCCESS METRICS

### 11.1 Client Success (They Care About)

| Metric            | Status | Definition                                 | Target           |
| ----------------- | ------ | ------------------------------------------ | ---------------- |
| Response rate     | [LIVE] | % of leads that got response               | >95%             |
| Response time     | [LIVE] | Time to first response (speed-to-lead)     | <30 seconds      |
| Booking rate      | [LIVE] | % of leads that booked                     | >20%             |
| Revenue recovered | [LIVE] | $ attributed to system                     | Track per client |
| ROI               | [LIVE] | Revenue / subscription cost                | >3x              |
| Speed multiplier  | [LIVE] | How much faster than industry avg (42 min) | Track per client |

### 11.2 Platform Success (You Care About)

| Metric          | Status | Definition                                        | Target        |
| --------------- | ------ | ------------------------------------------------- | ------------- |
| MRR             | [LIVE] | Monthly recurring revenue                         | Growth        |
| Churn           | [LIVE] | Clients cancelling per month                      | <5%           |
| Cost per client | [LIVE] | API costs / clients (tracked per service)         | Track margins |
| Support load    | [LIVE] | Support tickets (discussion threads)              | Minimize      |
| NPS             | [LIVE] | Post-appointment surveys via SMS, admin dashboard | >50           |

---

## 12. IMPLEMENTATION VERIFICATION CHECKLIST

### Authentication & Access

```
[x] Admin login via magic link email
[x] Admin session checks on all admin routes (403 if not admin)
[x] Client receives magic link email
[x] Magic link logs client in
[x] Sessions expire appropriately
[x] Logout clears session
[x] Team member claim flow (token-based escalation)
[x] Role-based admin access (super admin vs limited)
```

### Client Management

```
[x] Admin can create client (5-step wizard)
[x] Admin can edit client
[x] Admin can delete client (soft delete)
[x] Client list with status badges
[x] Client detail view with ROI dashboard
[x] Feature toggles per client
[x] Knowledge base per client (structured interview + industry presets)
[x] Multi-service catalog per client
```

### Phone Numbers

```
[x] Search available numbers by area code
[x] Purchase number from Twilio
[x] Assign number to client
[x] Release/unassign number
[x] Reassign across clients
[x] Central phone number console
[x] Twilio account balance display
[x] Multiple numbers per client (junction table, backward-compatible)
[x] Automatic webhook configuration on purchase
```

### SMS - Inbound

```
[x] Twilio webhook receives messages
[x] Message stored in database
[x] Lead created if new phone
[x] Lead updated if existing
[x] Conversation thread updated
[x] MMS media attachments saved
[x] Opt-out keywords detected
[x] Hot intent detection for immediate ring group
[x] AI response generated (autonomous mode)
[x] Notification sent to client/team
```

### SMS - Outbound

```
[x] All outbound through compliance gateway
[x] Message delivered via Twilio
[x] Message stored in database
[x] Opt-out check before sending
[x] DNC check before sending
[x] Consent validation before sending
[x] Quiet hours enforced (9pm-10am CRTC)
[x] Queue on quiet hours (send next available window)
[x] Audit trail logged for every attempt
[x] Monthly message count incremented
```

### AI Responses

```
[x] LangGraph agent generates responses
[x] AI uses knowledge base context (buildAIContext pipeline)
[x] AI response sent automatically (autonomous mode)
[x] AI suggestions for approval (assist mode)
[x] AI respects feature flags (aiAgentEnabled, aiAgentMode)
[x] AI escalates when appropriate (7 trigger types)
[x] 10 guardrail rules enforced in every prompt
[x] Confidence assessment (high/medium/low based on KB matches)
[x] Token usage tracked in api_usage table
[x] Service classification on projectType extraction
[x] Signal detection (urgency, budget, intent, sentiment)
```

### Flows / Sequences

```
[x] Flow templates created by admin
[x] Flow templates pushed to clients
[x] Scheduled messages created by flows
[x] Cron processes scheduled messages every 5 minutes
[x] Flow stops when lead replies (pauses active sequences)
[x] Flow stops when lead opts out
[x] Flow respects quiet hours via compliance gateway
[x] Missed call automation
[x] Appointment reminders (day-before + 2-hour)
[x] No-show recovery (AI-personalized, 2 attempts max)
[x] Win-back sequences (human-like AI, 2 attempts max)
[x] Estimate follow-up
[x] Payment reminders
[x] Review requests
[x] Client can activate/pause/customize flows
[x] Per-lead flow status UI
```

### Lead Management

```
[x] Lead list view works
[x] Lead detail view shows conversation + media
[x] Lead status can be changed (won/lost/contacted)
[x] Lead scoring calculated (quick + AI)
[x] Lead source tracked (missed_call, sms, form)
[x] Lead temperature indicator (hot/warm/cold)
[x] Lead search (by name, phone, email — debounced, case-insensitive)
[x] Lead advanced filters (status, source, temperature, client, date range)
[x] Lead editing (status, temperature, notes, project type, quote value — inline)
[x] Lead bulk actions (multi-select + bulk status change)
[x] Lead CSV export
[x] Manual lead creation
```

### Compliance

```
[x] STOP keyword detected (7 variants)
[x] Re-opt-in keyword detected (5 variants)
[x] Opt-out recorded (blockedNumbers + lead.optedOut)
[x] Opted-out lead blocked from all messaging
[x] Consent auto-recorded on first contact (4 trigger types)
[x] Quiet hours enforced (9pm-10am CRTC)
[x] DNC list checked before every send
[x] Audit trail logged for every compliance decision
[x] Compliance dashboard with score and metrics
[x] Message queue for quiet hours delivery
[x] Test client flag (isTest) skips real SMS and excludes from analytics
```

### Booking & Appointments

```
[x] Conversational booking intent detection
[x] Available slot calculation from business hours
[x] Slot suggestions (spread across days, prefer mid-morning)
[x] Time preference extraction via AI
[x] Appointment creation with reminders
[x] Rescheduling support
[x] Cancellation support
[x] Contractor notification on booking
[x] No-show detection and recovery
```

### Revenue & ROI

```
[x] Multi-service catalog per client
[x] AI service classification (fuzzy match)
[x] Revenue by service breakdown
[x] Speed-to-lead metrics (vs industry benchmark)
[x] ROI dashboard on client detail page
[x] Pipeline value tracking
[x] Month-over-month comparison
[x] Job lifecycle (lead -> quoted -> won -> completed)
[x] Payment received tracking
```

### Billing

```
[x] Plans in database with Stripe price IDs
[x] Stripe checkout for new subscriptions
[x] Stripe webhook handles subscription lifecycle
[x] Client can view current plan and usage
[x] Client can update payment method
[x] Invoice history with status
[x] Cancellation flow with value retention
[x] Pause/resume support
[x] Coupon code support (admin CRUD, validation, redemption tracking)
[x] Payment link generation for invoices
[x] Invoice retry (client-initiated from billing page)
[x] Usage limit enforcement on lead/team/phone creation
[x] Overage pricing (per-lead and per-SMS rates on plans)
```

### A/B Testing & Optimization

```
[x] Create A/B tests (messaging, timing, team, sequence)
[x] Per-variant metrics tracking
[x] Winner determination
[x] Aggregate template testing across all clients
[x] Template variant comparison
[x] One-click rollout to multiple clients
[x] Date range filtering (7/30/90 days)
[x] Bi-weekly/monthly report generation
```

### Notifications

```
[x] New lead notification (SMS/email)
[x] Escalation notification (SMS with claim link)
[x] Weekly summary email
[x] Notification preferences (per-notification toggle)
[x] Quiet hours for notifications
[x] Agency communications (admin -> client)
[x] Daily summary email (opted-in via notification_preferences, skips zero-activity days)
```

### Analytics

```
[x] Daily metrics aggregated
[x] Client dashboard shows stats
[x] Lead funnel displayed
[x] Revenue attribution works
[x] Admin dashboard shows platform metrics
[x] Lead source breakdown
[x] Response time metrics
[x] Analytics export (CSV/JSON)
[x] Platform health (MRR, churn, margins)
[x] Cost per client tracking
[x] Funnel visualization on platform analytics (conversion rates per stage)
[x] Cohort retention analysis (monthly, per-client milestones)
[x] Client webhook dispatch (HMAC-signed, retry, delivery logging)
[x] Google Business OAuth connect/disconnect/reconnect
```

### UI/UX

```
[x] All pages responsive (desktop + mobile nav)
[x] Loading states present
[x] Error states handled
[x] Empty states handled
[x] Help button visible (non-admin pages)
[x] Admin navigation (4 groups: Management, Optimization, Reporting, Settings)
[x] Support discussion system
```

---

## 13. ADMIN NAVIGATION STRUCTURE

```
Clients (5):
  Dashboard          /admin
  Clients            /admin/clients
  Users              /admin/users
  Communications     /admin/agency
  Discussions        /admin/discussions

Optimization (5):
  Flow Templates     /admin/flow-templates
  Flow Analytics     /admin/analytics
  Variant Results    /admin/template-performance
  A/B Tests          /admin/ab-tests
  Reputation         /admin/reputation

Reporting (6):
  Billing            /admin/billing
  Plans              /admin/billing/plans
  Coupons            /admin/billing/coupons
  Reports            /admin/reports
  Platform Health    /admin/platform-analytics
  Costs & Usage      /admin/usage

Settings (8):
  Phone Numbers      /admin/phone-numbers
  Twilio Account     /admin/twilio
  Voice AI           /admin/voice-ai
  Compliance         /admin/compliance
  Webhook Logs       /admin/webhook-logs
  Email Templates    /admin/email-templates
  API Keys           /admin/api-keys
  System Settings    /admin/settings
```

---

## APPENDIX: Database Tables

95+ tables organized by domain:

```
--- Core ---
clients                     leads                       conversations
scheduled_messages          appointments                jobs
business_hours              media_attachments

--- AI Agent ---
lead_context                agent_decisions             escalation_queue
conversation_checkpoints    client_agent_settings       agent_enums
escalation_rules            escalation_claims

--- Knowledge ---
knowledge_base              knowledge_gaps              client_services

--- Flows & Templates ---
flows                       flow_steps                  flow_executions
flow_templates              flow_template_steps         flow_template_versions
template_variants           template_performance_metrics
template_metrics_daily      template_step_metrics       client_flow_outcomes

--- Auth ---
users                       accounts                    sessions
verification_tokens         authenticators              magic_link_tokens
otp_codes                   admin_users

--- Team ---
team_members                team_invites

--- Billing ---
plans                       subscriptions               subscription_plans
subscription_invoices       payments                    payment_reminders
billing_payment_methods     billing_events              coupons
usage_records               cancellation_requests

--- Compliance ---
consent_records             blocked_numbers             do_not_contact_list
quiet_hours_config          compliance_audit_log

--- Analytics ---
daily_stats                 analytics_daily             analytics_weekly
analytics_monthly           platform_analytics          funnel_events
reports                     client_cohorts              revenue_events

--- A/B Testing ---
ab_tests                    ab_test_metrics             ab_test_daily_metrics

--- Reviews ---
reviews                     review_sources              review_responses
review_metrics              response_templates

--- Voice ---
voice_calls                 call_attempts               active_calls

--- Communication ---
support_messages            support_replies             agency_messages
notification_preferences

--- Usage ---
api_usage                   api_usage_daily             api_usage_monthly
usage_records               usage_alerts

--- Calendar ---
calendar_integrations       calendar_events

--- Invoices ---
invoices

--- Phone ---
client_phone_numbers

--- System ---
system_settings             webhook_log                 error_log
message_templates           email_templates             api_keys
help_articles               nps_surveys
```

---

## APPENDIX: Webhook Endpoints

| Endpoint                                      | Purpose                            |
| --------------------------------------------- | ---------------------------------- |
| `/api/webhooks/twilio/sms`                    | Inbound SMS handling               |
| `/api/webhooks/twilio/voice`                  | Inbound call routing               |
| `/api/webhooks/twilio/voice/ai`               | AI voice agent                     |
| `/api/webhooks/twilio/voice/ai/gather`        | DTMF input capture                 |
| `/api/webhooks/twilio/voice/ai/transfer`      | Call transfer                      |
| `/api/webhooks/twilio/voice/ai/dial-complete` | Dial completion status             |
| `/api/webhooks/twilio/ring-connect`           | Ring group notification            |
| `/api/webhooks/twilio/ring-result`            | Ring group result                  |
| `/api/webhooks/twilio/agency-sms`             | Agency client SMS                  |
| `/api/webhooks/twilio/status`                 | SMS delivery status callbacks      |
| `/api/webhooks/form`                          | Web form submission                |
| `/api/webhooks/stripe`                        | Stripe payment/subscription events |
| `/api/webhooks/nps`                           | NPS survey SMS responses           |
| `/api/auth/callback/google-business`          | Google Business OAuth callback     |

---

_This document serves as the complete specification for ConversionSurgery. All features are marked [LIVE] — fully implemented and working. Any gap between this spec and the implementation is a bug._
