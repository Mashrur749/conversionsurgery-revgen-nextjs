# ConversionSurgery Platform Use Cases

A comprehensive operations guide covering every workflow for every user type. Each use case describes **who** performs it, **when** it happens, **what** steps are involved, and **what** the expected outcome is.

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
- [Client Portal User Use Cases](#client-portal-user-use-cases)
  - [P1: Access the Portal via Link](#p1-access-the-portal-via-link)
  - [P2: Review Weekly Performance Summary](#p2-review-weekly-performance-summary)
  - [P3: View Conversation History](#p3-view-conversation-history)
  - [P4: Manage Billing and Subscription](#p4-manage-billing-and-subscription)
  - [P5: Configure Weekly Summary Preferences](#p5-configure-weekly-summary-preferences)
  - [P6: Cancel Subscription](#p6-cancel-subscription)
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

---

## User Types Overview

| User Type | Authentication | Access Level | Primary Purpose |
|-----------|---------------|--------------|-----------------|
| **Admin** | Magic link email (NextAuth) | Full platform + all clients | Manage the agency, onboard clients, optimize templates |
| **Client User** | Magic link email (NextAuth) | Own client dashboard only | View leads, conversations, escalations, analytics |
| **Client Portal** | Cookie-based link (no login) | Limited read-only portal | View stats, billing, configure preferences |
| **Team Member** | None (SMS/phone only) | Escalation claim links only | Receive escalation SMS, claim and resolve leads |

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
6. Ensure business hours are configured (used by `after_hours` mode).
7. Verify team members have "Receive Hot Transfers" enabled (for when the AI needs to transfer).

**Outcome**: When leads call the client's number and the configured condition is met, the AI answers, engages in conversation, and either resolves the query or transfers to a human. A post-call summary is generated with intent, sentiment, and transcript.

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
4. Navigation is organized into three groups:
   - **Management**: Clients, billing, discussions
   - **Optimization**: Flow templates, analytics, platform analytics, template performance, reports, reputation, usage
   - **Configuration**: Phone numbers, Twilio, Voice AI, compliance

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
   - Last activity timestamp
3. Filter leads by status or source.
4. Click into a lead to see:
   - Full contact info
   - Score breakdown with contributing factors
   - Complete conversation history
   - Notes and project type
5. Update lead status as you work with them:
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

## Client Portal User Use Cases

### P1: Access the Portal via Link

**When**: Client receives a weekly summary email or a direct link to the portal.

**Steps**:

1. Click the portal link in your email (e.g., `https://app.conversionsurgery.com/d/[token]`).
2. The system sets a `clientSessionId` cookie and redirects to `/client`.
3. No password or email verification needed - the link contains the session token.
4. You're now in the simplified client portal with 6 navigation items.

**Security note**: Portal links expire and are unique per client. They provide read-heavy access without the full dashboard capabilities.

**Outcome**: Quick, frictionless access to your account overview.

---

### P2: Review Weekly Performance Summary

**When**: After receiving the weekly summary email, you want to dive deeper.

**Steps**:

1. Access the portal (P1).
2. The dashboard at `/client` shows:
   - **Monthly stats**: Leads captured, messages sent, appointments booked
   - **Recent leads**: Name, source, and status of the latest leads
   - **Upcoming appointments**: Next scheduled events
3. Compare with previous periods to gauge performance.

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

## Appendix: Quick Reference

### Key URLs by User Type

**Admin**:
| URL | Purpose |
|-----|---------|
| `/admin` | Agency dashboard |
| `/admin/clients` | Client list |
| `/admin/clients/new/wizard` | Onboard new client |
| `/admin/clients/[id]` | Client detail |
| `/admin/clients/[id]/knowledge` | Knowledge base |
| `/admin/clients/[id]/reviews` | Reputation monitoring |
| `/admin/flow-templates` | Flow template management |
| `/admin/template-performance` | Aggregate A/B testing |
| `/admin/ab-tests` | Per-client A/B tests |
| `/admin/reports` | Report generation |
| `/admin/phone-numbers` | Phone number console |
| `/admin/twilio` | Twilio account settings |
| `/admin/voice-ai` | Voice AI config |
| `/admin/platform-analytics` | Platform metrics |
| `/admin/usage` | Usage monitoring |
| `/admin/billing` | Subscription management |
| `/admin/compliance` | Compliance dashboard |
| `/admin/discussions` | Support threads |
| `/admin/users` | User management |

**Client User**:
| URL | Purpose |
|-----|---------|
| `/dashboard` | Overview |
| `/leads` | Lead management |
| `/leads/[id]` | Lead detail + conversation |
| `/conversations` | All conversations |
| `/escalations` | Escalation queue |
| `/scheduled` | Scheduled messages |
| `/analytics` | Performance analytics |
| `/settings` | Configuration |
| `/discussions` | Support threads |

**Client Portal**:
| URL | Purpose |
|-----|---------|
| `/client` | Portal dashboard |
| `/client/conversations` | Conversation history |
| `/client/billing` | Billing & subscription |
| `/client/settings` | Preferences |
| `/client/cancel` | Cancellation flow |

**Team Member**:
| URL | Purpose |
|-----|---------|
| `/claim?token=xxx` | Claim an escalation |

### Webhook URLs (configured automatically)

| Webhook | URL | Source |
|---------|-----|--------|
| Twilio SMS | `/api/webhooks/twilio/sms` | Incoming text messages |
| Twilio Voice | `/api/webhooks/twilio/voice` | Incoming phone calls |
| Stripe | `/api/webhooks/stripe` | Payment events |
| Form | `/api/webhooks/form` | Website form submissions |

### Feature Flags (per client, admin-controlled)

| Flag | Default | What it controls |
|------|---------|-----------------|
| `missedCallSmsEnabled` | true | Auto-SMS after missed calls |
| `aiResponseEnabled` | true | AI auto-response to incoming SMS |
| `aiAgentMode` | off | Autonomous agent (off/assist/autonomous) |
| `autoEscalationEnabled` | true | Auto-escalate based on AI confidence |
| `flowsEnabled` | true | Automation flow execution |
| `leadScoringEnabled` | true | Lead score calculation |
| `calendarSyncEnabled` | false | Google Calendar integration |
| `hotTransferEnabled` | true | Live call transfer to team |
| `voiceEnabled` | false | Voice AI answering |
| `voiceMode` | after_hours | When Voice AI answers |
| `complianceEnabled` | true | TCPA compliance checks |
| `reputationEnabled` | false | Review monitoring |
