# Execution Plan — All Remaining [PLANNED] & [PARTIAL] Features

Generated: 2026-02-14 | Based on codebase exploration + BUSINESS-CASE.md audit

---

## Priority Tiers

| Tier | Criteria | Items |
|------|----------|-------|
| **T1 — Launch Blockers** | Must-have for first paying clients | 5 items |
| **T2 — High Value** | Major UX/ops improvement, moderate effort | 8 items |
| **T3 — Nice to Have** | Polish, completeness, future-proofing | 7 items |
| **T4 — Deferred** | Large effort, low urgency, or needs external API | 6 items |

---

## T1 — LAUNCH BLOCKERS

### 1. Webhook Auto-Config on Number Purchase
**Section**: 1.3 | **Status**: [PLANNED] | **Effort**: S (1 file)

**What exists**: `src/lib/services/twilio-provisioning.ts` — `purchaseNumber()` buys the number from Twilio and stores it on `clients.twilioNumber`. `releaseNumber()` already calls `incomingPhoneNumbers(sid).update()` to clear webhooks.

**What's missing**: After purchase, webhooks (SMS + Voice) are not auto-configured. Operator must manually set them in Twilio console.

**Plan**:
- File: `src/lib/services/twilio-provisioning.ts`
- In `purchaseNumber()`, after the `incomingPhoneNumbers.create()` call, add:
  ```
  await twilioClient.incomingPhoneNumbers(sid).update({
    smsUrl: `${APP_URL}/api/webhooks/twilio/sms`,
    smsMethod: 'POST',
    voiceUrl: `${APP_URL}/api/webhooks/twilio/voice`,
    voiceMethod: 'POST',
    statusCallback: `${APP_URL}/api/webhooks/twilio/status`,
  });
  ```
- Also add the same to `assignExistingNumber()` if it exists
- Use `process.env.NEXT_PUBLIC_APP_URL` for the base URL
- Add a `configureWebhooks(sid: string)` helper so it can be reused

**Dependencies**: None
**Risk**: Low — Twilio SDK already imported, just adding one API call

---

### 2. Create Lead Manually
**Section**: 2.3 | **Status**: [PLANNED] | **Effort**: S (3 files)

**What exists**: `POST /api/leads` doesn't exist (only GET). `src/db/schema/leads.ts` has the full schema. Lead creation currently only happens via incoming-sms.ts and form webhooks.

**What's missing**: No UI form or API for admin/client to manually add a lead.

**Plan**:
- File: `src/app/api/leads/route.ts` — Add POST handler
  - Zod schema: name (required), phone (required), email, source='manual', clientId, notes, projectType
  - Normalize phone via `normalizePhoneNumber()`
  - Set initial status='new', temperature='warm'
  - Auth: session required, non-admin scoped to their clientId
- File: `src/app/(dashboard)/leads/create-lead-dialog.tsx` — NEW
  - Modal dialog with form fields
  - Phone input with formatting
  - Triggered from button on leads list page
- File: `src/app/(dashboard)/leads/leads-table.tsx` — Add "Create Lead" button next to existing controls

**Dependencies**: None
**Risk**: Low

---

### 3. Trial → Paid Reminders
**Section**: 7.5 | **Status**: [PLANNED] | **Effort**: S (3 files)

**What exists**: `subscriptions` table has `trialEnd` date. Billing page shows trial status. No reminder emails sent.

**What's missing**: No automated email reminders as trial approaches expiration (day 7, day 12, day 14).

**Plan**:
- File: `src/lib/services/trial-reminders.ts` — NEW
  - `processTrialReminders()`: query subscriptions where `status='trialing'`
  - Calculate days remaining from `trialEnd`
  - Send email at day 7 ("You're halfway through"), day 12 ("3 days left"), day 14 ("Trial ends today")
  - Track last reminder sent to avoid duplicates (use metadata JSON on subscription or a `trialRemindersSent` column)
- File: `src/lib/services/trial-reminder-template.ts` — NEW
  - HTML email template showing value delivered during trial (leads captured, messages sent)
  - CTA: "Upgrade Now" button linking to billing page
- File: `src/app/api/cron/trial-reminders/route.ts` — NEW
  - Cron endpoint with `verifyCronSecret()`
  - Calls `processTrialReminders()`

**Dependencies**: May need a schema column addition for tracking sent reminders
**Risk**: Low

---

### 4. Export Leads CSV
**Section**: 2.3 | **Status**: [PLANNED] | **Effort**: S (2 files)

**What exists**: `GET /api/leads` returns paginated JSON. All lead data is queryable.

**What's missing**: No CSV download endpoint.

**Plan**:
- File: `src/app/api/leads/export/route.ts` — NEW GET endpoint
  - Reuse same filter logic from `GET /api/leads` (extract shared filter builder)
  - No pagination (return all matching leads)
  - Set `Content-Type: text/csv` and `Content-Disposition: attachment`
  - Columns: name, phone, email, status, temperature, source, projectType, quoteValue, createdAt, updatedAt
  - Sanitize values (escape commas, quotes)
  - Auth: same as leads list (admin or client-scoped)
- File: `src/app/(dashboard)/leads/leads-table.tsx` — Add "Export CSV" button
  - `window.open('/api/leads/export?...')` with current filter params

**Dependencies**: None
**Risk**: Low — be mindful of large datasets, consider streaming for >10K leads

---

### 5. Client-Facing Revenue Dashboard
**Section**: 2.2 | **Status**: [PARTIAL] | **Effort**: M (3 files)

**What exists**: `src/app/(dashboard)/admin/clients/[id]/roi-dashboard.tsx` — Full ROI dashboard on admin client detail. `src/lib/services/speed-to-lead.ts`, `src/lib/services/service-classification.ts` have all the data functions.

**What's missing**: Client portal (`/client`) doesn't show revenue metrics — only basic lead/message counts.

**Plan**:
- File: `src/app/(client)/client/page.tsx` — Enhance existing dashboard
  - Add "Revenue Impact" card section below existing metrics
  - Show: pipeline value, won value, ROI multiplier, speed-to-lead
  - Reuse data functions from speed-to-lead.ts and existing DB queries
- File: `src/app/(client)/client/revenue-card.tsx` — NEW component
  - Pipeline value, won value, ROI multiplier stat cards
  - Revenue by service breakdown (if multi-service catalog populated)
  - Uses `getClientSession()` for auth, scoped to their client
- File: `src/app/api/client/revenue/route.ts` — NEW GET endpoint (or inline in page.tsx as server component)
  - Aggregate: pipeline value (30d), won value (30d), ROI vs plan cost
  - Speed-to-lead average
  - Service breakdown

**Dependencies**: None — all data functions exist
**Risk**: Low

---

## T2 — HIGH VALUE

### 6. Plan Management UI
**Section**: 1.6 | **Status**: [PLANNED] | **Effort**: M (4 files)

**What exists**: `src/db/schema/subscriptions.ts` has `subscriptionPlans` table with name, price, stripePriceId, features JSON, limits. Plans are seeded but no CRUD UI.

**Plan**:
- File: `src/app/api/admin/plans/route.ts` — NEW GET + POST
- File: `src/app/api/admin/plans/[id]/route.ts` — NEW PATCH + DELETE
- File: `src/app/(dashboard)/admin/billing/plans/page.tsx` — NEW
  - Table of plans: name, monthly/annual price, limits, Stripe price ID
  - Create/edit modal with: name, description, monthly price, annual price, Stripe IDs, feature flags JSON, limits (leads, messages, team members)
- File: `src/app/(dashboard)/admin/billing/plans/plan-form.tsx` — NEW
  - Form component for create/edit

**Dependencies**: None
**Risk**: Low — CRUD page, existing pattern from client management

---

### 7. Overage Configuration UI
**Section**: 1.6 | **Status**: [PLANNED] | **Effort**: S (2 files)

**What exists**: Schema has overage-related fields on plans. No UI to configure them.

**Plan**:
- Add overage config fields to plan-form.tsx (from item 6 above)
  - Per-resource overage prices: lead, message, team member, phone number, voice minute
  - Toggle: allow overages yes/no
  - Hard cap vs soft cap
- File: `src/app/api/admin/plans/[id]/route.ts` — Include overage fields in PATCH

**Dependencies**: Item 6 (Plan Management UI)
**Risk**: Low

---

### 8. Clone Template
**Section**: 1.7 | **Status**: [PLANNED] | **Effort**: S (2 files)

**What exists**: `src/app/api/admin/flow-templates/route.ts` has GET + POST. `flow_templates` + `flow_template_steps` tables.

**Plan**:
- File: `src/app/api/admin/flow-templates/[id]/clone/route.ts` — NEW POST
  - Load template + all steps
  - Insert new template with `name + " (Copy)"`
  - Bulk insert cloned steps with new templateId
  - Return new template
- File: `src/app/(dashboard)/admin/flow-templates/` — Add "Clone" button to template row actions

**Dependencies**: None
**Risk**: Low

---

### 9. Per-Lead Flow Status
**Section**: 2.6 | **Status**: [PLANNED] | **Effort**: M (3 files)

**What exists**: `flow_executions` table tracks active/completed/cancelled flows per lead. `flow_step_executions` tracks individual step progress.

**What's missing**: No UI showing which flows are running for a given lead.

**Plan**:
- File: `src/app/api/leads/[id]/flows/route.ts` — NEW GET
  - Query `flow_executions` for this lead
  - Join with `flows` for flow name
  - Include status, currentStep, totalSteps, startedAt, nextStepAt
- File: `src/app/(dashboard)/leads/[id]/lead-flows.tsx` — NEW component
  - List of active/recent flows
  - Each shows: flow name, progress bar (step X/Y), status badge, next step time
  - "Cancel" button per flow
- File: `src/app/(dashboard)/leads/[id]/page.tsx` — Add flows tab/section

**Dependencies**: None
**Risk**: Low

---

### 10. Conversation Notes
**Section**: 2.4 | **Status**: [PLANNED] | **Effort**: S (3 files)

**What exists**: Leads have a `notes` text field already. But there's no per-conversation note system for staff annotations.

**Plan**:
- Option A (simple — use existing `notes` field): Already implemented via inline editing in lead-header.tsx. Could mark this as [LIVE] if notes field is sufficient.
- Option B (richer — per-message annotations):
  - File: `src/db/schema/conversation-notes.ts` — NEW table: id, leadId, clientId, conversationId, content, authorId, createdAt
  - File: `src/app/api/leads/[id]/notes/route.ts` — GET + POST
  - File: `src/app/(dashboard)/leads/[id]/lead-tabs.tsx` — Add notes section in conversation view

**Recommendation**: Option A is already done — the `notes` field on leads is editable inline. Mark as [LIVE] or clarify if per-message annotations are needed.

---

### 11. Conversation Tags/Labels
**Section**: 2.4 | **Status**: [PLANNED] | **Effort**: M (4 files + migration)

**What exists**: No tags column on leads. No tags table.

**Plan**:
- File: `src/db/schema/leads.ts` — Add `tags` column: `jsonb('tags').$type<string[]>().default([])`
- Migration: `npm run db:generate` + `npm run db:migrate`
- File: `src/app/api/leads/[id]/route.ts` — Add `tags` to PATCH whitelist
- File: `src/app/(dashboard)/leads/[id]/lead-header.tsx` — Add tag chips with add/remove
- File: `src/app/(dashboard)/leads/lead-filters.tsx` — Add tag filter option
- Predefined tags: "VIP", "Urgent", "Follow-up", "Duplicate", "Referral" (in shared constants)

**Dependencies**: Schema migration
**Risk**: Low — jsonb column avoids join table complexity

---

### 12. Client Flow Management
**Section**: 2.6 | **Status**: [PLANNED] | **Effort**: M (4 files)

**What exists**: Flows are pushed by admin to clients. `flows` table has `isActive` flag. Client portal has no flow management UI.

**Plan**:
- File: `src/app/api/client/flows/route.ts` — NEW GET
  - List flows assigned to authenticated client
  - Include: name, type, isActive, step count, last execution date
- File: `src/app/api/client/flows/[id]/route.ts` — NEW PATCH
  - Allow toggling `isActive` only (whitelist with Zod .strict())
  - Cannot edit flow content (admin-only)
- File: `src/app/(client)/client/flows/page.tsx` — NEW
  - List of assigned flows with on/off toggles
  - Description of what each flow does
  - Last triggered timestamp
- File: `src/app/(client)/layout.tsx` — Add "Automations" nav link

**Dependencies**: None
**Risk**: Low — read + toggle only, no editing

---

### 13. System Settings Page
**Section**: 1.17 | **Status**: [PLANNED] | **Effort**: M (3 files)

**What exists**: `system_settings` table exists in schema. `twilio-provisioning.ts` imports it. No admin UI.

**Plan**:
- File: `src/app/api/admin/settings/route.ts` — NEW GET + PATCH
  - GET: Return all system settings as key-value pairs
  - PATCH: Update settings (admin only)
  - Keys: appName, supportEmail, defaultTimezone, defaultMonthlyMessageLimit, maintenanceMode
- File: `src/app/(dashboard)/admin/settings/page.tsx` — NEW
  - Form with all editable system settings
  - Sections: General, Defaults, Maintenance
- File: Add "Settings" link to admin nav

**Dependencies**: None
**Risk**: Low

---

## T3 — NICE TO HAVE

### 14. Template Versioning
**Section**: 1.7 | **Status**: [PLANNED] | **Effort**: M (3 files + migration)

**What exists**: `flow_templates` has no version column. Template edits overwrite in-place.

**Plan**:
- Add `version` integer column to `flow_templates` (default 1)
- Add `parentTemplateId` self-reference for version chains
- On edit, option to "Save as new version" vs "Update in place"
- Version history UI: list past versions, diff view, rollback button
- Rollback = clone old version as new latest

**Dependencies**: Schema migration
**Risk**: Medium — need to handle in-progress flow executions referencing old versions

---

### 15. Read Receipts (Delivery Status)
**Section**: 2.4 | **Status**: [PLANNED] | **Effort**: S (2 files)

**What exists**: `conversations` table has `status` field. Twilio sends delivery callbacks. `src/app/api/webhooks/twilio/sms/route.ts` handles inbound. The status callback URL may not be configured.

**Plan**:
- File: `src/app/api/webhooks/twilio/status/route.ts` — NEW (or enhance existing)
  - Handle Twilio `MessageStatus` callback: sent, delivered, failed, undelivered
  - Update `conversations.status` with delivery status
  - Update `conversations.deliveredAt` timestamp (add column if needed)
- File: `src/app/(dashboard)/leads/[id]/lead-tabs.tsx` — Show delivery indicator icons
  - Single check = sent, double check = delivered, X = failed

**Dependencies**: Webhook auto-config (item 1) should include statusCallback URL
**Risk**: Low

---

### 16. Send Photos Outbound (MMS)
**Section**: 2.4 | **Status**: [PLANNED] | **Effort**: M (3 files)

**What exists**: `sendSMS()` in `src/lib/services/twilio.ts`. Twilio supports MMS via `mediaUrl` param. Inbound MMS already handled.

**Plan**:
- File: `src/lib/services/twilio.ts` — Add optional `mediaUrl: string[]` param to `sendSMS()`
- File: `src/app/(dashboard)/leads/[id]/reply-form.tsx` — Add file upload button
  - Accept image/* and application/pdf
  - Upload to Cloudflare R2 (existing pattern if used) or serve from public URL
  - Pass mediaUrl to send API
- File: `src/app/api/leads/[id]/messages/route.ts` — Add POST handler for sending
  - Accept body + optional mediaUrls
  - Call `sendCompliantMessage()` with media

**Dependencies**: Need a file upload/storage solution (R2 or similar)
**Risk**: Medium — file upload infrastructure may not exist yet

---

### 17. Help Articles / FAQ Page
**Section**: 2.13 | **Status**: [PLANNED] | **Effort**: S (2 files)

**What exists**: Help button exists. Discussion threads exist. No static FAQ/docs.

**Plan**:
- File: `src/app/(client)/client/help/page.tsx` — NEW
  - Static FAQ page with accordion sections
  - Categories: Getting Started, Conversations, Billing, Troubleshooting
  - Content hardcoded initially (can move to CMS later)
  - Search bar filtering FAQ items
- File: `src/app/(client)/layout.tsx` — Update help button to link to /client/help

**Dependencies**: None
**Risk**: Low — static content page

---

### 18. Role-Based Admin Access
**Section**: 1.1 | **Status**: [PARTIAL] | **Effort**: L (5+ files + migration)

**What exists**: Binary `isAdmin` on users table. All admin routes check `session.user.isAdmin`.

**Plan**:
- Migration: Add `role` enum column to `users`: 'super_admin', 'admin', 'viewer'
  - `super_admin`: Full access (billing, settings, user management)
  - `admin`: Client management, flows, reports (no billing/settings)
  - `viewer`: Read-only dashboard access
- File: `src/lib/utils/rbac.ts` — NEW
  - `checkPermission(session, permission)` helper
  - Permission map: `{ 'billing:write': ['super_admin'], 'clients:write': ['super_admin', 'admin'], ... }`
- Update all admin API routes to use `checkPermission()` instead of raw `isAdmin`
- File: `src/app/(dashboard)/admin/users/` — Add role selector when editing users

**Dependencies**: Schema migration, wide API route updates
**Risk**: High — touches many files, needs careful rollout

---

### 19. AI Settings (Client Self-Service)
**Section**: 2.10 | **Status**: [PARTIAL] | **Effort**: S (2 files)

**What exists**: `client_agent_settings` table with tone, maxLength, primaryGoal, etc. Admin can configure via client detail page.

**Plan**:
- File: `src/app/(client)/client/settings/ai-settings.tsx` — NEW component
  - Subset of settings clients can change: tone (professional/friendly/casual), maxResponseLength
  - NOT exposed: agentMode, booking aggressiveness, pricing rules (admin-only)
- File: `src/app/api/client/settings/ai/route.ts` — NEW PATCH
  - Whitelist: tone, maxResponseLength only
  - Uses `getClientSession()` auth

**Dependencies**: None
**Risk**: Low — limited subset of settings

---

### 20. Feature Toggles (Client Self-Service)
**Section**: 2.10 | **Status**: [PARTIAL] | **Effort**: S (2 files)

**What exists**: All feature flags on `clients` table. Admin toggles them on client detail page.

**Plan**:
- File: `src/app/(client)/client/settings/features.tsx` — NEW component
  - Safe toggles clients can control: `notificationEmail`, `notificationSms`, `weeklySummaryEnabled`
  - Dangerous toggles remain admin-only: aiAgentMode, hotTransferEnabled, voiceEnabled
- File: `src/app/api/client/settings/features/route.ts` — NEW PATCH
  - Strict whitelist of client-safe toggles
  - Uses `getClientSession()` auth

**Dependencies**: None
**Risk**: Low — strict whitelist prevents misuse

---

## T4 — DEFERRED

### 21. AI Voice Synthesis (ElevenLabs)
**Section**: 1.13 | **Status**: [PLANNED] | **Effort**: L

**What exists**: `voiceVoiceId`, `voiceModelId`, `voiceStability`, `voiceSimilarityBoost` fields on clients table. No ElevenLabs API integration.

**Plan**: Integrate ElevenLabs TTS API into voice call handling.
- Add `ELEVENLABS_API_KEY` env var
- Create `src/lib/services/elevenlabs.ts` — text-to-speech generation
- Modify `src/app/api/webhooks/twilio/voice/ai/route.ts` — Use ElevenLabs audio instead of Twilio TTS
- Admin UI to select voice, preview, adjust settings

**Dependencies**: ElevenLabs account + API key
**Risk**: Medium — real-time audio generation latency concerns

---

### 22. Review Auto-Fetching
**Section**: 1.12 | **Status**: [PLANNED] | **Effort**: M

**What exists**: `src/lib/services/review-monitoring.ts` has `syncAllReviews()` calling `syncGoogleReviews()`. `src/lib/services/google-places.ts` exists. Reviews table + sources table exist.

**Plan**:
- File: `src/app/api/cron/sync-reviews/route.ts` — NEW cron
  - Iterate active clients with `reputationMonitoringEnabled=true`
  - Call `syncAllReviews(clientId)` for each
- Ensure `syncGoogleReviews()` in google-places.ts actually calls Google Places API (may be stubbed)
- Add last_synced_at tracking to prevent excessive API calls

**Dependencies**: Google Places API key, verified Google Business Profile per client
**Risk**: Medium — API quota limits, costs at $0.017/request

---

### 23. Google Calendar Event Creation
**Section**: 2.15 | **Status**: [PLANNED] | **Effort**: M

**What exists**: `calendar_integrations` table with OAuth tokens. Calendar sync cron exists. `src/lib/services/appointment-booking.ts` creates appointments in DB.

**Plan**:
- File: `src/lib/services/google-calendar.ts` — NEW (or enhance existing)
  - `createCalendarEvent()` using Google Calendar API + stored OAuth tokens
  - Event details: lead name, phone, service type, appointment time
- Call from `appointment-booking.ts` after booking confirmation
- Handle token refresh automatically

**Dependencies**: Google Calendar API credentials, per-client OAuth already done
**Risk**: Medium — OAuth token refresh edge cases

---

### 24. NPS Surveys
**Section**: 11.2 | **Status**: [PLANNED] | **Effort**: L

**What exists**: Nothing — no schema, no service, no UI.

**Plan**:
- Schema: `nps_surveys` table (id, clientId, score, feedback, sentAt, respondedAt)
- Service: send NPS SMS after appointment completion (0-10 scale)
- Parse numeric reply as score, follow-up text as feedback
- Cron: trigger for completed appointments 24hrs ago
- Dashboard: NPS score trending, per-client breakdown

**Dependencies**: New schema + migration
**Risk**: Low (but large scope)

---

### 25. Multiple Numbers Per Client
**Section**: 1.3 | **Status**: [PARTIAL] | **Effort**: L

**What exists**: Single `twilioNumber` varchar on `clients` table. All routing uses this one field.

**Plan**:
- Schema: `client_phone_numbers` join table (id, clientId, phoneNumber, label, isPrimary, isActive)
- Migration: Migrate existing `twilioNumber` values into new table
- Update all SMS sending to look up primary number from join table
- Update all inbound routing to match any number in join table
- Admin UI: manage multiple numbers per client, set primary

**Dependencies**: Schema migration, wide refactor of SMS routing
**Risk**: High — touches core messaging pipeline

---

### 26. API Key Management / Webhook Logs / Email Templates Editor
**Section**: 1.17 | **Status**: [PLANNED] | **Effort**: L (combined)

These three are admin infrastructure features with no external dependency. Low urgency since the platform is managed-service (admin operates everything).

**API Keys**: Schema for api_keys table, generation UI, auth middleware checking Bearer tokens. Only needed if exposing a public API.

**Webhook Logs**: Already logging via compliance audit. Could add a UI viewer for `compliance_audit_log` + raw webhook payloads. Store raw Twilio/Stripe webhook bodies in a `webhook_logs` table.

**Email Templates**: Currently templates are code (weekly-summary-template.ts, daily-summary-template.ts). To make them editable: store templates in DB, build HTML editor UI, use template variables ({{businessName}}, {{stats}}).

**Recommendation**: Defer all three until post-launch. The managed-service model means admin handles everything directly — API keys and template editing are self-service features that aren't needed yet.

---

## Execution Sequence

```
Batch 1 — Quick Wins (can be done in parallel, ~1 session)
├── T1.1  Webhook Auto-Config
├── T1.2  Create Lead Manually
├── T1.4  Export Leads CSV
├── T2.8  Clone Template
└── T3.17 Help Articles

Batch 2 — Client Experience (~1 session)
├── T1.5  Client Revenue Dashboard
├── T2.10 Conversation Notes (verify if [LIVE] via existing notes field)
├── T2.19 AI Settings (Client)
├── T2.20 Feature Toggles (Client)
└── T1.3  Trial Reminders

Batch 3 — CRM Depth (~1 session)
├── T2.9  Per-Lead Flow Status
├── T2.11 Conversation Tags
├── T2.12 Client Flow Management
└── T3.15 Read Receipts

Batch 4 — Admin Tools (~1 session)
├── T2.6  Plan Management UI (+ T2.7 Overage Config)
├── T2.13 System Settings Page
└── T3.14 Template Versioning

Batch 5 — Deferred (future phases)
├── T3.16 Send Photos (MMS)
├── T3.18 Role-Based Admin Access
├── T4.21 ElevenLabs Voice
├── T4.22 Review Auto-Fetching
├── T4.23 Calendar Event Creation
├── T4.24 NPS Surveys
├── T4.25 Multiple Numbers Per Client
└── T4.26 API Keys / Webhook Logs / Email Templates
```

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Total remaining items | 26 |
| Small effort (S) | 12 |
| Medium effort (M) | 9 |
| Large effort (L) | 5 |
| Launch blockers (T1) | 5 |
| Schema migrations needed | 4 |
| New cron jobs | 2 |
| New API routes | ~18 |
| New UI pages/components | ~20 |
