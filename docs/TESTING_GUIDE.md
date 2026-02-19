# End-to-End Testing Guide

A dependency-ordered walkthrough for testing every feature in the ConversionSurgery platform. Tests are organized into **10 phases** — each phase's prerequisites are satisfied by completing earlier phases.

**Before you start**: Complete the [Local Development Setup](../DEPLOYMENT.md#local-development-setup) and ensure `npm run dev` is running.

---

## Table of Contents

- [Phase 0: Environment & Seed Data](#phase-0-environment--seed-data)
- [Phase 1: Admin Foundation](#phase-1-admin-foundation)
- [Phase 2: Client Onboarding](#phase-2-client-onboarding)
- [Phase 3: Automation Setup](#phase-3-automation-setup)
- [Phase 4: Lead Capture & SMS](#phase-4-lead-capture--sms)
- [Phase 5: Conversations & AI](#phase-5-conversations--ai)
- [Phase 6: Team & Escalations](#phase-6-team--escalations)
- [Phase 7: Voice AI & Calls](#phase-7-voice-ai--calls)
- [Phase 8: Billing & Payments](#phase-8-billing--payments)
- [Phase 9: Reviews & Reputation](#phase-9-reviews--reputation)
- [Phase 10: Reporting & Advanced](#phase-10-reporting--advanced)
- [Appendix A: Triggering Cron Jobs Manually](#appendix-a-triggering-cron-jobs-manually)
- [Appendix B: Simulating Webhooks](#appendix-b-simulating-webhooks)
- [Appendix C: Test Phone Numbers & Credentials](#appendix-c-test-phone-numbers--credentials)
- [Appendix D: Cleanup & Reset](#appendix-d-cleanup--reset)

---

## Phase 0: Environment & Seed Data

**Env vars needed**: `DATABASE_URL`, `AUTH_SECRET`, `CLIENT_SESSION_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `FORM_WEBHOOK_SECRET`

### 0.1 Verify Environment

```bash
# Ensure dev server starts cleanly
npm run dev

# Visit http://localhost:3000 — should show login page
```

**Pass criteria**: Login page loads without errors. Browser console has no red errors.

### 0.2 Push Schema & Seed Database

```bash
# Push all tables to Neon (first time only)
npm run db:push

# Seed demo data (plans, templates, admin user, demo clients, leads)
npm run db:seed

# Seed role templates for access management
npx tsx src/scripts/seed-role-templates.ts

# Run identity migration (creates people records + memberships from existing data)
npx tsx src/scripts/migrate-identities.ts --dry-run  # Preview first
npx tsx src/scripts/migrate-identities.ts             # Execute

# Verify migration
npx tsx src/scripts/verify-migration.ts
```

**Pass criteria**: All commands exit with 0. Run `npm run db:studio` and verify:
- `plans` table has 3 rows (Starter, Professional, Enterprise)
- `admin_users` table has 1 row (admin@conversionsurgery.com)
- `clients` table has 5 demo clients
- `flow_templates` table has 6 templates
- `leads` table has 16 demo leads
- `role_templates` table has 7 rows (3 client + 4 agency built-in roles)
- `people` table has records for all client owners, team members, and admins
- `client_memberships` table has owner records for each client
- `agency_memberships` table has records for each admin user

### 0.3 Admin Login

1. Go to `http://localhost:3000/login`
2. Enter the admin email from seed (`admin@conversionsurgery.com`) or your own email
3. Check your email for the magic link (if using Resend `onboarding@resend.dev`, check the Resend dashboard for delivered emails)
4. Click the magic link

**Pass criteria**: Redirected to `/admin` dashboard. Top nav shows &ldquo;Agency Dashboard.&rdquo; Session should include `isAgency: true` and `permissions` array populated from `agency_memberships` &rarr; `role_templates`.

### 0.4 Explore Seeded Data

The seed script created 5 demo clients. Verify each exists:

| Demo Client | Navigate to |
|------------|-------------|
| Summit Roofing | `/admin/clients` → click Summit Roofing |
| Precision Plumbing | `/admin/clients` → click Precision Plumbing |
| Northern HVAC | `/admin/clients` → click Northern HVAC |
| Calgary Concrete | `/admin/clients` → click Calgary Concrete |
| Alpine Electrical | `/admin/clients` → click Alpine Electrical |

**Pass criteria**: Each client detail page loads. Business name, team members, and leads are visible.

---

## Phase 1: Admin Foundation

**Depends on**: Phase 0 (admin logged in, seed data present)
**Env vars needed**: Same as Phase 0
**Use cases covered**: A18, A25, A28, A29, A30, A40

These features have **no client dependency** — they're standalone admin tools.

### 1.1 System Settings (A30)

1. Navigate to `/admin/settings`
2. View existing system settings (seeded defaults)
3. Edit a setting (e.g., change `sms.maxDailyPerLead` from 5 to 10)
4. Save

**Pass criteria**: Setting value persists after page refresh. Only accessible to users with `agency.settings.manage` permission (Agency Owner role).

**If it fails**: Check that the admin user has an `agency_membership` with the `agency_owner` role template. Legacy fallback: `role: 'super_admin'` in `admin_users` table.

### 1.2 Subscription Plans (A29)

1. Navigate to `/admin/billing/plans`
2. Verify 3 seeded plans appear (Starter $497, Professional $997, Enterprise $1,997)
3. Click "Create Plan" — fill in name, price, features
4. Save the new plan
5. Edit an existing plan's price
6. Delete the test plan you created

**Pass criteria**: CRUD operations work. Plans show correct pricing.

### 1.3 Email Templates (A25)

1. Navigate to `/admin/email-templates`
2. Click "Create Template"
3. Enter: Name "Test Template", Slug "test-template", Subject "Hello {{clientName}}"
4. Add HTML body with `{{variable}}` placeholders
5. Save. Verify it appears in the list
6. Click to edit. Change the subject. Save
7. Delete the test template

**Pass criteria**: Template CRUD works. Variable picker shows available variables.

### 1.4 Help Articles (A28)

1. Navigate to `/admin/help-articles` (via Settings nav)
2. Click "Create Article"
3. Enter title, category (e.g., "Getting Started"), content (markdown)
4. Toggle "Published" on
5. Save. Verify it appears in the list
6. **Test client visibility**: Open a new incognito window, log into client portal → navigate to `/client/help` → verify the article appears

**Pass criteria**: Article visible to clients only when published.

### 1.5 Coupons (A40)

1. Navigate to `/admin/billing/coupons`
2. Create a coupon: Code "TEST50", 50% discount, duration "once"
3. Create another: Code "YEARLY20", 20% discount, applicable plans = "Professional"
4. Verify both appear in the list
5. Edit one, change the discount amount
6. Delete one

**Pass criteria**: Coupon CRUD works. Discount types (percent/fixed) render correctly.

### 1.6 API Keys (A26)

1. Navigate to `/admin/api-keys`
2. Click "Generate API Key"
3. Enter label "Test Key", select scopes (e.g., leads:read)
4. Click Generate — **copy the key immediately** (shown only once)
5. Verify the key appears in the list (showing prefix only, e.g., `rr_abc1...`)
6. Test the key:
   ```bash
   curl http://localhost:3000/api/v1/leads \
     -H "Authorization: Bearer rr_your_key_here"
   ```
7. Revoke the key
8. Re-run the curl — should get 401

**Pass criteria**: Key generation shows plaintext once. After revoke, API returns 401.

---

## Phase 2: Client Onboarding

**Depends on**: Phase 0 (admin logged in)
**Env vars needed**: Phase 0 + `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `TWILIO_WEBHOOK_BASE_URL`, `OPENAI_API_KEY`
**Use cases covered**: A1, A2, A3, A21, A37, C1, C6, C7, C12, P1

### 2.1 Onboard a New Client (A1)

1. Navigate to `/admin/clients/new/wizard`
2. **Step 1 — Business Info**: Enter business name "Test Roofing Co", owner name, email (use your real email for testing portal login later), phone, timezone
3. **Step 2 — Phone Number**: Search by area code (e.g., "403"). Select a number and click "Purchase & Assign"
4. **Step 3 — Team Members**: Add at least 1 team member with "Receive Escalations" toggled on. Use a real phone number you can check
5. **Step 4 — Business Hours**: Set Mon-Fri 8am-5pm. Toggle Saturday off
6. **Step 5 — AI Config**: Leave defaults (AI response enabled, assist mode)
7. **Step 6 — Review**: Confirm and submit

**Pass criteria**: Client appears in `/admin/clients` list. Client detail page shows all configured data.

**If it fails**:
- "Phone number purchase failed" → Check TWILIO_ACCOUNT_SID/AUTH_TOKEN. Ensure Twilio account has funds
- "Email already exists" → Use a different email address

### 2.2 Build Knowledge Base (A3)

1. Navigate to `/admin/clients/[your-test-client-id]/knowledge`
2. Click "Add Entry"
3. Add 3-5 KB entries:
   - "What are your hours?" → "We're open Monday-Friday 8am-5pm"
   - "How much does a roof inspection cost?" → "Free estimates. We'll schedule a visit."
   - "Do you handle emergency repairs?" → "Yes, call us for same-day emergency service."
4. Save each entry

**Pass criteria**: Entries appear in KB list. Count shows correct number.

### 2.3 Define Service Catalog (A37)

1. On the same client detail page, navigate to the Services section
2. Add services: "Roof Inspection" ($0 — free), "Roof Repair" ($500-$5000), "Full Replacement" ($10,000-$25,000)
3. Save

**Pass criteria**: Services listed on client detail page.

### 2.4 Create a Lead Manually (A21, C12)

1. Navigate to `/leads` (or `/admin/clients/[id]` → leads section)
2. Click "Create Lead"
3. Enter: Name "John Doe", Phone "+1XXXXXXXXXX" (use a real phone you control for SMS testing), Project type "Roof Repair"
4. Save

**Pass criteria**: Lead appears in leads list with status "new" and temperature "warm".

### 2.5 Client User Login (C1)

1. Open a new incognito window
2. Go to `http://localhost:3000/login`
3. Enter the email you used when creating "Test Roofing Co"
4. Click the magic link from email
5. Verify you're redirected to the client dashboard `/dashboard`

**Pass criteria**: Dashboard shows the client's business name, lead count, and navigation.

### 2.6 Client Team Management (C6)

1. In the client dashboard, navigate to `/settings` → Team
2. Add a new team member
3. Toggle escalation and hot transfer settings
4. Set priority order

**Pass criteria**: Team member appears in the list with correct settings.

### 2.7 Business Hours Config (C7)

1. Navigate to client Settings → Business Hours
2. Modify hours (e.g., add Saturday 9am-1pm)
3. Save

**Pass criteria**: Hours persist after refresh. After-hours indicator shows correctly on dashboard.

### 2.8 Client Portal Login (P1)

1. Open another incognito window
2. Go to `http://localhost:3000/client-login`
3. **Phone login**: Enter the client&apos;s phone number, click &ldquo;Send Code,&rdquo; enter the 6-digit SMS code
4. **Email login**: Click &ldquo;Use email instead,&rdquo; enter the client email, click &ldquo;Send Code,&rdquo; enter the 6-digit email code
5. If the person has multiple businesses, a business picker appears &mdash; select the business
6. First-time users see a welcome page showing their role and accessible features
7. Verify portal dashboard loads at `/client`

**Pass criteria**: Portal shows client name, recent stats, and navigation matching the user&apos;s role permissions. Business owner sees all nav items. Team member sees only Dashboard, Conversations.

**If it fails**: Check that `people` record exists with matching email/phone, `client_memberships` record exists linking person to client, and `role_templates` are seeded.

---

## Phase 2.5: Access Management

**Depends on**: Phase 0 (admin logged in, seed data, role templates seeded, migration run)
**Use cases covered**: A18, P1 (multi-business), C6 (permission-based team)

### 2.5.1 Agency Team Management (A18)

1. Navigate to `/admin/team`
2. Verify the seeded admin appears with Agency Owner role
3. Click &ldquo;Invite Member&rdquo;
4. Enter: Name &ldquo;Test Account Manager,&rdquo; email, role &ldquo;Account Manager,&rdquo; client scope &ldquo;Assigned,&rdquo; select 2 clients
5. Submit
6. Verify the new member appears in the list with correct role and assigned clients

**Pass criteria**: Member created. Role shows &ldquo;Account Manager.&rdquo; Assigned clients listed.

### 2.5.2 Role Template Management

1. Navigate to `/admin/team/roles`
2. Verify 7 built-in templates appear (3 client + 4 agency)
3. Click &ldquo;Create Role&rdquo;
4. Enter: Name &ldquo;Read-Only Analyst,&rdquo; scope &ldquo;agency,&rdquo; select `agency.clients.view` and `agency.analytics.view` permissions
5. Save

**Pass criteria**: Custom role appears in list. Built-in roles show lock icon (non-editable).

### 2.5.3 Permission Changes Force Re-login

1. In `/admin/team`, edit the Account Manager member created in 2.5.1
2. Change their role to &ldquo;Content Specialist&rdquo;
3. Save
4. If the member had an active session, verify they must re-authenticate

**Pass criteria**: `sessionVersion` incremented. Member&apos;s next request returns 401 if using stale session.

### 2.5.4 Audit Log

1. Navigate to `/admin/audit-log`
2. Verify entries for: member.invited, role.changed from steps 2.5.1-2.5.3

**Pass criteria**: Audit entries show actor, action, timestamp, and metadata.

### 2.5.5 Client Team with Permissions (C6)

1. In client portal as business owner, navigate to `/client/team`
2. Click &ldquo;Add Team Member&rdquo;
3. Enter: Name, phone, email, role &ldquo;Team Member&rdquo;
4. Toggle &ldquo;Receive Escalations&rdquo; on
5. Save
6. Open a new incognito window, go to `/client-login`
7. Log in as the new team member (phone or email OTP)
8. Verify they only see Dashboard and Conversations in the nav (Team Member role)

**Pass criteria**: Team member has restricted navigation. Cannot access Settings, Revenue, etc.

### 2.5.6 Multi-Business Login

1. Create a second client with the same owner email as an existing client
2. Run the migration script (or manually create the `people` + `client_memberships` records)
3. Log in via `/client-login` with that email
4. After OTP, verify the business picker appears
5. Select a business and verify the portal loads for that business
6. Use the business switcher in the header to switch to the other business

**Pass criteria**: Business picker works. Business switcher changes the active context without re-login.

### 2.5.7 Session Revocation

1. As admin, navigate to `/admin/team` and deactivate a member
2. That member&apos;s next request should be rejected with a redirect to `/client-login?revoked=true`
3. Verify the revocation banner message appears

**Pass criteria**: Deactivated user cannot access the portal. Revocation message shown.

---

## Phase 3: Automation Setup

**Depends on**: Phase 2 (client with phone number, KB entries)
**Env vars needed**: Same as Phase 2
**Use cases covered**: A4, A5, A23, A24, C10, C11, C16, P10

### 3.1 Create Flow Template (A4)

1. Navigate to `/admin/flow-templates`
2. Click "Create Template"
3. Build a simple 3-step flow:
   - **Step 1**: SMS "Hi {{leadName}}, thanks for reaching out to {{businessName}}!" — delay: 0 min
   - **Step 2**: SMS "Would you like to schedule a free estimate?" — delay: 30 min
   - **Step 3**: SMS "Just checking in — we'd love to help. Reply YES to book." — delay: 24 hours
4. Set trigger: "form_submission"
5. Save

**Pass criteria**: Template appears in list with 3 steps. Status shows "draft".

### 3.2 Clone Template (A23)

1. From the template list, click the clone/duplicate action on your template
2. Verify a copy is created with "(Copy)" suffix
3. Edit the copy — change step 2 message text
4. Save

**Pass criteria**: Two templates exist. Clone has independent content.

### 3.3 Publish & Version (A24)

1. Open the original template
2. Click "Publish" → Add change notes "Initial release"
3. Navigate to Version History tab
4. Verify version 1 appears with your notes and timestamp
5. Edit the template, change step 1 text
6. Publish again with notes "Updated greeting"
7. Verify version 2 appears

**Pass criteria**: Version history shows 2 versions with different change notes.

### 3.4 Push Template to Client (A5)

1. From the template detail, click "Push to Clients"
2. Select "Test Roofing Co"
3. Confirm

**Pass criteria**: Template assigned. Navigate to client detail → Flows section — the flow appears.

### 3.5 Client Flow Management (C16, P10)

1. In the **client dashboard** (`/dashboard`), go to Flows
2. Verify the pushed flow appears
3. Toggle flow on/off
4. In the **client portal** (`/client/flows`), verify same flow appears
5. Toggle it from portal side

**Pass criteria**: Flow visibility and toggle work from both client dashboard and portal.

### 3.6 View Scheduled Messages (C11)

1. In client dashboard, navigate to `/scheduled`
2. If the flow is active and a lead triggered it, verify scheduled messages appear with send times

**Pass criteria**: Page loads. (Messages will appear after Phase 4 triggers a flow.)

---

## Phase 4: Lead Capture & SMS

**Depends on**: Phase 3 (flows assigned to client, KB populated)
**Env vars needed**: Phase 2 + ngrok running for webhook callbacks
**Use cases covered**: S1, S2, S3, S6, S10, S15, L1, L2, L3, A22, C2, C13, C14, C15, C19, C20

> **Important**: This phase requires **real SMS and phone calls** via Twilio. Ensure ngrok is running and webhook URLs are configured.

### 4.1 Simulate Form Submission (S2)

Send a POST to the form webhook to simulate a website form fill:

```bash
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_FORM_WEBHOOK_SECRET" \
  -d '{
    "name": "Jane Smith",
    "phone": "+1XXXXXXXXXX",
    "email": "jane@example.com",
    "message": "I need a roof inspection",
    "source": "website_form",
    "clientPhone": "+1YOUR_TWILIO_NUMBER"
  }'
```

**Pass criteria**:
- Response: 200 OK with `{ success: true }`
- New lead "Jane Smith" appears in `/leads`
- If flow is active, first SMS sent immediately (check Twilio logs)
- Conversation record created in `/conversations`

**If it fails**: Check `FORM_WEBHOOK_SECRET` matches the header. Check client has a flow assigned.

### 4.2 Simulate Missed Call (S1)

Call your Twilio number from your personal phone. Let it ring without answering (or hang up after 2-3 rings).

**Pass criteria**:
- Within 30 seconds, you receive an SMS back: "Hi, sorry we missed your call..."
- New lead created (or existing lead updated) in the system
- Conversation shows the missed call recovery message
- Webhook log entry created at `/admin/webhook-logs`

**If it fails**: Check Twilio voice webhook is set to `https://your-ngrok.ngrok-free.app/api/webhooks/twilio/voice`. Check `missedCallSmsEnabled` is `true` for the client.

### 4.3 Inbound SMS & AI Response (S3)

Send a text message from your phone to the Twilio number:
> "Hi, I need a quote for fixing my roof. It's been leaking."

**Pass criteria**:
- AI responds within 10-30 seconds using KB context
- Response references your KB entries (e.g., mentions free estimates)
- Conversation appears in `/conversations` with both messages
- Lead scoring fires (S4) — check lead's temperature/score in `/leads/[id]`

**If it fails**: Check `OPENAI_API_KEY` is valid. Check `aiResponseEnabled` is `true`. Check KB has relevant entries.

### 4.4 Compliance & Opt-Out (S6, S10, L3)

Send "STOP" from your test phone to the Twilio number.

**Pass criteria**:
- System replies: "You've been unsubscribed..."
- Lead's `optedOut` flag set to `true` in database
- Subsequent automated messages are blocked for this lead
- Verify by triggering another flow step — message should be skipped with compliance log

**Reset**: Send "START" to re-subscribe, or manually reset in DB.

### 4.5 SMS Delivery Status Tracking (S15, C19)

1. Send an outbound SMS to a lead (via quick reply in conversations)
2. Check the conversation thread
3. Look for delivery status indicators: queued → sent → delivered

**Pass criteria**: Status updates appear within 30-60 seconds. Viewable in lead conversation view.

**If it fails**: Check Twilio status callback webhook is set to `https://your-ngrok.ngrok-free.app/api/webhooks/twilio/status`.

### 4.6 Lead Tagging (C14)

1. Navigate to `/leads/[id]` for any lead
2. Add tags: "roof-repair", "urgent", "referred"
3. Go back to leads list
4. Filter by tag "urgent"

**Pass criteria**: Tags appear as badges. Filter returns only tagged leads.

### 4.7 CSV Export (A22, C13)

1. Navigate to `/leads`
2. Apply a filter (e.g., status = "new")
3. Click "Export CSV"
4. Open the downloaded file

**Pass criteria**: CSV contains all visible leads with columns matching the table. Filter is applied.

### 4.8 Send Photos / MMS (C15)

1. Navigate to `/leads/[id]` for a lead
2. In the message composer, click the photo attach button
3. Select an image file
4. Send

**Pass criteria**: Message sends with media. Lead receives MMS. Conversation shows image thumbnail.

**Env required**: `R2_*` variables for media storage. If not configured, MMS upload will fail.

### 4.9 Receive Photos from Leads (C20)

1. From your phone, send a photo via MMS to the Twilio number
2. Check the conversation in `/leads/[id]`

**Pass criteria**: Photo appears as thumbnail in conversation. Media stored in R2.

### 4.10 Appointment Booking via SMS (L1)

1. From your phone, text: "Can I schedule an appointment?"
2. AI should respond with available times
3. Reply with a time: "Tuesday at 2pm"
4. AI confirms the booking

**Pass criteria**: Appointment appears in database. If calendar sync is enabled (Phase 9), event created.

---

## Phase 5: Conversations & AI

**Depends on**: Phase 4 (leads with active conversations)
**Use cases covered**: C3, C4, C5, C8, A19, A20, A35, P3, P11, P12, P13

### 5.1 Read & Reply to Conversations (C3)

1. In client dashboard, navigate to `/conversations`
2. Click on a conversation with a lead
3. Read the thread (should show AI responses + lead messages from Phase 4)
4. Type a manual reply and send

**Pass criteria**: Reply appears in thread. Lead receives the SMS. Message shows as "manual" not "ai".

### 5.2 Take Over from AI (C4)

1. Open an active AI conversation
2. Click "Take Over" / pause AI
3. Send a manual message
4. Verify AI does NOT respond to the next inbound message from the lead
5. Click "Resume AI" to re-enable

**Pass criteria**: AI paused indicator visible. Manual messages sent. AI re-engages after resume.

### 5.3 Handle an Escalation (C5)

1. Send a message from your phone that triggers escalation (e.g., "I'm very unhappy with the work" or "I want to speak to a manager")
2. Check `/escalations` in client dashboard
3. Verify escalation appears with urgency level
4. Click to view, choose action (e.g., "Will call back")
5. Mark as resolved

**Pass criteria**: Escalation created. Team members notified via SMS (if configured). Resolution persists.

### 5.4 Review AI Response Quality (A19)

1. Navigate to `/admin/clients/[id]` → AI Responses section
2. Review AI-generated messages
3. Rate quality (thumbs up/down)

**Pass criteria**: AI messages listed with quality indicators.

### 5.5 Investigate Lead Journey (A20)

1. Navigate to `/leads/[id]` for a lead with activity
2. View the full timeline: lead creation, messages, scoring changes, flow triggers, appointments

**Pass criteria**: Complete journey visible in chronological order.

### 5.6 Knowledge Gap Review (A35)

1. Navigate to the KB gaps section for the client
2. Look for questions the AI couldn't answer confidently
3. Add a KB entry to fill the gap

**Pass criteria**: Gaps listed from conversation analysis. Adding KB entry resolves the gap.

### 5.7 Configure AI Settings (P11)

1. In client portal, go to `/client/settings/ai`
2. Toggle AI agent mode (off/assist/autonomous)
3. Adjust response tone or guidelines

**Pass criteria**: Settings save and take effect on next AI response.

### 5.8 Configure Feature Toggles (P12)

1. In client portal, go to `/client/settings/features`
2. Toggle features: `missedCallSmsEnabled`, `flowsEnabled`, `leadScoringEnabled`
3. Save

**Pass criteria**: Toggles persist. Disabling `aiResponseEnabled` stops AI from replying.

### 5.9 Notification Preferences (P13)

1. In client portal, go to `/client/settings/notifications`
2. Toggle email/SMS notification channels
3. Toggle daily summary email

**Pass criteria**: Settings persist. Daily summary email respects the toggle (verify in Phase 10).

### 5.10 Analytics Review (C8)

1. In client dashboard, navigate to `/analytics`
2. View conversion funnel, response times, lead temperature distribution

**Pass criteria**: Charts render. Data reflects the leads and conversations from earlier phases.

---

## Phase 6: Team & Escalations

**Depends on**: Phase 5 (escalation triggers tested)
**Use cases covered**: T1, T2, T3, A34, C18, S7

### 6.1 Configure Escalation Rules (A34, C18)

1. In admin or client dashboard, navigate to escalation settings
2. Configure rules:
   - Auto-escalate when AI confidence < 0.3
   - Escalate keywords: "manager", "complaint", "cancel"
   - SLA: respond within 30 minutes

**Pass criteria**: Rules save. Test by sending an escalation trigger message.

### 6.2 Receive & Claim Escalation (T1)

1. Trigger an escalation (from Phase 5.3 or send a new trigger message)
2. Check the team member's phone for escalation SMS
3. The SMS includes a claim link
4. Open the link in a browser (simulating team member's phone)
5. Claim the escalation

**Pass criteria**: Claim link works. Escalation shows as "claimed" in dashboard. Other team members see it's taken.

### 6.3 Respond to Claimed Lead (T3)

1. After claiming, the team member can respond
2. Reply to the lead directly via the claim page
3. Mark as resolved

**Pass criteria**: Lead receives the team member's response. Resolution logged.

### 6.4 Hot Intent Detection (S7)

1. Send a high-intent message from your phone: "YES I want to book NOW. When can you come?"
2. System should detect hot intent
3. If `hotTransferEnabled` is true, system attempts ring group call to team members

**Pass criteria**: Lead temperature changes to "hot". If hot transfer enabled, team members' phones ring (in priority order). Lead scoring (S4) fires.

---

## Phase 7: Voice AI & Calls

**Depends on**: Phase 2 (client with phone, team configured)
**Env vars needed**: `ELEVENLABS_API_KEY` (optional — falls back to Twilio TTS)
**Use cases covered**: A12, A33, S8, T2

### 7.1 Configure Voice AI (A12)

1. Navigate to `/admin/voice-ai` — all active clients are shown as collapsible sections
2. Expand the client section you want to configure (click the row to toggle)
3. Toggle `voiceEnabled` on
4. Set `voiceMode` to "always" for testing
5. If ElevenLabs configured: select a voice from the picker and test preview
6. Set greeting message: "Hello, thank you for calling Test Roofing. How can I help?"

**Pass criteria**: Settings save. Voice picker shows ElevenLabs voices (if API key configured).

### 7.2 Voice AI Call (S8)

1. Call the client's Twilio number from your phone
2. Voice AI should answer with the greeting
3. Speak: "I need a roof repair quote"
4. AI should respond using KB context
5. Say: "Can I schedule an appointment?"
6. AI should offer times and book

**Pass criteria**: Full conversational flow works. Appointment created. Conversation logged.

**If it fails**: Check voice webhook URL in Twilio. Check `voiceEnabled=true`. Check OpenAI key.

### 7.3 Hot Transfer (T2)

1. During a voice call, say a hot-intent trigger: "I need help urgently, can I speak to someone?"
2. AI should transfer the call to the ring group
3. Team member's phone rings
4. Answer → connected to the caller

**Pass criteria**: Call transfers. Team member answers. Both parties hear each other.

**Prerequisites**: `hotTransferEnabled=true`, team members configured with phone numbers.

### 7.4 Voice Call History (A33)

1. Navigate to `/admin/clients/[id]` → call history section
2. Verify calls from 7.2 and 7.3 appear with duration, status, and transcript

**Pass criteria**: Call records listed with correct metadata.

---

## Phase 8: Billing & Payments

**Depends on**: Phase 2 (client exists)
**Env vars needed**: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
**Use cases covered**: A15, A29, A32, A40, C17, P4, P6, P17, S13

> **Important**: Use Stripe **test mode**. Test card: `4242 4242 4242 4242`, any future expiry, any CVC.

### 8.1 Set Up Stripe Locally

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to local
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the signing secret → STRIPE_WEBHOOK_SECRET in .env.local
# Restart dev server
```

### 8.2 Admin Billing Management (A15)

1. Navigate to `/admin/billing`
2. View subscription overview for all clients
3. Select a client → view their subscription status

**Pass criteria**: Billing page loads. Shows client subscription data.

### 8.3 Client Portal Billing (P4)

1. In client portal, navigate to `/client/billing`
2. Click "Upgrade" or "Subscribe"
3. Select a plan (e.g., Professional $997/mo)
4. Enter test card: `4242 4242 4242 4242`
5. Complete payment

**Pass criteria**: Subscription created. Status shows "active" in portal. Stripe Dashboard shows test subscription.

### 8.4 Apply Coupon

1. During checkout (or via admin), apply coupon code "TEST50" (from Phase 1.5)
2. Verify discount is applied to the total
3. Complete payment

**Pass criteria**: Invoice shows 50% discount. Coupon usage count incremented in admin.

### 8.5 Send Payment Link (A32, C17)

1. Navigate to a lead detail page
2. Click "Send Payment Link"
3. Enter amount and description
4. Send

**Pass criteria**: Lead receives SMS with Stripe payment link. Clicking the link opens Stripe Checkout.

### 8.6 Cancel Subscription (P6)

1. In client portal, navigate to `/client/cancel`
2. Follow cancellation flow
3. Confirm cancellation

**Pass criteria**: Subscription status changes to "canceled". Stripe shows canceled.

### 8.7 Retry Failed Payment (P17)

1. In Stripe Dashboard (test mode), create a subscription with a card that will fail: `4000 0000 0000 0341`
2. In portal, navigate to `/client/billing` → see failed invoice
3. Click "Retry Payment"
4. Enter a valid test card

**Pass criteria**: Payment succeeds. Invoice status updates.

### 8.8 Trial Reminders (S13)

To test trial reminder emails without waiting days:

```bash
# Manually trigger the trial reminder cron
curl http://localhost:3000/api/cron/trial-reminders \
  -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Clients with trial subscriptions receive reminder emails at day 7, 12, and 14 milestones.

---

## Phase 9: Reviews & Reputation

**Depends on**: Phase 2 (client exists)
**Env vars needed**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PLACES_API_KEY`
**Use cases covered**: A13, A36, A41, S11, S12, A39

### 9.1 Set Up Reputation Monitoring (A13)

1. Navigate to `/admin/reputation`
2. Select a client
3. Toggle `reputationMonitoringEnabled` on
4. Add a review source (Google Business Profile URL or search by business name)

**Pass criteria**: Review source saved. Initial sync queued.

### 9.2 Connect Google OAuth (A41)

1. Navigate to `/admin/clients/[id]/reviews`
2. Click "Connect Google Business"
3. Complete OAuth consent flow
4. Select the business location

**Pass criteria**: OAuth tokens stored. Business profile connected.

**If it fails**: Check Google Cloud Console — OAuth consent screen must be configured, redirect URI must include your domain.

### 9.3 Review Response Templates (A36)

1. Navigate to the review response templates section
2. Create templates for: 5-star, 4-star, 3-star, negative review
3. Use `{{reviewerName}}` and `{{businessName}}` variables

**Pass criteria**: Templates saved. Variables interpolated in preview.

### 9.4 Auto Review Response (S11)

Trigger manually:

```bash
curl http://localhost:3000/api/cron/auto-review-response \
  -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: For clients with `autoReviewResponseEnabled=true` and new reviews: draft responses generated. Approved responses posted to Google.

### 9.5 NPS Surveys (S12, A39)

Trigger manually:

```bash
curl http://localhost:3000/api/cron/send-nps \
  -X POST \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Leads with completed appointments (4+ hours ago) receive NPS survey SMS. Responses (reply 1-10) logged. View results at `/admin/nps`.

---

## Phase 10: Reporting & Advanced

**Depends on**: All previous phases (maximum data available)
**Use cases covered**: A6, A7, A8, A10, A11, A14, A17, A22, A27, A31, A38, A39, A42, C9, C10, P2, P5, P8, P9, P14, P15, P16, S9, S16, S17, S18, S19, S20

### 10.1 Daily Stats Aggregation (S9)

```bash
# Trigger daily analytics
curl http://localhost:3000/api/cron \
  -X POST \
  -H "cf-cron: true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: `daily_stats` table updated. Platform analytics dashboard shows data.

### 10.2 Agency Dashboard (A17)

1. Navigate to `/admin`
2. Review: total clients, active leads, messages sent, revenue
3. Use client selector to switch between clients

**Pass criteria**: Dashboard shows aggregated metrics across all clients.

### 10.3 Platform Health (A8)

1. Navigate to `/admin/platform-analytics`
2. Check: active clients, MRR, churn rate, message delivery rates

**Pass criteria**: Real data displayed (not zeros — MRR comes from active subscriptions).

### 10.4 Funnel Analytics (A42)

1. Navigate to `/admin/analytics` (or the funnel analytics page)
2. View conversion funnel: leads → conversations → appointments → won

**Pass criteria**: Funnel stages show counts from your test data.

### 10.5 Client Performance Report (A7)

1. Navigate to `/admin/reports`
2. Select a client and date range
3. Generate report

**Pass criteria**: Report shows leads, response times, conversions for the selected period.

### 10.6 A/B Testing (A6, A14)

1. Navigate to `/admin/ab-tests`
2. Create a test: select template, create variant with different message text
3. Set traffic split (50/50)
4. Activate

**Pass criteria**: A/B test running. New leads randomly assigned to control or variant. Results page shows performance comparison.

### 10.7 Usage Alerts (A10)

1. Navigate to `/admin/usage`
2. Set alert threshold (e.g., 80% of message quota)
3. Manually trigger usage check:
   ```bash
   curl http://localhost:3000/api/cron \
     -X POST -H "cf-cron: true" \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

**Pass criteria**: When threshold exceeded, alert appears in dashboard and notification sent.

### 10.8 Discussions (A11, C9, P15)

1. In **client portal**, go to `/client/discussions`
2. Create a new discussion: "Question about my billing"
3. In **admin dashboard**, go to `/admin/discussions`
4. See the new discussion, reply to it
5. Back in portal, verify reply appears

**Pass criteria**: Two-way communication works between client and admin.

### 10.9 Agency Messages (A38)

1. In admin, go to `/admin/agency`
2. Send a broadcast message to selected clients
3. Verify clients see the message in their portal/dashboard

**Pass criteria**: Message delivered to target clients.

### 10.10 Webhook Logs (A27)

1. Navigate to `/admin/webhook-logs`
2. Filter by event type (e.g., "twilio_sms")
3. Expand a log entry to see full payload

**Pass criteria**: All webhook events from previous phases are logged. Payloads are viewable.

### 10.11 Multiple Phone Numbers (A31)

1. Navigate to `/admin/clients/[id]/phone`
2. Purchase a second number
3. Set it as secondary (primary remains)
4. Send SMS from primary and secondary — both work
5. Inbound SMS to either number routes to the same client

**Pass criteria**: Both numbers listed. Primary flag correct. Routing works for both.

### 10.12 Weekly Summary (P2, P5)

```bash
curl http://localhost:3000/api/cron/weekly-summary \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Clients with `weeklySummaryEnabled=true` receive email. Portal shows summary at `/client`.

### 10.13 Revenue Dashboard (P8)

1. In client portal, navigate to `/client/revenue`
2. View revenue attribution from won leads

**Pass criteria**: Revenue data displays. Charts render.

### 10.14 Portal Knowledge Base (P9)

1. In client portal, navigate to `/client/knowledge`
2. Add a KB entry
3. Edit an existing entry
4. Delete one

**Pass criteria**: CRUD works from portal side.

### 10.15 Help Articles (P14)

1. In portal, navigate to `/client/help`
2. Search for an article (from Phase 1.4)
3. Read the article

**Pass criteria**: Published articles visible. Search works.

### 10.16 No-Show Recovery (S17)

```bash
curl http://localhost:3000/api/cron/no-show-recovery \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Leads with past appointments marked as no-show receive follow-up SMS.

### 10.17 Win-Back Campaign (S18)

```bash
curl http://localhost:3000/api/cron/win-back \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Cold leads (25-35 days inactive) receive re-engagement SMS.

### 10.18 Agency Digest (S16)

```bash
curl http://localhost:3000/api/cron/agency-digest \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Admin receives weekly digest email with platform performance.

### 10.19 Client Webhook Dispatch (S20)

1. Configure a webhook URL for a client (use [webhook.site](https://webhook.site) for testing)
2. Trigger an event (e.g., new lead, appointment booked, lead qualified)
3. Check webhook.site for the POST payload

**Pass criteria**: Event payload delivered to configured URL with correct event type and data.

### 10.20 Cohort Analysis (S19)

```bash
# This runs monthly, but trigger manually:
curl http://localhost:3000/api/cron \
  -X POST -H "cf-cron: true" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Pass criteria**: Cohort retention metrics updated in database.

### 10.21 Approve AI Suggestions (C10, P16)

1. When AI suggests a flow or action, it appears as a pending prompt
2. In client dashboard or portal, review and approve/reject the suggestion

**Pass criteria**: Approved suggestions execute. Rejected ones are logged.

---

## Appendix A: Triggering Cron Jobs Manually

All cron jobs can be triggered via HTTP. Use your `CRON_SECRET` as a Bearer token.

```bash
# Set your secret for convenience
export CRON_SECRET="your-cron-secret-here"
export BASE_URL="http://localhost:3000"
```

| Job | Command |
|-----|---------|
| **Master orchestrator** | `curl -X POST $BASE_URL/api/cron -H "cf-cron: true" -H "Authorization: Bearer $CRON_SECRET"` |
| **Process scheduled SMS** | `curl $BASE_URL/api/cron/process-scheduled -H "Authorization: Bearer $CRON_SECRET"` |
| **Check missed calls** | `curl $BASE_URL/api/cron/check-missed-calls -H "Authorization: Bearer $CRON_SECRET"` |
| **Auto review response** | `curl -X POST $BASE_URL/api/cron/auto-review-response -H "Authorization: Bearer $CRON_SECRET"` |
| **Calendar sync** | `curl $BASE_URL/api/cron/calendar-sync -H "Authorization: Bearer $CRON_SECRET"` |
| **Expire prompts** | `curl $BASE_URL/api/cron/expire-prompts -H "Authorization: Bearer $CRON_SECRET"` |
| **Send NPS** | `curl -X POST $BASE_URL/api/cron/send-nps -H "Authorization: Bearer $CRON_SECRET"` |
| **Agent health check** | `curl $BASE_URL/api/cron/agent-check -H "Authorization: Bearer $CRON_SECRET"` |
| **Trial reminders** | `curl -X POST $BASE_URL/api/cron/trial-reminders -H "Authorization: Bearer $CRON_SECRET"` |
| **No-show recovery** | `curl $BASE_URL/api/cron/no-show-recovery -H "Authorization: Bearer $CRON_SECRET"` |
| **Daily summary** | `curl $BASE_URL/api/cron/daily-summary -H "Authorization: Bearer $CRON_SECRET"` |
| **Win-back** | `curl $BASE_URL/api/cron/win-back -H "Authorization: Bearer $CRON_SECRET"` |
| **Weekly summary** | `curl $BASE_URL/api/cron/weekly-summary -H "Authorization: Bearer $CRON_SECRET"` |
| **Agency digest** | `curl $BASE_URL/api/cron/agency-digest -H "Authorization: Bearer $CRON_SECRET"` |

---

## Appendix B: Simulating Webhooks

### Twilio SMS Inbound

```bash
curl -X POST http://localhost:3000/api/webhooks/twilio/sms \
  -d "From=%2B15551234567&To=%2B1YOUR_TWILIO_NUMBER&Body=Hello%20I%20need%20help&MessageSid=SM_test_123&NumMedia=0"
```

> Note: Twilio signature validation will fail for manual curl requests. For local testing, you may need to temporarily bypass validation or use the actual Twilio test tools.

### Form Submission

```bash
curl -X POST http://localhost:3000/api/webhooks/form \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: YOUR_FORM_WEBHOOK_SECRET" \
  -d '{
    "name": "Test Lead",
    "phone": "+15551234567",
    "email": "test@example.com",
    "message": "I need a quote",
    "source": "website_form",
    "clientPhone": "+1YOUR_TWILIO_NUMBER"
  }'
```

### Stripe Events (via CLI)

```bash
# Trigger specific events
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.deleted
```

---

## Appendix C: Test Phone Numbers & Credentials

### Twilio

- **Test from number**: Use your personal cell phone
- **Test to number**: Your provisioned Twilio number
- Twilio trial accounts can only send SMS to verified numbers. Add your test phone at: Twilio Console → Verified Caller IDs

### Stripe (Test Mode)

| Scenario | Card Number |
|----------|-------------|
| Successful payment | `4242 4242 4242 4242` |
| Requires authentication | `4000 0025 0000 3155` |
| Payment declined | `4000 0000 0000 0002` |
| Insufficient funds | `4000 0000 0000 9995` |
| Attach then fail | `4000 0000 0000 0341` |

Use any future expiry date and any 3-digit CVC.

### Resend (Email)

- For development without a verified domain: use `onboarding@resend.dev` as `EMAIL_FROM`
- Check delivered emails at: [resend.com/emails](https://resend.com/emails)

### OpenAI

- Model used: `gpt-4o-mini` (cost-effective for testing)
- Typical test session cost: < $1

---

## Appendix D: Cleanup & Reset

### Reset Test Data (keep schema)

```bash
npm run db:reset    # WARNING: drops ALL tables, re-creates, re-seeds
```

### Reset a Specific Client

Use Drizzle Studio (`npm run db:studio`) to:
1. Delete all leads for the client
2. Delete all conversations for the client
3. Delete the client record

### Opt-Out Reset

If a lead is opted out and you need to re-test:
1. In Drizzle Studio, find the lead in `leads` table
2. Set `optedOut = false`, `optedOutAt = null`
3. Delete the `opt_out_log` entry for that phone number

### Webhook Tunnel Reset

If ngrok restarts and you get a new URL:
1. Update `TWILIO_WEBHOOK_BASE_URL` in `.env.local`
2. Update Twilio phone number webhook URLs in Twilio Console
3. Restart dev server

---

## Feature-to-Phase Quick Reference

| Use Case | Phase | What it tests |
|----------|-------|---------------|
| A1 (onboard) | 2 | Client creation wizard |
| A2 (phone) | 2 | Twilio number provisioning |
| A3 (KB) | 2 | Knowledge base CRUD |
| A4 (templates) | 3 | Flow template builder |
| A5 (push) | 3 | Template → client deployment |
| A6 (A/B test) | 10 | Aggregate template testing |
| A7 (reports) | 10 | Client performance reports |
| A8 (health) | 10 | Platform metrics dashboard |
| A9 (reassign) | 10 | Phone number swap |
| A10 (alerts) | 10 | Usage threshold notifications |
| A11 (discussions) | 10 | Admin ↔ client messaging |
| A12 (voice) | 7 | Voice AI configuration |
| A13 (reviews) | 9 | Google review monitoring |
| A14 (client A/B) | 10 | Per-client variant tests |
| A15 (billing) | 8 | Subscription management |
| A16 (compliance) | 4 | Opt-out and consent |
| A17 (dashboard) | 10 | Agency overview |
| A18 (users) | 1 | Admin user management |
| A19 (AI quality) | 5 | AI response review |
| A20 (journey) | 5 | Lead timeline |
| A21 (manual lead) | 2 | Manual lead creation |
| A22 (export) | 4 | CSV download |
| A23 (clone) | 3 | Template duplication |
| A24 (versions) | 3 | Template versioning |
| A25 (emails) | 1 | Email template editor |
| A26 (API keys) | 1 | API key management |
| A27 (webhooks) | 10 | Webhook log viewer |
| A28 (help) | 1 | Help article editor |
| A29 (plans) | 1 | Subscription plan CRUD |
| A30 (settings) | 1 | System settings |
| A31 (multi-num) | 10 | Multiple phone numbers |
| A32 (pay link) | 8 | Payment link to lead |
| A33 (calls) | 7 | Voice call history |
| A34 (escalation) | 6 | Escalation rule config |
| A35 (KB gaps) | 5 | Knowledge gap detection |
| A36 (review tmpl) | 9 | Review response templates |
| A37 (services) | 2 | Service catalog |
| A38 (agency msg) | 10 | Admin → client messages |
| A39 (NPS) | 9 | NPS survey dashboard |
| A40 (coupons) | 1 | Coupon management |
| A41 (Google) | 9 | Google Business OAuth |
| A42 (funnel) | 10 | Funnel analytics |
| C1-C20 | 2-6 | Client dashboard workflows |
| P1-P17 | 2-10 | Client portal self-service |
| L1-L3 | 4 | Lead SMS interactions |
| T1-T3 | 6 | Team escalation handling |
| S1-S20 | 4-10 | System automations |
