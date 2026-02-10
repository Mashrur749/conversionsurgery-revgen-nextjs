# QA Checklist (Consolidated)

> Optimized for a single end-to-end QA pass. Cross-cutting patterns verified once up front, then each feature section covers only its unique behavior.

---

## Part 0: Cross-Cutting Compliance

_Verify these patterns once — they apply to every feature._

### Authentication & Authorization
- [ ] Every `/api/admin/*` route returns 403 for non-admin users
- [ ] Every `/api/client/*` route returns 401 without `clientSessionId` cookie
- [ ] Every `/admin/*` page redirects non-admin users to `/dashboard`
- [ ] Every `/client/*` page redirects to `/link-expired` without valid client session
- [ ] Admin auth uses `(session as any).user?.isAdmin` check

### Database Patterns
- [ ] All database calls use `getDb()` per-request (never a cached instance)
- [ ] All async route params use `Promise<{ id: string }>` and are awaited (Next.js 16)
- [ ] Phone numbers normalized via `normalizePhoneNumber()` on every write
- [ ] All cookie access uses `await cookies()` (Next.js 15+ async API)

### API Patterns
- [ ] All POST/PATCH/PUT endpoints validate input with Zod schemas
- [ ] Validation failures return 400 with error details
- [ ] Unexpected errors return 500 with error message and are logged
- [ ] All PATCH/PUT operations set `updatedAt` timestamp
- [ ] 404 returned for non-existent resources on single-resource endpoints

### UI Patterns
- [ ] Admin pages show "Select a Client" prompt when no client selected (no crash)
- [ ] All async operations show loading states (buttons show "Saving...", "Loading...", etc.)
- [ ] API errors display user-friendly error messages
- [ ] `'use client'` directive on all interactive components

---

## Part 1: Auth & Admin Foundation

### 01 — Auth Schema & Callbacks
- [ ] `users` table has `is_admin` boolean (default false) and `client_id` FK
- [ ] Auth tables use uuid PKs; `accounts` has unique `(provider, provider_account_id)`
- [ ] `Session.user` type includes `isAdmin?: boolean`; `Session.client?` includes `id`, `businessName`, `ownerName`
- [ ] **signIn callback**: non-admin without matching client email → denied; admin always allowed; auto-links clientId on first sign-in
- [ ] **session callback**: `session.user.isAdmin` from DB; non-admin gets `session.client` populated; admin does NOT get `session.client`
- [ ] Manual: sign in as admin → verify `user.isAdmin: true` in `/api/auth/session`; sign in as client → verify `client.id/businessName`; unknown email → denied

### 02 — Admin Context & Client Selector
- [ ] `AdminProvider` persists `selectedClientId` to both `localStorage` and `adminSelectedClientId` cookie
- [ ] Restores selection on mount; clearing removes both stores
- [ ] `selectedClient` derived from `clients` array; `useAdmin()` throws outside provider
- [ ] Client selector renders admin badge (amber), lists client business names, auto-selects first client
- [ ] **Server-side** `getClientId()`: admin reads cookie, non-admin returns `session.client.id`
- [ ] **Client-side** `useClientId()`: admin reads from context, non-admin from session
- [ ] Manual: change client in dropdown → verify localStorage + cookie update; refresh → persists; clear → both removed

### 03 — Dashboard Pages
- [ ] **Layout**: admin sees grouped nav (Management / Optimization / Configuration) in amber + regular nav after separator; non-admin sees only regular nav in gray
- [ ] **Dashboard**: stats from last 7 days `dailyStats`; up to 5 action-required leads with time-ago badges
- [ ] **Leads**: up to 100 leads sorted by `updatedAt` desc; red dot for actionRequired; color-coded status badges
- [ ] **Scheduled**: up to 50 pending messages by `sendAt` asc; uses `leftJoin` with leads; message preview `line-clamp-2`
- [ ] **Settings**: business info card, SMS config card, notifications card, form webhook card
- [ ] **Admin Overview**: 4 summary cards (Active Clients, Total Leads 7d, Messages 7d, Needs Attention in red); clients list sorted alphabetically with 7d metrics
- [ ] **Client switching**: selecting a client updates data on `/dashboard`, `/leads`, `/scheduled`, `/settings`; `/admin` shows all clients regardless

---

## Part 2: Team Escalation & Claims

### 04 — Team Schema & Escalation Service
- [ ] `team_members` table: priority ordering, `receiveEscalations` and `receiveHotTransfers` boolean flags
- [ ] `escalation_claims` table: `claimToken` (varchar 64, unique), status `pending/claimed/resolved`
- [ ] `generateClaimToken()` uses `crypto.randomBytes(32)` → 64-char hex; two calls produce different values
- [ ] `notifyTeamForEscalation()`: queries active members with `receiveEscalations=true` ordered by priority; returns `{notified:0}` when none configured or lead not found; creates claim record; sends SMS + email to each member
- [ ] `claimEscalation()`: validates token; "Already claimed" returns claimer name; updates claim status + `claimedAt`; clears `actionRequired` on lead; notifies other members (skips claimer)
- [ ] `getPendingEscalations()`: returns pending claims with lead info via innerJoin; empty array on error

### 05 — Claim Pages & SMS Integration
- [ ] `POST /api/claim`: validates `token` + `teamMemberId` (uuid) with Zod; returns claim result
- [ ] `/claim` page: reads token from searchParams; redirects to `/claim-error?reason=invalid` when missing/invalid; redirects with `reason=claimed&by=<name>` when already claimed; shows lead info + ClaimForm for pending claims
- [ ] `ClaimForm`: Select dropdown with team members; disabled until selected; "Claiming..." during submit; success → `/leads/{id}?claimed=true`
- [ ] `/claim-error`: "Invalid Link" for `reason=invalid`; "Already Claimed" with name for `reason=claimed`; "Go to Dashboard" button
- [ ] **Incoming SMS escalation**: calls `notifyTeamForEscalation()`; falls back to contractor SMS/email when 0 team members notified; conversation history limited to 20 messages

### 06 — Team Members UI
- [ ] `GET /api/team-members`: admin can pass `?clientId=` param; ordered by priority
- [ ] `POST /api/team-members`: normalizes phone; Zod validation
- [ ] `DELETE /api/team-members?memberId=<id>` and `DELETE /api/team-members/<id>`
- [ ] `PATCH /api/team-members/<id>`: updates fields + `updatedAt`; 404 if not found
- [ ] List component: "No team members yet" empty state; Add inline form (name, phone, email, role); Enable/Disable toggles `isActive`; Remove shows confirmation; list auto-refreshes after mutations
- [ ] Settings page: "Team Members" card spans `md:col-span-2`; receives `clientId` from server component

---

## Part 3: Hot Transfer System

### 07 — Business Hours & Ring Group Services
- [ ] `business_hours` table: unique on `(clientId, dayOfWeek)`; `openTime`/`closeTime` (time, nullable)
- [ ] `call_attempts` table: `callSid`, `answeredBy` FK → teamMembers, `duration`, `recordingUrl`
- [ ] `initializeBusinessHours()`: creates 7 rows (Mon-Fri 9-5, weekends closed); `onConflictDoNothing`
- [ ] `isWithinBusinessHours()`: defaults to `America/Edmonton`; uses `Intl.DateTimeFormat` for timezone; returns false when `isOpen=false` or outside open/close range
- [ ] `detectHotIntent()`: 16 trigger phrases including "ready to schedule", "call me", "i'm ready", "book an appointment"; case-insensitive
- [ ] `initiateRingGroup()`: queries active members with `receiveHotTransfers=true` by priority; creates call_attempts record; Twilio outbound call with ring-connect/ring-status webhooks; SMS to team; returns `{initiated, callSid, attemptId, membersToRing}`; on failure updates status to 'failed'
- [ ] `handleNoAnswer()`: SMS to team about missed call; SMS to lead offering callback; sets `actionRequired=true`

### 08 — Hot Transfer Webhooks & UI
- [ ] **ring-connect**: TwiML with `<Say voice="alice">` + `<Dial>` 25s timeout + `<Number>` per team member; fallback "no one available"
- [ ] **member-answered**: updates call attempt (`answeredBy`, `answeredAt`, `status:answered`); notifies OTHER team members; clears `actionRequired` on lead
- [ ] **ring-result**: `DialCallStatus=completed` → answered; else → no-answer + `handleNoAnswer()`; sets `endedAt`
- [ ] **Business hours API**: GET returns 7 days ordered by dayOfWeek; PUT upserts single day
- [ ] **Business hours editor**: Switch toggle per day; time inputs when open; "Closed" text when off; Save/Saving state
- [ ] **Hot intent in incoming-sms** (step 6.5, before AI): within hours → ringGroup + "calling you now" SMS; outside hours → escalation with "Hot intent - outside business hours"

---

## Part 4: Client & User Management

### 09 — Client CRUD API
- [ ] `POST /api/admin/clients`: requires businessName/ownerName/email/phone; defaults timezone to `America/Edmonton`, status to `pending`; rejects duplicate emails (400); accepts optional `googleBusinessUrl`
- [ ] `PATCH /api/admin/clients/:id`: all fields optional; validates status enum `pending/active/paused/cancelled`; normalizes phone
- [ ] `DELETE /api/admin/clients/:id`: soft delete → `status='cancelled'`
- [ ] `GET /api/admin/users`: all users with client name via left join, ordered by `createdAt` desc
- [ ] `PATCH /api/admin/users/:id`: updates `isAdmin` boolean and `clientId` UUID; prevents admin from demoting themselves (400)
- [ ] `GET /api/admin/clients/:id/stats`: lead counts (total, actionRequired), 7-day stats, active team member count; returns 0 when no data

### 10 — Client Management UI
- [ ] **Admin page**: 4 stat cards; client list as clickable links to `/admin/clients/:id`; "No phone number" warning; color-coded status badges (green=active, yellow=pending, gray=paused, red=cancelled); empty state message
- [ ] **Create client page**: wizard promotion card → `/admin/clients/new/wizard`; form with 5 Canadian timezones; redirects to detail on success; error on duplicate email
- [ ] **Client detail page**: header with status badge + "Created" date; edit form (all fields + notification toggles + message limit); phone card (assign/change); team members summary; usage stats; actions (delete/reactivate)
- [ ] **User management**: user list with admin badges; "Assign to Client" dialog; Make/Remove Admin toggle; self-toggle disabled; page refreshes after actions

---

## Part 5: Twilio Provisioning & Phone Numbers

### 11 — Twilio Provisioning Service
- [ ] `searchAvailableNumbers`: defaults `CA`, max 10 results; mock fallback in dev (`+1XXX555YYYY` format) with mapped localities (403→Calgary, 780→Edmonton, etc.)
- [ ] `purchaseNumber`: configures voice + SMS webhooks; updates client `twilioNumber` + status `active`; detects mock numbers and skips Twilio API in dev
- [ ] `configureExistingNumber`: looks up in Twilio account first; returns error if not found
- [ ] `releaseNumber`: clears webhooks but does NOT delete number; sets `twilioNumber=null`, `status=paused`
- [ ] `getAccountBalance`: returns `{balance, currency}` or null
- [ ] `listOwnedNumbers`: returns `{phoneNumber, friendlyName, sid}` array
- [ ] **Search API**: validates area code is exactly 3 digits (400 if invalid); returns `{success, numbers, count, isDevelopmentMock}`

### 12 — Phone Number UI
- [ ] **3 tabs**: Current Number (disabled when no number), Search New, Use Existing
- [ ] **Current Number**: large font-mono display; Voice/SMS badges; "Release Number" → confirmation → switches to Search tab
- [ ] **Search New**: 3-digit area code input (non-numeric stripped); results list with locality/region; Purchase → confirmation dialog → redirects to client detail
- [ ] **Use Existing**: freeform phone input; configure & assign → redirects
- [ ] **Twilio account page** (`/admin/twilio`): balance, owned numbers count (assigned vs available), number list with client assignment status

---

## Part 6: Setup Wizard (Sections 13+14 merged)

### Setup Wizard Flow
- [ ] **5-step wizard** with progress bar, numbered circles (checkmark when complete), step titles on md+ screens
- [ ] **Step 1 (Business Info)**: required fields marked with *; timezone dropdown (5 Canadian zones, default Mountain); validates email format; `POST /api/admin/clients` → stores `clientId`; "Creating..." button state
- [ ] **Step 2 (Phone Number)**: 3-digit area code search; scrollable results with Select button; `POST /api/admin/twilio/purchase` → stores `twilioNumber`; "Skip for now" button; shows assigned number with badges if already set
- [ ] **Step 3 (Team Members)**: "+Add Team Member" toggles inline form; role dropdown (Manager/Lead/Sales/Support/Admin); validates name+phone+email; member cards with Remove button; warning when empty; saves each via `POST /api/team-members` on Next
- [ ] **Step 4 (Business Hours)**: 7 days with Switch toggle; Mon-Fri default 08:00-18:00; time inputs when open, "Closed" when off; saves via `PUT /api/business-hours` on Next
- [ ] **Step 5 (Review & Launch)**: 4 summary sections; warning panel if phone/members missing; "Activate Client" (`PATCH /api/admin/clients/{id}` → `status:active`); disabled without Twilio number; completion screen with confetti + View Client / Back to All Clients buttons
- [ ] **Entry point** `/admin/clients/new`: wizard promotion card + quick create form; `/admin` button links to wizard

---

## Part 7: Usage Tracking & Cost Management

### 15 — Usage Tracking
- [ ] **4 tables**: `api_usage`, `api_usage_daily` (unique on clientId+date+service), `api_usage_monthly` (unique on clientId+month), `usage_alerts`
- [ ] **7 services** in enum: openai, twilio_sms, twilio_voice, twilio_phone, stripe, google_places, cloudflare_r2
- [ ] `calculateCostCents()` returns correct cents per service type (OpenAI tokens, Twilio segments, Stripe percentage+fixed)
- [ ] `trackUsage()` inserts record + upserts daily rollup with operation breakdown JSONB
- [ ] `getClientUsageSummary()` returns totalCostCents, byService, byDay, topOperations
- [ ] `getCurrentMonthUsage()` returns costCents, daysRemaining, projectedCostCents
- [ ] **Alerts**: warning at $50, critical at $100, spike at 50%+ above previous month, projected overage at 1.5x critical; deduplication within 24h; critical alerts send SMS
- [ ] **Tracked clients**: `openai-tracked.ts` and `twilio-tracked.ts` track usage async (errors caught, non-blocking)
- [ ] **Usage dashboard** (`/admin/usage`): month selector (last 6 months); summary cards (Total Cost, OpenAI, Twilio SMS, Avg per Client); client breakdown with trending badges; links to detail
- [ ] **Client detail** (`/admin/usage/[clientId]`): active alerts with acknowledge button; MTD/Projected/Daily Average cards; cost by service progress bars; top operations
- [ ] **Cron**: hourly `updateMonthlySummaries()` + `checkAllClientAlerts()` (UTC minutes < 10)

---

## Part 8: Client Dashboard & Magic Links

### 16 — Client Dashboard
- [ ] `magic_link_tokens` table: 64-char token (unique), 7-day expiry, `usedAt` timestamp
- [ ] `createMagicLink()` returns URL `${NEXT_PUBLIC_APP_URL}/d/${token}`
- [ ] `validateMagicLink()`: valid unexpired → `{valid:true, clientId}` + marks used; token remains valid within expiry; invalid/expired → `{valid:false, error}`
- [ ] `GET /d/:token`: validates → sets `clientSessionId` httpOnly cookie (secure in prod, 7-day maxAge) → redirects to `/client`; invalid → `/link-expired`
- [ ] `getClientSession()`: reads cookie → returns `{clientId, client}` or null
- [ ] `/link-expired` page: "Link Expired" + instruction to text "DASHBOARD"
- [ ] **Client layout**: business name in header (truncated 200px); 3 nav links (Dashboard, Conversations, Team); sticky header; `max-w-3xl`
- [ ] **Client dashboard**: 2 stat cards (Leads This Month = missedCalls+forms, Messages Sent); up to 5 upcoming appointments; up to 5 recent leads with time-ago
- [ ] **DASHBOARD text command**: matches `messageBody.toUpperCase() === 'DASHBOARD'`; calls `sendDashboardLink()`; returns `{processed:true, action:'dashboard_link_sent'}`

---

## Part 9: CRM Conversations

### 17 — Conversations & Human Takeover
- [ ] `leads` has `conversation_mode` (varchar 10, default 'ai'), `human_takeover_at`, `human_takeover_by`
- [ ] **Conversations list** (`/client/conversations`): up to 50 leads by `createdAt` desc; mode badges (AI blue, Human green); last message preview + count; red left border for actionRequired
- [ ] **Conversation detail**: chat bubbles (outbound right blue, inbound left gray); AI messages marked with "AI" prefix; auto-scroll to bottom
- [ ] **AI mode**: "Take Over" button visible; info card "AI is handling this conversation" instead of input
- [ ] **Human mode**: "Hand Back to AI" button; text input + Send button; Enter sends (without Shift); disabled while sending/empty
- [ ] `POST /api/client/conversations/[id]/takeover`: sets `conversationMode='human'`, `humanTakeoverAt`, `humanTakeoverBy='client'`, `actionRequired=false`
- [ ] `POST /api/client/conversations/[id]/handback`: sets `conversationMode='ai'`, clears takeover fields
- [ ] `POST /api/client/conversations/[id]/send`: validates message not empty; 404 if lead not client's; 400 if no Twilio number; sends SMS + saves conversation record with `direction:'outbound'`, `messageType:'contractor_response'`
- [ ] **Incoming SMS human mode check**: when `lead.conversationMode === 'human'` → logs message but skips AI/hot intent/escalation → returns `{processed:true, action:'human_mode_saved'}`

---

## Part 10: Weekly Summary & Notifications

### 18 — Weekly SMS Summary
- [ ] Client columns: `weeklySummaryEnabled` (default true), `weeklySummaryDay` (default 1/Monday), `weeklySummaryTime` (default '08:00'), `lastWeeklySummaryAt`
- [ ] `getWeeklyStats()`: last 7 days; includes escalationsClaimed and topTeamMember
- [ ] `formatWeeklySMS/Email()`: includes magic dashboard link; email has "View Full Dashboard" button
- [ ] `sendWeeklySummary()`: SMS if phone+twilioNumber; email if email; skips if disabled; updates `lastWeeklySummaryAt`
- [ ] `processWeeklySummaries()`: matches `weeklySummaryDay` + hour + `status:'active'`; skips if sent within 6 days; errors per client caught
- [ ] **Cron**: `/api/cron/weekly-summary` with `CRON_SECRET` Bearer auth (401 without)
- [ ] **Client settings** (`/client/settings`): "Weekly Summary" card with Switch toggle; when enabled: day selector (Sun-Sat) + time selector (06:00-12:00); Save → "Saving..." → "Saved!"
- [ ] **Settings API** (`PUT /api/client/settings/summary`): validates `enabled` (boolean), `day` (0-6), `time` (HH:MM)

### 26 — Notification Preferences
- [ ] `notification_preferences` table: unique on `clientId`; SMS defaults (newLead=true, escalation=true, weeklySummary=true, flowApproval=true, negativeReview=true); email defaults (newLead=false, dailySummary=false, weeklySummary=true, monthlyReport=true)
- [ ] Quiet hours: `enabled=false`, `start='22:00'`, `end='07:00'`; `urgentOverride=true`
- [ ] `getNotificationPrefs()`: returns defaults when no record; auto-creates on first call
- [ ] `isInQuietHours()`: handles overnight ranges (22:00-07:00) and same-day ranges
- [ ] `shouldNotify()`: respects disabled type + quiet hours + urgent override
- [ ] `/client/settings/notifications`: 5 SMS toggles + 4 email toggles; quiet hours section reveals/hides with start/end time inputs + urgent override toggle
- [ ] Settings page has "Manage Notifications" link to notifications page

---

## Part 11: Flow Engine

### 19 — Flow Schema & Templates
- [ ] **Enums**: `flow_category` (8 values), `flow_trigger` (4), `flow_approval` (3), `flow_sync_mode` (3)
- [ ] **8 tables**: `flow_templates` (slug unique, versioned), `flow_template_steps`, `flow_template_versions` (JSONB snapshot), `flows` (client-specific), `flow_steps` (template linking with `useTemplateDelay`/`useTemplateMessage` fallbacks), `flow_executions`, `flow_step_executions`, `suggested_actions` (24h expiry)
- [ ] **Template service**: create with steps; publish (creates version snapshot, increments version); push updates respecting sync modes (inherit=replace all, override=add new only, detached=skip); `dryRun` option; `createFlowFromTemplate` increments usageCount; `detachFlowFromTemplate` decrements usageCount
- [ ] **Resolution service**: `resolveFlowSteps()` returns resolved steps with template fallbacks; `source` field (template/custom/mixed); `getStepMessage()` with `{variable}` substitution; `formatDelay()` (0→"Immediately", negative→"X hours before")
- [ ] **Seed script**: 8 templates (estimate-standard/aggressive, payment-friendly/firm, review-simple/with-reminder, referral-standard, appointment-reminder); idempotent (checks slug before insert); publishes each after creation

### 20 — Flow Builder UI
- [ ] **Template library** (`/admin/flow-templates`): grouped by category with icons; cards show name, description, version, published/draft, usage count, tags; dropdown: Edit, Push Update, Duplicate, Delete
- [ ] **Template editor**: name auto-generates slug; all fields editable (name, slug, description, category, trigger, approval mode, tags); validation on Save Draft (name/slug/category required, steps need messages)
- [ ] **Step editor**: numbered steps with connection lines; click to expand (ring-2 highlight); editable name/delay (number + unit conversion)/message/skip conditions (replied, scheduled, paid); move up/down (disabled at boundaries); delete (hidden when 1 step)
- [ ] **Push update page**: summary cards (total, will update, partial, won't); client list with sync mode badges + outdated version indicators; "Preview Changes" dry run; "Push to N Clients" button
- [ ] **Toast notifications**: Sonner Toaster in root layout; success (green) for save/publish/push; error (red) for validation/API failures

### 21 — AI Flow Triggering
- [ ] `detectSignals()`: GPT-4o-mini with JSON format; 10 boolean signals + confidence (0-100); analyzes last 10 messages; all-false defaults on error
- [ ] `mapSignalsToFlows()`: readyToSchedule→"Schedule Appointment", wantsEstimate→"Estimate Follow-up", satisfied→"Review Request", referralMention→"Referral Request", paymentMention→"Payment Reminder"
- [ ] `checkAndSuggestFlows()`: skips if confidence < 60; matches `trigger='ai_suggested'` + `isActive=true`; no duplicate pending suggestions; 24h expiry; sends SMS for `approvalMode='ask_sms'` with 8-char ID
- [ ] `handleApprovalResponse()`: detects YES/NO + 8-char ID; YES → approved + starts flow; NO → rejected; non-matching → `{handled:false}`
- [ ] `startFlowExecution()`: resolves steps; creates execution record; executes first step immediately if delay=0; substitutes `{leadName}`, `{businessName}`, `{ownerName}`
- [ ] **Incoming SMS integration**: approval responses from client.phone intercepted before opt-out; `checkAndSuggestFlows()` fires async after AI response (errors caught)
- [ ] **Conversation view UI**: pending suggestions as blue cards (bg-blue-50); "Send" approves + removes; "Dismiss" rejects + removes

### 22 — Flow Metrics & Analytics
- [ ] **3 tables**: `template_metrics_daily` (unique on templateId+date), `template_step_metrics` (unique on templateId+stepNumber+date), `client_flow_outcomes` (unique on clientId+flowId+period)
- [ ] **Metrics collection**: `recordExecutionStart/Complete/StepMessageSent/LeadResponse/OptOut`; running averages for response time; all use COALESCE for null safety
- [ ] `getTemplatePerformance()`: aggregate completion/response/conversion/opt-out rates + per-step response rates
- [ ] `compareTemplates()`: all templates in category with rates
- [ ] **Analytics dashboard** (`/admin/analytics`): category sections with date range toggles (7/30/90d); low-volume warning (< 100 executions); crown icon on best performer (>= 100 + 2+ templates); color-coded metrics
- [ ] **Template detail stats**: 4 summary cards; horizontal bar chart for step performance; conditional insights (strong/low first message, high opt-out, above average conversion)
- [ ] **Client outcomes widget**: 4 cards (Missed Calls blue, Estimates green, Payments emerald, Reviews yellow) with rate percentages
- [ ] **Integration**: `startFlowExecution` calls `recordExecutionStart`; `executeStep` calls `recordStepMessageSent`; metrics calls wrapped in `.catch(console.error)`

---

## Part 12: Knowledge Base & AI

### 23 — Knowledge Base Schema & Service
- [ ] `knowledge_base` table: 6 categories enum (services, pricing, faq, policies, about, custom); priority, keywords, isActive
- [ ] `getClientKnowledge()`: active entries ordered by priority desc
- [ ] `searchKnowledge()`: ilike on title+content+keywords; ignores terms <= 2 chars; max 10 results
- [ ] `buildKnowledgeContext()`: formatted string grouped by category with section labels; empty string if client not found
- [ ] `initializeClientKnowledge()`: 5 default entries; idempotent (skips if entries exist)
- [ ] CRUD: `addKnowledgeEntry` returns ID; `updateKnowledgeEntry` sets `updatedAt`; `deleteKnowledgeEntry` hard-deletes

### 24 — Knowledge Base UI
- [ ] **Knowledge page** (`/admin/clients/[id]/knowledge`): entries grouped by category with colored badges + count; content truncated at 200 chars; keywords shown; default entries auto-initialized on first visit
- [ ] **New/Edit entry**: category selector (6 options); title + content required; keywords optional; priority 1-10 (default 5); redirects to list after save
- [ ] **Client detail integration**: "Knowledge Base" button in Actions card

### 25 (Phase 15c) — AI Integration with Knowledge
- [ ] `generateAIResponse` accepts optional `clientId`; includes knowledge context in prompt; uses `gpt-4o-mini`
- [ ] `generateKnowledgeAwareResponse`: builds knowledge context + highlights top 3 relevant entries; SMS-appropriate length (1-3 sentences); fallback on AI failure
- [ ] `handleIncomingSMS` passes `client.id` to `generateAIResponse`; existing escalation triggers unaffected
- [ ] **Preview page** (`/admin/clients/[id]/knowledge/preview`): left panel shows full knowledge context; right panel is test chat (user right/blue, AI left/gray, "Thinking..." animation, conversation history maintained)
- [ ] **Test API** (`POST /api/admin/clients/[id]/knowledge/test`): 404 for invalid client; 400 for missing message; returns `{response: string}` with knowledge context
- [ ] "Test AI" button on knowledge base page header

---

## Part 13: Client Self-Service

### Phase 16b — Cancellation Flow
- [ ] `cancellation_requests` table: status lifecycle `pending → scheduled_call / cancelled`
- [ ] `getValueSummary()`: monthsActive, totalLeads, totalMessages, estimatedRevenue, ROI
- [ ] `initiateCancellation()` creates with `status:pending` + value summary JSONB
- [ ] `confirmCancellation()` sets 7-day `gracePeriodEnds`
- [ ] **Cancel page** (`/client/cancel`): value summary card (green); "Never mind" link back to `/client`; 7 radio reasons; optional feedback textarea; Continue → retention offer step
- [ ] **Retention step**: contextual help based on reason; "Schedule a Call" and "Cancel Anyway" buttons (disabled while submitting)
- [ ] `POST /api/client/cancel`: `schedule_call` → creates request + admin email; `confirm` → 7-day grace period + admin email
- [ ] `/client/cancel/call-scheduled` and `/client/cancel/confirmed` confirmation pages
- [ ] Pending cancellation redirects to `/client/cancel/pending`
- [ ] Settings page: "Danger Zone" card with red border + "Cancel Subscription" link

---

## Part 14: Revenue & Lead Scoring

### 28 — Revenue Attribution
- [ ] `jobs` table: `job_status` enum (lead/quoted/won/lost/completed); quote/deposit/final/paid amounts
- [ ] `revenue_events` table: event_type, amount, notes
- [ ] `createJobFromLead()` creates job + logs "job_created" event; `updateJobStatus("won")` logs revenue event
- [ ] `recordPayment()` increments paidAmount + logs "payment_received"
- [ ] `getRevenueStats()` returns counts and sums filtered by clientId + date range
- [ ] **Revenue dashboard** (`/admin/clients/[id]/revenue`): ROI banner (ROI%, revenue, collected); pipeline stats (leads, quoted, won, lost, win rate, avg job value)
- [ ] **Jobs list**: status badge colors (lead=gray, quoted=blue, won=green, lost=red, completed=purple); status dropdown for changes; empty state message
- [ ] Client detail: "Revenue Tracking" button in Actions card

### Phase 17b — Lead Scoring
- [ ] `leads` new columns: `score` (0-100, default 50), `temperature` (hot/warm/cold, default warm), `score_factors` JSONB, `score_updated_at`
- [ ] `quickScore()`: detects urgency ("asap", "emergency"), budget ("how much", "budget ready"), intent ("ready to book"), satisfaction signals
- [ ] `calculateEngagement()`: 0-25 based on response ratio + recency
- [ ] `aiScore()`: GPT-4o-mini structured output; falls back to `quickScore()` on parse failure
- [ ] `scoreLead()`: combines factors → total 0-100; sets temperature: hot >= 70, warm >= 40, cold < 40; updates DB
- [ ] **Webhook integration**: inbound SMS → quick score; high-value signals → async AI score (errors caught, non-blocking)
- [ ] **LeadScoreBadge**: compact mode (colored pill with score); full mode (card with 4-factor breakdown); hot=red/Flame, warm=yellow/Thermometer, cold=blue/Snowflake
- [ ] **Leads page**: compact badge next to status badge on each lead row
- [ ] **Cron**: midnight UTC batch rescore in quick mode (no AI)

---

## Part 15: Media & Payments

### 30 — Photo Handling
- [ ] `media_attachments` table: 5 types enum; R2 storage keys + public URLs; AI description + tags JSONB; dimensions/fileSize/mimeType
- [ ] `uploadImage()` uploads original + generates 300x300 JPEG thumbnail (`_thumb.jpg` suffix)
- [ ] `processIncomingMedia()`: fetches from Twilio URL with Basic auth; images → `uploadImage()` + AI Vision analysis (gpt-4o-mini → description + tags, fallback "Image received"/["unanalyzed"]); non-images → `uploadFile()`
- [ ] `generatePhotoAcknowledgment()`: contextual message based on AI tags (roof damage, leak, completed work, etc.)
- [ ] **Webhook MMS**: extracts `NumMedia`, loops `MediaUrl0..N`/`MediaContentType0..N`/`MediaSid0..N`; body defaults to empty
- [ ] **Incoming SMS**: `[N media attachment(s)]` for no-text MMS; `messageType:'mms'`; `.returning()` for message ID; photo-only → acknowledgment; photo+text → adds context to AI prompt
- [ ] **Media gallery**: 3/4/6 col grid; thumbnails with hover zoom icon; dialog with full-size image + AI description + tags + dimensions; download + delete buttons
- [ ] **Lead tabs**: Conversation + Photos tabs; inline thumbnails in message bubbles; MMS badge; Photos tab with full gallery + delete via API

### 31 — Payment Links (Stripe)
- [ ] `payments` table: Stripe fields (intent, link ID, link URL), status, `link_expires_at`, `metadata` JSONB
- [ ] `payment_reminders` table: per-reminder tracking with `lead_replied`
- [ ] `invoices` new columns: `job_id`, `description`, `total_amount`, `paid_amount`, `remaining_amount`, `stripe_customer_id`
- [ ] `getOrCreateStripeCustomer()`: returns existing from leads table or creates new; Stripe client lazy-initialized
- [ ] `createPaymentLink()`: creates Stripe price + link; 30-day expiry; saves to `payments` table
- [ ] `handlePaymentSuccess()`: updates payment `paid` + `paidAt`; updates invoice `paidAmount`/`remainingAmount`/status (`paid` when full, `partial` when partial); updates job `paidAmount`
- [ ] **Stripe webhook** (`/api/webhooks/stripe`): validates `stripe-signature`; `checkout.session.completed` → handlePaymentSuccess + SMS to lead + SMS to owner; `checkout.session.expired` → cancelled; `charge.refunded` → refunded
- [ ] **Payment API**: GET by clientId/leadId (400 if neither); POST creates link (dollars→cents), with `createInvoice:true` creates invoice+link; POST `[id]/send` sends via SMS + updates `linkSentAt`
- [ ] **Payment reminder**: auto-creates Stripe link when none provided; link included in scheduled messages; `markInvoicePaid()` also marks pending payments
- [ ] **SendPaymentButton**: dialog with amount/type (Full/Deposit/Progress/Final)/description; creates link → shows in read-only input with copy; "Send via SMS" button; form disabled after creation; resets on dialog close
- [ ] `/payment/success`: public page with green checkmark

---

## Part 16: Reputation & Reviews

### Phase 32 — Reputation Monitoring
- [ ] **3 tables**: `reviews` (rating, sentiment, AI suggested response, matchedLeadId), `review_sources` (googlePlaceId, consecutiveErrors), `review_metrics` (star counts, sentiment counts, response time)
- [ ] `fetchGooglePlaceDetails()`: returns null without API key; `findGooglePlaceId()` searches by business name
- [ ] `syncGoogleReviews()`: deduplicates by externalId (author_name+time); updates source stats; tracks consecutive errors; assigns sentiment by rating (>=4 positive, 3 neutral, <=2 negative)
- [ ] `checkAndAlertNegativeReviews()`: finds unalerted rating <= 2; generates AI response; sends SMS alert; marks `alertSent`
- [ ] **Review API**: GET with filters (source, rating, needsResponse, limit); POST triggers sync; sources GET/POST (auto-finds Place ID from business name)
- [ ] **Cron**: hourly sync for stale sources (not fetched in 1h); then negative alerts; per-client error catching
- [ ] **Dashboard** (`/admin/clients/[id]/reviews`): 4 summary cards (avg rating with stars, total, last 30d, needs response); sync button with spinner; negative reviews highlighted red; AI suggested response with copy + mark responded buttons
- [ ] **Source config**: Place ID input with auto-detect; connected source status badges with avg rating/total/last synced/errors
- [ ] `/admin/reputation`: all clients overview with sources and ratings; "View Reviews"/"Setup" links

### Phase 19b — Review Response AI
- [ ] `responseTemplates` + `reviewResponses` tables; Google OAuth fields on `clients`
- [ ] `generateReviewResponse()`: AI per rating tier (negative/neutral/positive); tone selector (professional/friendly/apologetic/thankful)
- [ ] `findMatchingTemplate()`: scores by rating range + keyword match; `applyTemplate()` substitutes `{{customer_name}}`, `{{business_name}}`, `{{owner_name}}`
- [ ] `createDraftResponse()`: template first → AI fallback; `regenerateResponse()`: tone change, shorter, custom instructions
- [ ] `postResponseToGoogle()`: checks Google source; refreshes expired tokens; updates response status + review record on success
- [ ] **API routes**: responses CRUD for a review; regenerate (tone/shorter/custom); post to Google (400 on failure); templates CRUD per client
- [ ] **Response editor**: tone selector; editable textarea with word count; "Make shorter"/"More friendly"/"More apologetic" quick actions; Copy button; "Post to Google" for Google reviews; "Copy & Reply on {source}" for others
- [ ] **6 default templates**: 5-Star Thank You, 4-Star Appreciation, 3-Star Follow Up, 3 negative templates (Quality/Communication/Timing with keywords)

---

## Part 17: Calendar Sync

### 34 — Calendar Integration
- [ ] `calendarIntegrations` table: 5 providers enum (google, jobber, servicetitan, housecall_pro, outlook); OAuth tokens; syncDirection; consecutiveErrors
- [ ] `calendarEvents` table: client+lead+job linking; startTime/endTime; provider + externalEventId; syncStatus; eventType
- [ ] **Google Calendar service**: `getGoogleAuthUrl()` with calendar scopes + clientId state; `handleGoogleCallback()` exchanges code → upserts integration; `createGoogleEvent/updateGoogleEvent/deleteGoogleEvent`; `syncFromGoogleCalendar()` pulls events; token refresh when expired; error tracking
- [ ] **Calendar facade**: `createEvent` → local insert + provider sync; `updateEvent/cancelEvent`; `getEvents` by date range; `getLeadEvents` (up to 10 upcoming); `fullSync` (-30 to +90 days); skips inbound-only integrations for outbound sync
- [ ] **Events API**: GET with clientId+start+end (400 without clientId); POST creates with Zod validation (clientId/title/startTime/endTime required)
- [ ] **Integrations API**: GET lists integrations; POST with `{clientId, provider:'google'}` → returns `{authUrl}`; unsupported provider → 400; DELETE sets inactive
- [ ] **Sync API**: POST `{clientId}` → full bidirectional sync → `{inbound:{created,updated}, outbound:{synced,failed}}`
- [ ] **OAuth callback** (`/api/auth/callback/google-calendar`): code+state → token exchange → redirect with success; `error=access_denied` → redirect with `error=google_denied`; missing code/state → `error=invalid_callback`
- [ ] **UI**: 4 providers shown (3 "Coming Soon"); Google: connect/disconnect/sync buttons; connected status with last sync; disconnect confirmation dialog; toast notifications
- [ ] **Cron** (`/api/cron/calendar-sync`): CRON_SECRET auth; syncs integrations not synced in 15 min; grouped by clientId; returns `{synced, errors}`

---

## Part 18: Voice AI

### 35 — Voice AI
- [ ] `voiceCalls` table with transcript, summary, intent, outcome, duration fields
- [ ] `clients` voice columns: `voiceEnabled`, `voiceMode` (after_hours/overflow/always), `voiceGreeting`, `voiceVoiceId`, `voiceMaxDuration`
- [ ] **Voice AI webhook** (`/api/webhooks/twilio/voice/ai`): finds client by Twilio number; forwards if voice disabled; checks business hours for `after_hours` mode; creates lead (source: `voice`); creates voiceCalls record; returns TwiML greeting + `<Gather>` for speech
- [ ] **Gather webhook** (`/api/webhooks/twilio/voice/ai/gather`): processes `SpeechResult`; fetches knowledge base context; OpenAI response generation; updates transcript; returns TwiML response + next gather or transfer redirect
- [ ] **Transfer webhook**: transfers to client owner phone; voicemail fallback if no phone; updates outcome to `transferred`
- [ ] **Dial-complete webhook**: updates voice call status on completion; handles missed/answered
- [ ] **Call summary service**: `generateCallSummary()` creates AI summary from transcript; `notifyClientOfCall()` sends SMS to owner
- [ ] **Voice call history API** (`GET /api/admin/clients/[id]/voice-calls`): up to 50 calls, most recent first
- [ ] **Voice settings UI**: enable/disable toggle; mode selector with description; custom greeting textarea; save calls PATCH API
- [ ] **Call history component**: caller number, intent/outcome badges, duration; AI summary; expandable transcript; play recording link; relative timestamps
- [ ] **Admin page** (`/admin/voice-ai`): all active clients with voice settings and call history; "Voice AI" in admin nav Configuration group

---

## Part 19: End-to-End Walkthrough

_One integrated manual test pass covering the critical happy paths._

### Admin Setup (5 min)
1. `npm run dev` → open `http://localhost:3000/login`
2. Sign in as admin → verify `user.isAdmin: true` via `/api/auth/session`
3. Verify admin nav shows Management/Optimization/Configuration groups in amber

### Client Creation via Wizard (5 min)
4. Navigate to `/admin` → click "+ New Client" → lands on wizard
5. Step 1: fill required fields → "Creating..." → advances to Step 2
6. Step 2: search area code 403 → mock numbers appear → purchase one → Step 3
7. Step 3: add a team member (name, phone, email, role) → Next saves via API → Step 4
8. Step 4: toggle Sunday on, toggle Friday off → Next saves → Step 5
9. Step 5: verify all 4 summary sections → "Activate Client" → completion screen → "View Client"

### Client Detail Management (3 min)
10. On client detail: edit business name → Save → success message; verify phone card shows number
11. Navigate to `/admin/users` → verify user list; assign a user to client; toggle admin (not self)
12. Back to `/admin` → verify client in list with status badge

### Client Switching & Dashboard Pages (3 min)
13. Select the new client in admin dropdown → `/dashboard` shows their stats
14. Visit `/leads`, `/scheduled`, `/settings` → each shows "Select a Client" prompt or data
15. Settings: verify Team Members section shows the member added in wizard; verify Business Hours editor

### Client Self-Service (3 min)
16. Create a magic link → visit `/d/<token>` → redirected to `/client` with cookie set
17. Verify client dashboard: stat cards, appointments, recent leads
18. Navigate to Conversations → verify list; Settings → verify Weekly Summary card + Notification link
19. Settings → Danger Zone → Cancel Subscription → select reason → verify flow

### Knowledge Base & AI (2 min)
20. `/admin/clients/[id]/knowledge` → verify default entries auto-initialized
21. Add a custom entry → verify it appears in list
22. Click "Test AI" → ask a question → verify AI uses knowledge base entries

### Twilio & Phone Management (2 min)
23. `/admin/twilio` → verify account balance + owned numbers display
24. `/admin/clients/[id]/phone` → verify Current Number tab shows assigned number

### Admin Tools Spot Check (3 min)
25. `/admin/usage` → verify month selector + summary cards render
26. `/admin/flow-templates` → verify seeded templates grouped by category
27. `/admin/analytics` → verify category sections render (may show empty/low-volume)
28. `/admin/reputation` → verify client overview renders
29. `/admin/voice-ai` → verify client list with voice settings

---

## Part 20: Build & Route Manifest

### Build
- [ ] `npm run build` completes with **0 TypeScript errors**
- [ ] `Compiled successfully` in output
- [ ] No unused imports or variables warnings

### Dashboard Pages
- [ ] `/admin` — Agency dashboard / Client management
- [ ] `/admin/clients/new` — Create client (quick + wizard link)
- [ ] `/admin/clients/new/wizard` — Setup wizard
- [ ] `/admin/clients/[id]` — Client detail
- [ ] `/admin/clients/[id]/phone` — Phone assignment
- [ ] `/admin/clients/[id]/knowledge` — Knowledge base list
- [ ] `/admin/clients/[id]/knowledge/new` — New knowledge entry
- [ ] `/admin/clients/[id]/knowledge/[entryId]` — Edit knowledge entry
- [ ] `/admin/clients/[id]/knowledge/preview` — AI test chat
- [ ] `/admin/clients/[id]/revenue` — Revenue dashboard
- [ ] `/admin/clients/[id]/reviews` — Reputation monitoring
- [ ] `/admin/users` — User management
- [ ] `/admin/twilio` — Twilio account dashboard
- [ ] `/admin/phone-numbers` — Phone number console
- [ ] `/admin/ab-tests` — A/B testing
- [ ] `/admin/ab-tests/new` — Create A/B test
- [ ] `/admin/ab-tests/[id]` — A/B test detail
- [ ] `/admin/reports` — Reports list
- [ ] `/admin/reports/new` — Generate report
- [ ] `/admin/reports/[id]` — Report detail
- [ ] `/admin/template-performance` — Template performance dashboard
- [ ] `/admin/usage` — Usage tracking
- [ ] `/admin/usage/[clientId]` — Client usage detail
- [ ] `/admin/flow-templates` — Flow template library
- [ ] `/admin/flow-templates/[id]` — Template editor
- [ ] `/admin/flow-templates/[id]/push` — Push update
- [ ] `/admin/analytics` — Flow analytics
- [ ] `/admin/reputation` — Reputation overview
- [ ] `/admin/voice-ai` — Voice AI management
- [ ] `/dashboard` — Client dashboard (admin view)
- [ ] `/leads` — Leads list
- [ ] `/scheduled` — Scheduled messages
- [ ] `/settings` — Client settings
- [ ] `/claim` — Escalation claim
- [ ] `/claim-error` — Claim error
- [ ] `/link-expired` — Magic link expired
- [ ] `/payment/success` — Payment success (public)

### Client Portal Pages
- [ ] `/d/[token]` — Magic link auth redirect
- [ ] `/client` — Client dashboard
- [ ] `/client/conversations` — Conversations list
- [ ] `/client/conversations/[id]` — Conversation detail
- [ ] `/client/team` — Team page
- [ ] `/client/settings` — Client settings
- [ ] `/client/settings/notifications` — Notification preferences
- [ ] `/client/cancel` — Cancellation flow
- [ ] `/client/cancel/call-scheduled` — Call scheduled confirmation
- [ ] `/client/cancel/confirmed` — Cancellation confirmed

### API Routes — Admin
- [ ] `/api/admin/clients` (GET, POST)
- [ ] `/api/admin/clients/[id]` (GET, PATCH, DELETE)
- [ ] `/api/admin/clients/[id]/stats` (GET)
- [ ] `/api/admin/clients/[id]/knowledge` (GET, POST)
- [ ] `/api/admin/clients/[id]/knowledge/[entryId]` (PATCH, DELETE)
- [ ] `/api/admin/clients/[id]/knowledge/test` (POST)
- [ ] `/api/admin/clients/[id]/jobs` (GET, POST)
- [ ] `/api/admin/clients/[id]/jobs/[jobId]` (PATCH)
- [ ] `/api/admin/clients/[id]/reviews` (GET, POST)
- [ ] `/api/admin/clients/[id]/reviews/sources` (GET, POST)
- [ ] `/api/admin/clients/[id]/templates` (GET, POST)
- [ ] `/api/admin/clients/[id]/voice-calls` (GET)
- [ ] `/api/admin/users` (GET)
- [ ] `/api/admin/users/[id]` (PATCH)
- [ ] `/api/admin/twilio/search` (GET)
- [ ] `/api/admin/twilio/purchase` (POST)
- [ ] `/api/admin/twilio/configure` (POST)
- [ ] `/api/admin/twilio/release` (POST)
- [ ] `/api/admin/twilio/account` (GET)
- [ ] `/api/admin/ab-tests` (GET, POST)
- [ ] `/api/admin/ab-tests/[id]` (GET, PATCH)
- [ ] `/api/admin/ab-tests/[id]/results` (GET)
- [ ] `/api/admin/reports` (GET, POST)
- [ ] `/api/admin/reports/[id]` (GET)
- [ ] `/api/admin/usage` (GET)
- [ ] `/api/admin/usage/[clientId]` (GET)
- [ ] `/api/admin/usage/alerts/[id]/acknowledge` (POST)
- [ ] `/api/admin/flow-templates` (GET, POST)
- [ ] `/api/admin/flow-templates/[id]` (GET, PATCH, DELETE)
- [ ] `/api/admin/flow-templates/[id]/publish` (POST)
- [ ] `/api/admin/flow-templates/[id]/push` (POST)
- [ ] `/api/admin/analytics/templates` (GET)
- [ ] `/api/admin/analytics/templates/[id]` (GET)
- [ ] `/api/admin/reviews/[id]/responses` (GET, POST)
- [ ] `/api/admin/responses/[id]` (GET, PATCH, DELETE)
- [ ] `/api/admin/responses/[id]/regenerate` (POST)
- [ ] `/api/admin/responses/[id]/post` (POST)

### API Routes — Client
- [ ] `/api/client/conversations/[id]/takeover` (POST)
- [ ] `/api/client/conversations/[id]/handback` (POST)
- [ ] `/api/client/conversations/[id]/send` (POST)
- [ ] `/api/client/settings/summary` (PUT)
- [ ] `/api/client/notifications` (GET, PUT)
- [ ] `/api/client/cancel` (POST)
- [ ] `/api/client/leads/[id]/suggestions` (GET, POST)
- [ ] `/api/clients/[id]/outcomes` (GET)
- [ ] `/api/clients/[id]/leads/scores` (GET, POST)

### API Routes — Public / Auth
- [ ] `/api/auth/[...nextauth]`
- [ ] `/api/auth/callback/google-calendar` (GET)
- [ ] `/api/claim` (POST)
- [ ] `/api/team-members` (GET, POST, DELETE)
- [ ] `/api/team-members/[id]` (PATCH, DELETE)
- [ ] `/api/business-hours` (GET, PUT)
- [ ] `/api/leads/[id]/score` (GET, POST)
- [ ] `/api/leads/[id]/media` (GET)
- [ ] `/api/media/[id]` (GET, DELETE)
- [ ] `/api/payments` (GET, POST)
- [ ] `/api/payments/[id]/send` (POST)
- [ ] `/api/calendar/events` (GET, POST)
- [ ] `/api/calendar/integrations` (GET, POST)
- [ ] `/api/calendar/integrations/[id]` (DELETE)
- [ ] `/api/calendar/sync` (POST)

### API Routes — Webhooks
- [ ] `/api/webhooks/twilio/sms` (POST)
- [ ] `/api/webhooks/twilio/voice` (POST)
- [ ] `/api/webhooks/twilio/voice/ai` (POST)
- [ ] `/api/webhooks/twilio/voice/ai/gather` (POST)
- [ ] `/api/webhooks/twilio/voice/ai/transfer` (POST)
- [ ] `/api/webhooks/twilio/voice/ai/dial-complete` (POST)
- [ ] `/api/webhooks/twilio/ring-connect` (POST)
- [ ] `/api/webhooks/twilio/member-answered` (POST)
- [ ] `/api/webhooks/twilio/ring-result` (POST)
- [ ] `/api/webhooks/stripe` (POST)

### API Routes — Cron
- [ ] `/api/cron` (GET) — main orchestrator
- [ ] `/api/cron/weekly-summary` (GET)
- [ ] `/api/cron/calendar-sync` (GET)

### Navigation Links (Admin Sidebar)
- [ ] **Management**: Agency Dashboard, Clients, Users
- [ ] **Optimization**: A/B Tests, Template Performance, Flow Templates, Analytics, Reports, Usage, Reputation
- [ ] **Configuration**: Phone Numbers, Twilio Settings, Voice AI

---

## Part 21: Database Setup & Seed Data (00E)

### Schema — Clients Feature Flags
- [ ] `clients` table includes Core SMS flags: `missed_call_sms_enabled` (default true), `ai_response_enabled` (default true)
- [ ] `clients` table includes AI Agent flags: `ai_agent_enabled` (default true), `ai_agent_mode` (default 'assist'), `auto_escalation_enabled` (default true)
- [ ] `clients` table includes Automation flags: `flows_enabled` (default true), `lead_scoring_enabled` (default true)
- [ ] `clients` table includes Integration flags: `calendar_sync_enabled` (default false), `hot_transfer_enabled` (default false), `payment_links_enabled` (default false)
- [ ] `clients` table includes Reputation flags: `reputation_monitoring_enabled` (default false), `auto_review_response_enabled` (default false)
- [ ] `clients` table includes Communication flags: `photo_requests_enabled` (default true), `multi_language_enabled` (default false), `preferred_language` (default 'en')

### Schema — New Tables
- [ ] `subscription_plans` table exists with columns: slug (unique), name, priceMonthly/priceYearly (integer cents), stripe IDs, included quotas (leads/messages/team/phones), features (JSONB), sortOrder, isPublic, isPopular
- [ ] `admin_users` table exists with columns: email (unique), name, passwordHash, role (default 'admin'), lastLoginAt
- [ ] `system_settings` table exists with columns: key (unique), value, description

### Schema Exports
- [ ] `subscription-plans.ts`, `admin-users.ts`, `system-settings.ts` files exist in `src/db/schema/`
- [ ] All three are re-exported from `src/db/schema/index.ts`
- [ ] TypeScript types exported: `SubscriptionPlan`, `AdminUser`, `SystemSetting` (+ insert types)

### Migration
- [ ] Migration file `0008_*.sql` exists in `drizzle/` directory
- [ ] `npm run db:generate` runs without errors (no pending schema changes)

### Seed Script
- [ ] `scripts/seed.ts` exists and is syntactically valid
- [ ] `npm run db:seed` is defined in `package.json` and points to `scripts/seed.ts`
- [ ] `npm run db:setup` is defined and chains `db:migrate && db:seed`
- [ ] Seed script is idempotent — running twice does not create duplicates (plans update, admin skips, settings skip)
- [ ] Seeds 3 subscription plans: Starter ($497), Professional ($997), Enterprise ($1,997)
- [ ] Seeds 5 flow templates: missed-call-standard, estimate-standard, invoice-reminder, appointment-reminder, review-request
- [ ] Seeds 1 admin user (uses ADMIN_EMAIL/ADMIN_PASSWORD env vars or defaults)
- [ ] Seeds 10 system settings (app.name, sms.quiet_hours_*, ai.default_model, billing.trial_days, etc.)

### Database Connection
- [ ] `GET /api/test-db` returns `{ success: true }` with 200 status
- [ ] Database client uses `getDb()` factory per request (not cached)
- [ ] `drizzle.config.ts` points to `./src/db/schema/index.ts`

### Overage Pricing (00E.2E)
- [ ] `seedOveragePricing()` function exists in `scripts/seed.ts` and is called from main `seed()`
- [ ] Overage pricing logs 5 resources: leads ($0.50), messages ($0.03), team_members ($20), phone_numbers ($15), voice_minutes ($0.15)
- [ ] `npm run db:seed` output includes "Seeding overage pricing..." and "Configure these overages in Stripe:" lines
- [ ] `db:reset` script defined in `package.json` as `npx drizzle-kit drop && npm run db:setup`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] All 60 tables recognized by Drizzle (verify in `db:generate` output)

---

## Part 22: Feature Flags & Configuration (01E)

### Type Definitions
- [ ] `src/types/client.ts` exports `ClientFeatureFlags` interface
- [ ] Interface includes all 15 boolean flags + `aiAgentMode` enum + `preferredLanguage` string
- [ ] `voiceMode` typed as `'always' | 'after_hours' | 'overflow'`
- [ ] `aiAgentMode` typed as `'off' | 'assist' | 'autonomous'`

### Feature Check Helper (`src/lib/features/check-feature.ts`)
- [ ] `FeatureFlag` type covers all 14 feature flags (missedCallSms through multiLanguage)
- [ ] `featureToColumn` maps each FeatureFlag to the correct `clients` column name
- [ ] `isFeatureEnabled(clientId, feature)` returns `true` when flag is true in DB
- [ ] `isFeatureEnabled(clientId, feature)` returns `false` when flag is false or client not found
- [ ] `getEnabledFeatures(clientId, features)` returns a Record with correct boolean for each requested flag
- [ ] `requireFeature(clientId, feature)` resolves when flag is true
- [ ] `requireFeature(clientId, feature)` throws Error with feature name when flag is false
- [ ] `requireFeature(clientId, feature, customMsg)` throws with custom message when flag is false

### API Schema Update (`/api/admin/clients/[id]` PATCH)
- [ ] Zod schema accepts all 14 boolean feature flags as optional booleans
- [ ] Zod schema accepts `aiAgentMode` as optional enum `'off' | 'assist' | 'autonomous'`
- [ ] Zod schema accepts `preferredLanguage` as optional string (max 10 chars)
- [ ] PATCH with `{ missedCallSmsEnabled: false }` → updates DB → returns updated client
- [ ] PATCH with `{ aiAgentMode: 'autonomous' }` → updates DB → returns updated client
- [ ] PATCH with `{ aiAgentMode: 'invalid' }` → returns 400 validation error

### Feature Toggles Panel (Admin UI)
- [ ] Feature Toggles card appears on `/admin/clients/[id]` page
- [ ] Card has 7 sections: Core SMS, AI Agent, Voice AI, Automation, Integrations, Reputation, Communication
- [ ] Each section has uppercase tracking-wide header label
- [ ] Each toggle shows label, description, and Switch component
- [ ] AI Agent Mode has Select dropdown with Off/Assist/Autonomous options
- [ ] Toggling a switch updates local state immediately (optimistic UI)
- [ ] "Save Feature Settings" button sends PATCH to API
- [ ] Success message "Features updated successfully" shown on save
- [ ] Error message shown on API failure
- [ ] Page refreshes after successful save (router.refresh)

### Feature Status Display (Admin UI)
- [ ] Feature Status card appears on `/admin/clients/[id]` page (above toggles)
- [ ] Shows "X of 14 enabled" count in header
- [ ] 14 feature items in 2/3 column grid (responsive)
- [ ] Enabled features show green background, green icon, "Enabled" text
- [ ] Disabled features show gray background, gray icon, "Disabled" text
- [ ] Each feature has its own Lucide icon (Phone, Bot, Brain, Mic, etc.)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors after all feature flag changes

---

## Part 21.1: Database Setup Manual QA (00E Verification)

_Manual verification steps for the Phase 1 project setup and database connection._

### Step 1: Project & Dependencies
- [ ] `package.json` exists with `next@16`, `drizzle-orm`, `@neondatabase/serverless`, `zod`, `date-fns`
- [ ] `npm run dev` starts without errors on port 3000
- [ ] All UI dependencies present: `@radix-ui/*`, `tailwindcss`, `lucide-react`, `sonner`
- [ ] Service SDKs present: `twilio`, `openai`, `resend`, `stripe`

### Step 2: Drizzle Configuration
- [ ] `drizzle.config.ts` exists at project root
- [ ] Schema path points to `./src/db/schema/index.ts`
- [ ] Dialect is `postgresql`
- [ ] `drizzle/` directory contains migration SQL files (0000 through 0008)

### Step 3: Database Client Factory
- [ ] `src/db/client.ts` exports `createNeonClient()` using `neon()` + `drizzle()`
- [ ] `src/db/index.ts` exports `getDb()` that creates a new client per call (never cached)
- [ ] `getDb()` handles both Cloudflare Workers and Next.js environments
- [ ] `getDb()` throws descriptive error when `DATABASE_URL` is missing

### Step 4: Core Schema Tables (10 tables)
- [ ] `clients` table: `id` (uuid PK), `businessName`, `ownerName`, `email` (unique), `phone`, `twilioNumber`, `timezone` (default 'America/Edmonton'), `status` (default 'active'), `createdAt`, `updatedAt`
- [ ] `leads` table: `id` (uuid PK), `clientId` (FK cascade), `phone`, `status` (default 'new'), unique on `(clientId, phone)`, indexes on `clientId`, `phone`, `status`, `actionRequired`
- [ ] `conversations` table: `id` (uuid PK), `leadId` (FK cascade), `clientId` (FK cascade), `direction`, `messageType`, `content`, `twilioSid`, `aiConfidence`, indexes on `leadId`, `clientId`
- [ ] `scheduled_messages` table: `sendAt` (not null), `sent`, `cancelled`, indexes on `sendAt`, `clientId`, `leadId`
- [ ] `appointments` table: `appointmentDate` (date), `appointmentTime` (time), `status` (default 'scheduled'), `reminderDayBeforeSent`, `reminder2hrSent`
- [ ] `invoices` table: `amount` (numeric), `totalAmount`/`paidAmount`/`remainingAmount` (integer cents), `dueDate`, `paymentLink`, `status` (default 'pending')
- [ ] `blocked_numbers` table: unique on `(clientId, phone)`
- [ ] `message_templates` table: `templateType`, `content`, unique on `(clientId, templateType)`
- [ ] `daily_stats` table: 9 integer metric columns, unique on `(clientId, date)`
- [ ] `error_log` table: `errorType`, `errorMessage`, `errorDetails` (JSONB), `resolved`

### Step 5: Feature Flags on Clients
- [ ] Core SMS: `missed_call_sms_enabled` (true), `ai_response_enabled` (true)
- [ ] AI Agent: `ai_agent_enabled` (true), `ai_agent_mode` ('assist'), `auto_escalation_enabled` (true)
- [ ] Voice AI: `voice_enabled` (false), `voice_mode` ('after_hours')
- [ ] Automation: `flows_enabled` (true), `lead_scoring_enabled` (true)
- [ ] Integrations: `calendar_sync_enabled` (false), `hot_transfer_enabled` (false), `payment_links_enabled` (false)
- [ ] Reputation: `reputation_monitoring_enabled` (false), `auto_review_response_enabled` (false)
- [ ] Communication: `photo_requests_enabled` (true), `multi_language_enabled` (false), `preferred_language` ('en')
- [ ] Weekly Summary: `weekly_summary_enabled` (true), `weekly_summary_day` (1), `weekly_summary_time` ('08:00')

### Step 6: Schema Exports & Relations
- [ ] `src/db/schema/index.ts` re-exports all 55+ tables from individual files
- [ ] `src/db/schema/relations.ts` defines relations for: `clients`, `users`, `accounts`, `sessions`, `leads`, `conversations`, `scheduledMessages`, `appointments`, `invoices`, `blockedNumbers`, `messageTemplates`, `dailyStats`, `teamMembers`, `escalationClaims`, `businessHours`, `callAttempts`, `flows`, `flowExecutions`, `payments`, `mediaAttachments`
- [ ] Each schema file exports `$inferSelect` and `$inferInsert` types

### Step 7: Test Route
- [ ] `GET /api/test-db` exists at `src/app/api/test-db/route.ts`
- [ ] Returns `{ success: true, message: "Database connection successful" }` with 200 on success
- [ ] Returns `{ success: false, error: "..." }` with 500 on database failure
- [ ] Uses `getDb()` (not a cached instance)

### Step 8: Seed Script & npm Scripts
- [ ] `scripts/seed.ts` seeds: 3 plans (Starter $497, Professional $997, Enterprise $1,997), 5 flow templates, 1 admin user, 10 system settings, overage pricing log
- [ ] Seed is idempotent: plans update, admin skips if exists, settings skip if exists
- [ ] `npm run db:seed` -> `npx tsx scripts/seed.ts`
- [ ] `npm run db:setup` -> `npm run db:migrate && npm run db:seed`
- [ ] `npm run db:reset` -> `npx drizzle-kit drop && npm run db:setup`
- [ ] `npm run db:generate` -> `drizzle-kit generate`
- [ ] `npm run db:studio` -> `drizzle-kit studio`

### Step 9: Build Verification
- [ ] `npm run build` completes with `Compiled successfully` and 0 TypeScript errors
- [ ] All routes registered (60+ dynamic routes in build output)

---

## Part 10: TCPA Compliance & Consent Management (02E)

### Schema & Database
- [ ] `consent_records` table created with all columns (id, clientId, leadId, phoneNumber, phoneNumberHash, consentType, consentSource, consentScope, consentLanguage, consentTimestamp, ipAddress, userAgent, formUrl, signatureImage, recordingUrl, isActive, revokedAt, revokedReason, metadata, createdAt, updatedAt)
- [ ] `opt_out_records` table created with all columns (id, clientId, leadId, phoneNumber, phoneNumberHash, optOutReason, optOutTimestamp, triggerMessage, triggerMessageId, processedAt, processedBy, reoptedInAt, reoptinConsentId, metadata, createdAt)
- [ ] `do_not_contact_list` table created with all columns (id, clientId, phoneNumber, phoneNumberHash, source, sourceReference, addedAt, expiresAt, isActive, removedAt, removeReason, metadata)
- [ ] `quiet_hours_config` table created with clientId unique constraint, default quiet hours 21-8
- [ ] `compliance_audit_log` table created with event tracking fields
- [ ] `compliance_check_cache` table created with TTL-based caching fields
- [ ] All tables use `uuid_generate_v4()` for primary keys
- [ ] All indexes created (consent_client_phone, consent_phone_hash, optout_client_phone, dnc_phone_hash, audit_client_event, cache_client_phone, etc.)
- [ ] Enums: `consent_type` (4 values), `consent_source` (7 values), `opt_out_reason` (7 values)
- [ ] Relations added in `relations.ts` for consentRecords and optOutRecords
- [ ] Schema exported from `src/db/schema/index.ts`

### Opt-Out Handling
- [ ] STOP keyword triggers opt-out recording
- [ ] STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT, OPT OUT, OPTOUT, REMOVE keywords detected
- [ ] Case-insensitive opt-out detection works
- [ ] Opt-out confirmation message returned: "You have been unsubscribed..."
- [ ] Lead status updated to `opted_out` with `optedOut=true` and `optedOutAt` set
- [ ] Consent record marked `isActive=false` with `revokedAt` and `revokedReason`
- [ ] Compliance check cache invalidated after opt-out
- [ ] Future messages blocked for opted-out numbers
- [ ] Audit log entry created for opt-out event

### Opt-In Handling
- [ ] START keyword triggers re-opt-in
- [ ] YES, UNSTOP, SUBSCRIBE, OPTIN, OPT IN keywords detected
- [ ] New consent record created with `text_optin` source
- [ ] Previous opt-out record marked with `reoptedInAt` and `reoptinConsentId`
- [ ] Lead status updated to `active` with `optedOut=false` and `optedOutAt=null`
- [ ] Opt-in confirmation message returned: "You have been resubscribed!"
- [ ] Audit log entry created for consent event

### Consent Recording
- [ ] `POST /api/compliance/consent` requires auth (returns 401 without session)
- [ ] Required fields validated: phoneNumber, type, source, language (returns 400 if missing)
- [ ] Consent record stored with IP address from `x-forwarded-for` header
- [ ] Consent record stored with user agent from request header
- [ ] Consent scope defaults to all-true if not provided
- [ ] Phone number normalized and hashed before storage
- [ ] Associated lead found and linked if exists
- [ ] Returns consentId on success

### Compliance Check
- [ ] `POST /api/compliance/check` requires auth (returns 401 without session)
- [ ] Returns 400 if phoneNumber missing
- [ ] Full check validates: opt-out status, DNC list, consent records, quiet hours
- [ ] Opted-out numbers return `canSend: false` with `blockReason: "Recipient has opted out"`
- [ ] DNC list numbers return `canSend: false` with `blockReason` including source
- [ ] No consent returns `canSend: false` with `blockReason: "No valid consent record"`
- [ ] Quiet hours return `canSend: false` with reason including time window
- [ ] Valid consent returns `canSendMarketing` and `canSendTransactional` based on scope
- [ ] Warning generated for consent over 1 year old
- [ ] Warning generated for implied consent type
- [ ] Cache checked first (5-minute TTL)
- [ ] Cache invalidated after opt-out or consent changes
- [ ] Audit log entries created for blocked messages

### DNC List Management
- [ ] Single number addition works via `DncService.addToDnc()`
- [ ] Duplicate detection prevents re-adding active entries
- [ ] Removal sets `isActive=false` with `removedAt` and `removeReason`
- [ ] Bulk import processes in chunks of 1000
- [ ] Bulk import returns counts: total, added, duplicates, errors
- [ ] Global DNC (clientId=null) blocks across all clients
- [ ] Client-specific DNC blocks only for that client
- [ ] DNC expiration honored (expired entries not blocking)

### Quiet Hours
- [ ] Default quiet hours: 9 PM to 8 AM (21:00-08:00)
- [ ] Weekend hours override works when configured
- [ ] Timezone conversion uses `date-fns-tz` `getTimezoneOffset()`
- [ ] Default timezone fallback to `America/New_York` when not provided
- [ ] Overnight quiet hours (start > end) correctly detected
- [ ] Federal holiday detection for fixed holidays (New Year, July 4th, Veterans Day, Christmas)
- [ ] `enforceQuietHours=false` disables quiet hours check

### Compliance Report
- [ ] `GET /api/compliance/report` requires auth (returns 401 without session)
- [ ] `months` query param controls report period (default: 1)
- [ ] Report includes: totalConsents, activeConsents, totalOptOuts, optOutRate, dncListSize, messagesBlocked
- [ ] Consent breakdown by type and source
- [ ] Opt-out breakdown by reason with 30-day daily trend
- [ ] Compliance events grouped by type
- [ ] Risk detection: high opt-out rate (>5%), implied consent dominance (>30%), complaints
- [ ] Recommendations generated for each detected risk

### Admin Compliance Dashboard
- [ ] `/admin/compliance` page accessible only to admin users
- [ ] Non-admin redirected to `/dashboard`
- [ ] Compliance score displayed with color-coded badge (green/yellow/red)
- [ ] Stats grid shows: Active Consents, Opt-Outs (with rate), DNC List size, Messages Blocked
- [ ] Risk warnings displayed in amber alert card when risks exist
- [ ] Download Report button triggers JSON report download
- [ ] "Compliance" link appears in admin Configuration nav group

### UI Components
- [ ] `ConsentCapture` component renders 4 checkboxes (marketing, transactional, promotional, reminders)
- [ ] TCPA disclosure text displayed with message rates and STOP info
- [ ] Submit button shows "Saving..." during submission
- [ ] Success state shows "Thank you!" alert after consent saved
- [ ] `ComplianceDashboard` component renders score, stats, risks, and download button
- [ ] Progress bar reflects compliance score percentage

### Phone Number Privacy
- [ ] All phone numbers hashed with SHA-256 before storage in hash columns
- [ ] Hash-based lookups used for compliance checks (not plain text matching)
- [ ] Original phone numbers stored only where legally required (consent_records, opt_out_records)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] All compliance routes registered: `/api/compliance/check`, `/api/compliance/consent`, `/api/compliance/report`
- [ ] Admin compliance page registered: `/admin/compliance`
- [ ] `date-fns-tz` dependency installed

---

## Part 23: Billing Schema & Subscription Management (03E)

### Schema — Billing Enums
- [ ] `subscription_status` pgEnum exists with 6 values: trialing, active, past_due, canceled, unpaid, paused
- [ ] `plan_interval` pgEnum exists with 2 values: month, year
- [ ] Enums exported from `src/db/schema/billing-enums.ts`

### Schema — Plans Table
- [ ] `plans` table exists with columns: id (uuid PK), name, slug (unique), description, priceMonthly (integer cents), priceYearly (integer cents, nullable), stripe IDs, features (JSONB with typed interface), trialDays (default 14), isPopular, displayOrder, isActive, timestamps
- [ ] Features JSONB type includes: maxLeadsPerMonth, maxTeamMembers, maxPhoneNumbers, includesVoiceAi, includesCalendarSync, includesAdvancedAnalytics, includesWhiteLabel, supportLevel, apiAccess
- [ ] Indexes on slug and displayOrder

### Schema — Subscriptions Table
- [ ] `subscriptions` table exists with: clientId (FK cascade, unique), planId (FK), status (subscriptionStatusEnum), interval (planIntervalEnum), Stripe IDs, period timestamps, trial timestamps, cancellation fields, pause fields, discount fields, usage-based overage fields, timestamps
- [ ] Unique index on clientId, regular indexes on stripeSubscriptionId and status

### Schema — Billing Payment Methods Table
- [ ] `billing_payment_methods` table exists with: clientId (FK cascade), stripePaymentMethodId (unique), card details (brand, last4, expMonth, expYear), bank details, isDefault, billing address (JSONB), timestamps
- [ ] Index on clientId, unique index on stripePaymentMethodId

### Schema — Subscription Invoices Table
- [ ] `subscription_invoices` table exists with: clientId (FK cascade), subscriptionId (FK), Stripe IDs, invoiceNumber, status, amounts in cents (subtotal, discount, tax, total, amountPaid, amountDue), currency, lineItems (JSONB array), dates (invoiceDate, dueDate, paidAt), period (start/end), PDF URLs, payment tracking fields, metadata (JSONB), timestamps
- [ ] Indexes on clientId, stripeInvoiceId (unique), status, invoiceDate

### Schema — Usage Records Table
- [ ] `usage_records` table exists with: clientId (FK cascade), subscriptionId (FK), usageType, quantity, unitAmountCents, period (start/end), reportedToStripe, stripeUsageRecordId, billedOnInvoiceId (FK), createdAt
- [ ] Composite index on clientId+periodStart+periodEnd, index on usageType

### Schema — Billing Events Table
- [ ] `billing_events` table exists with: clientId (FK cascade), eventType, description, related entity FKs (subscriptionId, invoiceId, paymentMethodId), amountCents, Stripe event data (stripeEventId unique, stripeEventType, rawData JSONB), createdAt
- [ ] Indexes on clientId, eventType, stripeEventId (unique), createdAt

### Schema — Coupons Table
- [ ] `coupons` table exists with: code (unique), name, discountType, discountValue, duration, durationMonths, limits, validity dates, restrictions (applicablePlans JSONB, minAmountCents, firstTimeOnly), stripeCouponId, isActive, createdAt
- [ ] Unique index on code

### Schema Exports
- [ ] All 8 billing schema files exist in `src/db/schema/`
- [ ] All re-exported from `src/db/schema/index.ts`
- [ ] Types exported from `src/db/types.ts`: Plan, Subscription, BillingPaymentMethod, SubscriptionInvoice, UsageRecord, BillingEvent, Coupon (+ insert types)

### Stripe Client Module
- [ ] `src/lib/clients/stripe.ts` exports `getStripeClient()` (lazy-initialized singleton)
- [ ] Uses Stripe API version `2026-01-28.clover` matching existing project usage
- [ ] Throws descriptive error when `STRIPE_SECRET_KEY` is missing
- [ ] Exports `STRIPE_WEBHOOK_SECRET` from env

### Subscription Service (`src/lib/services/subscription.ts`)
- [ ] `createSubscription()`: fetches client + plan; creates/retrieves Stripe customer; creates Stripe subscription with trial; reads period from items (Stripe v20); inserts DB record; logs billing event
- [ ] `cancelSubscription()`: cancel immediately or at period end; updates Stripe and local record; logs event
- [ ] `changePlan()`: retrieves current Stripe sub; updates items with proration; updates local record; logs event
- [ ] `pauseSubscription()`: pauses collection in Stripe; updates local status to 'paused'
- [ ] `resumeSubscription()`: removes pause in Stripe; updates local status to 'active'
- [ ] `getSubscriptionWithPlan()`: inner joins subscriptions with plans; returns null if not found
- [ ] `hasFeatureAccess()`: checks subscription is active/trialing then checks plan features
- [ ] `checkUsageLimit()`: maps usage type to plan limits; returns allowed/limit/current

### Payment Method Service (`src/lib/services/payment-methods.ts`)
- [ ] `createSetupIntent()`: creates/retrieves Stripe customer; creates Stripe SetupIntent; returns client_secret
- [ ] `addPaymentMethod()`: retrieves from Stripe; deduplicates; first method auto-default; updates Stripe subscription and customer default
- [ ] `setDefaultPaymentMethod()`: unsets other defaults; sets new default; syncs to Stripe
- [ ] `removePaymentMethod()`: blocks removing default; detaches from Stripe; deletes from DB
- [ ] `getPaymentMethods()`: returns all methods for client ordered by isDefault

### Subscription Invoice Service (`src/lib/services/subscription-invoices.ts`)
- [ ] `syncInvoiceFromStripe()`: retrieves from Stripe; extracts subscription from `parent.subscription_details` (Stripe v20); maps line items with `pricing.unit_amount_decimal`; upserts invoice record
- [ ] `getClientSubscriptionInvoices()`: filters by status/date range; ordered by invoiceDate desc
- [ ] `retryInvoicePayment()`: validates invoice exists and not paid; calls `stripe.invoices.pay()`; re-syncs
- [ ] `getUpcomingInvoice()`: uses `stripe.invoices.createPreview()` (Stripe v20); returns null on error

### Stripe Webhook Handler (`/api/webhooks/stripe`)
- [ ] Existing payment link handlers preserved (checkout.session.completed, expired, charge.refunded)
- [ ] `customer.subscription.created/updated`: syncs status, period from items (v20), cancel state; logs billing event
- [ ] `customer.subscription.deleted`: sets status 'canceled'; updates client status to 'cancelled'; logs event
- [ ] `invoice.created/updated/paid/payment_failed`: syncs invoice; extracts sub from `parent.subscription_details` (v20); logs event with amount
- [ ] `payment_method.attached`: finds client by customer ID; adds payment method; logs event
- [ ] `customer.subscription.trial_will_end`: logs trial ending event
- [ ] Duplicate event detection via `billingEvents.stripeEventId`
- [ ] Webhook signature verification with `STRIPE_WEBHOOK_SECRET`
- [ ] Uses shared `getStripeClient()` instead of local `getStripe()`

### Seed Data (`src/db/seeds/plans.ts`)
- [ ] `seedPlans()` inserts 3 plans: Starter ($497), Professional ($997), Enterprise ($1,997)
- [ ] Each plan has typed features JSONB with correct limits
- [ ] Professional marked as `isPopular`
- [ ] All plans have 14-day trial
- [ ] Uses `onConflictDoNothing()` for idempotency

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] No type errors from Stripe v20 API changes (current_period on items, parent.subscription_details, createPreview, etc.)
- [ ] Webhook route registered at `/api/webhooks/stripe`

---

## Phase 04E: Billing UI & Subscription Management

### Client Billing Page (`/client/billing`)
- [ ] Page loads behind client session auth (redirects to `/link-expired` without session)
- [ ] Skeleton loading state renders while data fetches
- [ ] "No Active Subscription" card renders when no subscription exists
- [ ] "View Plans" button navigates to `/client/billing/upgrade`

### Subscription Card
- [ ] Displays plan name and monthly price (in dollars, from cents)
- [ ] Status badge shows correct color: trialing=blue, active=green, past_due=red, canceled=gray, unpaid=red, paused=yellow
- [ ] Discount percent shows when present (e.g. "20% discount applied")
- [ ] Trial banner shows remaining days and charge date when status=trialing
- [ ] Past due warning banner shows when status=past_due
- [ ] Cancellation pending banner shows end date when cancelAtPeriodEnd=true
- [ ] Billing period shows days remaining and date range
- [ ] Leads usage progress bar shows X / Y with percentage
- [ ] Warning text appears when leads usage >= 80%
- [ ] "Upgrade Plan" button navigates to upgrade page
- [ ] "Pause Subscription" button appears for active subscriptions
- [ ] "Resume Subscription" button appears for paused subscriptions
- [ ] "Cancel Subscription" button appears when not already canceling

### Cancel Subscription Dialog
- [ ] Dialog opens when "Cancel Subscription" clicked
- [ ] Shows end date in dialog description
- [ ] Pause suggestion banner displays
- [ ] 7 cancellation reason radio options render
- [ ] "Other reason" textarea appears when "Other" selected
- [ ] "Confirm Cancellation" disabled until reason selected
- [ ] "Confirm Cancellation" disabled when "Other" selected but empty
- [ ] Loading state shows "Canceling..." during submission
- [ ] Dialog closes after successful cancellation
- [ ] "Keep Subscription" button closes dialog without action

### Pause Subscription Dialog
- [ ] Dialog opens when "Pause Subscription" clicked
- [ ] Dropdown allows 1, 2, or 3 month selection
- [ ] Info box updates resume date when duration changes
- [ ] Loading state shows "Pausing..." during submission
- [ ] Dialog closes after successful pause

### Payment Methods Card
- [ ] Card shows "No payment methods added yet" when empty
- [ ] "Add Method" button opens Stripe Elements dialog
- [ ] Each payment method shows brand, last4, and expiry
- [ ] Default badge shows on default payment method
- [ ] "Set Default" button appears on non-default methods
- [ ] Delete button appears on non-default methods (only when >1 methods)
- [ ] Delete confirmation dialog shows before removing
- [ ] Failed payment banner shows when subscription status is past_due

### Add Payment Method Dialog (Stripe Elements)
- [ ] Dialog renders with Stripe CardElement
- [ ] "Add Card" button disabled until Stripe loads
- [ ] Loading spinner shows "Processing..." during submission
- [ ] Error message displays on Stripe validation failure
- [ ] Dialog closes on successful addition

### Invoice List
- [ ] "No invoices yet" message when empty
- [ ] Table shows invoice number, date, status badge, amount
- [ ] Status badges: draft=gray, open=blue, paid=green, void=gray, uncollectible=red
- [ ] Clicking row expands line items
- [ ] Line items show description, quantity, and amount
- [ ] Total row shows at bottom of expanded view
- [ ] PDF download button opens invoice PDF in new tab
- [ ] External link button opens hosted invoice URL
- [ ] "Load More" button appears when hasMore=true

### Usage Display
- [ ] Shows current billing period date range
- [ ] Leads usage with progress bar and X/Y count
- [ ] "Unlimited" label when leads included is null
- [ ] Overage warning alert when leads exceed included
- [ ] Team members usage bar with X/Y count
- [ ] Phone numbers usage bar with X/Y count

### Plan Selector (`/client/billing/upgrade`)
- [ ] Page loads behind client session auth
- [ ] Monthly/yearly toggle shows when yearly pricing exists
- [ ] "Save 20%" badge shows next to yearly option
- [ ] All active plans render as cards
- [ ] "Most Popular" badge on isPopular plan
- [ ] Price displays correctly in dollars (from cents)
- [ ] Yearly price shows per-month equivalent and annual total
- [ ] Feature list shows leads, team members, phone numbers, plus extras
- [ ] "Current Plan" button disabled on current plan
- [ ] "Upgrade" text on higher plans, "Downgrade" on lower
- [ ] Downgrade note: "Takes effect at end of current billing period"
- [ ] Processing state shows during plan change

### Server Actions (`src/lib/billing/actions.ts`)
- [ ] `cancelSubscription` finds subscription by clientId, calls service, revalidates path
- [ ] `pauseSubscription` finds subscription by clientId, calls service with resume date
- [ ] `resumeSubscription` finds subscription by clientId, calls service
- [ ] `addPaymentMethod` delegates to payment-methods service
- [ ] `removePaymentMethod` delegates to payment-methods service
- [ ] `setDefaultPaymentMethod` delegates to payment-methods service
- [ ] `changePlan` finds subscription, calls service with correct interval mapping

### Billing Queries (`src/lib/billing/queries.ts`)
- [ ] `getBillingData` returns subscription, paymentMethods, invoices, usage
- [ ] Subscription includes plan details via inner join
- [ ] Payment methods mapped with card/bankAccount detail objects
- [ ] Invoices mapped with lineItems from JSONB
- [ ] Usage calculates leads from usage_records, team members from count, phone from client
- [ ] `getPlans` returns active plans ordered by displayOrder
- [ ] `getCurrentSubscription` returns subscription for client
- [ ] `getAdminBillingStats` returns MRR, active count, churn rate, failed payments

### Admin Billing Page (`/admin/billing`)
- [ ] Page requires admin auth (redirects non-admins)
- [ ] 4 stat cards: MRR, Active Subscriptions, Churn Rate, Failed Payments
- [ ] MRR calculated from active subscription plan prices
- [ ] Revenue chart renders (placeholder when no data)
- [ ] Subscription table loads via API fetch
- [ ] Table shows client name, plan, status badge, MRR, renewal date, start date

### Admin API (`/api/admin/billing/subscriptions`)
- [ ] GET returns 403 for non-admin users
- [ ] Returns subscription list with client name, plan name, status, price, dates
- [ ] Inner joins subscriptions with plans and clients tables

### Navigation
- [ ] Client nav includes "Billing" link between "Team" and "Settings"
- [ ] Admin nav includes "Billing" link in Management group

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/client/billing`, `/client/billing/upgrade`, `/admin/billing`, `/api/admin/billing/subscriptions`

---

## Phase 05E: Conversation Agent Schema

### Schema — Agent Enums
- [ ] `lead_stage` pgEnum exists with 8 values: new, qualifying, nurturing, hot, objection, escalated, booked, lost
- [ ] `sentiment` pgEnum exists with 4 values: positive, neutral, negative, frustrated
- [ ] `escalation_reason` pgEnum exists with 11 values: explicit_request, frustrated_sentiment, legal_threat, repeated_objection, complex_technical, high_value_lead, negative_review_threat, pricing_negotiation, complaint, emergency, other
- [ ] `agent_action` pgEnum exists with 10 values: respond, wait, trigger_flow, escalate, book_appointment, send_quote, request_photos, send_payment, close_won, close_lost
- [ ] Enums exported from `src/db/schema/agent-enums.ts` and re-exported from index

### Schema — Lead Context Table
- [ ] `lead_context` table exists with 33 columns including: id (uuid PK), leadId (FK cascade, unique), clientId (FK cascade), stage (lead_stage enum, default 'new'), signal scores (urgency/budget/intent, default 50), currentSentiment, sentimentHistory (JSONB array), project info fields, objections (JSONB array), competitorMentions (JSONB array), interaction metrics, booking/quote tracking, conversationSummary, keyFacts (JSONB), recommendedAction (agent_action enum), timestamps
- [ ] Unique index on `lead_id`, regular indexes on `client_id`, `stage`, `intent_score`
- [ ] JSONB columns default to empty arrays `[]` where applicable
- [ ] Types exported: `LeadContext`, `NewLeadContext`

### Schema — Agent Decisions Table
- [ ] `agent_decisions` table exists with 16 columns including: id (uuid PK), leadId (FK cascade), clientId (FK cascade), messageId (FK to conversations, set null on delete), triggerType (varchar 30), stageAtDecision (lead_stage enum), contextSnapshot (JSONB), action (agent_action enum, not null), actionDetails (JSONB), reasoning (text), confidence (integer 0-100), alternativesConsidered (JSONB array), outcome (varchar 30), processingTimeMs, createdAt
- [ ] Indexes on `lead_id`, `client_id`, `action`, `created_at`
- [ ] `messageId` references `conversations.id` (not a separate `messages` table)
- [ ] Types exported: `AgentDecision`, `NewAgentDecision`

### Schema — Escalation Queue Table
- [ ] `escalation_queue` table exists with 24 columns including: id (uuid PK), leadId (FK cascade), clientId (FK cascade), reason (escalation_reason enum, not null), reasonDetails, triggerMessageId (FK to conversations), priority (integer default 3), conversationSummary, suggestedResponse, keyPoints (JSONB array), status (varchar 20, default 'pending'), assignedTo (FK to team_members), assignedAt, resolvedAt, resolvedBy (FK to team_members), resolution (varchar 30), resolutionNotes, returnToAi (boolean default true), returnToAiAfter, timestamps, SLA fields (firstResponseAt, slaDeadline, slaBreach)
- [ ] Indexes on `lead_id`, `client_id`, `status`, `priority`, `assigned_to`
- [ ] Types exported: `EscalationQueueItem`, `NewEscalationQueueItem`

### Schema — Escalation Rules Table
- [ ] `escalation_rules` table exists with 12 columns including: id (uuid PK), clientId (FK cascade), name (varchar 100, not null), description, conditions (JSONB, not null — typed with triggers array and optional filters), action (JSONB, not null — typed with priority/assignTo/notifyVia/pauseAi), enabled (boolean default true), priority (integer default 100), timesTriggered (integer default 0), lastTriggeredAt, timestamps
- [ ] Indexes on `client_id`, `enabled`
- [ ] Conditions JSONB supports trigger types: keyword, sentiment, intent_score, objection_count, value_threshold, no_response, custom
- [ ] Action JSONB supports notifyVia channels: sms, email, push
- [ ] Types exported: `EscalationRule`, `NewEscalationRule`

### Schema — Conversation Checkpoints Table
- [ ] `conversation_checkpoints` table exists with 9 columns: id (uuid PK), leadId (FK cascade), messageIndex (integer, not null), checkpointAt (timestamp, default now), summary (text, not null), extractedData (JSONB with typed fields), stageAtCheckpoint (lead_stage enum), scoresAtCheckpoint (JSONB with urgency/budget/intent), tokenCount (integer)
- [ ] Indexes on `lead_id`, `message_index`
- [ ] Types exported: `ConversationCheckpoint`, `NewConversationCheckpoint`

### Schema — Client Agent Settings Table
- [ ] `client_agent_settings` table exists with 25 columns: id (uuid PK), clientId (FK cascade, unique), AI personality (agentName default 'Assistant', agentTone default 'professional'), response settings (maxResponseLength default 300, useEmojis, signMessages), behavior settings (autoRespond, respondOutsideHours, maxDailyMessagesPerLead default 5, minTimeBetweenMessages default 60), goal settings (primaryGoal default 'book_appointment', bookingAggressiveness default 5, maxBookingAttempts default 3), escalation thresholds (autoEscalateAfterMessages nullable, autoEscalateOnNegativeSentiment default true, autoEscalateOnHighValue nullable), knowledge boundaries (canDiscussPricing default false, canScheduleAppointments default true, canSendPaymentLinks default false), quiet hours (enabled default true, start default '21:00', end default '08:00'), timestamps
- [ ] Unique constraint on `client_id`
- [ ] `quiet_hours_start` and `quiet_hours_end` use `time` column type
- [ ] Types exported: `ClientAgentSettings`, `NewClientAgentSettings`

### Relations
- [ ] `leadContext` relations defined: `lead` (one, FK leadId), `client` (one, FK clientId)
- [ ] `agentDecisions` relations defined: `lead` (one, FK leadId), `message` (one, FK messageId → conversations)
- [ ] `escalationQueue` relations defined: `lead` (one), `client` (one), `assignedTeamMember` (one, FK assignedTo → teamMembers)
- [ ] `escalationRules` relations defined: `client` (one, FK clientId)
- [ ] `conversationCheckpoints` relations defined: `lead` (one, FK leadId)
- [ ] `clientAgentSettings` relations defined: `client` (one, FK clientId)
- [ ] `clients` relation updated with: `leadContexts`, `agentDecisions`, `escalationQueueItems`, `escalationRules`, `clientAgentSettings` (many)
- [ ] `leads` relation updated with: `leadContext`, `agentDecisions`, `escalationQueueItems`, `conversationCheckpoints` (many)

### Type Exports
- [ ] `src/lib/types/agent.ts` exists and exports all schema-inferred types
- [ ] Exports `LeadStage` union type (8 values)
- [ ] Exports `AgentAction` union type (10 values)
- [ ] Exports `EscalationReason` union type (11 values)
- [ ] Exports `LeadSignals` interface (urgency, budget, intent, sentiment)
- [ ] Exports `LeadState` interface for LangGraph (leadId, clientId, stage, signals, conversationHistory, objections, extractedInfo, bookingAttempts, lastAction, humanNeededReason)
- [ ] `src/db/types.ts` updated with agent table type re-exports

### Seed Data
- [ ] `src/db/seeds/escalation-rules.ts` exists with `seedDefaultEscalationRules(clientId)` function
- [ ] Seeds 5 default rules: Explicit Human Request (priority 10), Legal/Complaint Threat (priority 5), Frustrated Customer (priority 50), High Value Lead (priority 60), Emergency/Safety (priority 1)
- [ ] Each rule has properly typed conditions and action JSONB
- [ ] Uses `getDb()` per project conventions

### Migration
- [ ] Migration file exists in `drizzle/` directory
- [ ] Migration includes CREATE TYPE for all 4 enums
- [ ] Migration includes CREATE TABLE for all 6 agent tables
- [ ] Migration includes ALTER TABLE for all foreign key constraints
- [ ] Migration includes CREATE INDEX for all declared indexes
- [ ] `npm run db:generate` runs without pending changes

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] All 6 new tables appear in Drizzle migration output (lead_context, agent_decisions, escalation_queue, escalation_rules, conversation_checkpoints, client_agent_settings)
- [ ] All 4 enums appear in Drizzle migration output (lead_stage, sentiment, escalation_reason, agent_action)

---

## Part 27: Conversation Agent Core (LangGraph) — Phase 37

### Dependencies
- [ ] `@langchain/core` is in `package.json` dependencies
- [ ] `@langchain/langgraph` is in `package.json` dependencies
- [ ] `@langchain/openai` is in `package.json` dependencies
- [ ] `npm install` succeeds with no missing peer dependency errors

### State Definition (`src/lib/agent/state.ts`)
- [ ] File exists and exports `ConversationState` annotation and `ConversationStateType`
- [ ] State includes core identifiers: `leadId`, `clientId`
- [ ] State includes `messages` field with `messagesStateReducer`
- [ ] State includes `stage` field with default `'new'`
- [ ] State includes `signals` field with default `{ urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' }`
- [ ] State includes `extractedInfo`, `objections`, `bookingAttempts` fields
- [ ] State includes `lastAction`, `responseToSend`, `flowToTrigger` fields
- [ ] State includes `needsEscalation`, `escalationReason` fields
- [ ] State includes `shouldWait`, `waitUntil` fields
- [ ] State includes `clientSettings` with all required business config fields
- [ ] State includes `knowledgeContext`, `decisionReasoning` fields
- [ ] All fields have proper reducers and defaults

### Analysis Node (`src/lib/agent/nodes/analyze.ts`)
- [ ] File exists and exports `analyzeConversation` function
- [ ] Uses `ChatOpenAI` with `gpt-4o-mini` and `temperature: 0.1`
- [ ] Uses `withStructuredOutput` with Zod schema for structured analysis
- [ ] Analysis schema includes: sentiment, scores (urgency/budget/intent), detected objections, extracted info
- [ ] Analysis schema includes: suggested stage, escalation needed flag, key insights
- [ ] Formats last 10 messages for analysis context
- [ ] Returns updated signals, stage, objections, extractedInfo, escalation flags
- [ ] Throws error if `clientSettings` is not loaded

### Decision Node (`src/lib/agent/nodes/decide.ts`)
- [ ] File exists and exports `decideAction` function
- [ ] Uses `ChatOpenAI` with `gpt-4o-mini` and `temperature: 0.3`
- [ ] Uses `withStructuredOutput` with Zod schema for structured decision
- [ ] Decision schema includes 10 possible actions: respond, wait, trigger_flow, escalate, book_appointment, send_quote, request_photos, send_payment, close_won, close_lost
- [ ] If `needsEscalation` is already set, returns escalate immediately without LLM call
- [ ] Handles wait action: sets `shouldWait` and `waitUntil` with duration
- [ ] Handles booking: increments `bookingAttempts` counter
- [ ] Handles flow trigger: sets `flowToTrigger`
- [ ] Prompt includes business context, current state, and decision guidelines

### Response Generation Node (`src/lib/agent/nodes/respond.ts`)
- [ ] File exists and exports `generateResponse` function
- [ ] Uses `ChatOpenAI` with `gpt-4o-mini` and `temperature: 0.7`
- [ ] Only generates response for actions: respond, book_appointment, send_quote, request_photos
- [ ] Returns empty object for non-response actions (wait, escalate, etc.)
- [ ] Determines response strategy based on `lastAction`
- [ ] Adds objection handling to strategy when objections exist
- [ ] Formats last 8 messages for conversation context
- [ ] Respects `maxResponseLength` setting and trims if needed
- [ ] Returns `responseToSend` text and appends `AIMessage` to messages

### Graph Builder (`src/lib/agent/graph.ts`)
- [ ] File exists and exports `buildConversationGraph` function and `conversationAgent` singleton
- [ ] Graph has 7 nodes: analyze, decide, respond, escalate, trigger_flow, close, send_payment
- [ ] Entry point is `__start__` → `analyze`
- [ ] After analyze: routes to `decide` or `escalate` (if escalation needed)
- [ ] After decide: routes to respond/escalate/trigger_flow/close/send_payment/END
- [ ] Escalation handler sets `needsEscalation: true` and `stage: 'escalated'`
- [ ] Close handler sets stage to `'booked'` or `'lost'` based on action
- [ ] All terminal nodes (respond, escalate, trigger_flow, close, send_payment) route to END

### Orchestrator Service (`src/lib/agent/orchestrator.ts`)
- [ ] File exists and exports `processIncomingMessage` and `processScheduledCheck`
- [ ] Uses `getDb()` per project conventions (not cached db instance)
- [ ] Loads lead, client, agent settings, and lead context from database
- [ ] Creates new lead context if none exists
- [ ] Loads last 20 messages from conversations table
- [ ] Converts conversation history to LangChain messages (HumanMessage/AIMessage)
- [ ] Retrieves knowledge context via `buildKnowledgeContext()`
- [ ] Builds initial state with all required fields from database
- [ ] Invokes `conversationAgent.invoke()` with initial state
- [ ] Logs agent decision to `agentDecisions` table with context snapshot
- [ ] Updates `leadContext` with new stage, signals, extracted info, booking attempts
- [ ] Tracks AI usage via `trackUsage()` (non-blocking with `.catch()`)
- [ ] Sends response SMS via `sendTrackedSMS()` when response exists and no escalation
- [ ] Saves outbound message to `conversations` table
- [ ] Inserts into `escalationQueue` when escalation needed
- [ ] Triggers flow via `startFlowExecution()` when flow requested
- [ ] Returns `ProcessMessageResult` with action, responseSent, escalated, newStage

### Scheduled Check (`processScheduledCheck`)
- [ ] Returns `null` for leads in terminal stages (escalated, booked, lost)
- [ ] Returns `null` if no messages exist for lead
- [ ] Triggers nurture flow if last outbound message was >24 hours ago
- [ ] Returns proper `ProcessMessageResult` for triggered flows

### Webhook Integration (`src/lib/automations/incoming-sms.ts`)
- [ ] Imports `processIncomingMessage` from `@/lib/agent/orchestrator`
- [ ] Imports `clientAgentSettings` from `@/db`
- [ ] Checks `client.aiAgentMode === 'autonomous'` before using LangGraph agent
- [ ] Loads agent settings to check `autoRespond` flag
- [ ] Calls `processIncomingMessage()` with lead ID, message ID, and message body
- [ ] Falls back to legacy AI response if agent processing fails (try/catch)
- [ ] Integration point is after hot intent detection and before legacy AI response

### Cron Endpoint (`src/app/api/cron/agent-check/route.ts`)
- [ ] File exists with `GET` handler
- [ ] Uses `getDb()` per project conventions
- [ ] Queries `leadContext` for leads not in terminal stages and not updated in 24 hours
- [ ] Limits to 50 leads per cron run
- [ ] Processes each stale lead with `processScheduledCheck()`
- [ ] Catches errors per-lead without failing the entire batch
- [ ] Returns JSON with `{ processed: count }`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Route `/api/cron/agent-check` appears in build output

---

## Phase 38: Escalation Management (07E)

### Step 1: Escalation Service (`src/lib/services/escalation.ts`)

#### `createEscalation()`
- [ ] Returns existing escalation ID if one is already pending for the lead
- [ ] Updates priority on existing escalation if new priority is higher (lower number)
- [ ] Matches escalation rules by trigger type (keyword or reason match)
- [ ] Increments `timesTriggered` and sets `lastTriggeredAt` on matched rule
- [ ] Supports `round_robin` assignment (assigns to team member with fewest pending)
- [ ] Calculates SLA deadline: 1 hour for priority 1-2, 4 hours for priority 3+
- [ ] Creates escalation with status `assigned` when assignee found, `pending` otherwise
- [ ] Updates `leadContext.stage` to `escalated`
- [ ] Sends notification to assigned team member or all eligible team members
- [ ] Sends auto-response SMS if rule has `autoResponse` configured
- [ ] Uses `getDb()` per-request (not cached)
- [ ] Uses `sendTrackedSMS()` from `@/lib/clients/twilio-tracked`
- [ ] Uses `sendEmail()` from `@/lib/services/resend`

#### `assignEscalation()`
- [ ] Sets `assignedTo`, `assignedAt`, status to `assigned`, and `updatedAt`

#### `takeOverConversation()`
- [ ] Sets status to `in_progress`, `assignedTo`, `firstResponseAt`, and `updatedAt`

#### `resolveEscalation()`
- [ ] Throws error if escalation not found
- [ ] Sets status to `resolved` with `resolvedAt`, `resolvedBy`, `resolution`, `resolutionNotes`
- [ ] Updates `leadContext.stage` based on resolution:
  - `converted` → `booked`
  - `lost` → `lost`
  - `returned_to_ai` → `nurturing`
  - Other → `qualifying`

#### `getEscalationQueue()`
- [ ] Filters by `clientId` (required)
- [ ] Optionally filters by `status`, `assignedTo`, `priority`
- [ ] Returns joined data: escalation + lead + assignee
- [ ] Orders by priority (ascending) then createdAt (descending)

#### `checkSlaBreaches()`
- [ ] Finds escalations that are `pending` or `assigned`, not yet breached, and past SLA deadline
- [ ] Marks each as `slaBreach: true`
- [ ] Sends email notification to team members who receive escalations
- [ ] Returns count of breached escalations

### Step 2: Escalation Queue API Routes

#### `GET /api/escalations`
- [ ] Returns 401 if not authenticated
- [ ] Returns 400 if `clientId` not provided
- [ ] Returns queue (joined escalation/lead/assignee data)
- [ ] Returns summary counts by status (pending, assigned, in_progress, resolved)
- [ ] Returns SLA breach count for active escalations
- [ ] Supports `status` and `assignedTo` query param filters

#### `GET /api/escalations/[id]`
- [ ] Returns 401 if not authenticated
- [ ] Returns 404 if escalation not found
- [ ] Returns escalation details, lead info, conversation history (last 50 messages), and assignee
- [ ] Conversation history is returned in chronological order (oldest first)
- [ ] Uses `conversations` table (not `messages`)
- [ ] Awaits `params` for Next.js 16 compatibility

#### `POST /api/escalations/[id]/assign`
- [ ] Returns 401 if not authenticated
- [ ] Returns 400 if `teamMemberId` not provided
- [ ] Calls `assignEscalation()` service method

#### `POST /api/escalations/[id]/takeover`
- [ ] Returns 401 if not authenticated
- [ ] Returns 400 if `teamMemberId` not provided
- [ ] Calls `takeOverConversation()` service method

#### `POST /api/escalations/[id]/resolve`
- [ ] Returns 401 if not authenticated
- [ ] Returns 400 if `teamMemberId` or `resolution` not provided
- [ ] Calls `resolveEscalation()` service method

### Step 3: Escalation Rules API

#### `GET /api/clients/[clientId]/escalation-rules`
- [ ] Returns 401 if not authenticated
- [ ] Returns rules ordered by priority (ascending)
- [ ] Filters by `clientId`

#### `POST /api/clients/[clientId]/escalation-rules`
- [ ] Returns 401 if not authenticated
- [ ] Returns 400 if `name`, `conditions`, or `action` missing
- [ ] Creates rule with default priority 100 and enabled true
- [ ] Returns created rule

#### `PUT /api/clients/[clientId]/escalation-rules/[ruleId]`
- [ ] Returns 401 if not authenticated
- [ ] Returns 404 if rule not found (scoped to clientId)
- [ ] Updates rule fields and sets `updatedAt`

#### `DELETE /api/clients/[clientId]/escalation-rules/[ruleId]`
- [ ] Returns 401 if not authenticated
- [ ] Deletes rule scoped to clientId

### Step 4: Escalation Queue Page (`/escalations`)
- [ ] Page exists at `src/app/(dashboard)/escalations/page.tsx`
- [ ] Redirects to `/login` if not authenticated
- [ ] Passes `clientId` from session for non-admin users
- [ ] Passes `isAdmin` flag to component

### Step 5: Escalation Queue Component
- [ ] File exists at `src/components/escalations/escalation-queue.tsx`
- [ ] Shows client selector dropdown for admin users
- [ ] Fetches client list from `/api/admin/clients` for admin users
- [ ] Shows 4 summary cards: Active, Pending, In Progress, SLA Breached
- [ ] SLA Breached card has `border-destructive` when count > 0
- [ ] Tabs: Active, Pending, In Progress, Resolved — each with count
- [ ] Each escalation row shows: priority badge, lead name/phone, status badge, reason, time ago, assignee, View button
- [ ] View button links to `/escalations/[id]`
- [ ] Empty state shows green checkmark with "No escalations in this queue"
- [ ] Loading state shown while fetching

### Step 6: Escalation Detail Page & Component
- [ ] Page exists at `src/app/(dashboard)/escalations/[id]/page.tsx`
- [ ] Returns 404 if escalation not found
- [ ] Uses `Promise<{ id: string }>` for params (Next.js 16)
- [ ] Component exists at `src/components/escalations/escalation-detail.tsx`
- [ ] Shows back button linking to `/escalations`
- [ ] Shows lead name, phone, and SLA BREACH badge if applicable
- [ ] Shows AI conversation summary if available
- [ ] Shows conversation history with message bubbles (outbound right, inbound left)
- [ ] Shows suggested response with "Use this" button to populate textarea
- [ ] Has response textarea and Send button for active escalations
- [ ] Has Take Over button when status is `assigned`
- [ ] Right sidebar shows: reason, details, priority, status, created time, assignee
- [ ] Quick actions: Call lead (tel: link), View Lead Profile
- [ ] Resolution section with select (5 options) + notes textarea + Resolve button
- [ ] Resolution options: Handled, Return to AI, Converted, Lost, No Action
- [ ] Toast notifications on takeover, send, resolve

### Step 7: SLA Check Cron & Navigation
- [ ] SLA breach check added to `src/app/api/cron/route.ts`
- [ ] Runs hourly (when `minutes < 10`)
- [ ] Imports `checkSlaBreaches` from escalation service
- [ ] Logs breached count
- [ ] Results stored in `results.escalationSla`
- [ ] "Escalations" nav item added to dashboard layout
- [ ] Navigation link appears in main nav items (not admin-only)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes `/escalations` and `/escalations/[id]` appear in build output
- [ ] Routes `/api/escalations`, `/api/escalations/[id]/*` registered
- [ ] Routes `/api/clients/[clientId]/escalation-rules/*` registered
- [ ] No new lint warnings related to agent files

---

## Phase 08E: Analytics Schema

### Schema Files (6 tables)
- [ ] `src/db/schema/analytics-daily.ts` exists with `analytics_daily` table
- [ ] `src/db/schema/analytics-weekly.ts` exists with `analytics_weekly` table
- [ ] `src/db/schema/analytics-monthly.ts` exists with `analytics_monthly` table
- [ ] `src/db/schema/platform-analytics.ts` exists with `platform_analytics` table
- [ ] `src/db/schema/funnel-events.ts` exists with `funnel_events` table
- [ ] `src/db/schema/client-cohorts.ts` exists with `client_cohorts` table
- [ ] All 6 tables exported from `src/db/schema/index.ts`
- [ ] Each schema file follows project pattern: `uuid_generate_v4()`, array-style indexes, type exports

### Analytics Daily Table
- [ ] Unique index on `(clientId, date)` prevents duplicate daily rows
- [ ] Lead metrics: `newLeads`, `leadsFromMissedCalls`, `leadsFromWebForms`, `leadsFromReferrals`, `leadsFromOther`
- [ ] Message metrics: `inboundMessages`, `outboundMessages`, `aiResponses`, `humanResponses`
- [ ] Conversion metrics: `appointmentsBooked`, `quotesRequested`, `quotesSent`, `jobsWon`, `jobsLost`
- [ ] Revenue metrics in cents: `revenueAttributedCents`, `invoicesSentCents`, `paymentsCollectedCents`
- [ ] Lead stage distribution snapshot: `leadsNew`, `leadsQualifying`, `leadsNurturing`, `leadsHot`, `leadsBooked`, `leadsLost`

### Analytics Weekly Table
- [ ] Unique index on `(clientId, weekStart)`
- [ ] Conversion rates stored as percentage * 100 (e.g. 2500 = 25.00%)
- [ ] Week-over-week change fields: `leadsChangePercent`, `revenueChangePercent`

### Analytics Monthly Table
- [ ] Unique index on `(clientId, month)` with month format "YYYY-MM"
- [ ] ROI fields: `platformCostCents`, `roiMultiple`
- [ ] Month-over-month comparison: `previousMonthRevenueChangePct`, `previousMonthLeadsChangePct`

### Platform Analytics Table
- [ ] Unique constraint on `date` column (one row per day)
- [ ] Client metrics: `totalClients`, `activeClients`, `newClients`, `churnedClients`
- [ ] MRR metrics: `mrrCents`, `newMrrCents`, `churnedMrrCents`, `expansionMrrCents`

### Funnel Events Table
- [ ] References both `clients.id` and `leads.id` with cascade delete
- [ ] Indexes on `clientId`, `leadId`, `eventType`, `createdAt`
- [ ] Supports event types: lead_created, first_response, qualified, appointment_booked, quote_sent, job_won, etc.

### Client Cohorts Table
- [ ] Unique constraint on `clientId` (one cohort entry per client)
- [ ] Monthly retention booleans: `month1Active` through `month12Active`
- [ ] Revenue tracking: `month1RevenueCents` through `lifetimeRevenueCents`

### Analytics Aggregation Service
- [ ] `src/lib/services/analytics-aggregation.ts` exists
- [ ] Uses `getDb()` per function call (not cached)
- [ ] `calculateDailyAnalytics(clientId, date)` counts leads, messages, escalations, funnel events
- [ ] Queries `conversations` table (not `messages`) with correct column names (`messageType` for ai_response/contractor_response)
- [ ] Lead source filter uses `'form'` (not `'web_form'`) matching actual leads table values
- [ ] `calculateAvgResponseTime()` uses CTE with message pairs from `conversations` table
- [ ] `calculateWeeklyAnalytics(clientId, weekStart)` aggregates from daily with WoW comparison
- [ ] `calculateMonthlyAnalytics(clientId, month)` aggregates from daily with MoM comparison, gets API costs
- [ ] `calculatePlatformAnalytics(date)` aggregates across all clients
- [ ] `runDailyAnalyticsJob()` processes all active clients, triggers weekly on Sundays, monthly on 1st
- [ ] Upserts use `onConflictDoUpdate` for idempotent reruns

### Funnel Tracking Service
- [ ] `src/lib/services/funnel-tracking.ts` exists
- [ ] `trackFunnelEvent()` inserts into `funnel_events` table
- [ ] Helper functions: `trackLeadCreated`, `trackFirstResponse`, `trackAppointmentBooked`, `trackJobWon`, `trackPaymentReceived`, `trackReviewReceived`
- [ ] `FunnelEventType` type exported with all 12 event types

### Analytics Query Service
- [ ] `src/lib/services/analytics-queries.ts` exists
- [ ] `getClientDashboardSummary(clientId)` returns monthly + 7-day trend
- [ ] `getConversionFunnel(clientId, startDate, endDate)` returns funnel stages with conversion rates
- [ ] `getLeadSourceBreakdown(clientId, startDate, endDate)` groups by source with conversion count
- [ ] `getResponseTimeDistribution(clientId, startDate, endDate)` buckets response times
- [ ] `getMonthlyComparison(clientId, months)` returns MoM data in chronological order

### Cron Job
- [ ] `src/app/api/cron/daily/route.ts` exists with GET handler
- [ ] Auth check: validates `Authorization: Bearer <CRON_SECRET>` header
- [ ] Calls `runDailyAnalyticsJob()` and returns success/error JSON
- [ ] Main cron orchestrator (`src/app/api/cron/route.ts`) imports and calls `runDailyAnalyticsJob` at midnight UTC
- [ ] Route `/api/cron/daily` appears in build output

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Route `/api/cron/daily` registered in build output
- [ ] All 6 schema files compile without errors
- [ ] All 3 service files compile without errors
