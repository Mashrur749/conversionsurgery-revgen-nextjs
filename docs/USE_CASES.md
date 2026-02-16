# ConversionSurgery Platform Use Cases

A comprehensive operations guide covering every workflow for every user type — **98 use cases** across 6 user categories. Each use case describes **who** performs it, **when** it happens, **what** steps are involved, and **what** the expected outcome is.

---

## Table of Contents

- [User Types Overview](#user-types-overview)
- [Admin (Agency Operator) Use Cases](#admin-agency-operator-use-cases)
  - [A1: Onboard a New Client](#a1-onboard-a-new-client)
  - [A2: Provision and Assign a Phone Number](#a2-provision-and-assign-a-phone-number)
  - [A3: Build a Client's Knowledge Base](#a3-build-a-clients-knowledge-base)
  - [A4: Create and Manage Flow Templates](#a4-create-and-manage-flow-templates)
  - [A5: Push a Flow Template to Clients](#a5-push-a-flow-template-to-clients)
  - [A6: Run an Aggregate A/B Test on Templates](#a6-run-an-aggregate-ab-test-on-templates)
  - [A7: Generate a Client Performance Report](#a7-generate-a-client-performance-report)
  - [A8: Monitor Platform Health](#a8-monitor-platform-health)
  - [A9: Reassign a Phone Number Between Clients](#a9-reassign-a-phone-number-between-clients)
  - [A10: Manage Usage Alerts](#a10-manage-usage-alerts)
  - [A11: Review and Respond to Client Discussions](#a11-review-and-respond-to-client-discussions)
  - [A12: Configure Voice AI for a Client](#a12-configure-voice-ai-for-a-client)
  - [A13: Set Up Reputation Monitoring](#a13-set-up-reputation-monitoring)
  - [A14: Run a Per-Client A/B Test](#a14-run-a-per-client-ab-test)
  - [A15: Manage Billing and Subscriptions](#a15-manage-billing-and-subscriptions)
  - [A16: Handle Compliance and Opt-Outs](#a16-handle-compliance-and-opt-outs)
  - [A17: Operate the Agency Dashboard](#a17-operate-the-agency-dashboard)
  - [A18: Manage Users and Admin Access](#a18-manage-users-and-admin-access)
  - [A19: Review AI Response Quality](#a19-review-ai-response-quality)
  - [A20: Investigate a Lead's Full Journey](#a20-investigate-a-leads-full-journey)
  - [A21: Create a Lead Manually](#a21-create-a-lead-manually)
  - [A22: Export Leads to CSV](#a22-export-leads-to-csv)
  - [A23: Clone a Flow Template](#a23-clone-a-flow-template)
  - [A24: Manage Template Versions](#a24-manage-template-versions)
  - [A25: Manage Email Templates](#a25-manage-email-templates)
  - [A26: Manage API Keys](#a26-manage-api-keys)
  - [A27: View Webhook Logs](#a27-view-webhook-logs)
  - [A28: Manage Help Articles](#a28-manage-help-articles)
  - [A29: Manage Subscription Plans](#a29-manage-subscription-plans)
  - [A30: Configure System Settings](#a30-configure-system-settings)
  - [A31: Manage Multiple Numbers per Client](#a31-manage-multiple-numbers-per-client)
  - [A32: Send Payment Link to a Lead](#a32-send-payment-link-to-a-lead)
  - [A33: Review Voice Call History](#a33-review-voice-call-history)
  - [A34: Configure Escalation Rules](#a34-configure-escalation-rules)
  - [A35: Review and Resolve Knowledge Gaps](#a35-review-and-resolve-knowledge-gaps)
  - [A36: Manage Review Response Templates](#a36-manage-review-response-templates)
  - [A37: Define Client Service Catalog](#a37-define-client-service-catalog)
  - [A38: Send Agency Messages to Clients](#a38-send-agency-messages-to-clients)
  - [A39: View NPS Dashboard](#a39-view-nps-dashboard)
- [Client User (Business Owner) Use Cases](#client-user-business-owner-use-cases)
  - [C1: First Login and Dashboard Orientation](#c1-first-login-and-dashboard-orientation)
  - [C2: View and Manage Leads](#c2-view-and-manage-leads)
  - [C3: Read and Reply to Conversations](#c3-read-and-reply-to-conversations)
  - [C4: Take Over a Conversation from AI](#c4-take-over-a-conversation-from-ai)
  - [C5: Handle an Escalation](#c5-handle-an-escalation)
  - [C6: Add and Manage Team Members](#c6-add-and-manage-team-members)
  - [C7: Configure Business Hours](#c7-configure-business-hours)
  - [C8: Review Analytics](#c8-review-analytics)
  - [C9: Use Discussions for Support](#c9-use-discussions-for-support)
  - [C10: Approve an AI-Suggested Flow](#c10-approve-an-ai-suggested-flow)
  - [C11: View Scheduled Messages](#c11-view-scheduled-messages)
  - [C12: Create a Lead Manually](#c12-create-a-lead-manually)
  - [C13: Export Leads to CSV](#c13-export-leads-to-csv)
  - [C14: Tag and Categorize Leads](#c14-tag-and-categorize-leads)
  - [C15: Send Photos (MMS) to a Lead](#c15-send-photos-mms-to-a-lead)
  - [C16: Manage Automation Flows](#c16-manage-automation-flows)
  - [C17: Send Payment Link to a Lead](#c17-send-payment-link-to-a-lead)
  - [C18: Configure Escalation Rules](#c18-configure-escalation-rules)
  - [C19: View Message Delivery Status](#c19-view-message-delivery-status)
  - [C20: Receive and View Photos from Leads](#c20-receive-and-view-photos-from-leads)
- [Client Portal User Use Cases](#client-portal-user-use-cases)
  - [P1: Access the Portal via Link or OTP](#p1-access-the-portal-via-link-or-otp)
  - [P2: Review Weekly Performance Summary](#p2-review-weekly-performance-summary)
  - [P3: View Conversation History](#p3-view-conversation-history)
  - [P4: Manage Billing and Subscription](#p4-manage-billing-and-subscription)
  - [P5: Configure Weekly Summary Preferences](#p5-configure-weekly-summary-preferences)
  - [P6: Cancel Subscription](#p6-cancel-subscription)
  - [P8: View Revenue Dashboard](#p8-view-revenue-dashboard)
  - [P9: Manage Knowledge Base](#p9-manage-knowledge-base)
  - [P10: Manage Automation Flows](#p10-manage-automation-flows)
  - [P11: Configure AI Settings](#p11-configure-ai-settings)
  - [P12: Configure Feature Toggles](#p12-configure-feature-toggles)
  - [P13: Configure Notification Preferences](#p13-configure-notification-preferences)
  - [P14: Browse Help Articles](#p14-browse-help-articles)
  - [P15: Use Discussions for Support](#p15-use-discussions-for-support)
  - [P16: Approve AI-Suggested Actions](#p16-approve-ai-suggested-actions)
- [Lead (Homeowner) Use Cases](#lead-homeowner-use-cases)
  - [L1: Book an Appointment via SMS](#l1-book-an-appointment-via-sms)
  - [L2: Receive and Respond to Automated Messages](#l2-receive-and-respond-to-automated-messages)
  - [L3: Opt Out of Messages](#l3-opt-out-of-messages)
- [Team Member Use Cases](#team-member-use-cases)
  - [T1: Receive and Claim an Escalation](#t1-receive-and-claim-an-escalation)
  - [T2: Receive a Hot Transfer Call](#t2-receive-a-hot-transfer-call)
  - [T3: Respond to a Claimed Lead](#t3-respond-to-a-claimed-lead)
- [System / Automated Use Cases](#system--automated-use-cases)
  - [S1: Missed Call Recovery (End-to-End)](#s1-missed-call-recovery-end-to-end)
  - [S2: Form Submission Response](#s2-form-submission-response)
  - [S3: Incoming SMS AI Response](#s3-incoming-sms-ai-response)
  - [S4: Lead Scoring Update](#s4-lead-scoring-update)
  - [S5: Appointment Reminder Sequence](#s5-appointment-reminder-sequence)
  - [S6: Compliance Check Before Sending](#s6-compliance-check-before-sending)
  - [S7: Hot Intent Detection and Ring Group](#s7-hot-intent-detection-and-ring-group)
  - [S8: Voice AI Call Handling](#s8-voice-ai-call-handling)
  - [S9: Daily Stats Aggregation](#s9-daily-stats-aggregation)
  - [S10: Opt-Out Processing](#s10-opt-out-processing)
  - [S11: Auto Review Response Generation](#s11-auto-review-response-generation)
  - [S12: NPS Survey Sending](#s12-nps-survey-sending)
  - [S13: Trial Reminder Emails](#s13-trial-reminder-emails)
  - [S14: Calendar Event Creation on Booking](#s14-calendar-event-creation-on-booking)
  - [S15: SMS Delivery Status Tracking](#s15-sms-delivery-status-tracking)
  - [S16: Agency Digest Email](#s16-agency-digest-email)
  - [S17: No-Show Recovery Automation](#s17-no-show-recovery-automation)
  - [S18: Win-Back Re-engagement Automation](#s18-win-back-re-engagement-automation)

---

## User Types Overview

| User Type | Authentication | Access Level | Primary Purpose |
|-----------|---------------|--------------|-----------------|
| **Admin** | Magic link email (NextAuth) | Full platform + all clients | Manage the agency, onboard clients, optimize templates |
| **Client User** | Magic link email (NextAuth) | Own client dashboard only | View leads, conversations, escalations, analytics |
| **Client Portal** | OTP login (email code) or cookie-based link | Self-service portal | Revenue, KB, flows, billing, AI settings, help |
| **Team Member** | None (SMS/phone only) | Escalation claim links only | Receive escalation SMS, claim and resolve leads |
| **Lead** | None (SMS/phone only) | No dashboard access | Receive automated messages, book appointments, send photos, opt out |

---

## Admin (Agency Operator) Use Cases

### A1: Onboard a New Client

**When**: A new contractor signs up for the $997/mo managed service.

**Preconditions**: Admin is logged in. Client has provided business name, email, phone, and timezone.

**Steps**:

1. Navigate to `/admin/clients/new/wizard` (or click "Add New Client" from the agency dashboard).
2. **Step 1 - Business Info**: Enter the client's business name, owner name, email, phone number, and timezone. The system normalizes the phone number and validates the email.
3. **Step 2 - Phone Number**: Search for an available Twilio number by area code (e.g., `403` for Calgary). The system returns up to 10 options showing city and region. Select one and click "Purchase & Assign." The system buys the number from Twilio, assigns it to the client, and auto-configures SMS/voice webhooks.
4. **Step 3 - Team Members**: Add the client's team (owner + any employees who should receive escalations). For each member, enter name, phone, email, and role. Toggle "Receive Escalations" and "Receive Hot Transfers" per member. Set priority order (1 = first to be contacted).
5. **Step 4 - Business Hours**: Configure operating hours for each day of the week. Toggle days on/off and set start/end times. Select the correct timezone. These hours determine when hot transfers are attempted vs. queued for callback.
6. **Step 5 - Review & Launch**: Review all entered information. The system shows warnings if phone number is missing or no team members were added. Click "Activate Client" to set client status to `active`.

**Outcome**: Client record created with status `active`, Twilio number assigned and configured, team members stored, business hours set. The client's email can now receive magic link logins. Missed calls to the assigned number will trigger automated SMS responses.

**Key API calls**:
- `POST /api/admin/clients` (create client)
- `POST /api/admin/twilio/search` (find numbers)
- `POST /api/admin/twilio/purchase` (buy + assign)
- `POST /api/team-members` (add members)
- `PUT /api/business-hours` (save hours)
- `PATCH /api/admin/clients/[id]` (activate)

---

### A2: Provision and Assign a Phone Number

**When**: A new client needs a Twilio number, or an existing client needs a different number.

**Preconditions**: Admin is logged in. Twilio account has sufficient balance.

**Steps**:

1. Navigate to `/admin/twilio` to view the Twilio dashboard (balance, owned numbers).
2. Click "Search Numbers" or go to a specific client's phone page at `/admin/clients/[id]/phone`.
3. Enter a 3-digit area code (e.g., `780` for Edmonton). The system queries Twilio's available numbers API.
4. Review the returned list showing phone number, city, and province.
5. Click "Purchase" on the desired number. The system:
   - Buys the number from Twilio ($1-2/mo)
   - Assigns it to the client (`clients.twilioNumber`)
   - Configures voice webhook → `/api/webhooks/twilio/voice`
   - Configures SMS webhook → `/api/webhooks/twilio/sms`
6. Verify the number appears on the client's detail page.

**Outcome**: Client has a dedicated phone number. All calls and SMS to that number route through the platform's webhooks. Missed calls trigger automated follow-up. Incoming SMS trigger AI responses.

**If the number needs to change later**: Use the phone number manager to release the old number and purchase a new one, or use the reassignment console at `/admin/phone-numbers`.

**Multiple numbers**: Clients can have multiple numbers via the junction table (`client_phone_numbers`). The first number is marked as primary and synced to `clients.twilioNumber` for backward compatibility. Additional numbers can be added at `/admin/clients/[id]/phone`. See A31 for details.

---

### A3: Build a Client's Knowledge Base

**When**: After onboarding, to give the AI accurate information about the client's business.

**Preconditions**: Client exists and is active.

**Steps**:

1. Navigate to `/admin/clients/[id]/knowledge`.
2. Click "Add Entry."
3. Select a **category**: `services`, `pricing`, `faq`, `policies`, `about`, or `custom`.
4. Enter the **title** (e.g., "Bathroom Renovation Services").
5. Write the **content** with the details the AI should know:
   ```
   We specialize in full bathroom renovations including tile work,
   fixture installation, plumbing, and electrical. Average project
   takes 2-3 weeks. We serve the Greater Calgary area within 50km.
   ```
6. Add **keywords** for search matching: `bathroom, renovation, tile, fixtures, plumbing, remodel`.
7. Set **priority** (higher = used more prominently in AI context).
8. Click "Save."
9. Repeat for each category. A well-configured client typically has 8-15 entries covering:
   - Services offered (2-4 entries)
   - Pricing/rates (1-2 entries)
   - Common FAQs (3-5 entries)
   - Policies (warranty, cancellation, scheduling) (1-2 entries)
   - About the business (1 entry)

**Testing the knowledge base**:
1. Go to `/admin/clients/[id]/knowledge/preview`.
2. Enter a test question like "How much does a bathroom reno cost?"
3. The system shows which knowledge entries would be injected into the AI prompt.
4. Verify the right entries surface for common questions.

**Outcome**: When a lead texts the client's number, the AI draws from these knowledge entries to give accurate, specific answers about the business. Instead of generic responses, leads get information like "Our bathroom renovations typically take 2-3 weeks and start at $X."

---

### A4: Create and Manage Flow Templates

**When**: Building reusable automation sequences that can be pushed to multiple clients.

**Preconditions**: Admin has identified a common workflow (e.g., missed call follow-up).

**Steps**:

1. Navigate to `/admin/flow-templates`.
2. Click "Create Template."
3. Fill in template details:
   - **Name**: "Missed Call 3-Step Recovery"
   - **Category**: `missed_call_followup`
   - **Trigger**: `missed_call` (auto-starts when a missed call is detected)
   - **Approval mode**: `auto` (sends immediately without client approval)
4. Add steps:
   - **Step 1** (delay: 0 minutes):
     ```
     Hi! This is {ownerName} from {businessName}. I noticed you
     tried to call - how can I help you today?
     ```
   - **Step 2** (delay: 60 minutes, skip if replied):
     ```
     Just following up on my earlier message. I'd love to help
     with your project. What are you looking for?
     ```
   - **Step 3** (delay: 1440 minutes / 24 hours, skip if replied OR scheduled):
     ```
     Hi again! I wanted to reach out one more time. If you're still
     interested, just reply here or call anytime. Have a great day!
     ```
5. Save as draft.
6. Test with 1-2 clients before publishing.
7. Click "Publish" to create a versioned snapshot.

**Template variables available**: `{ownerName}`, `{businessName}`, `{leadName}`, `{leadPhone}`.

**Outcome**: A reusable, versioned flow template that can be assigned to any client. When a missed call comes in for those clients, the sequence fires automatically with their business-specific details.

---

### A5: Push a Flow Template to Clients

**When**: A template has been tested and is ready for wider rollout.

**Preconditions**: Flow template is published with at least one version.

**Steps**:

1. Navigate to `/admin/flow-templates/[id]`.
2. Click "Push to Clients."
3. Select which clients should receive this template:
   - **All active clients**: Push to everyone.
   - **Specific clients**: Check individual clients from the list.
4. Choose the sync mode for each client:
   - **Inherit**: Client auto-receives future updates to this template.
   - **Locked**: Client gets the current version and never auto-updates.
   - **Custom**: Client starts from this template but can customize later.
5. Click "Push."
6. The system creates client-specific `flows` records linked to the template.

**Outcome**: Selected clients now have the flow active. When their trigger event occurs (e.g., missed call), the sequence executes with their business details substituted into the template variables.

---

### A6: Run an Aggregate A/B Test on Templates

**When**: You want to determine which message template performs better across all clients.

**Preconditions**: At least 2 template variants exist for the same message type.

**Steps**:

1. Navigate to `/admin/template-performance`.
2. Click "Create Variant" to set up competing templates:
   - **Variant A** (Standard):
     ```
     Hi! This is {ownerName} from {businessName}. I saw you tried
     to call - how can I help?
     ```
   - **Variant B** (Urgent):
     ```
     Hey {leadName}! {ownerName} here from {businessName}. Sorry I
     missed your call! What do you need help with? I can usually
     respond within minutes.
     ```
3. Both variants are assigned `type: missed_call`.
4. Click "Assign Variants" to distribute:
   - Assign Variant A to clients 1-10.
   - Assign Variant B to clients 11-20.
5. Let the test run for 30-90 days.
6. Return to `/admin/template-performance` to review metrics:
   - **Executions**: How many times each was sent.
   - **Delivery rate**: % successfully delivered.
   - **Engagement rate**: % that received a reply.
   - **Conversion rate**: % that led to an appointment or sale.
7. The dashboard shows the winner: "Variant B has 4.2% higher engagement."
8. Click "Roll Out Winner" to assign the winning variant to all clients at once.

**Outcome**: Data-driven template optimization across your entire client base. Over time you build a library of proven, tested templates. "Tested on 50,000+ messages" becomes a competitive advantage.

**Key difference from per-client A/B tests**: Aggregate testing uses volume from all 20+ clients (1,000+ leads/month) to reach statistical significance in weeks rather than years.

---

### A7: Generate a Client Performance Report

**When**: Bi-weekly or monthly reporting cycle for a client.

**Preconditions**: Client has been active and has daily stats data.

**Steps**:

1. Navigate to `/admin/reports/new`.
2. Select the **report type**: bi-weekly, monthly, or custom.
3. Choose the **date range** (e.g., Jan 1 - Jan 31, 2026).
4. Select the **client** from the dropdown.
5. Click "Generate Report."
6. The system aggregates metrics from the `daily_stats` table:
   - Total messages sent
   - Missed calls captured
   - Forms responded
   - Conversations started
   - Appointments reminded
   - Conversion rate: `(appointments / messages) * 100`
   - Engagement rate: `(conversations / messages) * 100`
7. Review the generated report at `/admin/reports/[id]`:
   - **Summary metrics grid**: 8 key numbers at a glance.
   - **Daily breakdown table**: Day-by-day performance with trend arrows.
   - **Team performance**: Active members, response times.
   - **A/B test results**: If any tests were running during the period.
8. Share the report with the client (URL or PDF).

**Outcome**: A professional performance report showing the client exactly what value they're getting from the $997/mo service. Demonstrates ROI with concrete numbers.

---

### A8: Monitor Platform Health

**When**: Daily check-in to ensure all clients are performing well.

**Preconditions**: Admin is logged in.

**Steps**:

1. Navigate to `/admin` (Agency Dashboard).
2. Review the **overview stats**:
   - Total clients (active vs. pending)
   - Phone numbers assigned
   - Team members across all clients
   - Messages sent today
   - Missed calls captured today
   - Pending setup clients
3. Scan the **clients performance list**:
   - Status indicators (green = active, yellow = pending, red = issue)
   - Phone number assignment status (missing = needs attention)
   - Today's message count and missed call count per client
4. Click into any client showing anomalies (e.g., 0 messages when they usually have 10+).
5. Navigate to `/admin/platform-analytics` for aggregated metrics:
   - MRR, churn rate, new clients
   - Total messages, AI responses, escalations
   - API costs per client

**Outcome**: Quick identification of clients that need attention. Catch issues like disconnected phone numbers, inactive clients, or unusual message patterns before clients notice.

---

### A9: Reassign a Phone Number Between Clients

**When**: A client cancels and their number should go to a new client, or a number swap is needed.

**Steps**:

1. Navigate to `/admin/phone-numbers`.
2. Find the number to reassign in the list.
3. Click "Reassign."
4. Select the new client from the dropdown.
5. Confirm the reassignment.
6. The system updates `clients.twilioNumber` for both the old and new client and reconfigures webhooks.

**Outcome**: The phone number now routes to the new client's account. Calls and SMS are attributed to the new client. The old client's number field is cleared.

---

### A10: Manage Usage Alerts

**When**: A client is approaching or has exceeded their monthly message limit.

**Steps**:

1. Navigate to `/admin/usage`.
2. Review the usage dashboard showing all clients' consumption:
   - Messages sent this month vs. limit
   - Percentage of limit used
   - Projected usage at current rate
3. Click into a specific client at `/admin/usage/[clientId]` for details:
   - Daily message breakdown
   - Peak usage days
   - Usage trend chart
4. If an alert has fired (80% threshold or overage):
   - Review the alert details
   - Click "Acknowledge" to dismiss
   - Optionally adjust the client's message limit
   - Contact the client if they're at risk of service interruption

**Outcome**: Proactive management of messaging costs. Prevents surprise overages and ensures clients stay within their plan limits.

---

### A11: Review and Respond to Client Discussions

**When**: A client has submitted a question or support request through the dashboard.

**Steps**:

1. Navigate to `/admin/discussions`.
2. Review open discussions sorted by recency.
3. Click into a discussion to see:
   - The client's email and which page they were on when they asked
   - Their original message
   - Any previous replies in the thread
4. Write a response and click "Reply."
5. Mark the discussion as "Resolved" when the issue is addressed.

**Outcome**: Clients get timely support without leaving the platform. Discussion history provides context for recurring issues.

---

### A12: Configure Voice AI for a Client

**When**: Setting up AI-powered phone answering for a client.

**Steps**:

1. Navigate to `/admin/voice-ai`.
2. Select the client to configure.
3. Enable Voice AI and choose the **mode**:
   - `always` - AI answers every call
   - `after_hours` - AI only answers outside business hours
   - `overflow` - AI answers when team is unavailable
4. Configure the **greeting**:
   ```
   Hi, thanks for calling {businessName}! I'm an AI assistant
   and I can help you with scheduling, pricing questions, or
   connect you with {ownerName}. How can I help?
   ```
5. Set **max call duration** (default: 5 minutes).
6. **Select a voice** (optional): Use the ElevenLabs voice picker to choose a custom AI voice:
   - Browse available voices from the ElevenLabs library (labels show language and style).
   - Click **Preview** to hear a sample of each voice.
   - Select and save — the `voiceVoiceId` is stored on the client record.
   - When set, the Voice AI uses ElevenLabs TTS instead of Twilio's default TTS.
7. Ensure business hours are configured (used by `after_hours` mode).
8. Verify team members have "Receive Hot Transfers" enabled (for when the AI needs to transfer).

**Outcome**: When leads call the client's number and the configured condition is met, the AI answers (optionally in a custom ElevenLabs voice), engages in conversation, and either resolves the query or transfers to a human. A post-call summary is generated with intent, sentiment, and transcript.

**Key API calls**:
- `GET /api/admin/voice/voices` (list ElevenLabs voices)
- `POST /api/admin/voice/preview` (preview voice with sample text)
- `PATCH /api/admin/clients/[id]` (save voiceVoiceId)

---

### A13: Set Up Reputation Monitoring

**When**: A client wants to track and respond to online reviews.

**Steps**:

1. Navigate to `/admin/clients/[id]/reviews`.
2. Click "Add Review Source."
3. Connect a **review platform**:
   - Google Business: Enter the Google Place ID
   - Yelp: Enter the business URL
   - Facebook: Enter the page URL
4. The system begins polling for new reviews.
5. When reviews come in, the dashboard shows:
   - Star rating with color coding (green 4-5, yellow 3, red 1-2)
   - Review text and author
   - AI-generated sentiment analysis
   - AI-suggested response
6. For each review, choose an action:
   - **Use AI response**: Post the suggested response as-is.
   - **Edit and post**: Customize the response before posting.
   - **Dismiss**: No response needed.
7. Monitor review metrics over time:
   - Average rating trend
   - Response rate
   - Time to respond

**Outcome**: The client's online reputation is actively managed. Negative reviews get quick, professional responses. Positive reviews are acknowledged and amplified.

---

### A14: Run a Per-Client A/B Test

**When**: Testing a specific optimization for an individual client (works best for high-volume clients).

**Steps**:

1. Navigate to `/admin/ab-tests/new`.
2. Configure the test:
   - **Client**: Select the target client
   - **Type**: `messaging`, `timing`, `team`, or `sequence`
   - **Variant A** (control): Current configuration
   - **Variant B** (experimental): New approach to test
   - **Duration**: Recommended 30+ days for significance
3. Click "Create Test." Status starts as `active`.
4. Monitor at `/admin/ab-tests/[id]`:
   - Real-time metrics for both variants
   - Delivery rate, engagement rate, conversion rate
   - Statistical confidence indicator
5. When enough data is collected, the system determines a winner:
   - "Variant B shows 3.5% higher conversion rate"
   - Percentage improvement calculated
6. Click "Complete Test" to finalize.
7. Apply the winner to the client's configuration.

**Important note**: For solo contractors with low volume (50-100 leads/month), per-client tests take 2-4 years for significance. Use aggregate testing (A6) instead.

---

### A15: Manage Billing and Subscriptions

**When**: Reviewing subscription status, handling payment issues, or changing plans.

**Steps**:

1. Navigate to `/admin/billing`.
2. View the subscription overview:
   - Active subscriptions with plan details
   - Monthly recurring revenue
   - Past-due accounts
3. For past-due accounts:
   - Review payment failure details
   - Contact client if needed
   - Stripe handles retry logic automatically
4. To view a specific client's billing:
   - Navigate to their client detail page
   - See subscription status, plan, and payment history

**Outcome**: Clear visibility into revenue and payment health across all clients.

---

### A16: Handle Compliance and Opt-Outs

**When**: A lead opts out (sends STOP), or you need to review compliance records.

**Steps**:

1. Navigate to `/admin/compliance`.
2. Review the compliance dashboard:
   - Recent opt-outs
   - Consent records
   - Do-not-contact list entries
   - Blocked numbers
3. When a lead sends "STOP":
   - The system automatically processes the opt-out
   - Adds to `opt_out_records`
   - Adds to `blocked_numbers`
   - Sets `lead.optedOut = true`
   - Cancels all scheduled messages
   - Sends confirmation: "You've been unsubscribed. Reply START to re-subscribe."
4. To manually add a number to the do-not-contact list:
   - Click "Add to DNC"
   - Enter phone number and reason
   - Set expiry if temporary
5. Review the audit log for compliance events:
   - Every opt-out, consent change, and blocked message is logged
   - Includes timestamps, actors, and reasons
   - Required for TCPA compliance audits

**Outcome**: Full regulatory compliance. Every consent and opt-out is tracked with an immutable audit trail. Protects the agency and clients from TCPA violations.

---

### A17: Operate the Agency Dashboard

**When**: Daily operations management.

**Steps**:

1. Navigate to `/admin` (Agency Dashboard).
2. Use the **Client Selector** dropdown in the header to switch between clients.
   - When a client is selected, all standard dashboard pages (leads, conversations, analytics) show that client's data.
   - The admin cookie `adminSelectedClientId` persists the selection across page navigations.
3. Quick actions available:
   - "Create New Client" → wizard
   - "Manage Phone Numbers" → Twilio console
   - "View All Clients" → client list
   - "View Reports" → report list
   - "Twilio Settings" → account dashboard
4. Navigation is organized into four groups:
   - **Clients**: Dashboard, Clients, Users, Communications, Discussions
   - **Optimization**: Flow Templates, Flow Analytics, Variant Results, A/B Tests, Reputation
   - **Reporting**: Billing, Plans, Reports, Platform Health, Costs & Usage
   - **Settings**: Phone Numbers, Twilio Account, Voice AI, Compliance, Webhook Logs, Email Templates, API Keys, System Settings

**Outcome**: Efficient multi-client management from a single dashboard. Switch between client views seamlessly while always having admin tools accessible.

---

### A18: Manage Users and Admin Access

**When**: Granting or revoking admin access, or managing user-client associations.

**Steps**:

1. Navigate to `/admin/users`.
2. View all users in the system with their:
   - Email address
   - Admin status (true/false)
   - Associated client (if any)
3. To grant admin access:
   - Click "Edit" on the user
   - Toggle `isAdmin` to true
   - Save
4. To associate a user with a client:
   - Click "Edit" on the user
   - Select a client from the dropdown
   - Save
5. New users are created automatically when they log in via magic link for the first time. Their `clientId` is auto-linked if their email matches a client's email.

**Outcome**: Proper access control. Only designated admins can access the full platform. Client users are restricted to their own data.

---

### A19: Review AI Response Quality

**When**: Periodic quality check on AI-generated responses, or when a client reports an issue.

**Steps**:

1. Select a client using the Client Selector.
2. Navigate to `/conversations` to see recent message threads.
3. Look for conversations where:
   - AI confidence was low (escalation triggered)
   - Lead seems confused or frustrated
   - Multiple back-and-forth without resolution
4. For each conversation:
   - Read the full thread
   - Check if the AI used knowledge base entries appropriately
   - Verify the responses match the client's services and pricing
5. If AI responses are inaccurate:
   - Update the client's knowledge base (use case A3)
   - Add missing information
   - Improve keywords for better matching
6. Navigate to `/admin/clients/[id]/knowledge/preview` to test improvements.

**Outcome**: Continuous improvement of AI response quality. Ensures leads get accurate, helpful information that matches each client's business.

---

### A20: Investigate a Lead's Full Journey

**When**: A client asks "what happened with this lead?" or you're debugging a conversion issue.

**Steps**:

1. Select the client using the Client Selector.
2. Navigate to `/leads` and find the lead (search by name or phone).
3. Click into the lead detail page at `/leads/[id]`:
   - **Lead info**: Name, phone, email, source, status, temperature
   - **Score**: 0-100 with breakdown (urgency, budget, engagement, intent)
   - **Conversation history**: Every SMS/MMS in chronological order, showing who sent each (AI, human, lead)
   - **Escalation history**: If/when escalated, reason, who claimed, resolution
   - **Flow executions**: Which sequences ran, which steps completed
4. Check the conversation mode: AI, Human, or Paused.
5. If the lead was escalated, check:
   - Escalation reason and priority
   - Whether a team member claimed it
   - Time to first response
   - Resolution outcome

**Outcome**: Complete audit trail of every interaction with a lead. Answers questions about why a lead converted or was lost.

---

### A21: Create a Lead Manually

**When**: A lead comes in through an offline channel (phone call to personal number, walk-in, referral) and needs to be tracked in the system.

**Steps**:

1. Select the client using the Client Selector.
2. Navigate to `/leads`.
3. Click "Add Lead" to open the Create Lead dialog.
4. Fill in the details:
   - **Name** (required)
   - **Phone number** (required, auto-normalized)
   - **Email** (optional)
   - **Project type** (optional, e.g., "Bathroom Renovation")
   - **Notes** (optional, context about the lead)
5. Click "Create." The system creates a new lead with `source: manual`.

**Outcome**: The lead appears in the leads list and is eligible for all automations (flow sequences, AI responses, scoring). Useful for capturing leads that bypass the phone/SMS system.

**Key API calls**:
- `POST /api/leads` (create lead with clientId, name, phone, email, projectType, notes)

---

### A22: Export Leads to CSV

**When**: Generating a report, importing into another CRM, or backing up lead data.

**Steps**:

1. Navigate to `/leads`.
2. Apply any desired filters (status, source, temperature, date range).
3. Click "Export" (CSV icon).
4. A CSV file downloads with all matching leads including: name, phone, email, status, source, temperature, score, project type, quote value, created date, and last activity.

**Outcome**: Filtered lead data exported in standard CSV format for external use.

**Key API calls**:
- `GET /api/leads/export?status=won&source=missed_call` (filters passed as query params)

---

### A23: Clone a Flow Template

**When**: Creating a variation of an existing template without starting from scratch.

**Steps**:

1. Navigate to `/admin/flow-templates`.
2. Find the template to clone.
3. Click "Clone."
4. The system creates a duplicate including all steps and conditions, with "(Copy)" appended to the name.
5. Edit the cloned template as needed.

**Outcome**: A new independent template pre-populated with the original's configuration. Saves time when creating variations for A/B testing or client-specific customizations.

**Key API calls**:
- `POST /api/admin/flow-templates/[id]/clone`

---

### A24: Manage Template Versions

**When**: Publishing a template update and reviewing version history.

**Steps**:

1. Navigate to `/admin/flow-templates/[id]`.
2. Make changes to the template steps or configuration.
3. Click "Publish" to create a versioned snapshot:
   - Enter optional **change notes** describing the update.
   - The system creates a `flow_template_versions` record with: version number, full snapshot of the template, change notes, timestamp, and who published it.
4. View the **Version History** panel to see:
   - All published versions in reverse chronological order.
   - Change notes for each version.
   - Who published and when.

**Outcome**: Complete audit trail of template changes. Enables safe iterative improvements knowing you can reference previous versions.

**Key API calls**:
- `POST /api/admin/flow-templates/[id]/publish` (create version with changeNotes)
- `GET /api/admin/flow-templates/[id]/versions` (list version history)

---

### A25: Manage Email Templates

**When**: Customizing the system's email communications (magic link emails, weekly summaries, trial reminders, etc.).

**Steps**:

1. Navigate to `/admin/email-templates`.
2. View the list of templates showing name, slug, and last updated date.
3. Click a template or "Create Template" to open the editor:
   - **Name**: Display name (e.g., "Weekly Summary Email")
   - **Slug**: Unique identifier (e.g., `weekly-summary`)
   - **Subject**: Email subject line with `{{variable}}` support
   - **HTML Body**: Rich text editor with variable interpolation
   - **Variables**: Available template variables (e.g., `{{businessName}}`, `{{ownerName}}`, `{{leadCount}}`)
4. Use the **Preview** panel to see the rendered email with sample data.
5. Save the template.

**Template lookup**: When the system sends an email, it checks the database for a matching template by slug. If none found, it falls back to the hardcoded default. This means the system works without any templates configured.

**Outcome**: Customizable email communications without code changes. Brand the emails to match the agency's style.

**Key API calls**:
- `GET /api/admin/email-templates` (list)
- `POST /api/admin/email-templates` (create)
- `GET /api/admin/email-templates/[id]` (get)
- `PATCH /api/admin/email-templates/[id]` (update)
- `DELETE /api/admin/email-templates/[id]` (delete)

---

### A26: Manage API Keys

**When**: A client needs programmatic access to the platform's API, or you need to generate keys for integrations.

**Steps**:

1. Navigate to `/admin/api-keys`.
2. Enter a **Client ID** and click "Load Keys" to see existing keys.
3. To create a new key:
   - Enter a **Label** (e.g., "Zapier Integration").
   - Select **Scopes**: `leads:read`, `leads:write`, `conversations:read`, `conversations:write`.
   - Click "Create."
4. The system generates a key with prefix `cs_` and displays it **once** in a green banner.
   - **Copy the key immediately** — it cannot be retrieved later.
   - The key is stored as a SHA-256 hash in the database.
5. The key list shows:
   - Label, prefix (first 8 chars), scopes as badges, creation date, last used date.
6. To revoke a key, click "Revoke" on its row.

**API key authentication**: External callers use `Authorization: Bearer cs_...` or `X-API-Key: cs_...` headers. The middleware validates the hash, checks scopes, and returns the associated clientId.

**Key API calls**:
- `GET /api/admin/api-keys?clientId=xxx` (list keys for client)
- `POST /api/admin/api-keys` (create key with clientId, label, scopes)
- `DELETE /api/admin/api-keys/[id]` (revoke key)

---

### A27: View Webhook Logs

**When**: Debugging inbound webhook issues, verifying Twilio events are arriving, or investigating a missing message.

**Steps**:

1. Navigate to `/admin/webhook-logs`.
2. View the log table showing recent webhook events:
   - **Event type** (e.g., `sms_inbound`, `voice_inbound`, `stripe_event`)
   - **Client ID** (which client the event relates to)
   - **Timestamp**
   - **Response status** (200, 400, 500)
3. **Filter** by client ID or event type using the dropdowns.
4. **Expand** any row to see the full payload (JSON viewer).
5. Pagination: 50 events per page.

**How events are logged**: The SMS and voice webhook handlers insert a log entry on every inbound event, including the raw payload and response status.

**Key API calls**:
- `GET /api/admin/webhook-logs?clientId=xxx&eventType=sms_inbound&page=1`

---

### A28: Manage Help Articles

**When**: Creating FAQ content for the client-facing help center.

**Steps**:

1. Navigate to `/admin/help-articles` (if a dedicated page exists) or manage via the API.
2. Create a new article:
   - **Title**: "How do I change my business hours?"
   - **Slug**: `change-business-hours` (auto-generated, unique)
   - **Content**: Detailed instructions in rich text.
   - **Category**: `getting-started`, `billing`, `features`, `troubleshooting`.
   - **Sort order**: Controls display position within category.
   - **Published**: Toggle to make visible to clients.
3. Edit or delete existing articles.
4. Published articles appear at `/client/help` for all client portal users.

**Outcome**: A self-service help center that reduces support tickets. Clients can search and browse articles by category.

**Key API calls**:
- `GET /api/admin/help-articles` (list)
- `POST /api/admin/help-articles` (create)
- `PATCH /api/admin/help-articles/[id]` (update)
- `DELETE /api/admin/help-articles/[id]` (delete)

---

### A29: Manage Subscription Plans

**When**: Creating or modifying the pricing tiers offered to clients.

**Steps**:

1. Navigate to `/admin/billing/plans`.
2. View existing plans with name, price, billing cycle, and feature details.
3. To create a new plan:
   - **Name**: "Growth Plan"
   - **Price**: $997/month
   - **Stripe Price ID**: Link to Stripe pricing
   - **Features**: JSON editor for included features and quotas (message limits, AI credits, etc.)
   - **Trial days**: Number of free trial days
4. Edit existing plans (name, features, pricing).
5. Delete plans that are no longer offered (won't affect existing subscribers).

**Outcome**: Full control over plan tiers without touching code. Changes are reflected in the client billing portal.

**Key API calls**:
- `GET /api/admin/plans` (list plans)
- `POST /api/admin/plans` (create plan)
- `PATCH /api/admin/plans/[id]` (update plan)
- `DELETE /api/admin/plans/[id]` (delete plan)

---

### A30: Configure System Settings

**When**: Adjusting platform-wide configuration (default behaviors, feature flags, limits).

**Preconditions**: Must be a **super admin** (`requireSuperAdmin()` — regular admins get 403).

**Steps**:

1. Navigate to `/admin/settings`.
2. View the key-value settings table showing all system configuration.
3. Add or edit settings:
   - **Key**: Unique identifier (e.g., `default_trial_days`, `max_message_length`)
   - **Value**: The setting value (string, stored as JSON if complex)
4. Save changes.

**Role gating**: This page and the underlying API are restricted to super admins. Other sensitive routes (plan management, client deletion) are similarly gated.

**Key API calls**:
- `GET /api/admin/system-settings` (list all settings)
- `POST /api/admin/system-settings` (create/update setting)
- `PUT /api/admin/system-settings/[key]` (update specific setting)

---

### A31: Manage Multiple Numbers per Client

**When**: A client needs more than one phone number (e.g., separate numbers for different service areas or marketing campaigns).

**Steps**:

1. Navigate to `/admin/clients/[id]/phone`.
2. View the phone number manager showing all assigned numbers:
   - Phone number, friendly name, primary badge, active status.
3. To add a number:
   - Enter the phone number and optional friendly name.
   - Click "Add." The system inserts into `client_phone_numbers` and marks it primary if it's the first number.
4. To set a different number as primary:
   - Click the star icon on the desired number.
   - The system updates `isPrimary` and syncs to `clients.twilioNumber` for backward compatibility.
5. To remove a number:
   - Click "Remove" on the number.
   - If the removed number was primary, the next number is auto-promoted.

**Backward compatibility**: The `clients.twilioNumber` field always reflects the primary number. Existing code that reads `twilioNumber` continues to work. The junction table (`client_phone_numbers`) enables multi-number lookup in SMS and voice webhooks.

**Key API calls**:
- `GET /api/admin/clients/[id]/phone-numbers` (list numbers)
- `POST /api/admin/clients/[id]/phone-numbers` (add number)
- `PATCH /api/admin/clients/[id]/phone-numbers/[phoneId]` (set primary)
- `DELETE /api/admin/clients/[id]/phone-numbers/[phoneId]` (remove number)

---

### A32: Send Payment Link to a Lead

**When**: A lead has agreed to a quote and needs to pay, or an invoice is outstanding.

**Steps**:

1. Navigate to the lead's detail page at `/leads/[id]`.
2. Click "Send Payment" or use the payment button in the conversation area.
3. Fill in payment details:
   - **Amount** (full invoice amount or deposit percentage)
   - **Description** (e.g., "Bathroom Renovation Deposit - 50%")
   - **Invoice reference** (optional, links to an existing invoice)
4. Click "Generate & Send."
5. The system:
   - Creates a Stripe payment link with the specified amount.
   - Sends the link to the lead via SMS: "Here's your payment link for {description}: {stripeLink}"
   - Records the payment request in the `payments` table.
6. When the lead pays:
   - Stripe webhook fires `checkout.session.completed`.
   - Invoice status updated to `paid`.
   - Both the lead and client/team are notified.
   - The payment success page is shown to the lead.

**Outcome**: Seamless payment collection via SMS. No need for the lead to visit a website or call to pay.

**Key API calls**:
- `POST /api/payments` (create payment link)
- `POST /api/payments/[id]/send` (send link via SMS)

---

### A33: Review Voice Call History

**When**: Checking what happened on voice AI calls, reviewing call quality, or debugging voice issues.

**Steps**:

1. Select a client using the Client Selector.
2. Navigate to the client detail page or use the voice AI section.
3. View the call history list showing:
   - Caller phone number and lead name
   - Call duration
   - Call status (completed, missed, transferred)
   - AI-generated summary
   - Timestamp
4. Click into a call to see:
   - Full **transcript** of the AI-lead conversation
   - **Summary**: AI-generated overview of what was discussed
   - **Intent**: What the caller wanted (booking, pricing, info, etc.)
   - **Sentiment**: Positive, neutral, negative, frustrated
   - **Outcome**: Whether the call led to a booking, transfer, or drop-off
   - **Recording URL** (if configured)

**Outcome**: Quality assurance on voice AI interactions. Identify when the AI handles calls well vs. when it needs improvement.

**Key API calls**:
- `GET /api/admin/clients/[id]/voice-calls` (list calls with pagination)

---

### A34: Configure Escalation Rules

**When**: Setting up or modifying what triggers an escalation for a specific client.

**Steps**:

1. Navigate to escalation configuration for the client (via settings or client detail).
2. View existing escalation rules:
   - **Trigger type**: pricing_request, complaint, high_intent, low_confidence, stuck, explicit_request
   - **Conditions**: Thresholds (e.g., confidence < 60%, sentiment < 30, 3+ exchanges without progress)
   - **Priority**: 1-5 (determines notification urgency)
   - **Active/inactive** toggle
3. Create a new rule:
   - Select trigger type and configure conditions.
   - Set priority level.
   - Choose notification targets (which team members).
4. Edit or delete existing rules.

**Default rules**: The system includes built-in escalation logic (pricing requests, complaints, high intent, low confidence, stuck conversations, explicit "talk to a person" requests). Custom rules supplement these defaults.

**Outcome**: Fine-tuned escalation behavior per client. A high-end contractor might escalate on any pricing mention, while a high-volume shop only escalates on explicit requests.

**Key API calls**:
- `GET /api/clients/[id]/escalation-rules` (list rules)
- `POST /api/clients/[id]/escalation-rules` (create rule)
- `PATCH /api/clients/[id]/escalation-rules/[ruleId]` (update rule)
- `DELETE /api/clients/[id]/escalation-rules` (delete rule)

---

### A35: Review and Resolve Knowledge Gaps

**When**: Periodically reviewing what questions the AI couldn't answer confidently, to improve the knowledge base.

**Steps**:

1. Navigate to the client's knowledge base at `/admin/clients/[id]/knowledge`.
2. Look for the **Knowledge Gaps** section showing:
   - Questions the AI was asked but couldn't answer confidently
   - Number of occurrences (how many times this gap appeared)
   - Confidence level at the time
   - Category (pricing, services, scheduling, etc.)
   - Resolution status (open vs. resolved)
3. For each gap:
   - Read the question that stumped the AI.
   - Create a new knowledge base entry that answers it (see A3).
   - Mark the gap as resolved — it links to the KB entry that fixed it (`resolvedByKbId`).
4. Over time, the gap list shrinks as the KB becomes more comprehensive.

**Outcome**: Continuous improvement cycle. The AI gets smarter for each client as gaps are identified and filled. "Why does the AI keep escalating on bathroom questions?" → add a KB entry about bathroom services → AI handles it next time.

---

### A36: Manage Review Response Templates

**When**: Creating reusable response templates for different types of reviews (positive, negative, complaint).

**Steps**:

1. Navigate to the review response management section.
2. View existing templates categorized by:
   - **Rating range**: Which star ratings this template applies to (e.g., 1-2 stars, 4-5 stars)
   - **Category**: positive, negative, complaint, neutral
   - **Keywords**: Trigger words that match this template (e.g., "late", "expensive", "great work")
3. Create a new template:
   - Set the rating range and category.
   - Write the response body with `{{variables}}`:
     ```
     Thank you for your feedback, {{reviewerName}}! We're sorry to hear
     about your experience with {{serviceType}}. {{ownerName}} would love
     to discuss this further — please call us at {{businessPhone}}.
     ```
   - Add keywords for matching.
4. Templates are used by the auto-review-response cron (S11) to generate AI-drafted responses.

**Outcome**: Consistent, on-brand review responses. The AI uses these templates as a starting point and personalizes them for each review.

**Key API calls**:
- `GET /api/admin/responses/[id]` (get template)
- `PUT /api/admin/responses/[id]` (update template)
- `DELETE /api/admin/responses/[id]` (delete template)

---

### A37: Define Client Service Catalog

**When**: Setting up the services a client offers, which drives AI classification and revenue tracking.

**Steps**:

1. Navigate to `/admin/clients/[id]/knowledge` or the structured interview form.
2. Use the **Service Catalog** section (synced to `client_services` table):
   - Add each service the client offers:
     - **Service name**: "Bathroom Renovation"
     - **Category**: "renovation", "plumbing", "electrical", etc.
     - **Description**: What's included in this service
     - **Price range**: Min and max (e.g., $5,000 - $25,000)
     - **Average value**: Typical job value (used for revenue estimation)
     - **AI disclosure rules**: What the AI can/cannot say about pricing
3. The catalog is used for:
   - **AI service classification**: When a lead mentions a project, the AI fuzzy-matches to the catalog and sets `lead.projectType`.
   - **Revenue by service**: Per-service pipeline and won value breakdown on the revenue dashboard.
   - **Estimated value auto-fill**: When the AI can't extract a dollar amount, it uses the service's average value.
   - **Knowledge base context**: Services are injected into AI prompts for accurate responses.

**Outcome**: The AI understands what the client offers, can classify leads by service type, and estimates revenue accurately.

**Key API calls**:
- `GET /api/admin/clients/[id]/services` (list services)
- Knowledge base structured form handles CRUD

---

### A38: Send Agency Messages to Clients

**When**: Sending important communications to clients that require urgency or categorization (different from support discussions).

**Steps**:

1. Navigate to `/admin/agency`.
2. View the agency communications dashboard:
   - **Pending action prompts**: Messages requiring client response
   - **Weekly digests**: Scheduled performance summaries
   - **Custom messages**: Free-form communications
3. Click "Send Message" to compose:
   - Select the **target client** (or all clients).
   - Choose a **category**: `custom`, `action_prompt`, `alert`, `digest`.
   - Set **urgency**: normal, high, critical.
   - Set **expiration** (optional, up to 168 hours for action prompts).
   - Write the message content.
4. Click "Send."
5. The message appears in the client's portal and/or triggers an email/SMS notification based on urgency.

**Difference from Discussions (A11)**: Discussions are two-way support threads. Agency messages are one-way communications with urgency levels, categories, and optional expiration. Think "announcement" vs. "support ticket."

**Outcome**: Proactive client communication. Alert a client about a billing issue, send a performance milestone notification, or prompt them to update their knowledge base.

**Key API calls**:
- `GET /api/admin/agency/messages` (list messages)
- `POST /api/admin/agency/messages` (send message)
- `POST /api/admin/agency/send-digest` (trigger weekly digest)

---

### A39: View NPS Dashboard

**When**: Reviewing customer satisfaction scores collected from post-service NPS surveys.

**Preconditions**: NPS surveys have been sent (see S12) and some responses received.

**Steps**:

1. Navigate to `/admin/nps`.
2. View the NPS dashboard:
   - **Average NPS score** across all clients
   - **Score distribution**: Breakdown of responses by score (1-10)
   - **Trend over time**: NPS score trend chart
   - **Recent responses**: Latest survey responses with score, comment, lead name, and client
3. Filter by client or date range.
4. Identify clients with low NPS scores for follow-up.

**Outcome**: Visibility into customer satisfaction across all clients. Identify which clients' customers are happiest and which need attention.

---

## Client User (Business Owner) Use Cases

### C1: First Login and Dashboard Orientation

**When**: Client has been onboarded by the admin and is logging in for the first time.

**Steps**:

1. Open the login page at `/login`.
2. Enter your business email address.
3. Check your inbox for a magic link from "Revenue Recovery."
4. Click the magic link. You are redirected to `/dashboard`.
5. The dashboard shows your key metrics:
   - Messages sent today
   - Missed calls captured
   - Active conversations
   - Upcoming appointments
6. Navigation bar at the top shows:
   - **Overview** (`/dashboard`) - Daily snapshot
   - **Leads** (`/leads`) - All captured leads
   - **Conversations** (`/conversations`) - Message threads
   - **Escalations** (`/escalations`) - Items needing your attention
   - **Scheduled** (`/scheduled`) - Upcoming automated messages
   - **Analytics** (`/analytics`) - Performance charts
   - **Settings** (`/settings`) - Configuration
   - **Discussions** (`/discussions`) - Support conversations

**Outcome**: Client understands the layout and can navigate to any section.

---

### C2: View and Manage Leads

**When**: Checking on captured leads, reviewing their status, or looking for hot prospects.

**Steps**:

1. Navigate to `/leads`.
2. View the leads list with:
   - Name and phone number
   - Source (missed call, form, SMS)
   - Status (new, contacted, estimate sent, won, lost)
   - Temperature indicator (cold, warm, hot)
   - Lead score (0-100)
   - Tags (color-coded badges)
   - Last activity timestamp
3. **Search and filter**:
   - Debounced search by name, phone, or email (case-insensitive)
   - Filter by status, source, temperature, and tags
   - Sort by updated date, created date, or score (ascending/descending)
4. **Bulk actions**: Select multiple leads via checkboxes, then apply bulk status changes.
5. **Create a lead manually**: Click "Add Lead" to open the dialog (see C12).
6. **Export to CSV**: Click "Export" to download filtered leads (see C13).
7. Click into a lead to see:
   - Full contact info
   - Score breakdown with contributing factors
   - Complete conversation history
   - Tags (add/remove)
   - Active flow executions with progress
   - Notes and project type
8. Update lead status as you work with them:
   - Mark as "Estimate Sent" after quoting
   - Mark as "Won" after closing
   - Mark as "Lost" if they chose a competitor

**Outcome**: Clear visibility into your pipeline. Know which leads are hot and need immediate attention vs. which are in the nurture sequence.

---

### C3: Read and Reply to Conversations

**When**: You want to see what the AI has been saying on your behalf, or send a manual message.

**Steps**:

1. Navigate to `/conversations`.
2. View the conversation list showing recent threads.
3. Click into a conversation to see the full message history:
   - Messages are labeled by sender (AI, You, Lead)
   - Timestamps on every message
   - Media attachments (photos, documents) displayed inline
4. To send a manual reply:
   - Type your message in the input box
   - Click "Send"
   - The message is sent via SMS through your Twilio number
   - Note: If AI mode is active, the AI may also respond to the lead's next message

**Outcome**: You can see exactly what the AI said, verify it was accurate, and jump in with a personal touch when needed.

---

### C4: Take Over a Conversation from AI

**When**: The AI is handling a conversation but you want to respond personally (e.g., a high-value lead or a complex question).

**Steps**:

1. Navigate to the conversation (via `/conversations` or `/leads/[id]`).
2. Click "Take Over" (or "Switch to Human").
3. The system:
   - Sets `conversationMode = 'human'` on the lead
   - Records `humanTakeoverAt` and `humanTakeoverBy`
   - AI stops auto-responding to this lead
4. Respond to the lead manually.
5. When done, click "Hand Back to AI" to resume automated responses.
   - The AI picks up where you left off, with full conversation context.

**Outcome**: Seamless handoff between AI and human. The lead never notices the switch. You handle the important conversations personally while AI manages the rest.

---

### C5: Handle an Escalation

**When**: The AI has flagged a conversation that needs human attention.

**Steps**:

1. Navigate to `/escalations`.
2. View the escalation queue with:
   - Lead name and phone
   - Escalation reason (e.g., "pricing request", "complaint", "high intent")
   - Priority level (1-5)
   - Time since escalation
   - SLA status (within SLA / breached)
3. Click into an escalation to see:
   - Full conversation history
   - AI-generated conversation summary
   - AI-suggested response
   - Escalation reason details
4. Choose an action:
   - **Respond**: Write and send a reply. Conversation mode switches to Human.
   - **Use AI suggestion**: Send the AI-generated response.
   - **Resolve**: Mark as handled without sending a message.
   - **Return to AI**: Let the AI continue handling it.
5. After resolving, set the resolution type:
   - `handled` - You responded
   - `converted` - Lead became a customer
   - `lost` - Lead not interested
   - `no_action` - Didn't need attention

**Outcome**: High-priority leads get personal attention. The AI handles routine conversations while you focus on the leads that matter most.

---

### C6: Add and Manage Team Members

**When**: You want to add employees who should receive escalation SMS alerts or hot transfer calls.

**Steps**:

1. Navigate to `/settings`.
2. Find the "Team Members" section.
3. Click "Add Team Member."
4. Enter their details:
   - Name
   - Phone number (for escalation SMS and hot transfers)
   - Email (optional, for email notifications)
   - Role (e.g., "Sales Manager", "Lead Technician")
5. Configure their notifications:
   - **Receive Escalations**: Toggle on if they should get SMS when leads need attention
   - **Receive Hot Transfers**: Toggle on if they should receive live call transfers
6. Set their **priority** (1 = first to be contacted for transfers).
7. To remove a team member, click "Remove" on their row.

**Outcome**: Your team stays informed about hot leads. When the AI can't handle a question, the right person gets notified immediately.

---

### C7: Configure Business Hours

**When**: Setting up or changing when hot transfers should be attempted.

**Steps**:

1. Navigate to `/settings`.
2. Find the "Business Hours" section.
3. For each day of the week:
   - Toggle the day on/off (off = not available)
   - Set start time (e.g., 8:00 AM)
   - Set end time (e.g., 5:00 PM)
4. Verify the timezone is correct (set during onboarding).
5. Click "Save."

**How it's used**: When a lead says "call me" during business hours, the system initiates a hot transfer to your team. Outside business hours, the AI tells the lead someone will call back and creates an escalation.

**Outcome**: Your team only gets live call transfers when they're actually available. Leads outside hours get a promise of callback.

---

### C8: Review Analytics

**When**: Checking how the service is performing for your business.

**Steps**:

1. Navigate to `/analytics`.
2. View the analytics dashboard:
   - **Messages sent** over time (chart)
   - **Missed calls captured** vs. total missed calls
   - **Conversations started** from automated messages
   - **Conversion funnel**: Lead → Contacted → Engaged → Qualified → Won
   - **Lead sources breakdown**: missed call vs. form vs. SMS
   - **Response time metrics**: How fast leads get their first reply
3. Use date range filters to compare periods.
4. View monthly trends to see growth over time.

**Outcome**: Data-driven understanding of how many leads the platform is capturing and converting. Proves ROI of the service.

---

### C9: Use Discussions for Support

**When**: You have a question about the platform or need help from the admin team.

**Steps**:

1. Navigate to `/discussions`.
2. Click "New Discussion."
3. Write your question or issue:
   ```
   The AI told a customer our hourly rate is $75 but it should
   be $85. Can you update the knowledge base?
   ```
4. Submit. The discussion appears in the admin's queue.
5. Check back later for a response. You'll see the admin's reply in the thread.
6. Continue the conversation if needed.

**Outcome**: Direct line of communication with the admin team without leaving the platform. Creates a record of all support interactions.

---

### C10: Approve an AI-Suggested Flow

**When**: The AI has detected a signal in a conversation and suggests starting an automation sequence.

**Steps**:

1. You receive an SMS:
   ```
   [Revenue Recovery] AI suggestion: Start "Estimate Follow-Up"
   sequence for John Smith. He asked about pricing in his last
   message. Reply YES to start or NO to skip.
   ```
2. Consider whether the sequence is appropriate:
   - Did the lead actually ask about pricing?
   - Is now a good time to send a follow-up sequence?
3. Reply **YES** to approve or **NO** to skip.
4. If approved:
   - The system starts the flow execution
   - Step 1 sends immediately
   - Subsequent steps follow the defined delays
   - Steps are skipped if the lead replies in the meantime
5. Monitor progress in `/scheduled` to see upcoming messages.

**Outcome**: The AI proactively identifies opportunities and you approve them with a single text. Combines AI intelligence with human judgment.

---

### C11: View Scheduled Messages

**When**: Checking what automated messages are queued to send.

**Steps**:

1. Navigate to `/scheduled`.
2. View upcoming messages with:
   - Recipient (lead name and phone)
   - Message content preview
   - Scheduled send time
   - Which flow/sequence it belongs to
3. If needed, cancel a scheduled message before it sends.

**Outcome**: Visibility into what the system will send on your behalf. No surprises.

---

### C12: Create a Lead Manually

Same workflow as A21 but accessed from the client dashboard at `/leads` → "Add Lead." Client users see the same dialog and create leads with `source: manual`.

---

### C13: Export Leads to CSV

Same workflow as A22 but accessed from the client dashboard at `/leads` → "Export" button. Exports the same CSV format with all filtered lead data.

---

### C14: Tag and Categorize Leads

**When**: You want to organize leads beyond the built-in status/temperature categories (e.g., "VIP", "referral", "repeat customer").

**Steps**:

1. Navigate to a lead's detail page at `/leads/[id]`.
2. Find the **Tags** section in the header area.
3. Type a tag name and press Enter to add it (e.g., "VIP", "insurance-job").
4. Click the × on any tag to remove it.
5. Tags appear as colored badges in the leads list.
6. Use the tag filter on the leads page to find all leads with a specific tag.

**Outcome**: Custom categorization system that works alongside status and temperature. Useful for client-specific workflows.

**Key API calls**:
- `PATCH /api/leads/[id]/tags` (update tags array)

---

### C15: Send Photos (MMS) to a Lead

**When**: You want to send a photo of completed work, a product image, or a document to a lead via MMS.

**Steps**:

1. Navigate to the lead's conversation at `/leads/[id]`.
2. In the reply area, click the photo/attachment icon.
3. Select an image file from your device.
4. Preview the image and add an optional text message.
5. Click "Send."
6. The system sends the image as MMS through the compliance gateway (opt-out and quiet hours checks still apply).

**Outcome**: The lead receives the photo via MMS from your business number. The attachment is stored in the conversation history.

---

### C16: Manage Automation Flows

**When**: You want to see which automation sequences are active for your business and toggle them on or off.

**Steps**:

1. Navigate to `/client/flows` (portal) or check per-lead flow status on `/leads/[id]`.
2. View all assigned flows with:
   - Flow name and description
   - Category (missed_call, appointment_reminder, win_back, etc.)
   - Trigger event
   - Active/inactive status
3. Toggle a flow on or off. For example, turn off "Win-Back" during a busy season when you don't need re-engagement.
4. On a lead's detail page, view the **Flow Executions** sidebar showing:
   - Active and paused flows
   - Current step progress
   - Next scheduled message time

**Outcome**: Self-service control over which automations run for your business, plus visibility into flow progress per lead.

---

### C17: Send Payment Link to a Lead

Same workflow as A32 but accessed from the client dashboard at `/leads/[id]` → payment button. See A32 for full steps including Stripe integration and payment confirmation flow.

---

### C18: Configure Escalation Rules

Same workflow as A34 but accessed from the client dashboard settings. Client users can view, toggle, and adjust thresholds on their own escalation rules. See A34 for full details on trigger types, conditions, and priority levels.

---

### C19: View Message Delivery Status

**When**: Checking whether a message you sent actually reached the lead.

**Steps**:

1. Navigate to a conversation at `/leads/[id]`.
2. Each outbound message shows a delivery status indicator:
   - **Queued** — Message accepted by Twilio
   - **Sent** — Handed to carrier
   - **Delivered** — Confirmed delivered to device
   - **Failed** — Message failed to send (check number validity)
   - **Undelivered** — Carrier could not deliver
3. Failed/undelivered messages are highlighted for attention.

**Outcome**: Confidence that your messages are reaching leads. Quick identification of bad phone numbers or carrier issues.

---

### C20: Receive and View Photos from Leads

**When**: A lead sends photos of their project (damage, current state, measurements) via MMS.

**Steps**:

1. Navigate to the conversation at `/leads/[id]`.
2. Inbound MMS photos appear inline in the message thread.
3. Click on a photo to view it full-size.
4. Media attachments are also accessible from the lead's media tab.
5. The AI can reference received photos in its responses (e.g., "Thanks for the photos! I can see the water damage — let me get {ownerName} to take a look and send you an estimate.").

**Outcome**: Visual context for estimates and quotes. Leads can show you the job before you visit.

---

## Client Portal User Use Cases

### P1: Access the Portal via Link or OTP

**When**: Client receives a weekly summary email, a direct link, or navigates to the login page.

**Option A — Link access**:
1. Click the portal link in your email (e.g., `https://app.conversionsurgery.com/d/[token]`).
2. The system sets a `clientSessionId` cookie and redirects to `/client`.
3. No password needed — the link contains the session token.

**Option B — OTP login**:
1. Navigate to `/client-login`.
2. Enter your business email address.
3. Click "Send Code."
4. Check your inbox for a 6-digit verification code (sent via Resend).
5. Enter the code within 10 minutes.
6. The system verifies the code against the `otp_codes` table, looks up the client by email, sets a session cookie, and redirects to `/client`.

**OTP security notes**:
- OTP codes expire after 10 minutes.
- Used codes are marked as consumed and cannot be reused.
- Rate limiting prevents brute-force attempts.

**Portal navigation** (9 items):
Dashboard, Conversations, Revenue, Knowledge Base, Flows, Billing, Settings, Help, Discussions

**Outcome**: Access to the full self-service client portal with revenue tracking, KB management, flow control, billing, AI settings, and more.

**Key API calls** (OTP):
- `POST /api/client/auth/send-otp` (send code to email)
- `POST /api/client/auth/verify-otp` (verify code, create session)

---

### P2: Review Weekly Performance Summary

**When**: After receiving the weekly summary email, you want to dive deeper.

**Steps**:

1. Access the portal (P1).
2. The dashboard at `/client` shows:
   - **Monthly stats**: Leads captured, messages sent, appointments booked
   - **Recent leads**: Name, source, and status of the latest leads
   - **Upcoming appointments**: Next scheduled events
3. For deeper revenue insights, visit `/client/revenue` (see P8).
4. Compare with previous periods to gauge performance.

**Outcome**: At-a-glance understanding of what the service has done for you this week.

---

### P3: View Conversation History

**When**: You want to see what messages have been exchanged with your leads.

**Steps**:

1. Navigate to `/client/conversations`.
2. Browse conversation threads.
3. Click into a conversation to read the full message history.
4. Filter by inbound (from leads) or outbound (from AI/team).

**Outcome**: Transparency into exactly what's being said to your customers on your behalf.

---

### P4: Manage Billing and Subscription

**When**: Checking your subscription status, viewing payment history, or upgrading.

**Steps**:

1. Navigate to `/client/billing`.
2. View:
   - Current plan and price
   - Subscription status (active, trial, past due)
   - Usage this month vs. limit
   - Payment method on file
3. To upgrade, click "Upgrade" and select a higher plan.
4. Payment is processed through Stripe.

**Outcome**: Self-service billing management. See exactly what you're paying for and how much you're using.

---

### P5: Configure Weekly Summary Preferences

**When**: You want to change when you receive your weekly performance email.

**Steps**:

1. Navigate to `/client/settings`.
2. Find the "Weekly Summary" section.
3. Select your preferred day of the week (e.g., Monday).
4. Select your preferred time (e.g., 9:00 AM).
5. Toggle on/off specific sections of the summary.
6. Save preferences.

**Outcome**: Your weekly summary arrives exactly when you want it.

---

### P6: Cancel Subscription

**When**: You've decided to discontinue the service.

**Steps**:

1. Navigate to `/client/settings`.
2. Scroll to the "Danger Zone" section.
3. Click "Cancel Subscription."
4. You're taken to `/client/cancel` with a 3-step process:
   - **Step 1**: Reason for cancellation (dropdown + free text).
   - **Step 2**: Option to schedule an exit call with the admin team (to discuss concerns and potentially retain).
   - **Step 3**: Confirmation. Read the impact statement and confirm cancellation.
5. If you scheduled an exit call, you'll be redirected to `/client/cancel/call-scheduled`.
6. If you confirmed, you'll see `/client/cancel/confirmed`.

**Outcome**: The subscription is marked for cancellation. Service continues until the end of the current billing period. Admin is notified.

---

### P8: View Revenue Dashboard

**When**: Checking the business impact of the platform — how much revenue is being recovered.

**Steps**:

1. Navigate to `/client/revenue`.
2. View the 30-day ROI dashboard:
   - **Revenue pipeline**: Total pipeline value + confirmed (won) value
   - **Month-over-month change**: Pipeline trend vs. previous period
   - **Response time**: Average first-response time with industry benchmark (42 minutes) comparison
   - **Speed multiplier**: "54x faster than industry average"
   - **Missed calls captured**: 30-day count of leads recovered from missed calls
   - **Appointments booked**: 30-day booking count
   - **Leads re-engaged**: Win-back re-engagement count
   - **ROI multiplier**: Won value divided by subscription cost
   - **Revenue by service**: Per-service breakdown when multi-service catalog is populated

**Outcome**: Data-driven proof of ROI. See exactly how much revenue the platform has generated compared to the subscription cost.

**Key API calls**:
- `GET /api/client/revenue` (pipeline, speed, activity, service breakdown)

---

### P9: Manage Knowledge Base

**When**: Adding or updating information the AI should know about your business.

**Steps**:

1. Navigate to `/client/knowledge`.
2. View existing KB entries grouped by category (services, pricing, FAQ, policies, about, custom).
3. Click "Add Entry" to create a new one:
   - Select a **category**
   - Enter a **title** and **content**
   - Add **keywords** for AI search matching
4. Click "Edit" on existing entries to update information.
5. Click "Delete" to remove outdated entries.

**How it's used**: When leads text your number, the AI searches these entries to give accurate, business-specific answers. The more complete your KB, the better the AI performs.

**Outcome**: Direct control over what the AI knows about your business. Update pricing, add new services, or correct information without contacting the admin.

**Key API calls**:
- `GET /api/client/knowledge` (list entries)
- `POST /api/client/knowledge` (create entry)
- `PATCH /api/client/knowledge/[id]` (update entry)
- `DELETE /api/client/knowledge/[id]` (delete entry)

---

### P10: Manage Automation Flows

Same workflow as C16 but accessed via the client portal at `/client/flows`. See C16 for full details on viewing flows, toggling active/inactive, and per-lead flow status.

**Key API calls**:
- `GET /api/client/flows` (list assigned flows)
- `PATCH /api/client/flows/[id]` (toggle active/inactive)

---

### P11: Configure AI Settings

**When**: Customizing how the AI communicates with your leads.

**Steps**:

1. Navigate to `/client/settings/ai`.
2. Configure the AI assistant:
   - **Tone**: Professional, Friendly, or Casual
   - **Emojis**: Enable/disable emoji usage in AI messages
   - **Signature**: Custom text appended to AI messages
   - **Primary goal**: What the AI should aim for (book appointment, get estimate, etc.)
   - **Quiet hours**: When the AI should not send messages (separate from system quiet hours)
3. Save changes.

**Outcome**: The AI communicates in your preferred style. A plumber might want "friendly + casual" while a law firm wants "professional + no emojis."

**Key API calls**:
- `GET /api/client/ai-settings` (fetch settings)
- `POST /api/client/ai-settings` (update settings)

---

### P12: Configure Feature Toggles

**When**: Enabling or disabling specific platform features for your business.

**Steps**:

1. Navigate to `/client/settings/features`.
2. View the safe subset of feature toggles available to clients:
   - **Missed call SMS**: Auto-text when calls go unanswered
   - **AI responses**: AI auto-responds to incoming SMS
   - **Photo requests**: AI can request photos from leads
   - **Email notifications**: Receive email alerts
   - **SMS notifications**: Receive SMS alerts
3. Toggle each feature on or off.
4. Save changes.

**Note**: Some features (voice AI, hot transfers, calendar sync) are admin-only and cannot be self-configured.

**Outcome**: Control over which features are active without contacting the admin.

**Key API calls**:
- `GET /api/client/features` (fetch toggle state)
- `POST /api/client/features` (update toggles)

---

### P13: Configure Notification Preferences

**When**: Controlling what notifications you receive and when.

**Steps**:

1. Navigate to `/client/settings/notifications`.
2. Configure per-notification toggles:
   - **New leads** (SMS / Email)
   - **Escalations** (SMS / Email)
   - **Weekly summaries** (Email)
   - **Daily summaries** (Email)
   - **Flow approvals** (SMS)
   - **Negative reviews** (SMS / Email)
3. Set **quiet hours**: Start time, end time, and urgent override toggle.
4. Save preferences.

**Outcome**: Only receive the notifications you want, at the times you want.

**Key API calls**:
- `GET /api/client/notifications` (fetch preferences)
- `POST /api/client/notifications` (update preferences)

---

### P14: Browse Help Articles

**When**: Looking for answers to common questions about the platform.

**Steps**:

1. Navigate to `/client/help`.
2. Browse articles organized by category.
3. Use the **search bar** to find specific topics.
4. Click an article to expand it and read the full content.

**Outcome**: Self-service answers without submitting a support ticket. Reduces admin workload.

**Key API calls**:
- `GET /api/client/help-articles` (fetch published articles)

---

### P15: Use Discussions for Support

Same workflow as C9 but accessed via the client portal at `/client/discussions`. Portal users can create support threads, view admin replies, and continue conversations. The floating help button (visible on all non-admin pages) also opens a quick support ticket modal.

---

### P16: Approve AI-Suggested Actions

**When**: The AI has identified an opportunity (e.g., a lead asking about pricing should trigger an estimate follow-up flow) and suggests it in-app.

**Steps**:

1. Navigate to `/client/conversations/[id]`.
2. When the AI detects an opportunity, a **suggestion card** appears below the conversation:
   - Suggested action (e.g., "Start Estimate Follow-Up sequence")
   - Reason (e.g., "Lead asked about pricing in last message")
   - Status: pending
3. Choose an action:
   - **Approve** → The flow starts immediately. Step 1 sends within minutes.
   - **Reject** → The suggestion is dismissed.
4. Approved suggestions are tracked with timestamp and outcome.

**Difference from C10**: C10 is SMS-based approval (reply YES/NO to a text). P16 is the in-app portal version with richer context and one-click approval.

**Key API calls**:
- `GET /api/client/leads/[id]/suggestions` (list pending suggestions)
- `POST /api/client/leads/[id]/suggestions` (approve/reject)

---

## Lead (Homeowner) Use Cases

Leads interact with the platform entirely through SMS and phone calls. They never see a dashboard. Understanding their experience is critical for testing.

### L1: Book an Appointment via SMS

**When**: A lead wants to schedule a service call or estimate visit.

**Flow**:

1. Lead texts something indicating booking intent:
   ```
   "Can you come out this week to look at my bathroom?"
   ```
2. The AI detects booking intent using keyword + context analysis.
3. AI checks the client's **business hours** and **existing appointments** for the next 7 days.
4. AI suggests 2-3 available time slots spread across different days, preferring mid-morning:
   ```
   "I'd love to set that up! Here are some available times:
   - Tuesday at 10:00 AM
   - Wednesday at 2:00 PM
   - Thursday at 10:30 AM
   Which works best for you?"
   ```
5. Lead replies with a preference:
   ```
   "Tuesday works"
   ```
6. AI matches "Tuesday" to the available slot and confirms:
   ```
   "Great! You're booked for Tuesday at 10:00 AM.
   {ownerName} will be there. You'll get a reminder
   the day before. See you then!"
   ```
7. The system:
   - Creates an **appointment** record
   - Schedules **reminders** (day-before at 10am, 2 hours before)
   - Creates a **calendar event** (if Google Calendar connected)
   - Sends **contractor notification** SMS to the team
   - Updates lead status to `scheduled`

**Rescheduling**: Lead can text "Can we reschedule?" → AI cancels old appointment, offers new slots.

**Cancellation**: Lead can text "I need to cancel" → AI cancels with a grace message.

---

### L2: Receive and Respond to Automated Messages

**When**: A lead receives automated messages from flow sequences (missed call follow-up, appointment reminders, win-back, etc.).

**Flow**:

1. Lead receives an automated SMS:
   ```
   "Hi! This is Dave from Dave's Plumbing. I noticed you tried
   to call - how can I help you today?"
   ```
2. If the lead **replies**, the system:
   - Pauses any active flow (stops further automated messages)
   - Routes the reply to the AI for a conversational response
   - Updates lead status and engagement score
3. If the lead **doesn't reply**, the flow continues:
   - Step 2 sends after the configured delay (e.g., 60 minutes)
   - Step 3 sends after a longer delay (e.g., 24 hours)
   - Flow stops after all steps complete or max attempts reached
4. At any point, the lead can text **STOP** to opt out (see L3).

**Key behavior**: Automated messages sound human-like and reference the lead's specific situation. They're personalized by the AI using context from the conversation history and knowledge base.

---

### L3: Opt Out of Messages

**When**: A lead wants to stop receiving messages.

**Flow**:

1. Lead sends any opt-out keyword: STOP, UNSUBSCRIBE, CANCEL, END, QUIT, STOPALL, OPT OUT, REMOVE.
2. Immediate confirmation:
   ```
   "You've been unsubscribed from {businessName} messages.
   Reply START to re-subscribe."
   ```
3. The system:
   - Adds to blocked numbers
   - Sets `lead.optedOut = true`
   - Cancels ALL scheduled messages
   - Stops ALL active flows
   - Logs to compliance audit trail
4. No further messages are sent — every compliance check blocks this number.

**Re-subscription**: Lead texts START, YES, UNSTOP, SUBSCRIBE, or OPTIN → opt-out reversed, messaging resumes.

---

## Team Member Use Cases

Team members are **not dashboard users**. They interact with the platform entirely through SMS and phone calls.

### T1: Receive and Claim an Escalation

**When**: The AI has detected a lead that needs human attention and sends you an SMS.

**Steps**:

1. You receive an SMS from the platform:
   ```
   [ESCALATION] New lead needs attention!

   Lead: John Smith (403-555-1234)
   Reason: Pricing request - asked about bathroom reno cost
   Last message: "How much would a full bathroom renovation cost?"

   Claim this lead: https://app.conversionsurgery.com/claim?token=abc123
   ```
2. If you can handle it, click the claim link.
3. The claim page shows:
   - Lead details (name, phone, source)
   - Conversation summary (AI-generated)
   - AI-suggested response
4. Click "Claim" to assign the lead to yourself.
5. The system:
   - Marks the escalation as "claimed"
   - Switches the lead's conversation mode to "human"
   - Notifies other team members that it's been claimed
6. You can now respond to the lead directly by calling or texting their number.

**If you can't handle it**: Ignore the SMS. The escalation stays in the queue for other team members or the admin.

**Outcome**: The highest-intent leads get personal attention from a real person within minutes.

---

### T2: Receive a Hot Transfer Call

**When**: A lead is on the phone with the AI and asks to speak to a person, or the AI detects high buying intent during business hours.

**Steps**:

1. Your phone rings from the platform's number.
2. Answer the call.
3. You hear a brief announcement: "Incoming transfer from [Business Name]. Lead: John Smith."
4. You're connected directly to the lead.
5. Have your conversation normally.
6. When the call ends, the system:
   - Records the call duration
   - Generates an AI summary of the conversation
   - Updates the lead's status
   - Logs the outcome (qualified, scheduled, dropped, etc.)

**If you don't answer**: The system tries the next team member in priority order. If no one answers, the AI tells the lead someone will call back and creates an escalation.

**Outcome**: Hot leads get connected to a real person in real-time. The window of buying intent is captured while it's open.

---

### T3: Respond to a Claimed Lead

**When**: After claiming an escalation (T1), you need to follow up with the lead.

**Steps**:

1. Call or text the lead's phone number directly from your phone.
2. Reference the conversation summary from the claim page for context:
   - What the lead asked about
   - What the AI already told them
   - The AI's suggested response
3. Handle the conversation:
   - Answer their question
   - Provide a quote
   - Schedule an appointment
   - Whatever the situation calls for
4. The platform detects your outbound communication and logs it in the conversation history.
5. The escalation is automatically marked as "handled" when you respond.

**Outcome**: Seamless continuation of the conversation the AI started. The lead gets a complete experience without gaps.

---

## System / Automated Use Cases

These happen without any user action. Understanding them is essential for operations.

### S1: Missed Call Recovery (End-to-End)

**Trigger**: Someone calls a client's Twilio number and it goes unanswered.

**Flow**:

1. **Call arrives** → Twilio receives inbound call to client's number.
2. **Ring-through** → Call rings to team members (if configured). No one answers.
3. **Webhook fires** → Twilio sends `CallStatus: no-answer` to `/api/webhooks/twilio/voice`.
4. **Deduplication check** → System checks if SMS was already sent for this `CallSid`. Prevents double messages.
5. **Client lookup** → Finds the client by matching the Twilio number.
6. **Feature check** → Verifies `missedCallSmsEnabled = true` for this client.
7. **Lead creation** → Creates or updates a lead with `source: missed_call`.
8. **Compliance check** → Verifies the number isn't blocked, opted out, or on the DNC list. Checks quiet hours.
9. **Template rendering** → Uses the client's missed call template (or default): `"Hi! This is {ownerName} from {businessName}. I saw you tried to call - how can I help?"`
10. **SMS sent** → Twilio sends the message from the client's number.
11. **Conversation logged** → Both the missed call event and the outbound SMS are recorded.
12. **Stats updated** → `missedCallsCaptured++`, `messagesSent++` on `daily_stats`.
13. **Flow triggered** → If a "Missed Call Follow-Up" flow is configured, it starts executing (e.g., second message in 60 minutes, third in 24 hours).

**Latency**: Entire process completes in under 5 seconds from the missed call event.

---

### S2: Form Submission Response

**Trigger**: A lead submits a contact form on the client's website.

**Flow**:

1. **Form webhook** → Client's website POSTs to `/api/webhooks/form` with `{ clientId, name, phone, email, message, projectType }`.
2. **Validation** → Phone number is normalized and validated.
3. **Client lookup** → Finds the client by `clientId`.
4. **Lead creation** → Creates or updates a lead with `source: form`. Merges form data (name, email, address, project type).
5. **Notes enrichment** → Appends `[Form] {message}` to lead notes.
6. **Compliance check** → Same as S1.
7. **Auto-response** → Sends: `"Hi {name}, thanks for reaching out to {businessName}! We received your inquiry about {projectType}. {ownerName} will follow up shortly."`
8. **Conversation logged** → Inbound form submission + outbound SMS both recorded.
9. **Stats updated** → `formsResponded++`, `messagesSent++`.
10. **Flow triggered** → If a "Form Follow-Up" flow is configured, it starts.

---

### S3: Incoming SMS AI Response

**Trigger**: A lead sends a text message to a client's Twilio number.

**Flow**:

1. **SMS webhook** → Twilio POSTs to `/api/webhooks/twilio/sms` with the message body and sender number.
2. **Client lookup** → Finds client by the receiving Twilio number.
3. **Lead lookup** → Finds or creates lead by phone number.
4. **Conversation logged** → Inbound message stored.
5. **Mode check** → If `conversationMode = 'human'`, skip AI response (human is handling it).
6. **Opt-out check** → If message is "STOP", "UNSUBSCRIBE", etc., process opt-out (S10) and stop.
7. **Keyword check** → If message is "CLAIM {token}", process escalation claim and stop.
8. **AI enabled check** → Verify `aiResponseEnabled = true` for this client.
9. **Knowledge context** → Fetch all active knowledge base entries for the client. Search for the most relevant entries using keywords from the incoming message.
10. **Conversation history** → Load last 10 messages for context.
11. **AI generation** → Send to OpenAI with system prompt (business info + knowledge) and conversation history. Model generates a response.
12. **Confidence check** → If confidence < 0.7, trigger escalation (S1-adjacent) instead of sending the response.
13. **Hot intent check** → If the lead shows buying signals ("ready to book", "when can you start"), check business hours:
    - During hours → Initiate ring group / hot transfer (S7)
    - After hours → Send acknowledgment + create escalation
14. **Lead scoring** → Update the lead's score based on the new message (S4).
15. **SMS sent** → AI response delivered via Twilio.
16. **Stats updated** → `messagesSent++`, `conversationsStarted++` (if first exchange).

---

### S4: Lead Scoring Update

**Trigger**: Every incoming message from a lead.

**Flow**:

1. **Quick score** → Keyword matching on the message:
   - Urgency keywords: "today", "ASAP", "urgent", "emergency" → +urgency
   - Budget keywords: "ready to pay", "approved", "budget" → +budget
   - Intent keywords: "when can you start", "let's do it", "schedule" → +intent
   - Engagement: Reply frequency, speed → +engagement
2. **Score calculation** → Each factor is 0-25, total 0-100.
3. **Score storage** → `leads.score`, `leads.scoreFactors` (JSON), `leads.scoreUpdatedAt`.
4. **Temperature update**:
   - 0-33 → cold
   - 34-66 → warm
   - 67-100 → hot
5. **AI scoring** (for high signals) → If quick score detects hot keywords, a deeper AI analysis runs to confirm.
6. **Escalation trigger** → If score jumps above 70 and lead isn't already being handled, trigger escalation.

---

### S5: Appointment Reminder Sequence

**Trigger**: Cron job runs `/api/cron/process-scheduled` at regular intervals.

**Flow**:

1. **Query** → Find all `calendar_events` with appointments in the next 24 hours.
2. **Day-before reminder** (if `reminderDayBeforeSent = false` and appointment is tomorrow):
   ```
   Reminder: You have an appointment with {businessName} tomorrow
   at {time}. Reply YES to confirm or let us know if you need
   to reschedule.
   ```
3. **2-hour reminder** (if `reminder2hrSent = false` and appointment is in 2 hours):
   ```
   Your appointment with {businessName} is at {time} today.
   See you soon! Reply if you need to make any changes.
   ```
4. **Flags updated** → Mark each reminder as sent to prevent duplicates.
5. **Stats updated** → `appointmentsReminded++`.

---

### S6: Compliance Check Before Sending

**Trigger**: Every outbound message, before it's actually sent.

**Flow**:

1. **Cache check** → Look in `compliance_check_cache` for a recent result (1 hour TTL). If found and valid, use cached result.
2. **Consent check** → Query `consent_records` for valid consent:
   - Express written, express oral, implied, or transactional.
   - Must not be expired or revoked.
3. **Opt-out check** → Query `opt_out_records` for active opt-outs.
4. **DNC check** → Query `do_not_contact_list` for the phone number:
   - Global list (all clients)
   - Client-specific list
   - Check expiry dates
5. **Quiet hours check** → Query `quiet_hours_config`:
   - Convert current time to recipient's timezone
   - Check if within quiet window
   - Weekend overrides may apply
6. **Decision**:
   - **Pass** → Message sent normally. Result cached.
   - **Blocked** → Message not sent. Reason logged to `compliance_audit_log`.
   - **Queued** → Message scheduled for after quiet hours end.
7. **Audit log** → Every check result (pass or block) is recorded with timestamp, reason, and actor.

---

### S7: Hot Intent Detection and Ring Group

**Trigger**: AI detects high buying intent during business hours.

**Flow**:

1. **Intent detected** → AI sees phrases like "ready to book", "can you come today", "let's schedule".
2. **Business hours check** → Is it within the client's configured hours?
3. **If yes** → Initiate ring group:
   - Send acknowledgment to lead: "Great! Let me connect you with {ownerName} right now."
   - Call team members in priority order (highest priority first).
   - First person to answer gets connected to the lead via Twilio conference.
   - If no one answers after cycling through all members, tell the lead: "Sorry, everyone's busy right now. {ownerName} will call you back within the hour."
4. **If no (after hours)** → Create escalation:
   - Send to lead: "Thanks! {ownerName} will call you back first thing in the morning."
   - Notify team members via SMS.
   - Create escalation queue entry with `priority: 1`.

---

### S8: Voice AI Call Handling

**Trigger**: Inbound phone call when Voice AI is enabled.

**Flow**:

1. **Call arrives** → Twilio webhook at `/api/webhooks/twilio/voice`.
2. **Client lookup** → Match by Twilio number.
3. **Mode check**:
   - `always` → AI answers.
   - `after_hours` → Check business hours. If outside hours, AI answers. Otherwise, ring team.
   - `overflow` → Try team first. If no answer, AI takes over.
4. **AI greeting** → Text-to-speech plays the custom greeting.
5. **Gather input** → `<Gather>` listens for caller's speech.
6. **Process speech** → Transcribe and send to AI for response.
7. **AI responds** → Text-to-speech plays the AI's answer.
8. **Loop** → Continue conversation until:
   - Caller hangs up
   - Transfer requested ("I want to speak to someone") → Connect to team member
   - Max duration reached
9. **Post-call processing**:
   - Create `voice_calls` record with transcript.
   - AI generates call summary, extracts intent and sentiment.
   - Update lead status.
   - Send follow-up SMS if appropriate: "Thanks for calling! As discussed, I'll send over that estimate today."

---

### S9: Daily Stats Aggregation

**Trigger**: Every event that affects metrics (message sent, call captured, etc.) and daily cron job.

**Flow**:

**Real-time upserts** (throughout the day):
- Each message sent → `messagesSent++`
- Each missed call → `missedCallsCaptured++`
- Each form response → `formsResponded++`
- Each new conversation → `conversationsStarted++`
- Each appointment reminder → `appointmentsReminded++`
- Each payment requested → `paymentsRequested++`

**Daily cron** (`/api/cron/daily`):
1. Roll up daily stats into weekly aggregation.
2. Roll up weekly into monthly aggregation.
3. Calculate platform-wide analytics.
4. Check usage limits for all clients.
5. Fire usage alerts if thresholds exceeded.

---

### S10: Opt-Out Processing

**Trigger**: Lead sends "STOP", "UNSUBSCRIBE", "CANCEL", "END", or "QUIT".

**Flow**:

1. **Keyword detected** → Incoming SMS matches opt-out keywords.
2. **Opt-out record created** → `opt_out_records` entry with timestamp and keyword used.
3. **Blocked number added** → Phone number added to `blocked_numbers` for this client.
4. **Lead updated** → `lead.optedOut = true`, `lead.optedOutAt = now()`.
5. **Scheduled messages cancelled** → All pending `scheduled_messages` for this lead are cancelled.
6. **Active flows stopped** → Any running `flow_executions` are cancelled.
7. **Confirmation sent** → "You've been unsubscribed from {businessName} messages. Reply START to re-subscribe."
8. **Audit log** → Event recorded in `compliance_audit_log`.
9. **No further messages** → All future compliance checks for this number will block sending.

**Re-subscription**: If the lead sends "START", the opt-out is reversed, blocked number is removed, and they're restored to active status.

---

### S11: Auto Review Response Generation

**Trigger**: Cron job runs `/api/cron/auto-review-response` every 30 minutes.

**Flow**:

1. **Query clients** → Find all active clients with `autoReviewResponseEnabled = true`.
2. **Find unresponded reviews** → Query reviews without responses (`hasResponse = false`).
3. **Generate drafts** → For each review, call `createDraftResponse(reviewId)`:
   - AI analyzes the review text, star rating, and client's business context.
   - Generates a professional, personalized response.
   - Stores as `status: draft` in `review_responses`.
4. **Auto-post approved** → Find responses with `status: approved`:
   - Call `postResponseToGoogle(responseId)` to publish via Google Business API.
   - Update status to `posted`.

**Outcome**: Reviews get AI-drafted responses automatically. Approved responses are posted without manual intervention. Negative reviews get timely, professional replies.

---

### S12: NPS Survey Sending

**Trigger**: Cron job runs `/api/cron/send-nps` periodically.

**Flow**:

1. **Find eligible leads** → Query completed appointments that are 4+ hours old and haven't been surveyed.
2. **Create survey** → Insert `nps_surveys` record with status `sent`.
3. **Send SMS** → Text the lead: "How would you rate your experience with {businessName}? Reply with a number 1-10."
4. **Receive response** → The lead's reply arrives via the main SMS webhook (`/api/webhooks/twilio/sms`). The NPS service processes it:
   - Parse the score (1-10) from the SMS body.
   - Store in `nps_surveys.score`.
   - If the lead includes a comment, store in `nps_surveys.comment`.
   - Update status to `responded`.

**Outcome**: Post-service satisfaction data collected automatically. NPS scores visible on the admin NPS dashboard (see A39).

---

### S13: Trial Reminder Emails

**Trigger**: Cron job runs `/api/cron/trial-reminders` daily.

**Flow**:

1. **Query trial clients** → Find subscriptions with `status: trialing` and active trial periods.
2. **Check milestones** → For each trial:
   - Day 7: Send "You're halfway through your trial" email.
   - Day 12: Send "Only 2 days left" email.
   - Day 14 (or trial end): Send "Your trial ends today" email.
3. **Render email** → Use the email template system (DB template or hardcoded fallback).
4. **Send via Resend** → Deliver to the client's email.

**Outcome**: Clients are reminded of trial progress and encouraged to convert. Higher trial-to-paid conversion rate.

---

### S14: Calendar Event Creation on Booking

**Trigger**: A lead books an appointment through the conversational AI.

**Flow**:

1. **Appointment confirmed** → `bookAppointment()` creates the appointment record.
2. **Calendar check** → Verify client has `calendarSyncEnabled = true` and an active calendar integration.
3. **Create event** → Call `createEvent()` with:
   - Client ID and lead ID
   - Title: `"{projectType}: {leadName}"` (or "Service Call: Customer")
   - Start time and end time (defaults to 1 hour)
   - Location (from lead's address if available)
   - Event type: `estimate`
4. **Calendar API** → Push to Google Calendar via OAuth.
5. **Failure handling** → Calendar errors are caught silently — the booking succeeds regardless.

**Outcome**: Appointments automatically appear on the client's Google Calendar. No manual calendar entry needed.

---

### S15: SMS Delivery Status Tracking

**Trigger**: Twilio sends a status callback after each outbound SMS.

**Flow**:

1. **Send SMS** → Outbound messages include a `statusCallback` URL pointing to `/api/webhooks/twilio/status`.
2. **Status update** → Twilio POSTs status changes:
   - `queued` → Message accepted by Twilio
   - `sent` → Message handed to carrier
   - `delivered` → Message confirmed delivered to device
   - `failed` → Message failed to send
   - `undelivered` → Message could not be delivered
3. **Database update** → Webhook handler matches by `MessageSid` and updates `conversations.deliveryStatus`.
4. **Error tracking** → Failed/undelivered messages include an `ErrorCode` for diagnosis.

**Outcome**: Real-time delivery status visible on each message in the conversation UI. Failed messages are flagged for attention.

---

### S16: Agency Digest Email

**Trigger**: Cron job runs `/api/cron/agency-digest` weekly.

**Flow**:

1. **Compile metrics** → For each active client, aggregate the week's performance:
   - Messages sent, leads captured, appointments booked
   - Conversion rate, response time
   - Active flows, escalation count
2. **Render digest** → Build a formatted email with per-client summaries.
3. **Send via Resend** → Deliver to all opted-in clients.

**Outcome**: Clients receive a weekly performance snapshot email. Reinforces the value of the service and keeps clients engaged.

---

### S17: No-Show Recovery Automation

**Trigger**: Cron job runs `/api/cron/no-show-recovery` daily.

**Flow**:

1. **Find no-shows** → Query appointments where the scheduled time has passed and the lead's status indicates they didn't show up (no check-in, no follow-up activity).
2. **Eligibility check** → Verify the lead hasn't opted out, isn't blocked, and the client has flows enabled.
3. **Send recovery message** → AI generates a personalized follow-up:
   ```
   Hi {leadName}! We missed you at your appointment today with
   {businessName}. Things happen! Would you like to reschedule?
   We'd love to help with your {projectType}.
   ```
4. **Update lead** → Mark as no-show in the system, update status.
5. **Start recovery flow** → If a "No-Show Recovery" flow template is assigned, begin the multi-step sequence (initial message → follow-up in 24h → final attempt in 3 days).
6. **Stats updated** → Track no-show recovery attempts and re-engagement rate.

**Outcome**: Leads who miss appointments get a friendly follow-up instead of being lost. Recovers revenue that would otherwise be written off.

---

### S18: Win-Back Re-engagement Automation

**Trigger**: Cron job runs `/api/cron/win-back` daily at 10am.

**Flow**:

1. **Find stale leads** → Query leads with last activity 25-35 days ago who were never marked as `won` or `lost`, and haven't opted out.
2. **Client check** → Verify the client has flows enabled and win-back automation is active.
3. **Send re-engagement message** → AI generates a contextual win-back message:
   ```
   Hi {leadName}! It's been a while since we chatted about your
   {projectType}. {ownerName} from {businessName} here — just
   checking in to see if you still need help. No pressure at all!
   ```
4. **Start win-back flow** → If a "Win-Back" flow template is assigned, begin the multi-step sequence with escalating urgency and optional special offers.
5. **Update lead** → Mark as win-back attempted, update engagement tracking.

**Outcome**: Stale leads get a second chance before going completely cold. Even a 5-10% re-engagement rate from win-back sequences generates significant recovered revenue.

---

## Appendix: Quick Reference

### Key URLs by User Type

**Admin** (Clients group):
| URL | Purpose |
|-----|---------|
| `/admin` | Agency dashboard |
| `/admin/clients` | Client list |
| `/admin/clients/new/wizard` | Onboard new client |
| `/admin/clients/[id]` | Client detail + ROI |
| `/admin/clients/[id]/knowledge` | Knowledge base |
| `/admin/clients/[id]/phone` | Phone number manager (multi-number) |
| `/admin/clients/[id]/revenue` | Client revenue metrics |
| `/admin/clients/[id]/reviews` | Reputation monitoring |
| `/admin/users` | User management |
| `/admin/agency` | Communications / agency messages |
| `/admin/discussions` | Support threads |

**Admin** (Optimization group):
| URL | Purpose |
|-----|---------|
| `/admin/flow-templates` | Flow template management |
| `/admin/flow-templates/[id]` | Template editor + version history + publish |
| `/admin/analytics` | Flow analytics |
| `/admin/template-performance` | Variant results / aggregate A/B testing |
| `/admin/ab-tests` | Per-client A/B tests |
| `/admin/reputation` | Reputation monitoring (all clients) |
| `/admin/nps` | NPS survey results dashboard |

**Admin** (Reporting group):
| URL | Purpose |
|-----|---------|
| `/admin/billing` | Billing / subscription management |
| `/admin/billing/plans` | Plan management (CRUD) |
| `/admin/reports` | Report generation |
| `/admin/platform-analytics` | Platform health metrics |
| `/admin/usage` | Costs & usage monitoring |

**Admin** (Settings group):
| URL | Purpose |
|-----|---------|
| `/admin/phone-numbers` | Phone number console |
| `/admin/twilio` | Twilio account settings |
| `/admin/voice-ai` | Voice AI config + ElevenLabs voice picker |
| `/admin/compliance` | Compliance dashboard |
| `/admin/webhook-logs` | Webhook log viewer |
| `/admin/email-templates` | Email template editor |
| `/admin/email-templates/[id]` | Edit individual template |
| `/admin/api-keys` | API key management |
| `/admin/settings` | System settings (super admin only) |

**Client User** (NextAuth dashboard):
| URL | Purpose |
|-----|---------|
| `/dashboard` | Overview (7-day stats + action items) |
| `/leads` | Lead management (create, export, tags, bulk actions) |
| `/leads/[id]` | Lead detail + conversation + flow status |
| `/conversations` | All conversations |
| `/escalations` | Escalation queue |
| `/scheduled` | Scheduled messages |
| `/analytics` | Performance analytics + ROI |
| `/settings` | Configuration (team, hours, notifications) |
| `/discussions` | Support threads |

**Client Portal** (OTP / cookie auth):
| URL | Purpose |
|-----|---------|
| `/client-login` | OTP login page |
| `/client` | Portal dashboard |
| `/client/conversations` | Conversation history |
| `/client/revenue` | Revenue / ROI dashboard |
| `/client/knowledge` | Knowledge base (self-service CRUD) |
| `/client/flows` | Automation flow management |
| `/client/billing` | Billing & subscription |
| `/client/billing/upgrade` | Plan upgrade |
| `/client/settings` | Settings hub |
| `/client/settings/ai` | AI assistant configuration |
| `/client/settings/features` | Feature toggles (safe subset) |
| `/client/settings/notifications` | Notification preferences |
| `/client/help` | Help articles / FAQ |
| `/client/discussions` | Support discussions |
| `/client/cancel` | Cancellation flow (3-step) |

**Team Member**:
| URL | Purpose |
|-----|---------|
| `/claim?token=xxx` | Claim an escalation |

### Webhook URLs (configured automatically)

| Webhook | URL | Source |
|---------|-----|--------|
| Twilio SMS | `/api/webhooks/twilio/sms` | Incoming text messages |
| Twilio Voice | `/api/webhooks/twilio/voice` | Incoming phone calls |
| Twilio Voice AI | `/api/webhooks/twilio/voice/ai` | AI voice agent |
| Twilio Ring Group | `/api/webhooks/twilio/ring-connect` | Ring group notification |
| Twilio Ring Result | `/api/webhooks/twilio/ring-result` | Ring group outcome |
| Twilio SMS Status | `/api/webhooks/twilio/status` | Delivery status callbacks |
| Twilio Agency SMS | `/api/webhooks/twilio/agency-sms` | Agency client SMS |
| Stripe | `/api/webhooks/stripe` | Payment/subscription events |
| Form | `/api/webhooks/form` | Website form submissions |

### Cron Jobs

| Endpoint | Frequency | Purpose |
|----------|-----------|---------|
| `/api/cron` | Every 5 min | Master orchestrator (schedules all jobs) |
| `/api/cron/process-scheduled` | Every 5 min | Send due scheduled messages |
| `/api/cron/check-missed-calls` | Periodic | Backup missed call detection |
| `/api/cron/no-show-recovery` | Daily | Detect no-shows, send AI follow-ups |
| `/api/cron/win-back` | Daily 10am | Re-engage stale leads (25-35 days) |
| `/api/cron/daily` | Daily | Aggregate daily stats |
| `/api/cron/daily-summary` | Daily 7am | Send daily summary email |
| `/api/cron/weekly-summary` | Weekly | Send weekly performance reports |
| `/api/cron/agency-digest` | Weekly | Agency performance summaries |
| `/api/cron/calendar-sync` | Periodic | Sync appointments with calendars |
| `/api/cron/agent-check` | Periodic | Health check on conversation agent |
| `/api/cron/expire-prompts` | Periodic | Expire old agency prompts |
| `/api/cron/trial-reminders` | Daily | Trial reminder emails (day 7, 12, 14) |
| `/api/cron/auto-review-response` | Every 30 min | AI draft + auto-post review responses |
| `/api/cron/send-nps` | Periodic | Send NPS surveys post-appointment |

### Feature Flags (per client, admin-controlled)

| Flag | Default | What it controls |
|------|---------|-----------------|
| `missedCallSmsEnabled` | true | Auto-SMS after missed calls |
| `aiResponseEnabled` | true | AI auto-response to incoming SMS |
| `aiAgentEnabled` | true | AI conversation agent active |
| `aiAgentMode` | assist | Autonomous agent (off/assist/autonomous) |
| `autoEscalationEnabled` | true | Auto-escalate based on AI confidence |
| `flowsEnabled` | true | Automation flow execution |
| `leadScoringEnabled` | true | Lead score calculation |
| `calendarSyncEnabled` | false | Google Calendar integration |
| `hotTransferEnabled` | false | Live call transfer to team |
| `voiceEnabled` | false | Voice AI answering |
| `voiceMode` | after_hours | When Voice AI answers (after_hours/always/manual) |
| `reputationMonitoringEnabled` | false | Google review tracking |
| `autoReviewResponseEnabled` | false | AI writes review responses |
| `paymentLinksEnabled` | false | Send payment links to leads |
| `photoRequestsEnabled` | true | Request photos from leads |
| `multiLanguageEnabled` | false | Non-English support |
| `notificationEmail` | true | Email notifications |
| `notificationSms` | true | SMS notifications |
| `weeklySummaryEnabled` | true | Weekly summary emails |
