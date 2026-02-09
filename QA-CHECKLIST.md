# QA Checklist

## 01-admin-schema-auth

### Schema Verification
- [ ] `users` table has `is_admin` boolean column (default: false)
- [ ] `users` table has `client_id` FK referencing `clients.id`
- [ ] `accounts` table has unique constraint on `(provider, provider_account_id)`
- [ ] `sessions` table has `session_token` unique constraint
- [ ] `verification_tokens` table has composite PK on `(identifier, token)`
- [ ] All auth tables use `uuid` primary keys

### Auth Type Declarations
- [ ] `Session.user` includes `isAdmin?: boolean`
- [ ] `Session.client?` includes `id`, `businessName`, `ownerName`
- [ ] `User` interface includes `isAdmin?: boolean`

### signIn Callback
- [ ] Non-admin user without matching client email is denied sign-in
- [ ] Admin user can always sign in (even without client)
- [ ] User with matching client email is allowed sign-in
- [ ] User auto-linked to client on first sign-in when `clientId` is null

### Session Callback
- [ ] `session.user.isAdmin` is populated from DB
- [ ] Non-admin user with `clientId` gets `session.client` populated
- [ ] Admin user does NOT get `session.client` populated
- [ ] `session.user.id` is set from DB user ID

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Open browser to `http://localhost:3000/login`
3. Sign in with admin email (must have `is_admin = true` in DB)
4. Open browser console and run:
   ```js
   fetch('/api/auth/session').then(r => r.json()).then(console.log)
   ```
5. Verify response includes `user.isAdmin: true`
6. Sign out and sign in with a client email
7. Verify response includes `client.id`, `client.businessName`, `client.ownerName`
8. Attempt sign-in with an email not in clients table — should be denied

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] All auth routes registered: `/api/auth/[...nextauth]`

## 02-admin-ui-components

### File Existence
- [ ] `src/components/ui/select.tsx` exists (shadcn Select component)
- [ ] `src/lib/admin-context.tsx` exists (AdminProvider + useAdmin hook)
- [ ] `src/components/providers.tsx` wraps children with `AdminProvider`
- [ ] `src/components/admin/client-selector.tsx` exists (shadcn-based selector)
- [ ] `src/lib/get-client-id.ts` exists (server-side helper)
- [ ] `src/lib/hooks/use-client-id.ts` exists (client-side hook)

### Admin Context (src/lib/admin-context.tsx)
- [ ] `AdminProvider` persists `selectedClientId` to `localStorage`
- [ ] `AdminProvider` syncs `selectedClientId` to a cookie (`adminSelectedClientId`)
- [ ] `AdminProvider` restores `selectedClientId` from `localStorage` on mount
- [ ] `setSelectedClientId(null)` clears both `localStorage` and cookie
- [ ] `selectedClient` is derived from `clients` array when `selectedClientId` changes
- [ ] `isLoading` starts `true` and becomes `false` after hydration
- [ ] `useAdmin()` throws if used outside `AdminProvider`

### Providers (src/components/providers.tsx)
- [ ] `SessionProvider` wraps `AdminProvider` (session available inside admin context)
- [ ] Both providers are `'use client'` components

### Client Selector (src/components/admin/client-selector.tsx)
- [ ] Renders an "Admin" badge with amber styling
- [ ] Renders a shadcn `Select` dropdown with client business names
- [ ] Selecting a client updates `AdminContext` (and persists to localStorage/cookie)
- [ ] If no client is selected and clients exist, auto-selects the first client
- [ ] Accepts `clients` as a prop (server-fetched data passed down)

### Server-Side Client ID (src/lib/get-client-id.ts)
- [ ] Returns `null` if no session
- [ ] For admin users: reads `adminSelectedClientId` cookie and returns it
- [ ] For non-admin users: returns `session.client.id`
- [ ] Uses `await cookies()` (Next.js 15+ async API)

### Client-Side Hook (src/lib/hooks/use-client-id.ts)
- [ ] For admin users: returns `selectedClientId` from `AdminContext`
- [ ] For non-admin users: returns `session.client.id`
- [ ] Returns `null` if no session

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Sign in as admin user
3. Open browser console and verify `localStorage.getItem('adminSelectedClientId')` returns a client ID
4. Check that the `adminSelectedClientId` cookie is set (DevTools > Application > Cookies)
5. Refresh the page — the selected client should persist (not reset)
6. Change client selection in the dropdown — verify localStorage and cookie both update
7. Clear selection — verify localStorage and cookie are removed

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] No new warnings related to admin-context or client-selector

## 03-admin-dashboard-pages

### Dashboard Layout (src/app/(dashboard)/layout.tsx)
- [ ] Admin users see grouped admin nav items (Management, Optimization, Configuration) in amber color
- [ ] Admin users see regular nav items (Overview, Leads, Conversations, Scheduled, Settings) after a separator
- [ ] Non-admin users see only regular nav items in gray
- [ ] Admin users see "Admin" badge + client selector dropdown in header
- [ ] Non-admin users see their business name or email in header
- [ ] Sign Out button renders for both admin and non-admin users
- [ ] Client selector dropdown lists only active clients sorted alphabetically
- [ ] `AdminProvider` wraps all children

### Dashboard Page (src/app/(dashboard)/dashboard/page.tsx)
- [ ] Admin without selected client sees "Select a Client" prompt
- [ ] Non-admin without `clientId` sees "No client linked to account"
- [ ] Stats cards show: Leads Captured (calls + forms), Messages Sent, Follow-ups (estimates + appointments), Scheduled (pending count)
- [ ] Stats are aggregated over last 7 days from `dailyStats`
- [ ] Scheduled count uses `count(*)` query (not `.length`)
- [ ] Action Required section lists up to 5 leads with `actionRequired = true`
- [ ] Each action lead links to `/leads/{id}` with name/phone and reason
- [ ] Time-ago badge renders via `formatDistanceToNow`

### Leads Page (src/app/(dashboard)/leads/page.tsx)
- [ ] Admin without selected client sees "Select a Client" prompt
- [ ] Uses `getClientId()` (not `session.client.id` or `users` table lookup)
- [ ] Lists up to 100 leads sorted by `updatedAt` descending
- [ ] Each lead shows name or formatted phone, optional project type
- [ ] Red dot indicator for `actionRequired` leads
- [ ] Status badges with color coding (new=blue, contacted=yellow, won=green, etc.)
- [ ] Time-ago display for each lead

### Scheduled Page (src/app/(dashboard)/scheduled/page.tsx)
- [ ] Admin without selected client sees "Select a Client" prompt
- [ ] Uses `getClientId()` for client resolution
- [ ] Uses `leftJoin` with leads table for lead name/phone
- [ ] Shows up to 50 pending messages ordered by `sendAt` ascending
- [ ] Each message shows lead name, sequence type badge, step badge, scheduled time
- [ ] Message content preview with `line-clamp-2`

### Settings Page (src/app/(dashboard)/settings/page.tsx)
- [ ] Admin without selected client sees "Select a Client" prompt
- [ ] Uses `getClientId()` for client resolution
- [ ] Shows Business Information card (name, owner, email, phone)
- [ ] Shows SMS Configuration card (Twilio number, messages this month / limit, Google Business URL)
- [ ] Shows Notifications card (email and SMS notification badges)
- [ ] Shows Form Webhook card with URL and field documentation

### Admin Overview Page (src/app/(dashboard)/admin/page.tsx)
- [ ] Non-admin users are redirected to `/dashboard`
- [ ] Shows 4 summary cards: Active Clients, Total Leads (7d), Messages Sent (7d), Needs Attention
- [ ] "Needs Attention" count is red and sums action-required leads across all clients
- [ ] Clients list shows each client with business name, owner, phone
- [ ] Each client row shows 7-day leads count and messages count
- [ ] Red dot indicator for clients with action-required leads
- [ ] Action count badge in destructive variant when > 0
- [ ] Status badge (active=default, other=secondary)
- [ ] Clients sorted alphabetically by business name

### Admin Client Switching
- [ ] Select a client in the dropdown → navigate to `/dashboard` → see that client's data
- [ ] Switch to a different client → `/dashboard` updates with new client's stats
- [ ] Visit `/leads` → shows selected client's leads
- [ ] Visit `/scheduled` → shows selected client's scheduled messages
- [ ] Visit `/settings` → shows selected client's business info and SMS config
- [ ] Visit `/admin` → shows all clients overview (not filtered by selection)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] All routes registered: `/admin`, `/dashboard`, `/leads`, `/scheduled`, `/settings`

## 04-team-schema-service

### Schema: team_members Table
- [ ] `team_members` table exists in `src/db/schema/team-members.ts`
- [ ] Columns: `id` (uuid PK), `clientId` (FK → clients.id, cascade), `name` (varchar 255, not null), `phone` (varchar 20, not null)
- [ ] Columns: `email` (varchar 255, nullable), `role` (varchar 50, nullable)
- [ ] Columns: `receiveEscalations` (boolean, default true), `receiveHotTransfers` (boolean, default true)
- [ ] Columns: `priority` (integer, default 1), `isActive` (boolean, default true)
- [ ] Columns: `createdAt` (timestamp, defaultNow), `updatedAt` (timestamp, defaultNow)
- [ ] Index: `idx_team_members_client_id` on `clientId`
- [ ] Exported types: `TeamMember`, `NewTeamMember`

### Schema: escalation_claims Table
- [ ] `escalation_claims` table exists in `src/db/schema/escalation-claims.ts`
- [ ] Columns: `id` (uuid PK), `leadId` (FK → leads.id, cascade), `clientId` (FK → clients.id, cascade)
- [ ] Columns: `claimedBy` (FK → teamMembers.id, set null on delete)
- [ ] Columns: `claimToken` (varchar 64, not null, unique)
- [ ] Columns: `escalationReason` (varchar 255), `lastLeadMessage` (text)
- [ ] Columns: `status` (varchar 20, default 'pending') — values: pending, claimed, resolved
- [ ] Columns: `notifiedAt` (timestamp, defaultNow), `claimedAt` (timestamp), `resolvedAt` (timestamp), `createdAt` (timestamp, defaultNow)
- [ ] Indexes: `idx_escalation_claims_lead_id`, `idx_escalation_claims_token`, `idx_escalation_claims_client_id`, `idx_escalation_claims_status`
- [ ] Exported types: `EscalationClaim`, `NewEscalationClaim`

### Schema: Relations
- [ ] `teamMembersRelations` defines `client` (one → clients) and `claims` (many → escalationClaims)
- [ ] `escalationClaimsRelations` defines `lead` (one → leads), `client` (one → clients), `claimedByMember` (one → teamMembers)
- [ ] `clientsRelations` includes `teamMembers: many(teamMembers)` and `escalationClaims: many(escalationClaims)`
- [ ] Both schemas exported from `src/db/schema/index.ts`

### Token Utility (src/lib/utils/tokens.ts)
- [ ] `generateClaimToken()` function exists
- [ ] Uses `crypto.randomBytes(32).toString('hex')` — produces 64-char hex string
- [ ] Calling `generateClaimToken()` twice produces different values (randomness check)

### Team Escalation Service (src/lib/services/team-escalation.ts)
- [ ] `notifyTeamForEscalation(payload)` function exists
- [ ] Accepts `EscalationPayload` with `leadId`, `clientId`, `twilioNumber`, `reason`, `lastMessage`
- [ ] Uses `getDb()` per-request (not cached `db` instance)
- [ ] Queries only active team members with `receiveEscalations = true`, ordered by `priority`
- [ ] Returns `{ notified: 0 }` when no team members configured
- [ ] Returns `{ notified: 0, error: 'Lead not found' }` when lead doesn't exist
- [ ] Creates escalation claim record with `status: 'pending'`, unique `claimToken`
- [ ] Sends SMS to each team member with lead name, truncated message (80 chars), reason, and claim URL
- [ ] Sends email via `actionRequiredEmail` to team members who have email configured
- [ ] Returns `{ notified, escalationId, claimToken }` on success

### Claim Escalation (src/lib/services/team-escalation.ts)
- [ ] `claimEscalation(token, teamMemberId)` function exists
- [ ] Returns `{ success: false, error: 'Invalid claim link' }` for unknown tokens
- [ ] Returns `{ success: false, error: 'Already claimed', claimedBy: '<name>' }` for already-claimed escalations
- [ ] Looks up claimer name from `teamMembers` table when returning "Already claimed"
- [ ] Returns `{ success: false, error: 'Team member not found' }` for invalid team member ID
- [ ] Updates escalation claim: sets `claimedBy`, `claimedAt`, `status: 'claimed'`
- [ ] Clears `actionRequired = false` and `actionRequiredReason = null` on the lead
- [ ] Notifies other team members via SMS: "✓ <name> is handling <lead>"
- [ ] Skips SMS notification for the claiming member themselves
- [ ] Returns `{ success: true, leadId, leadPhone }` on success

### Pending Escalations (src/lib/services/team-escalation.ts)
- [ ] `getPendingEscalations(clientId)` function exists
- [ ] Returns array of pending claims with lead name and phone via `innerJoin`
- [ ] Only returns claims with `status: 'pending'` for the given `clientId`
- [ ] Returns empty array on error (does not throw)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] No new warnings related to team-escalation service

## 05-claim-pages-sms-update

### Claim API Route (src/app/api/claim/route.ts)
- [ ] `POST /api/claim` route exists
- [ ] Validates input with Zod: `token` (string, min 1), `teamMemberId` (string, uuid)
- [ ] Returns 400 with `{ success: false, error: 'Invalid input' }` on validation failure
- [ ] Returns 500 with `{ success: false, error: 'Failed to claim' }` on unexpected error
- [ ] Calls `claimEscalation(token, teamMemberId)` and returns the result
- [ ] Successful claim returns `{ success: true, leadId, leadPhone }`
- [ ] Already-claimed returns `{ success: false, error: 'Already claimed', claimedBy: '<name>' }`

### Claim Page (src/app/(auth)/claim/page.tsx)
- [ ] Page exists at `/claim` route under `(auth)` layout
- [ ] Reads `token` from async `searchParams` (Next.js 16 pattern)
- [ ] Redirects to `/claim-error?reason=invalid` when no token provided
- [ ] Redirects to `/claim-error?reason=invalid` when token doesn't match any escalation
- [ ] Redirects to `/claim-error?reason=claimed&by=<name>` when escalation already claimed
- [ ] Uses `getDb()` per-request (not cached instance)
- [ ] Displays lead name or formatted phone number
- [ ] Displays last lead message in quotes
- [ ] Displays escalation reason
- [ ] Renders `ClaimForm` with token, active team members, and lead ID
- [ ] Only shows active team members for the escalation's client

### Claim Form Component (src/app/(auth)/claim/claim-form.tsx)
- [ ] `'use client'` component exists
- [ ] Renders shadcn `Select` dropdown with team member names
- [ ] "Select your name..." placeholder shown when no member selected
- [ ] "Claim & Respond" button is disabled when no member selected
- [ ] "Claim & Respond" button is disabled while loading
- [ ] Button text changes to "Claiming..." during submission
- [ ] Sends `POST /api/claim` with `{ token, teamMemberId }`
- [ ] On success, redirects to `/leads/<leadId>?claimed=true`
- [ ] On "Already claimed" error, redirects to `/claim-error?reason=claimed&by=<name>`
- [ ] On other errors, shows alert with error message

### Claim Error Page (src/app/(auth)/claim-error/page.tsx)
- [ ] Page exists at `/claim-error` route under `(auth)` layout
- [ ] Reads `reason` and `by` from async `searchParams` (Next.js 16 pattern)
- [ ] Shows "Invalid Link" title and "This claim link is invalid or has expired." for `reason=invalid`
- [ ] Shows "Already Claimed" title and "<name> is already handling this lead." for `reason=claimed`
- [ ] Shows generic "Claim Error" title for unknown reasons
- [ ] Has "Go to Dashboard" button linking to `/dashboard`

### Incoming SMS Handler (src/lib/automations/incoming-sms.ts)
- [ ] Imports `notifyTeamForEscalation` from `@/lib/services/team-escalation`
- [ ] Imports `sendEmail` and `actionRequiredEmail` from `@/lib/services/resend`
- [ ] On escalation: calls `notifyTeamForEscalation()` with leadId, clientId, twilioNumber, reason, lastMessage
- [ ] On escalation with 0 team members notified: falls back to contractor SMS notification (if `notificationSms` enabled)
- [ ] On escalation with 0 team members notified: falls back to contractor email notification (if `notificationEmail` enabled)
- [ ] Escalation return includes `teamNotified` count
- [ ] After AI response (non-escalation): sends contractor notification SMS with lead name, truncated message, and dashboard URL
- [ ] Conversation history limited to 20 messages
- [ ] Dashboard URL constructed from `NEXT_PUBLIC_APP_URL` environment variable
- [ ] All database operations use `getDb()` per-request

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Verify `/claim` page renders (will redirect to `/claim-error?reason=invalid` without a token)
3. Verify `/claim-error` page renders with "Invalid Link" message
4. Verify `/claim-error?reason=claimed&by=John` shows "Already Claimed" with "John is already handling this lead."
5. Send `POST /api/claim` with invalid body → expect 400 response
6. Send `POST /api/claim` with `{ "token": "fake", "teamMemberId": "<valid-uuid>" }` → expect `{ success: false, error: 'Invalid claim link' }`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/claim`, `/claim-error`, `/api/claim`
- [ ] Incoming SMS handler file has no lint errors

## 06-team-members-ui

### Team Members API (src/app/api/team-members/route.ts)
- [ ] `GET /api/team-members` returns members for authenticated users
- [ ] Admin users can pass `?clientId=` query param to fetch any client's members
- [ ] Non-admin users get members via `getClientId()` (cookie/session-based)
- [ ] Returns `{ success: true, members: [...] }` on success
- [ ] Returns 401 if not authenticated
- [ ] Returns 403 if no client resolved
- [ ] Members ordered by `priority`
- [ ] `POST /api/team-members` creates a new member with Zod validation
- [ ] Phone number normalized via `normalizePhoneNumber()` on create
- [ ] Returns 400 with validation details on invalid input
- [ ] `DELETE /api/team-members?memberId=<id>` removes a member
- [ ] Returns 400 if `memberId` not provided

### Team Members PATCH/DELETE API (src/app/api/team-members/[id]/route.ts)
- [ ] `PATCH /api/team-members/<id>` updates a member's fields
- [ ] Updates `updatedAt` timestamp automatically
- [ ] Returns 404 if member not found
- [ ] Returns 401 if not authenticated
- [ ] `DELETE /api/team-members/<id>` removes a member by path param
- [ ] Uses Next.js 16 async params pattern (`Promise<{ id: string }>`)

### TeamMembersList Component (src/app/(dashboard)/settings/team-members-list.tsx)
- [ ] Renders "No team members yet" message when list is empty
- [ ] Shows loading state while fetching
- [ ] Displays each member with name, phone, email, role badge, and active status
- [ ] "Add Team Member" button toggles inline form
- [ ] Form has name, phone, email (optional), and role fields
- [ ] "Add Member" button disabled when name or phone is empty
- [ ] Cancel button hides the form
- [ ] Enable/Disable button toggles `isActive` via PATCH
- [ ] Remove button shows confirmation dialog before deleting
- [ ] List refreshes automatically after add, toggle, or remove

### Settings Page Integration (src/app/(dashboard)/settings/page.tsx)
- [ ] "Team Members" card renders spanning full width (`md:col-span-2`)
- [ ] Card description reads "People who receive escalation notifications when AI can't answer"
- [ ] `TeamMembersList` receives `clientId` prop from server component
- [ ] Admin without selected client sees "Select a Client" prompt (no crash)

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Sign in and go to `/settings`
3. Scroll down to see "Team Members" section
4. Click "+ Add Team Member"
5. Fill in name and phone → click "Add Member" → member appears in list
6. Click "Disable" on a member → badge changes to "Inactive"
7. Click "Enable" → badge changes back to "Active"
8. Click "Remove" → confirm dialog → member is removed
9. Add a member with email and role → verify both display correctly

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/settings`, `/api/team-members`, `/api/team-members/[id]`

## 07-hot-transfer-schema-services

### Schema: business_hours Table
- [ ] `business_hours` table exists in `src/db/schema/business-hours.ts`
- [ ] Columns: `id` (uuid PK), `clientId` (FK → clients.id, cascade), `dayOfWeek` (integer, not null)
- [ ] Columns: `openTime` (time, nullable), `closeTime` (time, nullable), `isOpen` (boolean, default true)
- [ ] Column: `createdAt` (timestamp, defaultNow)
- [ ] Unique index on `(clientId, dayOfWeek)` — `business_hours_client_day_unique`
- [ ] Exported types: `BusinessHours`, `NewBusinessHours`
- [ ] Exported from `src/db/schema/index.ts`

### Schema: call_attempts Table
- [ ] `call_attempts` table exists in `src/db/schema/call-attempts.ts`
- [ ] Columns: `id` (uuid PK), `leadId` (FK → leads.id, cascade), `clientId` (FK → clients.id, cascade)
- [ ] Columns: `callSid` (varchar 50), `status` (varchar 20), `answeredBy` (FK → teamMembers.id, set null)
- [ ] Columns: `duration` (integer), `recordingUrl` (varchar 500)
- [ ] Columns: `createdAt` (timestamp, defaultNow), `answeredAt` (timestamp), `endedAt` (timestamp)
- [ ] Indexes: `idx_call_attempts_lead_id`, `idx_call_attempts_client_id`, `idx_call_attempts_status`
- [ ] Exported types: `CallAttempt`, `NewCallAttempt`
- [ ] Exported from `src/db/schema/index.ts`

### Schema: Relations
- [ ] `businessHoursRelations` defines `client` (one → clients)
- [ ] `callAttemptsRelations` defines `lead` (one → leads), `client` (one → clients), `answeredByMember` (one → teamMembers)
- [ ] `clientsRelations` includes `businessHours: many(businessHours)` and `callAttempts: many(callAttempts)`

### Business Hours Service (src/lib/services/business-hours.ts)
- [ ] `initializeBusinessHours(clientId)` creates 7 rows (Sun-Sat), Mon-Fri open 9-5, weekends closed
- [ ] Uses `onConflictDoNothing()` — safe to call multiple times
- [ ] `isWithinBusinessHours(clientId, timezone?)` returns `true` during business hours
- [ ] Defaults to `America/Edmonton` timezone
- [ ] Uses `Intl.DateTimeFormat` to convert current time to client's timezone
- [ ] Returns `false` when `isOpen` is `false` for that day
- [ ] Returns `false` when current time is outside `openTime`–`closeTime` range
- [ ] `getBusinessHours(clientId)` returns all 7 rows ordered by `dayOfWeek`
- [ ] `updateBusinessHours(clientId, dayOfWeek, openTime, closeTime, isOpen)` upserts a single day
- [ ] All functions use `getDb()` per-request (not cached instance)
- [ ] All functions have try/catch error handling with console logging

### Hot Intent Detection (src/lib/services/openai.ts)
- [ ] `detectHotIntent(message)` function exported
- [ ] Returns `true` for messages containing any trigger phrase (case-insensitive)
- [ ] Trigger phrases include: "ready to schedule", "ready to book", "can you call me", "call me", "give me a call", "want to proceed", "let's do it", "let's move forward", "when can you start", "i'm ready", "book an appointment", "schedule an estimate", "come out today", "come out tomorrow", "available today", "available tomorrow"
- [ ] Returns `false` for messages with no trigger phrases
- [ ] Case-insensitive matching (e.g., "I'M READY" matches "i'm ready")

### Ring Group Service (src/lib/services/ring-group.ts)
- [ ] `initiateRingGroup(payload)` function exported
- [ ] Accepts `{ leadId, clientId, leadPhone, twilioNumber }`
- [ ] Queries active team members with `receiveHotTransfers = true`, ordered by `priority`
- [ ] Returns `{ initiated: false, reason: 'No team members' }` when no members configured
- [ ] Creates `callAttempts` record with `status: 'initiated'`
- [ ] Creates Twilio outbound call to `leadPhone` from `twilioNumber`
- [ ] Sets `url` to ring-connect webhook with `attemptId` and `leadPhone` params
- [ ] Sets `statusCallback` to ring-status webhook with `attemptId` param
- [ ] Updates call attempt with `callSid` and `status: 'ringing'` after call creation
- [ ] Sends SMS to each team member notifying of hot lead
- [ ] Returns `{ initiated: true, callSid, attemptId, membersToRing }` on success
- [ ] On failure: updates call attempt to `status: 'failed'` and returns `{ initiated: false, error }`
- [ ] Uses `getDb()` per-request (not cached instance)

### Ring Group No-Answer Handler (src/lib/services/ring-group.ts)
- [ ] `handleNoAnswer(payload)` function exported
- [ ] Sends SMS to each hot-transfer team member about missed call with lead info
- [ ] Sends SMS to lead apologizing and offering callback
- [ ] Sets `actionRequired = true` and `actionRequiredReason = 'Hot transfer - no answer'` on lead
- [ ] Uses `formatPhoneNumber()` for display-friendly phone numbers

### Manual Verification Steps
1. Check file existence:
   - `src/db/schema/business-hours.ts` exists
   - `src/db/schema/call-attempts.ts` exists
   - `src/lib/services/business-hours.ts` exists
   - `src/lib/services/ring-group.ts` exists
2. Verify `detectHotIntent` in `src/lib/services/openai.ts`:
   - `detectHotIntent("I'm ready to book")` → `true`
   - `detectHotIntent("What services do you offer?")` → `false`
   - `detectHotIntent("CALL ME please")` → `true`
3. Verify imports resolve correctly:
   - `import { businessHours, callAttempts } from '@/db/schema'` — no errors
   - `import { detectHotIntent } from '@/lib/services/openai'` — no errors
   - `import { initiateRingGroup, handleNoAnswer } from '@/lib/services/ring-group'` — no errors

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] No new TypeScript warnings related to business-hours, call-attempts, or ring-group

## 08-hot-transfer-webhooks-ui

### Ring Connect Webhook (src/app/api/webhooks/twilio/ring-connect/route.ts)
- [ ] File exists at `src/app/api/webhooks/twilio/ring-connect/route.ts`
- [ ] Exports `POST` handler
- [ ] Reads `attemptId` and `leadPhone` from query params
- [ ] Returns TwiML error message when `attemptId` is missing
- [ ] Fetches call attempt record from database by `attemptId`
- [ ] Returns TwiML error when call attempt not found
- [ ] Queries active team members with `receiveHotTransfers = true`, ordered by priority
- [ ] Returns "no one available" TwiML when no team members found
- [ ] Generates TwiML with `<Say voice="alice">Please hold...</Say>`
- [ ] Generates `<Dial>` with 25-second timeout and ring-result action callback
- [ ] Sets `callerId` to `leadPhone` on dial
- [ ] Adds `<Number>` for each team member with member-answered status callback
- [ ] Appends fallback "no one available" `<Say>` after `<Dial>`
- [ ] Returns response with `Content-Type: text/xml` header
- [ ] Uses `getDb()` per-request (not cached instance)

### Member Answered Webhook (src/app/api/webhooks/twilio/member-answered/route.ts)
- [ ] File exists at `src/app/api/webhooks/twilio/member-answered/route.ts`
- [ ] Exports `POST` handler
- [ ] Reads `attemptId` and `memberId` from query params
- [ ] Returns 'OK' when params are missing (no error)
- [ ] Updates call attempt: sets `answeredBy`, `answeredAt`, `status: 'answered'`
- [ ] Returns 'OK' when call attempt update returns no rows
- [ ] Fetches answering member details from `teamMembers`
- [ ] Fetches all other active hot-transfer team members for the client
- [ ] Fetches lead details for display name
- [ ] Fetches client details for Twilio number
- [ ] Sends SMS notification to OTHER team members (skips answering member)
- [ ] SMS notification includes answering member name and lead display name
- [ ] Clears `actionRequired` and `actionRequiredReason` on the lead
- [ ] Uses `formatPhoneNumber()` for lead display when no name available
- [ ] Uses `getDb()` per-request (not cached instance)

### Ring Result Webhook (src/app/api/webhooks/twilio/ring-result/route.ts)
- [ ] File exists at `src/app/api/webhooks/twilio/ring-result/route.ts`
- [ ] Exports `POST` handler
- [ ] Reads `attemptId` from query params
- [ ] Reads `DialCallStatus` from form data
- [ ] Returns TwiML hangup when `attemptId` is missing
- [ ] Fetches call attempt record from database
- [ ] Returns TwiML hangup when call attempt not found
- [ ] Updates call attempt status to 'answered' when `DialCallStatus` is 'completed'
- [ ] Updates call attempt status to 'no-answer' for other statuses
- [ ] Sets `endedAt` timestamp on call attempt
- [ ] Calls `handleNoAnswer()` when call was NOT completed or answered
- [ ] Passes correct `leadId`, `clientId`, `leadPhone`, `twilioNumber` to `handleNoAnswer`
- [ ] Returns TwiML hangup response
- [ ] Uses `getDb()` per-request (not cached instance)

### Business Hours API - GET (src/app/api/business-hours/route.ts)
- [ ] `GET /api/business-hours` endpoint exists
- [ ] Returns 401 when not authenticated
- [ ] Returns 403 when no client resolved
- [ ] Accepts `clientId` query param (falls back to `getClientId()`)
- [ ] Returns `{ hours: [...] }` with hours ordered by `dayOfWeek`
- [ ] Works for both admin (with query param) and non-admin (via session)

### Business Hours Editor (src/app/(dashboard)/settings/business-hours-editor.tsx)
- [ ] File exists at `src/app/(dashboard)/settings/business-hours-editor.tsx`
- [ ] Marked as `'use client'` component
- [ ] Accepts `clientId` prop
- [ ] Fetches hours from `GET /api/business-hours?clientId=...` on mount
- [ ] Shows "Loading..." while fetching
- [ ] Defaults to Mon-Fri 08:00-18:00 when no hours exist
- [ ] Displays all 7 days (Sunday through Saturday)
- [ ] Each day has a `Switch` toggle for isOpen
- [ ] When open: shows time inputs for open/close times
- [ ] When closed: shows "Closed" text
- [ ] "Save Hours" button calls `PUT /api/business-hours`
- [ ] Button shows "Saving..." while saving
- [ ] Button is disabled while saving

### Settings Page Update (src/app/(dashboard)/settings/page.tsx)
- [ ] Imports `BusinessHoursEditor` from `./business-hours-editor`
- [ ] "Business Hours" card renders spanning full width (`md:col-span-2`)
- [ ] Card description reads "Set when hot transfers should connect calls immediately"
- [ ] `BusinessHoursEditor` receives `clientId` prop from server component
- [ ] Business Hours card appears AFTER Team Members card

### Hot Intent Integration (src/lib/automations/incoming-sms.ts)
- [ ] Imports `detectHotIntent` from `@/lib/services/openai`
- [ ] Imports `isWithinBusinessHours` from `@/lib/services/business-hours`
- [ ] Imports `initiateRingGroup` from `@/lib/services/ring-group`
- [ ] Hot intent check happens BEFORE AI response generation (step 6.5)
- [ ] Calls `detectHotIntent(messageBody)` on every incoming message
- [ ] On hot intent + within business hours: calls `initiateRingGroup()` with lead/client data
- [ ] On successful ring group: sends "We're calling you right now" SMS to lead
- [ ] On successful ring group: logs 'hot_transfer' conversation
- [ ] On successful ring group: returns `{ processed: true, hotTransfer: true, callSid }`
- [ ] On hot intent + outside hours: sends "outside business hours" SMS to lead
- [ ] On hot intent + outside hours: calls `notifyTeamForEscalation()` with reason "Hot intent - outside business hours"
- [ ] On hot intent + outside hours: returns `{ processed: true, hotTransfer: false, outsideHours: true }`
- [ ] Non-hot-intent messages proceed to normal AI processing (unchanged behavior)

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Go to Settings page and verify "Business Hours" section appears at bottom
3. Toggle days on/off with Switch — verify time inputs appear/disappear
4. Set business hours and click "Save Hours" — verify save completes
5. Refresh page — verify hours persist (loaded from API)
6. Verify webhook routes registered in build output: `ring-connect`, `member-answered`, `ring-result`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] Routes registered: `/api/webhooks/twilio/ring-connect`, `/api/webhooks/twilio/member-answered`, `/api/webhooks/twilio/ring-result`
- [ ] Route registered: `/api/business-hours` (GET + PUT)
- [ ] No new TypeScript warnings related to hot-transfer webhooks or business hours UI

## 09-client-crud-api

### Clients API (src/app/api/admin/clients/route.ts)
- [ ] `GET /api/admin/clients` returns all clients ordered by `createdAt` descending
- [ ] `GET /api/admin/clients` returns 403 for non-admin users
- [ ] `POST /api/admin/clients` creates a new client with required fields
- [ ] `POST /api/admin/clients` validates `businessName`, `ownerName`, `email`, `phone` are required
- [ ] `POST /api/admin/clients` returns 400 for duplicate email addresses
- [ ] `POST /api/admin/clients` normalizes phone numbers via `normalizePhoneNumber()`
- [ ] `POST /api/admin/clients` sets default timezone to `America/Edmonton`
- [ ] `POST /api/admin/clients` sets initial status to `pending`
- [ ] `POST /api/admin/clients` accepts optional `googleBusinessUrl` (valid URL or empty string)
- [ ] `POST /api/admin/clients` returns 400 with validation details for invalid input
- [ ] `POST /api/admin/clients` returns 403 for non-admin users

### Single Client API (src/app/api/admin/clients/[id]/route.ts)
- [ ] `GET /api/admin/clients/:id` returns a single client by ID
- [ ] `GET /api/admin/clients/:id` returns 404 for non-existent client
- [ ] `GET /api/admin/clients/:id` returns 403 for non-admin users
- [ ] `PATCH /api/admin/clients/:id` updates client fields (all optional)
- [ ] `PATCH /api/admin/clients/:id` normalizes phone number when provided
- [ ] `PATCH /api/admin/clients/:id` updates `updatedAt` timestamp
- [ ] `PATCH /api/admin/clients/:id` returns 404 for non-existent client
- [ ] `PATCH /api/admin/clients/:id` validates status enum: pending, active, paused, cancelled
- [ ] `PATCH /api/admin/clients/:id` returns 400 with validation details for invalid input
- [ ] `PATCH /api/admin/clients/:id` returns 403 for non-admin users
- [ ] `DELETE /api/admin/clients/:id` performs soft delete (sets status to `cancelled`)
- [ ] `DELETE /api/admin/clients/:id` updates `updatedAt` timestamp
- [ ] `DELETE /api/admin/clients/:id` returns 404 for non-existent client
- [ ] `DELETE /api/admin/clients/:id` returns 403 for non-admin users

### Admin Users API (src/app/api/admin/users/route.ts)
- [ ] `GET /api/admin/users` returns all users with client name via left join
- [ ] `GET /api/admin/users` returns fields: id, name, email, isAdmin, clientId, clientName, createdAt
- [ ] `GET /api/admin/users` orders by `createdAt` descending
- [ ] `GET /api/admin/users` returns 403 for non-admin users

### Single User API (src/app/api/admin/users/[id]/route.ts)
- [ ] `PATCH /api/admin/users/:id` updates `isAdmin` boolean field
- [ ] `PATCH /api/admin/users/:id` updates `clientId` UUID field (or null)
- [ ] `PATCH /api/admin/users/:id` prevents admin from demoting themselves (returns 400)
- [ ] `PATCH /api/admin/users/:id` updates `updatedAt` timestamp
- [ ] `PATCH /api/admin/users/:id` returns 404 for non-existent user
- [ ] `PATCH /api/admin/users/:id` returns 400 with validation details for invalid input
- [ ] `PATCH /api/admin/users/:id` returns 403 for non-admin users

### Client Stats API (src/app/api/admin/clients/[id]/stats/route.ts)
- [ ] `GET /api/admin/clients/:id/stats` returns lead counts (total, actionRequired)
- [ ] `GET /api/admin/clients/:id/stats` returns 7-day stats (missedCalls, forms, messages)
- [ ] `GET /api/admin/clients/:id/stats` returns active team member count
- [ ] `GET /api/admin/clients/:id/stats` calculates `leadsThisWeek` as missedCalls + forms
- [ ] `GET /api/admin/clients/:id/stats` returns 0 for all stats when no data exists
- [ ] `GET /api/admin/clients/:id/stats` returns 403 for non-admin users

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Test client list:
   ```bash
   curl http://localhost:3000/api/admin/clients
   ```
3. Test client creation:
   ```bash
   curl -X POST http://localhost:3000/api/admin/clients \
     -H "Content-Type: application/json" \
     -d '{"businessName":"Test Co","ownerName":"John","email":"john@test.com","phone":"4035551234"}'
   ```
4. Test client update (use ID from step 3):
   ```bash
   curl -X PATCH http://localhost:3000/api/admin/clients/<id> \
     -H "Content-Type: application/json" \
     -d '{"status":"active"}'
   ```
5. Test soft delete:
   ```bash
   curl -X DELETE http://localhost:3000/api/admin/clients/<id>
   ```
6. Test user list:
   ```bash
   curl http://localhost:3000/api/admin/users
   ```
7. Test client stats:
   ```bash
   curl http://localhost:3000/api/admin/clients/<id>/stats
   ```
8. All endpoints should return 403 without an admin session

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/api/admin/clients`, `/api/admin/clients/[id]`, `/api/admin/clients/[id]/stats`
- [ ] Routes registered: `/api/admin/users`, `/api/admin/users/[id]`

## 10-client-management-ui

### Admin Page (/admin)
- [ ] Non-admin users are redirected to `/dashboard`
- [ ] Page title reads "Client Management"
- [ ] "Manage Users" button links to `/admin/users`
- [ ] "+ New Client" button links to `/admin/clients/new`
- [ ] 4 stat cards: Total Clients (with active count), Total Leads (7d), Messages Sent (7d), Needs Attention
- [ ] "Needs Attention" count shown in red, aggregates action-required leads across all clients
- [ ] Client list shows each client as a clickable link to `/admin/clients/:id`
- [ ] Each client row shows: business name, owner name, email
- [ ] "No phone number" warning shown for clients without `twilioNumber`
- [ ] Red dot indicator for clients with action-required leads
- [ ] Action count badge in destructive variant when > 0
- [ ] Color-coded status badges (green=active, yellow=pending, gray=paused, red=cancelled)
- [ ] Empty state: "No clients yet. Create your first client to get started."

### Create Client Page (/admin/clients/new)
- [ ] Non-admin users are redirected to `/dashboard`
- [ ] Setup Wizard promotion card links to `/admin/clients/new/wizard`
- [ ] "Create New Client" form card with description
- [ ] Form fields: Business Name (required), Owner Name (required), Email (required), Phone (required)
- [ ] Timezone dropdown with 5 Canadian timezones (default: Mountain/Edmonton)
- [ ] Google Business URL field (optional)
- [ ] "Create Client" button submits to `POST /api/admin/clients`
- [ ] Error message shown on failed creation (e.g., duplicate email)
- [ ] On success, redirects to `/admin/clients/:id`
- [ ] "Cancel" button navigates back

### Client Detail Page (/admin/clients/:id)
- [ ] Non-admin users are redirected to `/dashboard`
- [ ] 404 page shown for non-existent client ID
- [ ] Header shows business name with color-coded status badge
- [ ] Shows "Created" date formatted as "MMM d, yyyy"
- [ ] "Back to Clients" button links to `/admin`
- [ ] "Assign Phone Number" button shown when no phone assigned
- [ ] Left column: Edit Client Form (see below)
- [ ] Right column: Phone Number card, Team Members summary, Usage stats, Actions card
- [ ] Phone card shows formatted number with "Change Number" link when assigned
- [ ] Phone card shows "No phone number assigned" with assign button when unassigned
- [ ] Team Members summary shows member count and list with active/inactive badges
- [ ] Usage card shows "Messages this month: X / Y"
- [ ] Actions card contains Delete/Reactivate button
- [ ] Team Manager section at bottom for adding/removing team members

### Edit Client Form (on detail page)
- [ ] Pre-populated with existing client data
- [ ] Editable fields: Business Name, Owner Name, Email, Phone, Timezone, Status, Google Business URL, Monthly Message Limit
- [ ] Timezone dropdown with 5 Canadian options
- [ ] Status dropdown: Pending, Active, Paused, Cancelled
- [ ] Email Notifications toggle (Switch component)
- [ ] SMS Notifications toggle (Switch component)
- [ ] "Save Changes" button submits to `PATCH /api/admin/clients/:id`
- [ ] Success message: "Client updated successfully" in green
- [ ] Error message shown on failed update in red
- [ ] Page refreshes after successful save

### User Management Page (/admin/users)
- [ ] Non-admin users are redirected to `/dashboard`
- [ ] Page title reads "User Management"
- [ ] "Back to Clients" button links to `/admin`
- [ ] All users listed with: name (or "No name"), email, client association, created date, admin badge
- [ ] Client association shown as "→ Business Name" when linked
- [ ] Amber "Admin" badge shown for admin users
- [ ] "Actions" dropdown button for each user

### User Actions Component
- [ ] "Assign to Client" opens a dialog with client dropdown
- [ ] Client dropdown lists all active clients + "No client (admin only)" option
- [ ] Save button in dialog calls `PATCH /api/admin/users/:id` with `clientId`
- [ ] "Make Admin" / "Remove Admin" toggle calls `PATCH /api/admin/users/:id` with `isAdmin`
- [ ] "Remove Admin" text shown in red
- [ ] Cannot toggle admin for the currently logged-in user (disabled)
- [ ] Page refreshes after any user action

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Sign in as admin and navigate to `/admin`
3. Verify stat cards display correct counts
4. Click "+ New Client" → fill form → submit → verify redirect to detail page
5. On detail page: edit business name → save → verify success message and page refresh
6. Change client status to "paused" → save → verify badge changes to gray
7. Toggle email/SMS notifications → save → verify toggles persist on refresh
8. Navigate to `/admin/users` → verify user list
9. Click "Actions" → "Assign to Client" → select a client → save → verify association shows
10. Click "Actions" → "Make Admin" on a non-current user → verify admin badge appears
11. Click "Actions" → "Remove Admin" → verify badge removed
12. Verify "Make Admin"/"Remove Admin" is disabled for your own user
13. Navigate back to `/admin` → click a client row → verify navigation to detail page

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/admin`, `/admin/clients/new`, `/admin/clients/[id]`, `/admin/users`
- [ ] UI components installed: `dialog.tsx`, `tabs.tsx`, `dropdown-menu.tsx`

---

## 11-twilio-provisioning-service

### Service Layer (`src/lib/services/twilio-provisioning.ts`)
- [ ] File exports 6 functions: `searchAvailableNumbers`, `purchaseNumber`, `configureExistingNumber`, `releaseNumber`, `getAccountBalance`, `listOwnedNumbers`
- [ ] `searchAvailableNumbers` accepts `areaCode`, `contains`, `country` params
- [ ] `searchAvailableNumbers` defaults country to `'CA'` when not provided
- [ ] `searchAvailableNumbers` returns max 10 results with `phoneNumber`, `friendlyName`, `locality`, `region`, `capabilities`
- [ ] Mock number fallback in development when Twilio returns no results or errors
- [ ] Mock numbers use `+1XXX555YYYY` format (area code + 555 + 4 digits)
- [ ] Mock localities mapped for area codes: 403 (Calgary), 780 (Edmonton), 604 (Vancouver), 416 (Toronto), 514 (Montreal)
- [ ] `purchaseNumber` checks for `NEXT_PUBLIC_APP_URL` before proceeding
- [ ] `purchaseNumber` configures voice webhook to `/api/webhooks/twilio/voice`
- [ ] `purchaseNumber` configures SMS webhook to `/api/webhooks/twilio/sms`
- [ ] `purchaseNumber` updates client `twilioNumber`, `status` to `'active'`, and `updatedAt`
- [ ] `purchaseNumber` detects mock numbers and skips Twilio API call in development
- [ ] `configureExistingNumber` looks up number in Twilio account before configuring
- [ ] `configureExistingNumber` returns error if number not found in Twilio account
- [ ] `configureExistingNumber` updates webhooks and client record on success
- [ ] `releaseNumber` fetches client record to get current `twilioNumber`
- [ ] `releaseNumber` returns error if no number assigned to client
- [ ] `releaseNumber` clears webhooks but does NOT delete the number from Twilio
- [ ] `releaseNumber` sets client `twilioNumber` to `null` and `status` to `'paused'`
- [ ] `getAccountBalance` returns `{ balance, currency }` or `null` on error
- [ ] `listOwnedNumbers` returns array of `{ phoneNumber, friendlyName, sid }` or empty array on error
- [ ] All functions use `getDb()` per-request pattern (not cached db instance)

### Search API (`GET /api/admin/twilio/search`)
- [ ] Returns 403 when user is not admin
- [ ] Accepts query params: `areaCode`, `contains`, `country`
- [ ] Validates area code is exactly 3 digits (returns 400 if invalid)
- [ ] Returns `{ success, numbers, count, isDevelopmentMock }` on success
- [ ] Returns 500 with error message on Twilio failure

### Purchase API (`POST /api/admin/twilio/purchase`)
- [ ] Returns 403 when user is not admin
- [ ] Validates body with Zod: `phoneNumber` (min 10 chars), `clientId` (UUID)
- [ ] Returns 400 with `'Invalid input'` on Zod validation failure
- [ ] Returns 400 with service error message when purchase fails
- [ ] Returns `{ success: true, sid }` on successful purchase
- [ ] Returns 500 on unexpected errors

### Configure API (`POST /api/admin/twilio/configure`)
- [ ] Returns 403 when user is not admin
- [ ] Validates body with Zod: `phoneNumber` (min 10 chars), `clientId` (UUID)
- [ ] Returns 400 with `'Invalid input'` on Zod validation failure
- [ ] Returns 400 with service error when number not found in Twilio account
- [ ] Returns `{ success: true }` on successful configuration

### Release API (`POST /api/admin/twilio/release`)
- [ ] Returns 403 when user is not admin
- [ ] Validates body with Zod: `clientId` (UUID)
- [ ] Returns 400 when no number assigned to client
- [ ] Returns `{ success: true }` on successful release

### Account API (`GET /api/admin/twilio/account`)
- [ ] Returns 403 when user is not admin
- [ ] Returns `{ balance, numbers }` with parallel data fetching
- [ ] `balance` is `{ balance: string, currency: string }` or `null`
- [ ] `numbers` is array of `{ phoneNumber, friendlyName, sid }`

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. As admin, call `GET /api/admin/twilio/search?areaCode=403` — verify returns mock numbers in development
3. Call with invalid area code `?areaCode=12` — verify 400 error
4. Call `GET /api/admin/twilio/account` — verify returns balance and numbers
5. Create a test client, then call `POST /api/admin/twilio/purchase` with a mock number and the client ID — verify client gets number assigned
6. Call `POST /api/admin/twilio/release` with the client ID — verify number removed and status set to paused
7. Call `POST /api/admin/twilio/configure` with a number and client ID — verify configuration attempt
8. As non-admin user, call any endpoint — verify 403 response
9. Submit invalid JSON body to purchase/configure/release — verify 400 response

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/api/admin/twilio/search`, `/api/admin/twilio/purchase`, `/api/admin/twilio/configure`, `/api/admin/twilio/release`, `/api/admin/twilio/account`
- [ ] Service file exists at `src/lib/services/twilio-provisioning.ts`

---

## 12-phone-number-ui

### Phone Number Assignment Page (`/admin/clients/[id]/phone`)
- [ ] Page loads for admin users only (non-admin redirected to `/dashboard`)
- [ ] Shows client business name in header
- [ ] "Back to Client" button links to `/admin/clients/[id]`
- [ ] Returns 404 for non-existent client ID
- [ ] Renders `PhoneNumberManager` component with client data

### Phone Number Manager Component (Tabs)
- [ ] Uses shadcn `Tabs` component with 3 tabs: Current Number, Search New, Use Existing
- [ ] "Current Number" tab is disabled when no number is assigned
- [ ] Default tab is "Current Number" if number assigned, "Search New" otherwise

### Current Number Tab
- [ ] Displays current phone number in large font-mono format
- [ ] Shows Voice Enabled and SMS Enabled badges
- [ ] Shows webhook configuration note
- [ ] "Release Number" button triggers confirmation dialog
- [ ] Release calls `POST /api/admin/twilio/release` with client ID
- [ ] On successful release, switches to "Search New" tab
- [ ] Displays error message on release failure

### Search New Tab
- [ ] Area code input accepts only 3 digits (non-numeric stripped)
- [ ] Shows validation error for non-3-digit area code
- [ ] Search calls `GET /api/admin/twilio/search?areaCode=XXX&country=CA`
- [ ] Displays list of available numbers with locality and region
- [ ] Shows "No numbers found" message when search returns empty
- [ ] "Purchase" button triggers confirmation dialog with formatted number
- [ ] Purchase calls `POST /api/admin/twilio/purchase` with phoneNumber and clientId
- [ ] On success, redirects to client detail page
- [ ] All purchase buttons disabled while any purchase is in progress
- [ ] Displays error message on search or purchase failure

### Use Existing Tab
- [ ] Phone number input accepts freeform text (e.g., `+14035551234`)
- [ ] Shows validation error for empty input
- [ ] Configure calls `POST /api/admin/twilio/configure` with stripped number and clientId
- [ ] On success, redirects to client detail page
- [ ] Displays error message on failure
- [ ] Shows note about automatic webhook configuration

### Twilio Account Page (`/admin/twilio`)
- [ ] Page loads for admin users only (non-admin redirected to `/dashboard`)
- [ ] Shows account balance with currency formatting
- [ ] Shows "Unable to fetch balance" when balance is null
- [ ] Displays total owned numbers count and assigned count
- [ ] Shows number of available (unassigned) numbers
- [ ] Lists all owned numbers with formatted phone number and friendly name
- [ ] Shows assigned client name next to assigned numbers (green text)
- [ ] Shows "Not assigned" for unassigned numbers
- [ ] Shows empty state when no numbers in account
- [ ] "Back to Clients" button links to `/admin/clients`

### Navigation
- [ ] Admin nav includes link to Twilio Settings (`/admin/twilio`)
- [ ] Admin nav includes link to Phone Numbers (`/admin/phone-numbers`)
- [ ] Phone number management page accessible from client detail page

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Navigate to `/admin/clients` — pick a client without a phone number
3. Go to `/admin/clients/[id]/phone` — verify "Search New" tab is active by default
4. Enter area code `403` and click Search — verify mock numbers appear in development
5. Click "Purchase" on a number — confirm dialog, then verify redirect to client detail
6. Return to `/admin/clients/[id]/phone` — verify "Current Number" tab is now active and shows the number
7. Click "Release Number" — confirm dialog, verify tab switches to "Search New"
8. Go to "Use Existing" tab — enter `+14035551234` and click "Configure & Assign"
9. Navigate to `/admin/twilio` — verify account balance, owned numbers, and assignments display
10. As non-admin user, navigate to `/admin/clients/[id]/phone` — verify redirect to `/dashboard`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Page files exist: `src/app/(dashboard)/admin/clients/[id]/phone/page.tsx`, `phone-number-manager.tsx`
- [ ] Twilio page exists: `src/app/(dashboard)/admin/twilio/page.tsx`
- [ ] shadcn Tabs component used in phone-number-manager

## 13-setup-wizard-flow

### File Existence
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/page.tsx` exists (wizard entry point)
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/setup-wizard.tsx` exists (main wizard component)
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/steps/step-business-info.tsx` exists
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/steps/step-phone-number.tsx` exists
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/steps/step-team-members.tsx` exists
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/steps/step-business-hours.tsx` exists
- [ ] `src/app/(dashboard)/admin/clients/new/wizard/steps/step-review.tsx` exists
- [ ] `src/app/(dashboard)/admin/clients/new/page.tsx` exists (entry point with wizard promotion)
- [ ] `src/components/ui/progress.tsx` exists (shadcn Progress component)
- [ ] `src/components/ui/select.tsx` exists (shadcn Select component)
- [ ] `src/components/ui/switch.tsx` exists (shadcn Switch component)

### Wizard Layout & Navigation
- [ ] Progress bar displays at top with correct step count (Step X of 5)
- [ ] Step indicators show numbered circles for each step
- [ ] Completed steps show checkmark (✓) instead of number
- [ ] Current step indicator is highlighted with primary color
- [ ] Step titles visible on medium+ screens (`hidden md:block`)
- [ ] Card wraps each step with title and description in header

### Step 1: Business Info
- [ ] Form shows fields: Business Name, Owner Name, Email, Phone, Timezone, Google Business URL
- [ ] Business Name, Owner Name, Email, Phone are required (marked with *)
- [ ] Timezone defaults to "America/Edmonton" (Mountain)
- [ ] Timezone dropdown shows 5 Canadian time zones (Pacific, Mountain, Central, Eastern, Atlantic)
- [ ] Clicking "Next" with empty required fields shows error: "Please fill in all required fields"
- [ ] Clicking "Next" with invalid email shows error: "Please enter a valid email address"
- [ ] Clicking "Next" with valid data calls `POST /api/admin/clients` to create client
- [ ] Button shows "Creating..." while loading
- [ ] On success, stores `clientId` in wizard state and advances to Step 2
- [ ] On API error, displays error message from response

### Step 2: Phone Number
- [ ] Shows area code input (3-digit, numeric only) with Search button
- [ ] Search validates 3-digit area code before API call
- [ ] Calls `GET /api/admin/twilio/search?areaCode=XXX&country=CA` on search
- [ ] Displays scrollable list of available numbers with phone and location info
- [ ] Each number has a "Select" button to purchase
- [ ] Purchase calls `POST /api/admin/twilio/purchase` with phoneNumber and clientId
- [ ] Shows "Purchasing..." while purchasing
- [ ] On successful purchase, stores `twilioNumber` and advances to Step 3
- [ ] "Skip for now" button allows advancing without a phone number
- [ ] Back button returns to Step 1
- [ ] If number already assigned, shows it with Voice/SMS badges and Next/Back buttons
- [ ] Shows "No numbers found" message when search returns empty results

### Step 3: Team Members
- [ ] Shows explanation text about escalation notifications
- [ ] "Add Team Member" form has fields: Name, Email, Phone, Role
- [ ] Role dropdown has options: Manager, Lead/Sales, Support, Admin
- [ ] Clicking "Add Member" validates required fields (Name, Phone, Email)
- [ ] Validates email format before adding
- [ ] Added members appear in a card list below the form
- [ ] Each member card shows name, email, phone, and role badge
- [ ] "Remove" button deletes a member from the list
- [ ] Shows warning when no members added: "escalations will only go to the business owner"
- [ ] Clicking "Next" saves all team members via `POST /api/team-members` for each member
- [ ] On save error, shows error message and stops navigation
- [ ] Back button returns to Step 2

### Step 4: Business Hours
- [ ] Shows 7 days (Sunday–Saturday) each with a toggle switch
- [ ] Monday–Friday default to open (08:00–18:00), Saturday–Sunday default to closed
- [ ] Switch component toggles day open/closed
- [ ] When day is open, shows time inputs for open and close times
- [ ] When day is closed, shows "Closed" text instead of time inputs
- [ ] Clicking "Next" saves hours via `PUT /api/business-hours` with clientId and hours array
- [ ] On save error, shows error message and stops navigation
- [ ] Explanatory text about after-hours AI responses shown
- [ ] Back button returns to Step 3

### Step 5: Review & Launch
- [ ] Displays summary of all collected data in 4 sections
- [ ] Business Information: shows business name, owner, email, phone
- [ ] Twilio Number: shows formatted number with "Configured" badge, or "No number assigned" with "Pending" badge
- [ ] Team Members: lists all members with name and phone, or "No team members added" message
- [ ] Business Hours: shows open days as badges with times, or "No business hours set" message
- [ ] Warning panel appears if phone number missing or no team members
- [ ] "Activate Client" button calls `PATCH /api/admin/clients/{id}` with `status: 'active'`
- [ ] Activate button is disabled if no Twilio number assigned
- [ ] Button shows "Activating..." while loading
- [ ] On success, shows completion screen with confetti emoji and business name
- [ ] Completion screen has "View Client" and "Back to All Clients" buttons
- [ ] Back button returns to Step 4

### Auth & Access Control
- [ ] `/admin/clients/new/wizard` redirects non-admin users to `/dashboard`
- [ ] Wizard page uses `auth()` for server-side session check
- [ ] `session?.user?.isAdmin` check enforced

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Log in as admin user
3. Navigate to `/admin/clients/new` — verify wizard promotion card visible
4. Click through to `/admin/clients/new/wizard` — verify progress bar and Step 1 form
5. Submit empty form — verify "Please fill in all required fields" error
6. Fill in valid business info and submit — verify client is created and Step 2 loads
7. In Step 2, enter area code `403` and search — verify numbers appear (mock in dev)
8. Select a number — verify it is purchased/assigned and Step 3 loads
9. Add a team member with Name, Email, Phone, Role — verify card appears in list
10. Remove the team member — verify it disappears
11. Add member again, click Next — verify saved via API and Step 4 loads
12. Toggle days open/closed, adjust times — verify switches and time inputs work
13. Click Next — verify hours saved and Step 5 loads
14. Review summary — verify all 4 sections display correctly
15. Click "Activate Client" — verify success screen shows with business name
16. Click "View Client" — verify navigation to client detail page
17. Log out and log in as non-admin — navigate to `/admin/clients/new/wizard` — verify redirect to `/dashboard`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Wizard route registered: `/admin/clients/new/wizard`
- [ ] Entry point route registered: `/admin/clients/new`
- [ ] All 5 step components import correctly from `./steps/`
- [ ] `WizardData` interface exported from `setup-wizard.tsx`

## 14-setup-wizard-steps

### Step 1: Team Members Step (step-team-members.tsx)
- [ ] Toggle-based add form: "+ Add Team Member" button shows/hides form
- [ ] Form fields: Name (required), Phone (required), Email (optional), Role (optional)
- [ ] Validation: shows "Name and phone are required" when missing
- [ ] Added members displayed in bordered list with name, phone, email, and role Badge
- [ ] "Remove" button deletes member from list
- [ ] "Cancel" button hides the add form
- [ ] Warning shown when no members: "Without team members, escalations will only go to the business owner"
- [ ] Clicking "Next: Business Hours" saves all members via `POST /api/team-members` for each member
- [ ] Back button returns to Step 2

### Step 2: Business Hours Step (step-business-hours.tsx)
- [ ] Shows 7 days (Sunday-Saturday) with Switch toggle for each
- [ ] Default: Mon-Fri open (08:00-18:00), weekends closed
- [ ] Open days show time inputs for open and close times
- [ ] Closed days show "Closed" text
- [ ] Clicking "Next: Review" saves hours via `PUT /api/business-hours`
- [ ] Explanatory text about hot transfers and after-hours behavior shown
- [ ] Back button returns to Step 3

### Step 3: Review Step (step-review.tsx)
- [ ] Business Information section: business name, owner, email, phone
- [ ] Twilio Number section: formatted number with "Configured" Badge, or "No number assigned" with "Pending" Badge
- [ ] Team Members section: list of members with name and phone, or "No team members added" message
- [ ] Business Hours section: open days as Badges with times, or "No business hours set" message
- [ ] Warning panel appears when phone number missing or no team members added
- [ ] "Activate Client" button calls `PATCH /api/admin/clients/{id}` with `status: 'active'`
- [ ] Activate button disabled when no Twilio number assigned
- [ ] Button shows "Activating..." during API call
- [ ] On error, JSON response parsed with type assertion `as { error?: string }`
- [ ] On success, shows completion screen

### Step 4: New Client Page (admin/clients/new/page.tsx)
- [ ] Page header shows "Create New Client" title with "Use Setup Wizard →" button
- [ ] Quick Create card with `CreateClientForm` component
- [ ] Card description: "Add a new contractor with basic info. You can configure phone number and team later."
- [ ] Wizard promotion card (blue) with "Prefer guided setup?" heading
- [ ] Promotion card links to `/admin/clients/new/wizard`
- [ ] Non-admin users redirected to `/dashboard`

### Step 5: Admin Page Button Update (admin/page.tsx)
- [ ] "+ New Client" button links to `/admin/clients/new/wizard` (not `/admin/clients/new`)

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Navigate to `/admin` — verify "+ New Client" links to `/admin/clients/new/wizard`
3. Navigate to `/admin/clients/new` — verify page header with wizard link and Quick Create form
4. Click "Use Setup Wizard →" — verify navigation to `/admin/clients/new/wizard`
5. Complete Steps 1-2 in wizard, then on Step 3 (Team Members):
   - Click "+ Add Team Member" — verify form appears
   - Fill name and phone only — click "Add Member" — verify member appears in list
   - Add a second member with email and role — verify Badge shows for role
   - Click "Remove" on a member — verify removed
   - Click "Cancel" — verify form hides
   - Click "Next" — verify members saved via API
6. On Step 4 (Business Hours):
   - Toggle Sunday switch on — verify time inputs appear
   - Toggle a weekday switch off — verify "Closed" text appears
   - Click "Next" — verify hours saved via API
7. On Step 5 (Review):
   - Verify all 4 summary sections display correctly
   - Verify warning panel if phone or team members missing
   - Click "Activate Client" — verify activation and completion screen

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] No TypeScript type assertion errors in step-review.tsx
- [ ] All wizard routes registered: `/admin/clients/new`, `/admin/clients/new/wizard`
- [ ] Admin page links directly to wizard for new client creation

## 15-usage-tracking

### Schema Verification
- [ ] `api_usage` table exists with columns: id, client_id, service (enum), operation, model, input_tokens, output_tokens, units, cost_cents, lead_id, message_id, flow_execution_id, external_id, metadata, created_at
- [ ] `api_usage_daily` table exists with columns: id, client_id, date, service, total_requests, total_tokens_in, total_tokens_out, total_units, total_cost_cents, operation_breakdown, updated_at
- [ ] `api_usage_monthly` table exists with per-service cost columns and volume metrics
- [ ] `usage_alerts` table exists with alert_type, severity, message, details, acknowledged fields
- [ ] `api_service` enum has values: openai, twilio_sms, twilio_voice, twilio_phone, stripe, google_places, cloudflare_r2
- [ ] Unique index on `api_usage_daily(client_id, date, service)`
- [ ] Unique index on `api_usage_monthly(client_id, month)`
- [ ] Foreign keys cascade on client delete for all 4 tables

### Cost Configuration
- [ ] `src/lib/config/api-costs.ts` exists with pricing for all 7 services
- [ ] `calculateCostCents()` returns correct cents for OpenAI (input + output tokens)
- [ ] `calculateCostCents()` returns correct cents for Twilio SMS (per segment)
- [ ] `calculateCostCents()` returns correct cents for Stripe (percentage + fixed)
- [ ] Cost calculation handles missing/optional parameters gracefully

### Usage Tracking Service
- [ ] `trackUsage()` inserts record into `api_usage` table
- [ ] `trackUsage()` updates or creates `api_usage_daily` rollup record
- [ ] Daily rollup correctly aggregates operation breakdown as JSONB
- [ ] `getClientUsageSummary()` returns totalCostCents, byService, byDay, topOperations
- [ ] `getCurrentMonthUsage()` returns costCents, daysRemaining, projectedCostCents
- [ ] `updateMonthlySummaries()` upserts monthly records for all clients with usage
- [ ] Monthly summary includes previous month comparison and cost change percent

### Usage Alert Service
- [ ] `checkUsageAlerts()` creates warning alert at $50 threshold
- [ ] `checkUsageAlerts()` creates critical alert at $100 threshold
- [ ] Spike detection triggers when usage is 50%+ higher than previous month
- [ ] Projected overage triggers anomaly alert at 1.5x critical threshold
- [ ] Alert deduplication prevents duplicate alerts within 24 hours
- [ ] Critical alerts send SMS to admin phone number
- [ ] `acknowledgeAlert()` sets acknowledged=true with timestamp and user ID
- [ ] `checkAllClientAlerts()` iterates all active clients

### Tracked API Clients
- [ ] `chatCompletion()` in openai-tracked.ts calls OpenAI and tracks usage asynchronously
- [ ] `createEmbedding()` in openai-tracked.ts tracks token usage
- [ ] `sendTrackedSMS()` in twilio-tracked.ts sends SMS and tracks segment count
- [ ] `trackInboundSMS()` records inbound SMS usage (called from webhook)
- [ ] `trackPhoneProvisioning()` records phone number cost
- [ ] Tracking errors are caught and logged (don't block API responses)

### API Routes
- [ ] `GET /api/admin/usage` returns monthly usage for all clients with totals
- [ ] `GET /api/admin/usage?month=2026-02` filters by month parameter
- [ ] `GET /api/admin/usage/[clientId]` returns detailed usage with alerts and projections
- [ ] `GET /api/admin/usage/[clientId]?startDate=...&endDate=...` supports date range
- [ ] `POST /api/admin/usage/alerts/[id]/acknowledge` acknowledges an alert
- [ ] All usage API routes return 403 for non-admin users
- [ ] All usage API routes return valid JSON responses

### Usage Dashboard UI (`/admin/usage`)
- [ ] Page loads with admin authentication check (redirects non-admins)
- [ ] Month selector dropdown shows last 6 months
- [ ] Changing month re-fetches data from API
- [ ] Summary cards display: Total Cost, OpenAI cost, Twilio SMS cost, Avg per Client
- [ ] Client breakdown table shows: Client name, OpenAI cost, SMS cost, Total, vs Last Month
- [ ] Client name links to detail page `/admin/usage/[clientId]`
- [ ] Cost change badge shows trending up/down with percentage
- [ ] Empty state shown when no usage data for selected month

### Client Usage Detail UI (`/admin/usage/[clientId]`)
- [ ] Page loads with client name in header
- [ ] Back arrow navigates to `/admin/usage`
- [ ] Active alerts section shows with acknowledge button
- [ ] Acknowledging alert refreshes data
- [ ] Month to Date, Projected Total, Daily Average cards display correctly
- [ ] Cost by Service section shows progress bars with percentages
- [ ] Top Operations section shows operation name, call count, and cost
- [ ] 404 returned for invalid client ID

### Cron Integration
- [ ] Hourly cron triggers `updateMonthlySummaries()` when UTC minutes < 10
- [ ] Hourly cron triggers `checkAllClientAlerts()` after monthly summaries
- [ ] Cron errors are caught and logged (don't break other cron tasks)
- [ ] Usage tracking results included in cron response JSON

### Navigation
- [ ] "Usage" link appears in admin nav under Optimization group
- [ ] Link navigates to `/admin/usage`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/admin/usage`, `/admin/usage/[clientId]`
- [ ] API routes registered: `/api/admin/usage`, `/api/admin/usage/[clientId]`, `/api/admin/usage/alerts/[id]/acknowledge`
- [ ] No unused imports or variables

## 16-client-dashboard

### Schema: magic_link_tokens Table
- [ ] `magic_link_tokens` table exists in `src/db/schema/magic-link-tokens.ts`
- [ ] Columns: `id` (uuid PK), `clientId` (FK → clients.id, cascade), `token` (varchar 64, not null, unique)
- [ ] Columns: `expiresAt` (timestamp, not null), `usedAt` (timestamp, nullable), `createdAt` (timestamp, defaultNow)
- [ ] Index: `idx_magic_link_tokens_token` on `token`
- [ ] Exported types: `MagicLinkToken`, `NewMagicLinkToken`
- [ ] Exported from `src/db/schema/index.ts`
- [ ] Relation defined in `src/db/schema/relations.ts` (client: one → clients)
- [ ] `clientsRelations` includes `magicLinkTokens: many(magicLinkTokens)`

### Magic Link Service (src/lib/services/magic-link.ts)
- [ ] `generateToken()` returns a 64-character hex string
- [ ] `createMagicLink(clientId)` inserts token with 7-day expiry and returns URL
- [ ] Generated URL format: `${NEXT_PUBLIC_APP_URL}/d/${token}`
- [ ] `validateMagicLink(token)` returns `{ valid: true, clientId }` for valid unexpired tokens
- [ ] `validateMagicLink(token)` returns `{ valid: false, error }` for expired or invalid tokens
- [ ] `validateMagicLink(token)` marks token as used on first validation (sets `usedAt`)
- [ ] Token remains valid for reuse within 7-day expiry window
- [ ] `sendDashboardLink(clientId, phone, twilioNumber)` sends SMS with dashboard link
- [ ] All functions use `getDb()` per-request (not cached db instance)

### Dashboard Auth Route (src/app/d/[token]/route.ts)
- [ ] `GET /d/:token` route exists
- [ ] Validates token via `validateMagicLink()`
- [ ] Invalid/expired token redirects to `/link-expired`
- [ ] Valid token sets `clientSessionId` cookie (httpOnly, secure in prod, sameSite lax, 7-day maxAge)
- [ ] Valid token redirects to `/client`
- [ ] Uses Next.js 16 async params pattern (`Promise<{ token: string }>`)
- [ ] Uses `await cookies()` for cookie access

### Client Auth Helper (src/lib/client-auth.ts)
- [ ] `getClientSession()` reads `clientSessionId` from cookies
- [ ] Returns `null` when no cookie present
- [ ] Returns `null` when client not found in database
- [ ] Returns `{ clientId, client }` for valid session
- [ ] Uses `getDb()` per-request (not cached db instance)
- [ ] Uses `await cookies()` for cookie access

### Link Expired Page (src/app/(auth)/link-expired/page.tsx)
- [ ] Page exists at `/link-expired` under `(auth)` layout group
- [ ] Shows "Link Expired" title
- [ ] Shows message about expired/invalid link
- [ ] Instructs user to text "DASHBOARD" for a new link

### Client Dashboard Layout (src/app/(client)/layout.tsx)
- [ ] Layout exists under `(client)` route group
- [ ] Redirects to `/link-expired` when no client session
- [ ] Shows client business name in header (truncated to max 200px)
- [ ] Navigation has 3 links: Dashboard (`/client`), Conversations (`/client/conversations`), Team (`/client/team`)
- [ ] Sticky header with `z-10`
- [ ] Mobile-first design with `max-w-3xl` content area
- [ ] `bg-gray-50` background

### Client Dashboard Page (src/app/(client)/client/page.tsx)
- [ ] Redirects to `/link-expired` when no client session
- [ ] Shows 2 stat cards: "Leads This Month" and "Messages Sent"
- [ ] Stats aggregated from `dailyStats` for current month
- [ ] Leads count = `missedCallsCaptured + formsResponded`
- [ ] "Upcoming Appointments" card shows up to 5 scheduled appointments
- [ ] Appointments joined with leads table for name/phone display
- [ ] Only shows future appointments with status "scheduled"
- [ ] "Recent Leads" card shows up to 5 most recent leads
- [ ] Each lead shows name (or phone), source, and time ago
- [ ] Empty states shown when no appointments or leads exist
- [ ] Uses `getDb()` per-request (not cached db instance)
- [ ] Uses `formatDistanceToNow` from date-fns for time display

### DASHBOARD Text Command (src/lib/automations/incoming-sms.ts)
- [ ] Check added after finding client, before opt-out handling
- [ ] Matches `messageBody.toUpperCase() === 'DASHBOARD'`
- [ ] Calls `sendDashboardLink(client.id, senderPhone, client.twilioNumber)`
- [ ] Returns `{ processed: true, action: 'dashboard_link_sent' }`
- [ ] Uses dynamic import for magic-link service

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Verify `/link-expired` page renders with "Link Expired" message and DASHBOARD instruction
3. Verify `/client` redirects to `/link-expired` without a valid session cookie
4. As admin, create a magic link for a client via the service (or simulate SMS "DASHBOARD")
5. Visit `/d/<token>` — verify redirect to `/client` and cookie is set
6. On `/client` page — verify business name in header, nav links work
7. Verify stat cards show correct monthly aggregations
8. Verify upcoming appointments section (may be empty)
9. Verify recent leads section with time-ago display
10. Wait for token to expire (or use expired token) — verify redirect to `/link-expired`
11. Text "DASHBOARD" to a Twilio number — verify SMS response with dashboard link

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/d/[token]`, `/link-expired`, `/client`
- [ ] Schema file exists: `src/db/schema/magic-link-tokens.ts`
- [ ] Service file exists: `src/lib/services/magic-link.ts`
- [ ] Auth helper exists: `src/lib/client-auth.ts`
- [ ] No unused imports or variables

## 17-crm-conversations

### Schema: Conversation Mode on Leads
- [ ] `leads` table has `conversation_mode` column (varchar 10, default 'ai')
- [ ] `leads` table has `human_takeover_at` column (timestamp, nullable)
- [ ] `leads` table has `human_takeover_by` column (varchar 255, nullable)
- [ ] New columns exported via `Lead` type from `src/db/schema/leads.ts`

### Conversations List Page (`/client/conversations`)
- [ ] Page exists at `src/app/(client)/client/conversations/page.tsx`
- [ ] Redirects to `/link-expired` when no client session
- [ ] Lists up to 50 leads for the authenticated client, ordered by `createdAt` desc
- [ ] Each lead shows name (or phone), conversation mode badge (AI/Human/Paused)
- [ ] Shows last message preview from conversations table (uses `content` column)
- [ ] Shows message count per lead
- [ ] Shows time-ago for last message (or lead creation date if no messages)
- [ ] Red left border on leads with `actionRequired = true`
- [ ] Mode legend badges shown in header (AI blue, Human green)
- [ ] Empty state: "No conversations yet" when no leads exist
- [ ] Each lead card links to `/client/conversations/[id]`

### Conversation Detail Page (`/client/conversations/[id]`)
- [ ] Page exists at `src/app/(client)/client/conversations/[id]/page.tsx`
- [ ] Redirects to `/link-expired` when no client session
- [ ] Returns 404 for leads not belonging to the authenticated client
- [ ] Uses Next.js 16 async params pattern (`Promise<{ id: string }>`)
- [ ] Fetches messages ordered by `createdAt` ascending
- [ ] Passes lead and messages to `ConversationView` client component

### Conversation View Component
- [ ] File exists at `src/app/(client)/client/conversations/[id]/conversation-view.tsx`
- [ ] Marked as `'use client'` component
- [ ] Header shows lead name (or phone) with back arrow link to `/client/conversations`
- [ ] Shows conversation mode badge (AI blue, Human green)
- [ ] "Take Over" button visible in AI mode
- [ ] "Hand Back to AI" button visible in Human mode
- [ ] Messages displayed as chat bubbles: outbound right (blue), inbound left (gray)
- [ ] AI messages marked with "AI" prefix in timestamp
- [ ] Messages auto-scroll to bottom on load and new messages
- [ ] In Human mode: text input and Send button visible
- [ ] In AI mode: info card "AI is handling this conversation" shown instead of input
- [ ] Send button disabled while sending or when input is empty
- [ ] Enter key triggers send (without Shift)

### Takeover API (`POST /api/client/conversations/[id]/takeover`)
- [ ] Route exists at `src/app/api/client/conversations/[id]/takeover/route.ts`
- [ ] Returns 401 when no `clientSessionId` cookie
- [ ] Uses Next.js 16 async params and `await cookies()`
- [ ] Sets `conversationMode` to `'human'` on the lead
- [ ] Sets `humanTakeoverAt` to current timestamp
- [ ] Sets `humanTakeoverBy` to `'client'`
- [ ] Sets `actionRequired` to `false`
- [ ] Only updates leads matching both `id` and `clientId`
- [ ] Returns `{ success: true }`

### Handback API (`POST /api/client/conversations/[id]/handback`)
- [ ] Route exists at `src/app/api/client/conversations/[id]/handback/route.ts`
- [ ] Returns 401 when no `clientSessionId` cookie
- [ ] Uses Next.js 16 async params and `await cookies()`
- [ ] Sets `conversationMode` to `'ai'` on the lead
- [ ] Sets `humanTakeoverAt` to `null`
- [ ] Sets `humanTakeoverBy` to `null`
- [ ] Only updates leads matching both `id` and `clientId`
- [ ] Returns `{ success: true }`

### Send Message API (`POST /api/client/conversations/[id]/send`)
- [ ] Route exists at `src/app/api/client/conversations/[id]/send/route.ts`
- [ ] Returns 401 when no `clientSessionId` cookie
- [ ] Returns 400 when message is empty or missing
- [ ] Returns 404 when lead not found or doesn't belong to client
- [ ] Returns 400 when client has no Twilio number configured
- [ ] Sends SMS via `sendSMS(lead.phone, client.twilioNumber, message)`
- [ ] Saves conversation record with `direction: 'outbound'`, `messageType: 'contractor_response'`
- [ ] Returns `{ message: { id, direction, content, messageType, createdAt } }`
- [ ] Uses `getDb()` per-request pattern
- [ ] Request body typed as `{ message?: string }` (no `unknown` errors)

### Incoming SMS Human Mode Check
- [ ] `src/lib/automations/incoming-sms.ts` checks `lead.conversationMode === 'human'` after logging inbound message
- [ ] When in human mode: returns `{ processed: true, action: 'human_mode_saved' }` without AI processing
- [ ] Inbound message is still logged to conversations table even in human mode
- [ ] AI response, hot intent detection, and escalation logic are skipped in human mode

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Access client dashboard via magic link (`/d/<token>`)
3. Click "Conversations" in navigation — verify list page loads
4. Verify leads display with name/phone, mode badges, message counts, and time ago
5. Click into a conversation — verify message bubbles display correctly
6. Outbound messages should appear on the right (blue), inbound on the left (gray)
7. Click "Take Over" — verify mode badge changes to "Human" and text input appears
8. Type a message and press Enter or click Send — verify message appears in chat
9. Click "Hand Back to AI" — verify mode changes back to "AI" and input disappears
10. Verify back arrow navigation returns to conversations list
11. Verify conversations list shows correct mode for the lead after takeover/handback
12. Send an SMS to the client's Twilio number while lead is in human mode — verify AI does NOT auto-respond

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/client/conversations`, `/client/conversations/[id]`
- [ ] API routes registered: `/api/client/conversations/[id]/takeover`, `/api/client/conversations/[id]/handback`, `/api/client/conversations/[id]/send`
- [ ] No unused imports or variables

## 18-weekly-sms-summary

### Schema: Weekly Summary Preferences on Clients
- [ ] `clients` table has `weekly_summary_enabled` boolean column (default: true)
- [ ] `clients` table has `weekly_summary_day` integer column (default: 1 for Monday)
- [ ] `clients` table has `weekly_summary_time` varchar(5) column (default: '08:00')
- [ ] `clients` table has `last_weekly_summary_at` timestamp column (nullable)
- [ ] New columns exported via `Client` type from `src/db/schema/clients.ts`

### Weekly Summary Service (src/lib/services/weekly-summary.ts)
- [ ] `getWeeklyStats(clientId)` returns stats for the last 7 days
- [ ] Stats include: leadsCapture (missedCalls + forms), messagesSent, appointmentsBooked
- [ ] Stats include: escalationsClaimed, topTeamMember name, topTeamMemberClaims count
- [ ] Escalation stats use inner join on `escalation_claims` and `team_members` tables
- [ ] `formatWeeklySMS()` returns formatted SMS string with leads, messages, appointments
- [ ] SMS includes top team member if available
- [ ] SMS includes dashboard link at the end
- [ ] `formatWeeklyEmail()` returns `{ subject, html }` with styled HTML email
- [ ] Email includes leads captured, messages sent, appointments (if > 0), top performer
- [ ] Email includes "View Full Dashboard" button linking to magic link
- [ ] `sendWeeklySummary(clientId)` sends both SMS and email to the client
- [ ] SMS sent only when client has `phone` AND `twilioNumber` configured
- [ ] Email sent only when client has `email` configured
- [ ] Creates magic link via `createMagicLink()` for dashboard access
- [ ] Updates `lastWeeklySummaryAt` after sending
- [ ] Skips sending if `weeklySummaryEnabled` is false
- [ ] `processWeeklySummaries()` finds eligible clients by day of week and status
- [ ] Only processes clients with matching `weeklySummaryDay` and `status: 'active'`
- [ ] Checks `weeklySummaryTime` hour matches current hour
- [ ] Skips clients who received summary within last 6 days (prevents duplicates)
- [ ] Returns count of summaries sent
- [ ] Errors for individual clients are caught and logged (don't block other clients)
- [ ] All functions use `getDb()` per-request (not cached db instance)

### Cron Route (src/app/api/cron/weekly-summary/route.ts)
- [ ] `GET /api/cron/weekly-summary` endpoint exists
- [ ] Verifies `CRON_SECRET` via Authorization Bearer header
- [ ] Returns 401 when secret is missing or doesn't match
- [ ] Calls `processWeeklySummaries()` from the service
- [ ] Returns `{ success: true, sent: <count> }` on success
- [ ] Returns 500 with error on failure
- [ ] Existing cron orchestrator (`/api/cron/route.ts`) already calls this on Monday 7am UTC

### Client Settings Page (src/app/(client)/client/settings/page.tsx)
- [ ] Page exists at `/client/settings` under `(client)` layout group
- [ ] Redirects to `/link-expired` when no client session
- [ ] Shows "Settings" heading
- [ ] Card with "Weekly Summary" title
- [ ] Passes current `weeklySummaryEnabled`, `weeklySummaryDay`, `weeklySummaryTime` to component

### Summary Settings Component (src/app/(client)/client/settings/summary-settings.tsx)
- [ ] Marked as `'use client'` component
- [ ] Switch toggle for "Receive weekly summary" (enabled/disabled)
- [ ] When enabled: shows day-of-week selector (Sunday through Saturday)
- [ ] When enabled: shows time selector (06:00 through 12:00)
- [ ] When disabled: hides day and time selectors
- [ ] "Save" button calls `PUT /api/client/settings/summary`
- [ ] Button shows "Saving..." while request is in flight
- [ ] Button shows "Saved!" after successful save
- [ ] Page refreshes after save via `router.refresh()`

### Settings API Route (src/app/api/client/settings/summary/route.ts)
- [ ] `PUT /api/client/settings/summary` endpoint exists
- [ ] Returns 401 when no `clientSessionId` cookie
- [ ] Validates input with Zod: `enabled` (boolean), `day` (0-6 int), `time` (HH:MM format)
- [ ] Returns 400 with validation details on invalid input
- [ ] Updates `weeklySummaryEnabled`, `weeklySummaryDay`, `weeklySummaryTime` on client
- [ ] Updates `updatedAt` timestamp
- [ ] Returns `{ success: true }` on success
- [ ] Returns 500 on unexpected errors

### Client Layout Navigation
- [ ] "Settings" link appears in client nav bar
- [ ] Nav items: Dashboard, Conversations, Team, Settings
- [ ] Settings link navigates to `/client/settings`

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Access client dashboard via magic link (`/d/<token>`)
3. Click "Settings" in navigation — verify settings page loads
4. Verify "Weekly Summary" card displays with switch, day, and time selectors
5. Toggle the switch off — verify day and time selectors disappear
6. Toggle switch back on — verify selectors reappear with previous values
7. Change day to "Friday" and time to "09:00"
8. Click "Save" — verify button shows "Saving..." then "Saved!"
9. Refresh the page — verify settings persisted (Friday, 09:00)
10. Toggle switch off and save — verify persisted on refresh
11. Manually test cron:
    ```bash
    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/weekly-summary
    ```
12. Verify response includes `{ success: true, sent: <number> }`
13. Without auth header, verify 401 response:
    ```bash
    curl http://localhost:3000/api/cron/weekly-summary
    ```

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/client/settings`, `/api/client/settings/summary`, `/api/cron/weekly-summary`
- [ ] Service file exists: `src/lib/services/weekly-summary.ts`
- [ ] No unused imports or variables

## 19-flow-schema-templates

### Schema: Flow Enums (src/db/schema/flow-enums.ts)
- [ ] `flow_category` enum exists with values: missed_call, form_response, estimate, appointment, payment, review, referral, custom
- [ ] `flow_trigger` enum exists with values: webhook, scheduled, manual, ai_suggested
- [ ] `flow_approval` enum exists with values: auto, suggest, ask_sms
- [ ] `flow_sync_mode` enum exists with values: inherit, override, detached

### Schema: flow_templates Table (src/db/schema/flow-templates.ts)
- [ ] `flow_templates` table exists with columns: id, name, slug (unique), description, category (enum)
- [ ] Versioning columns: version (default 1), is_published (default false), published_at
- [ ] Default columns: default_trigger (enum, default 'manual'), default_approval_mode (enum, default 'auto')
- [ ] Metadata columns: usage_count (default 0), tags (JSONB string[])
- [ ] Timestamps: created_at (defaultNow), updated_at (defaultNow)
- [ ] Primary key uses `uuid_generate_v4()` default
- [ ] Exported types: `FlowTemplate`, `NewFlowTemplate`

### Schema: flow_template_steps Table
- [ ] `flow_template_steps` table exists with columns: id, template_id (FK → flow_templates, cascade delete)
- [ ] Step columns: step_number (integer, not null), name (varchar 100), delay_minutes (default 0)
- [ ] Message column: message_template (text, not null)
- [ ] Conditions: skip_conditions (JSONB with ifReplied, ifScheduled, ifPaid, custom fields)
- [ ] Timestamp: created_at (defaultNow)
- [ ] Exported types: `FlowTemplateStep`, `NewFlowTemplateStep`

### Schema: flow_template_versions Table
- [ ] `flow_template_versions` table exists with columns: id, template_id (FK → flow_templates, cascade delete), version (integer)
- [ ] Snapshot column: snapshot (JSONB with name and steps array)
- [ ] Metadata: change_notes (text), published_at (defaultNow), published_by (uuid)
- [ ] Exported types: `FlowTemplateVersion`, `NewFlowTemplateVersion`

### Schema: flows Table (src/db/schema/flows.ts)
- [ ] `flows` table exists with columns: id, client_id (FK → clients, cascade delete)
- [ ] Identity: name (varchar 100, not null), description, category (enum)
- [ ] Template linking: template_id (FK → flow_templates, set null), template_version, sync_mode (enum, default 'inherit')
- [ ] Trigger config: trigger (enum, not null, default 'manual'), approval_mode (enum, default 'auto')
- [ ] AI conditions: ai_trigger_conditions (JSONB with signals, minConfidence, keywords)
- [ ] Status: is_active (default true), priority (default 0)
- [ ] Indexes: `flows_template_idx` on template_id, `flows_client_idx` on client_id
- [ ] Exported types: `Flow`, `NewFlow`

### Schema: flow_steps Table
- [ ] `flow_steps` table exists with columns: id, flow_id (FK → flows, cascade delete)
- [ ] Template linking: template_step_id (FK → flow_template_steps, set null)
- [ ] Step config: step_number (not null), name (varchar 100)
- [ ] Template fallback: use_template_delay (default true), custom_delay_minutes, use_template_message (default true), custom_message
- [ ] Conditions: skip_conditions (JSONB), is_active (default true)
- [ ] Exported types: `FlowStep`, `NewFlowStep`

### Schema: flow_executions Table (src/db/schema/flow-executions.ts)
- [ ] `flow_executions` table with: id, flow_id (set null), lead_id (cascade), client_id (cascade)
- [ ] Status tracking: status (default 'active'), current_step (default 1), total_steps
- [ ] Timing: started_at, completed_at, cancelled_at, cancel_reason, next_step_at
- [ ] Trigger: triggered_by, triggered_by_user_id
- [ ] Approval: approval_status, approval_requested_at, approval_responded_at, approved_by
- [ ] Context: metadata (JSONB)
- [ ] Indexes: flow_executions_lead_idx, flow_executions_status_idx, flow_executions_client_idx
- [ ] Exported types: `FlowExecution`, `NewFlowExecution`

### Schema: flow_step_executions Table
- [ ] Table with: id, flow_execution_id (cascade), flow_step_id (set null), step_number (not null)
- [ ] Status: status (default 'pending'), scheduled_at, executed_at
- [ ] Message: message_content, message_sid (varchar 50)
- [ ] Error handling: skip_reason, error (text), retry_count (default 0)
- [ ] Exported types: `FlowStepExecution`, `NewFlowStepExecution`

### Schema: suggested_actions Table
- [ ] Table with: id, lead_id (cascade), client_id (cascade), flow_id (cascade)
- [ ] Detection: detected_signal, confidence (0-100), reason, trigger_message_id
- [ ] Status: status (default 'pending'), created_at, expires_at, responded_at, responded_by
- [ ] Execution link: flow_execution_id (FK → flow_executions)
- [ ] Indexes: suggested_actions_lead_idx, suggested_actions_status_idx
- [ ] Exported types: `SuggestedAction`, `NewSuggestedAction`

### Schema: Relations (src/db/schema/relations.ts)
- [ ] `flowTemplatesRelations` defines: steps (many), versions (many), flows (many)
- [ ] `flowTemplateStepsRelations` defines: template (one → flowTemplates)
- [ ] `flowTemplateVersionsRelations` defines: template (one → flowTemplates)
- [ ] `flowsRelations` defines: client (one), template (one), steps (many), executions (many), suggestedActions (many)
- [ ] `flowStepsRelations` defines: flow (one), templateStep (one)
- [ ] `flowExecutionsRelations` defines: flow (one), lead (one), client (one), stepExecutions (many)
- [ ] `flowStepExecutionsRelations` defines: execution (one), step (one)
- [ ] `suggestedActionsRelations` defines: lead (one), client (one), flow (one), flowExecution (one)
- [ ] `clientsRelations` updated with: flows (many), flowExecutions (many), suggestedActions (many)
- [ ] `leadsRelations` updated with: flowExecutions (many), suggestedActions (many)

### Schema: Exports
- [ ] All new tables exported from `src/db/schema/index.ts`
- [ ] All enums exported from `src/db/schema/index.ts`
- [ ] Types exported from `src/db/types.ts`: FlowTemplate, Flow, FlowStep, FlowExecution, FlowStepExecution, SuggestedAction (+ New* variants)

### Flow Templates Service (src/lib/services/flow-templates.ts)
- [ ] `createTemplate(input)` creates template + steps, returns template record
- [ ] `updateTemplateStep(stepId, updates)` updates a single step
- [ ] `addTemplateStep(templateId, step)` adds a step to template, returns new step
- [ ] `deleteTemplateStep(stepId)` deletes step and renumbers remaining steps
- [ ] `publishTemplate(templateId, changeNotes?, publishedBy?)` creates version snapshot and increments version
- [ ] Publish updates: version, isPublished, publishedAt, updatedAt on template
- [ ] `getTemplateUsage(templateId)` returns all flows using the template
- [ ] `pushTemplateUpdate(templateId, options?)` pushes updates to client flows
- [ ] Push skips detached flows with reason "Flow is detached from template"
- [ ] Push skips flows already on latest version with reason "Already on latest version"
- [ ] Push 'inherit' mode: deletes and recreates all steps from template
- [ ] Push 'override' mode: only adds new steps from template, preserves custom overrides
- [ ] Push updates usageCount on template
- [ ] Push supports `dryRun` option (no DB writes)
- [ ] `createFlowFromTemplate(clientId, templateId, options?)` creates flow + steps linked to template
- [ ] Flow creation increments template usageCount
- [ ] `createCustomFlow(clientId, input)` creates detached flow with custom steps
- [ ] Custom flow steps use `useTemplateDelay: false`, `useTemplateMessage: false`
- [ ] `detachFlowFromTemplate(flowId)` converts template values to custom values
- [ ] Detach decrements template usageCount
- [ ] All functions use `getDb()` per-request (not cached db instance)

### Flow Resolution Service (src/lib/services/flow-resolution.ts)
- [ ] `resolveFlowSteps(flowId)` returns resolved steps with template fallbacks
- [ ] Returns correct `delayMinutes` from template when `useTemplateDelay` is true
- [ ] Returns correct `messageTemplate` from template when `useTemplateMessage` is true
- [ ] Returns custom values when `useTemplate*` flags are false
- [ ] Returns `source: 'template'` when both delay and message come from template
- [ ] Returns `source: 'custom'` when both are custom
- [ ] Returns `source: 'mixed'` when one is template and one is custom
- [ ] `getStepMessage(stepId, variables)` returns message with `{variable}` substitution
- [ ] Variable substitution replaces all occurrences of `{key}` with value
- [ ] `formatDelay(minutes)` returns 'Immediately' for 0
- [ ] `formatDelay(minutes)` returns 'X hours before' for negative values
- [ ] `formatDelay(minutes)` returns human-readable days/hours/minutes
- [ ] All async functions use `getDb()` per-request

### Seed Script (scripts/seed-flow-templates.ts)
- [ ] Script defines 8 default templates: estimate-standard, estimate-aggressive, payment-friendly, payment-firm, review-simple, review-with-reminder, referral-standard, appointment-reminder
- [ ] Each template has correct category assignment
- [ ] Each template has appropriate step delays (e.g., estimate-standard: 0, 2d, 5d, 14d)
- [ ] Skip conditions set correctly (ifReplied, ifScheduled, ifPaid)
- [ ] Payment templates use `ask_sms` approval mode
- [ ] Review/referral templates use `ai_suggested` trigger
- [ ] Appointment template uses `scheduled` trigger with negative delay (-24h for day-before)
- [ ] Script checks for existing templates by slug before inserting (idempotent)
- [ ] Script publishes each template after creation
- [ ] Script can be run with: `npx tsx scripts/seed-flow-templates.ts`

### Manual Verification Steps
1. Run `npm run build` — verify 0 TypeScript errors
2. Verify schema files exist:
   - `src/db/schema/flow-enums.ts`
   - `src/db/schema/flow-templates.ts`
   - `src/db/schema/flows.ts`
   - `src/db/schema/flow-executions.ts`
3. Verify service files exist:
   - `src/lib/services/flow-templates.ts`
   - `src/lib/services/flow-resolution.ts`
4. Verify seed script exists: `scripts/seed-flow-templates.ts`
5. Verify all new tables exported from `src/db/schema/index.ts`
6. Verify all new types exported from `src/db/types.ts`
7. Verify relations added to `src/db/schema/relations.ts` for all new tables
8. After running migration:
   - Run `npx tsx scripts/seed-flow-templates.ts`
   - Verify 8 templates created with `SELECT * FROM flow_templates;`
   - Verify template steps created with `SELECT * FROM flow_template_steps ORDER BY template_id, step_number;`
   - Verify version snapshots with `SELECT * FROM flow_template_versions;`
9. Test import paths resolve correctly:
   ```ts
   import { flowTemplates, flows, flowExecutions, suggestedActions } from '@/db';
   import { createTemplate, publishTemplate } from '@/lib/services/flow-templates';
   import { resolveFlowSteps, getStepMessage, formatDelay } from '@/lib/services/flow-resolution';
   ```

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] No new TypeScript warnings related to flow schemas or services
- [ ] Existing routes still registered (no regressions)

---

## 20-flow-builder-ui

### Template Library Page (`/admin/flow-templates`)
- [ ] Page loads and displays seeded templates grouped by category
- [ ] Category icons render correctly (Phone for missed_call, FileText for estimate, etc.)
- [ ] Each template card shows: name, description, version badge, published/draft status
- [ ] Usage count shows number of clients using the template
- [ ] Tags display as small badges on each card
- [ ] "Updated X ago" timestamp shows correctly
- [ ] "New Template" button links to `/admin/flow-templates/new`
- [ ] Empty state shows "No templates yet" with create button if no templates exist
- [ ] Dropdown menu on each card has: Edit, Push Update, Duplicate, Delete actions
- [ ] Edit links to `/admin/flow-templates/{id}`
- [ ] Push Update links to `/admin/flow-templates/{id}/push`

### Template Editor - New (`/admin/flow-templates/new`)
- [ ] Page loads with empty form and one default step
- [ ] Back arrow returns to template library
- [ ] Name field auto-generates slug when typing
- [ ] All form fields editable: name, slug, description, category, trigger, approval mode, tags
- [ ] Category dropdown shows all 8 categories
- [ ] Trigger dropdown shows: Manual, AI Suggested, Automatic (webhook), Scheduled
- [ ] Approval mode dropdown shows: Auto-execute, Show in CRM, Ask via SMS
- [ ] "Add Step" button adds a new step with 1-day default delay
- [ ] Validation: "Save Draft" shows error toast if name, slug, or category empty
- [ ] Validation: "Save Draft" shows error toast if any step has empty message
- [ ] After saving, redirects to edit page `/admin/flow-templates/{id}`
- [ ] Toast notification "Template saved!" on successful save

### Template Editor - Edit (`/admin/flow-templates/{id}`)
- [ ] Page loads with existing template data pre-filled
- [ ] Header shows "Edit: {template name}" with version and published/draft status
- [ ] "Save Draft" updates the template via PATCH API
- [ ] "Publish" button visible (hidden on new templates)
- [ ] Publishing increments version and shows success toast
- [ ] Tags comma-separated input populates correctly from existing tags

### Sequence View (Step Editor)
- [ ] Steps display in numbered order with step number circles
- [ ] Connection lines visible between steps
- [ ] Clicking a step expands it (collapses others)
- [ ] Expanded step has ring-2 ring-primary highlight
- [ ] Step name editable via input field
- [ ] Delay configurable with number input and unit dropdown (minutes/hours/days)
- [ ] Delay converts correctly between units (e.g., 1440 minutes = 1 day)
- [ ] Message textarea editable with placeholder variables shown
- [ ] Skip conditions checkboxes: "Lead replied", "Appointment scheduled", "Payment received"
- [ ] Move up/down buttons reorder steps and renumber them
- [ ] First step has disabled "Move up", last step has disabled "Move down"
- [ ] Delete button removes step and renumbers remaining steps
- [ ] Delete button hidden when only 1 step exists
- [ ] Collapsed step shows step name, delay summary, and expand chevron

### Push Update Page (`/admin/flow-templates/{id}/push`)
- [ ] Page loads with template name and version in header
- [ ] Summary cards show: Total using template, Will update (inherit), Partial update (override), Won't update (detached)
- [ ] Client list shows all flows using this template
- [ ] Each client row shows: green checkmark (will update) or gray X (won't), client name, flow name
- [ ] Sync mode badge (inherit/override/detached) displays per client
- [ ] Outdated version badge shows "vX → vY" for clients behind
- [ ] "Preview Changes" button performs dry run and shows results
- [ ] "Push to N Clients" button pushes update and shows success toast
- [ ] Push button disabled when no outdated clients
- [ ] Loading spinner shows during push operation
- [ ] Result card shows affected/skipped counts after push
- [ ] Empty state message when no clients use the template

### API Routes
- [ ] `GET /api/admin/flow-templates` returns all templates (admin only, 403 for non-admin)
- [ ] `POST /api/admin/flow-templates` creates template with steps (validates with Zod)
- [ ] `GET /api/admin/flow-templates/{id}` returns template with steps
- [ ] `PATCH /api/admin/flow-templates/{id}` updates template and replaces steps
- [ ] `DELETE /api/admin/flow-templates/{id}` deletes template
- [ ] `POST /api/admin/flow-templates/{id}/publish` publishes template, increments version
- [ ] `POST /api/admin/flow-templates/{id}/push` pushes update to client flows
- [ ] `POST /api/admin/flow-templates/{id}/push?dryRun=true` previews without applying
- [ ] All endpoints return 403 for non-admin users

### Navigation
- [ ] "Flow Templates" link appears in admin nav under Optimization group
- [ ] Link navigates to `/admin/flow-templates`
- [ ] Link styled consistently with other admin nav items (amber color scheme)

### Toast Notifications
- [ ] Sonner Toaster renders in root layout
- [ ] Success toasts show in green for save, publish, push actions
- [ ] Error toasts show in red for validation and API failures

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] Routes registered: `/admin/flow-templates`, `/admin/flow-templates/[id]`, `/admin/flow-templates/[id]/push`
- [ ] API routes registered: `/api/admin/flow-templates`, `/api/admin/flow-templates/[id]`, `/api/admin/flow-templates/[id]/publish`, `/api/admin/flow-templates/[id]/push`
- [ ] No regressions in existing routes

## 21-ai-flow-triggering

### Signal Detection Service
- [ ] `detectSignals()` accepts conversation history array and returns DetectedSignals
- [ ] Returns all 10 boolean signal fields (readyToSchedule, wantsEstimate, etc.)
- [ ] Returns confidence score (0-100) and rawSignals array
- [ ] Uses GPT-4o-mini with JSON response format
- [ ] Only analyzes last 10 messages for efficiency
- [ ] Returns all-false defaults on error (does not throw)
- [ ] `mapSignalsToFlows()` maps readyToSchedule to "Schedule Appointment"
- [ ] `mapSignalsToFlows()` maps wantsEstimate to "Estimate Follow-up"
- [ ] `mapSignalsToFlows()` maps satisfied to "Review Request"
- [ ] `mapSignalsToFlows()` maps referralMention to "Referral Request"
- [ ] `mapSignalsToFlows()` maps paymentMention to "Payment Reminder"

### Flow Suggestion Service
- [ ] `checkAndSuggestFlows()` detects signals and creates suggested_actions records
- [ ] Skips when confidence < 60
- [ ] Only matches flows with trigger='ai_suggested' and isActive=true
- [ ] Does not create duplicate pending suggestions for same lead+flow
- [ ] Sets 24-hour expiration on suggestions
- [ ] Sends SMS approval to client owner when flow has approvalMode='ask_sms'
- [ ] Approval SMS includes short suggestion ID (first 8 chars)
- [ ] `handleApprovalResponse()` detects YES/NO + 8-char ID patterns
- [ ] YES response sets status='approved', respondedBy='sms', starts flow
- [ ] NO response sets status='rejected', respondedBy='sms'
- [ ] Non-matching messages return { handled: false }

### Flow Execution Service
- [ ] `startFlowExecution()` resolves flow steps via flow-resolution service
- [ ] Creates flow_executions record with status='active'
- [ ] Executes first step immediately if delayMinutes=0
- [ ] Schedules first step if delayMinutes > 0
- [ ] Substitutes {leadName}, {businessName}, {ownerName} variables in messages
- [ ] Creates flow_step_executions records with sent/failed/skipped status
- [ ] Handles missing phone or message gracefully (skips step)

### Incoming SMS Integration
- [ ] Approval responses from client owner phone are intercepted before opt-out check
- [ ] `handleApprovalResponse()` called when sender matches client.phone
- [ ] Returns early with action result if approval was handled
- [ ] `checkAndSuggestFlows()` fires asynchronously after AI response
- [ ] Flow suggestion errors are caught and logged (do not break SMS handling)

### Suggested Actions API
- [ ] `GET /api/client/leads/{id}/suggestions` returns suggestions with flow name
- [ ] Returns 401 if clientSessionId cookie is missing
- [ ] Returns up to 10 suggestions ordered by createdAt desc
- [ ] `POST /api/client/leads/{id}/suggestions` accepts approve/reject action
- [ ] Returns 400 for missing suggestionId or invalid action
- [ ] Approve sets status='approved', respondedBy='crm', starts flow execution
- [ ] Reject sets status='rejected', respondedBy='crm'

### Conversation View UI
- [ ] Suggestions fetched on mount via /api/client/leads/{id}/suggestions
- [ ] Only pending suggestions displayed
- [ ] Each suggestion shows flow name and detection reason
- [ ] "Send" button approves suggestion and removes from list
- [ ] "Dismiss" button rejects suggestion and removes from list
- [ ] Suggestions appear between messages and input area
- [ ] Suggestions styled as blue cards (bg-blue-50, border-blue-200)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] Route registered: `/api/client/leads/[id]/suggestions`
- [ ] No regressions in existing routes

---

## 22-flow-metrics

### Schema Tables
- [ ] `template_metrics_daily` table exists in `src/db/schema/template-metrics-daily.ts`
- [ ] Has unique index on `(templateId, date)` to enable upsert
- [ ] Tracks volume: `executionsStarted`, `executionsCompleted`, `executionsCancelled`
- [ ] Tracks messages: `messagesSent`, `messagesDelivered`, `messagesFailed`
- [ ] Tracks engagement: `leadsResponded`, `totalResponses`, `avgResponseTimeMinutes`
- [ ] Tracks conversions: `conversions`, `conversionValue` (decimal)
- [ ] Tracks opt-outs: `optOuts`
- [ ] `template_step_metrics` table exists in `src/db/schema/template-step-metrics.ts`
- [ ] Has unique index on `(templateId, stepNumber, date)`
- [ ] Tracks `messagesSent`, `responsesReceived`, `skipped` per step per day
- [ ] `client_flow_outcomes` table exists in `src/db/schema/client-flow-outcomes.ts`
- [ ] Has unique index on `(clientId, flowId, period)`
- [ ] Tracks `leadsContacted`, `leadsResponded`, `conversions`, `revenue`
- [ ] All three tables exported from `src/db/schema/index.ts`

### Metrics Collection Service (`src/lib/services/flow-metrics.ts`)
- [ ] `recordExecutionStart(templateId)` upserts daily `executionsStarted` count
- [ ] `recordExecutionComplete(templateId, converted, value)` upserts `executionsCompleted` and conditionally increments `conversions`
- [ ] `recordStepMessageSent(templateId, stepNumber)` upserts both daily and step-level metrics
- [ ] `recordLeadResponse(templateId, stepNumber, responseTime)` updates response counts and running average
- [ ] `recordOptOut(templateId)` increments daily opt-out counter
- [ ] `getTemplatePerformance(templateId, days)` returns aggregate stats with completion/response/conversion/opt-out rates
- [ ] `getTemplatePerformance` returns `stepPerformance` array with per-step response rates
- [ ] `compareTemplates(category, days)` returns all templates in category with rates
- [ ] `getClientOutcomes(clientId, period)` returns outcomes grouped by flow category
- [ ] `updateClientOutcomes(clientId, flowId, period, updates)` upserts client outcomes
- [ ] All functions use `getDb()` per-request pattern
- [ ] All SQL aggregates use `COALESCE` for null safety

### Analytics API Routes
- [ ] `GET /api/admin/analytics/templates` returns 403 for non-admin users
- [ ] Requires `category` query param, returns 400 if missing
- [ ] Accepts optional `days` param (defaults to 30)
- [ ] Returns array of template comparison data with rates
- [ ] `GET /api/admin/analytics/templates/[id]` returns 403 for non-admin users
- [ ] Returns detailed template performance with step-level data
- [ ] Uses `Promise<{ id: string }>` for async params (Next.js 16)
- [ ] `GET /api/clients/[id]/outcomes` returns 401 for unauthenticated users
- [ ] Returns client outcomes with missed calls, estimates, payments, reviews

### Admin Analytics Dashboard (`/admin/analytics`)
- [ ] Page renders at `/admin/analytics` route
- [ ] Page uses `force-dynamic` to prevent build-time DB query
- [ ] Fetches distinct template categories from database
- [ ] Renders `CategoryPerformance` component for each category
- [ ] Shows empty state when no templates exist
- [ ] "Analytics" link appears in admin navigation under Optimization group

### Category Performance Component
- [ ] Fetches comparison data from `/api/admin/analytics/templates?category=X&days=Y`
- [ ] Renders table with Template, Executions, Response Rate, Conversion Rate, Opt-out Rate
- [ ] Date range toggles: 7d, 30d, 90d buttons
- [ ] Low-volume warning shown when total executions < 100
- [ ] Crown icon on best-performing template (only when >= 100 executions)
- [ ] "Best performer" banner with conversion rate comparison (only when >= 100 executions and 2+ templates)
- [ ] Metric cells show color: green for good, red for bad (inverse for opt-out rate)
- [ ] Arrow button links to template detail page
- [ ] Returns null (hidden) when no templates in category

### Template Detail Stats Component
- [ ] Fetches data from `/api/admin/analytics/templates/{id}`
- [ ] Displays 4 summary cards: Executions, Response Rate, Conversion Rate, Opt-out Rate
- [ ] Step performance shown as horizontal bar chart
- [ ] Bar width proportional to max response rate in steps
- [ ] Each bar shows percentage label and "X sent" count
- [ ] Insights section with conditional messages:
  - Strong first message (Step 1 response > 20%)
  - Low initial response (Step 1 response < 10%)
  - High opt-out rate warning (> 3%)
  - Above average conversion note (> 15%)
  - Empty state when no executions

### Client Outcomes Widget
- [ ] Fetches from `/api/clients/{id}/outcomes`
- [ ] 4 outcome cards: Missed Calls (blue), Estimates (green), Payments (emerald), Reviews (yellow)
- [ ] Each card shows count/total and rate percentage
- [ ] Payment card shows dollar amount
- [ ] Loading state while fetching

### Flow Execution Integration
- [ ] `startFlowExecution` looks up flow's `templateId`
- [ ] Calls `recordExecutionStart(templateId)` after creating execution
- [ ] Calls `updateClientOutcomes` with `leadsContacted: 1`
- [ ] `executeStep` receives `templateId` parameter
- [ ] Calls `recordStepMessageSent(templateId, stepNumber)` after successful SMS
- [ ] Metrics calls wrapped in `.catch(console.error)` to not block flow execution

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] Routes registered: `/admin/analytics`, `/api/admin/analytics/templates`, `/api/admin/analytics/templates/[id]`, `/api/clients/[id]/outcomes`
- [ ] No regressions in existing routes

## 23-knowledge-schema

### Schema Verification
- [ ] `knowledge_base` table exists with columns: `id`, `client_id`, `category`, `title`, `content`, `keywords`, `priority`, `is_active`, `created_at`, `updated_at`
- [ ] `knowledge_category` pgEnum created with values: `services`, `pricing`, `faq`, `policies`, `about`, `custom`
- [ ] `client_id` has FK to `clients.id` with `ON DELETE CASCADE`
- [ ] Indexes exist: `idx_knowledge_base_client_id`, `idx_knowledge_base_category`
- [ ] `knowledgeBase` exported from `src/db/schema/index.ts`
- [ ] `knowledgeBaseRelations` defined in `relations.ts` (one → clients)
- [ ] `knowledgeBase` added to `clientsRelations` many array

### Knowledge Base Service
- [ ] `getClientKnowledge(clientId)` returns active entries ordered by priority desc, then category
- [ ] `searchKnowledge(clientId, query)` filters by title, content, and keywords using ilike
- [ ] `searchKnowledge` ignores search terms with 2 or fewer characters
- [ ] `searchKnowledge` returns max 10 results
- [ ] `buildKnowledgeContext(clientId)` returns formatted string with business name header
- [ ] `buildKnowledgeContext` groups entries by category with section labels
- [ ] `buildKnowledgeContext` returns empty string if client not found
- [ ] `initializeClientKnowledge(clientId)` creates 5 default entries for new clients
- [ ] `initializeClientKnowledge` is idempotent (skips if entries already exist)
- [ ] `addKnowledgeEntry` inserts and returns new entry ID
- [ ] `updateKnowledgeEntry` updates fields and sets `updatedAt`
- [ ] `deleteKnowledgeEntry` hard-deletes the entry

### API Routes — GET /api/admin/clients/[id]/knowledge
- [ ] Returns 403 if user is not admin
- [ ] Initializes default knowledge if none exists for client
- [ ] Returns `{ entries }` array of active knowledge entries
- [ ] Handles server errors with 500 response

### API Routes — POST /api/admin/clients/[id]/knowledge
- [ ] Returns 403 if user is not admin
- [ ] Validates body with Zod: `category` (enum), `title` (min 1), `content` (min 1), optional `keywords`, optional `priority`
- [ ] Returns 400 with validation details on invalid input
- [ ] Returns `{ id }` of created entry on success
- [ ] Handles server errors with 500 response

### API Routes — PATCH /api/admin/clients/[id]/knowledge/[entryId]
- [ ] Returns 403 if user is not admin
- [ ] Validates body with Zod: all fields optional
- [ ] Updates only provided fields plus `updatedAt`
- [ ] Returns `{ success: true }` on success

### API Routes — DELETE /api/admin/clients/[id]/knowledge/[entryId]
- [ ] Returns 403 if user is not admin
- [ ] Hard-deletes the knowledge entry
- [ ] Returns `{ success: true }` on success

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] `Compiled successfully` in build output
- [ ] Routes registered: `/api/admin/clients/[id]/knowledge`, `/api/admin/clients/[id]/knowledge/[entryId]`
- [ ] No regressions in existing routes

## 24-knowledge-ui

### Knowledge Base Page (`/admin/clients/[id]/knowledge`)
- [ ] Page loads for admin users
- [ ] Non-admin users are redirected to `/dashboard`
- [ ] Client business name is displayed in the header
- [ ] "Back" button links to `/admin/clients/[id]`
- [ ] "+ Add Entry" button links to `/admin/clients/[id]/knowledge/new`
- [ ] Blue info box explains how AI uses knowledge base
- [ ] Default knowledge entries are auto-initialized on first visit
- [ ] Entries are grouped by category (About, Services, Pricing, Policies, FAQ, Custom)
- [ ] Each category shows a colored badge and entry count
- [ ] Entry content is truncated at 200 characters with "..."
- [ ] Keywords are displayed when present

### Knowledge List Component
- [ ] Entries are organized in correct category order: about, services, pricing, policies, faq, custom
- [ ] Each entry shows title, content preview, and keywords
- [ ] "Edit" button links to `/admin/clients/[id]/knowledge/[entryId]`
- [ ] "Delete" button shows confirmation dialog before deleting
- [ ] After deletion, the page refreshes and entry is removed
- [ ] Empty state message shown when no entries exist

### New Entry Page (`/admin/clients/[id]/knowledge/new`)
- [ ] Page loads for admin users only
- [ ] Form shows category selector with 6 options (About, Services, Pricing, Policies, FAQ, Custom)
- [ ] Title field is required
- [ ] Content textarea is required (6 rows)
- [ ] Keywords field is optional with helper text
- [ ] Priority field accepts numbers 1-10 with default of 5
- [ ] Submit button shows "Add Entry" for new entries
- [ ] "Saving..." shown while submitting
- [ ] After submit, redirects to knowledge base list
- [ ] Cancel button returns to knowledge base list
- [ ] New entry appears in the list after creation

### Edit Entry Page (`/admin/clients/[id]/knowledge/[entryId]`)
- [ ] Page loads with existing entry data pre-filled
- [ ] Non-existent entry ID returns 404
- [ ] Category, title, content, keywords, and priority are editable
- [ ] Submit button shows "Save Changes" for existing entries
- [ ] After save, redirects to knowledge base list
- [ ] Changes are persisted and visible in the list

### Knowledge Entry Form Component
- [ ] Form works for both create (POST) and edit (PATCH) modes
- [ ] Category select defaults to "services" for new entries
- [ ] Priority defaults to 5 for new entries
- [ ] All form fields are controlled (values update on input)
- [ ] Submit is disabled while saving

### Client Detail Page Integration
- [ ] "Knowledge Base" button visible in the Actions card
- [ ] Button links to `/admin/clients/[id]/knowledge`
- [ ] Button uses outline variant and full width

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Routes registered: `/admin/clients/[id]/knowledge`, `/admin/clients/[id]/knowledge/new`, `/admin/clients/[id]/knowledge/[entryId]`
- [ ] No regressions in existing routes

---

## Phase 15c: AI Integration with Knowledge Base

### AI Response Service (openai.ts)
- [ ] `generateAIResponse` accepts optional `clientId` parameter
- [ ] When `clientId` is provided, knowledge context is included in the AI prompt
- [ ] Relevant knowledge entries are searched based on the incoming message
- [ ] AI uses `gpt-4o-mini` model
- [ ] Existing escalation triggers still work (pricing, complaints, human requests)
- [ ] Conversation length escalation (6+ messages) still triggers

### Knowledge-Aware Response Handler (knowledge-ai.ts)
- [ ] `generateKnowledgeAwareResponse` fetches client, lead, and conversation history
- [ ] Knowledge context is built and included in the system prompt
- [ ] Relevant entries (top 3) are highlighted in the prompt
- [ ] SMS-appropriate response length (1-3 sentences)
- [ ] Graceful error handling returns fallback message on AI failure

### Incoming SMS Handler Integration
- [ ] `handleIncomingSMS` passes `client.id` to `generateAIResponse`
- [ ] AI responses now reflect knowledge base content
- [ ] Existing SMS flow (opt-out, blocking, hot intent, escalation) unaffected

### Knowledge Preview Page
- [ ] Navigate to `/admin/clients/[id]/knowledge/preview`
- [ ] Page requires admin authentication (non-admins redirected)
- [ ] Left panel shows full knowledge context (what AI sees)
- [ ] Right panel shows test chat interface
- [ ] Client business name displayed in header
- [ ] "Back" button links to knowledge base page

### Preview Chat Component
- [ ] Chat interface renders with placeholder text when empty
- [ ] User messages appear on the right (blue background)
- [ ] AI responses appear on the left (gray background)
- [ ] "Thinking..." animation shows while waiting for response
- [ ] Enter key sends the message
- [ ] Send button disabled when input is empty or loading
- [ ] Conversation history is maintained across messages in the session
- [ ] Error responses display gracefully

### Test API Endpoint
- [ ] POST `/api/admin/clients/[id]/knowledge/test` is accessible
- [ ] Returns 403 for non-admin users
- [ ] Returns 404 for invalid client ID
- [ ] Returns 400 for missing/invalid message
- [ ] Includes knowledge context and relevant entries in AI prompt
- [ ] Returns AI-generated response in JSON `{ response: string }`
- [ ] Conversation history from chat is sent and used for context

### Knowledge Base Page Link
- [ ] "Test AI" button visible in knowledge base page header
- [ ] Button links to `/admin/clients/[id]/knowledge/preview`
- [ ] Button uses outline variant

### End-to-End Test Scenarios
- [ ] Add knowledge entries for a client (services, pricing, FAQ)
- [ ] Go to Knowledge Base -> Test AI
- [ ] Ask "What services do you offer?" — AI uses knowledge base entries
- [ ] Ask "How much does a roof repair cost?" — AI references pricing entries
- [ ] Ask "What areas do you serve?" — AI references service area entry
- [ ] Ask a question with no matching knowledge — AI offers to have someone follow up
- [ ] Multi-turn conversation maintains context

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/admin/clients/[id]/knowledge/preview`, `/api/admin/clients/[id]/knowledge/test`
- [ ] No regressions in existing routes

## 26-notification-preferences

### Schema Verification
- [ ] `notification_preferences` table exists in database
- [ ] `client_id` column has unique constraint and cascading delete
- [ ] SMS boolean columns default correctly: `sms_new_lead=true`, `sms_escalation=true`, `sms_weekly_summary=true`, `sms_flow_approval=true`, `sms_negative_review=true`
- [ ] Email boolean columns default correctly: `email_new_lead=false`, `email_daily_summary=false`, `email_weekly_summary=true`, `email_monthly_report=true`
- [ ] Quiet hours defaults: `quiet_hours_enabled=false`, `quiet_hours_start='22:00'`, `quiet_hours_end='07:00'`
- [ ] `urgent_override` defaults to `true`
- [ ] Schema exported from `src/db/schema/index.ts`
- [ ] Relations defined in `src/db/schema/relations.ts`

### Service Layer
- [ ] `getNotificationPrefs()` returns defaults when no record exists
- [ ] `getNotificationPrefs()` auto-creates a database record on first call
- [ ] `updateNotificationPrefs()` inserts new record if none exists (upsert behavior)
- [ ] `updateNotificationPrefs()` updates existing record and sets `updatedAt`
- [ ] `isInQuietHours()` returns false when quiet hours disabled
- [ ] `isInQuietHours()` handles overnight ranges (e.g., 22:00 to 07:00)
- [ ] `isInQuietHours()` handles same-day ranges (e.g., 13:00 to 17:00)
- [ ] `shouldNotify()` returns false when notification type is disabled
- [ ] `shouldNotify()` respects quiet hours
- [ ] `shouldNotify()` allows urgent notifications during quiet hours when `urgentOverride=true`

### API Endpoints
- [ ] `GET /api/client/notifications` returns 401 without `clientSessionId` cookie
- [ ] `GET /api/client/notifications` returns preferences JSON for authenticated client
- [ ] `PUT /api/client/notifications` returns 401 without `clientSessionId` cookie
- [ ] `PUT /api/client/notifications` validates input with Zod (rejects invalid time format)
- [ ] `PUT /api/client/notifications` updates preferences and returns `{ success: true }`
- [ ] `PUT /api/client/notifications` accepts partial updates (e.g., only `smsNewLead`)

### Notification Settings Page
- [ ] `/client/settings/notifications` redirects to `/link-expired` without session
- [ ] Page loads with current preferences from database
- [ ] "Back" button navigates to `/client/settings`
- [ ] Page title shows "Notification Settings"

### Notification Settings Form
- [ ] SMS section shows 5 toggle switches (New lead, Escalations, Weekly summary, Flow approval, Negative review)
- [ ] Email section shows 4 toggle switches (New lead, Daily summary, Weekly summary, Monthly report)
- [ ] Quiet hours section shows enable toggle
- [ ] Enabling quiet hours reveals start/end time inputs and urgent override toggle
- [ ] Disabling quiet hours hides time inputs and urgent override
- [ ] Time inputs accept valid HH:MM format
- [ ] "Allow urgent notifications" toggle appears with description text
- [ ] "Save Preferences" button shows "Saving..." during API call
- [ ] "Save Preferences" button shows "Saved!" for 3 seconds after success
- [ ] All toggle changes are reflected in state before saving

### Settings Page Integration
- [ ] `/client/settings` shows "Notifications" card with "Manage Notifications" link
- [ ] Link navigates to `/client/settings/notifications`
- [ ] Button uses outline variant

### End-to-End Test Scenarios
- [ ] Navigate to client settings, click "Manage Notifications"
- [ ] Toggle off all SMS notifications, save, reload — all SMS toggles remain off
- [ ] Toggle on all email notifications, save, reload — all email toggles remain on
- [ ] Enable quiet hours, set start to 23:00 and end to 06:00, save, reload — times persist
- [ ] Enable quiet hours, disable urgent override, save, reload — urgent override remains off
- [ ] Disable quiet hours, save, reload — quiet hours section is collapsed

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/client/settings/notifications`, `/api/client/notifications`
- [ ] No regressions in existing routes

---

## Phase 16b: Cancellation Flow

### Schema & Service
- [ ] `cancellation_requests` table exists in database after migration/push
- [ ] `cancellationRequests` exported from `@/db` schema index
- [ ] `getValueSummary()` returns correct stats (monthsActive, totalLeads, totalMessages, estimatedRevenue, roi)
- [ ] `initiateCancellation()` creates a row with status `pending` and stores value summary as JSONB
- [ ] `scheduleRetentionCall()` updates status to `scheduled_call` and sets `scheduledCallAt`
- [ ] `confirmCancellation()` updates status to `cancelled` and sets 7-day `gracePeriodEnds`
- [ ] `getPendingCancellation()` returns existing pending request or undefined

### Client Settings — Cancel Link
- [ ] Navigate to `/client/settings` — "Danger Zone" card appears at bottom with red border
- [ ] "Cancel Subscription" button links to `/client/cancel`

### Cancellation Page (`/client/cancel`)
- [ ] Unauthenticated access redirects to `/link-expired`
- [ ] Value summary card shows leads captured, messages sent, estimated revenue, and ROI
- [ ] Green-themed card with border highlights positive results
- [ ] "Never mind, take me back" link returns to `/client`

### Cancellation Flow (Step 1 — Reason Selection)
- [ ] 7 radio button reasons displayed (too_expensive, not_using, switching_competitor, business_closing, missing_features, poor_results, other)
- [ ] "Continue" button disabled until a reason is selected
- [ ] Optional feedback textarea accepts free-form input
- [ ] Selecting a reason and clicking "Continue" advances to step 2

### Cancellation Flow (Step 2 — Retention Offer)
- [ ] Contextual help text displayed based on selected reason (e.g., pricing options for "too_expensive")
- [ ] "Schedule a Call" button sends POST to `/api/client/cancel` with `action: schedule_call`
- [ ] "Cancel Anyway" button sends POST to `/api/client/cancel` with `action: confirm`
- [ ] Both buttons disabled while submitting (prevents double-submit)
- [ ] Grace period notice displayed: "7 days to reactivate"

### Cancellation API (`POST /api/client/cancel`)
- [ ] Returns 401 if no `clientSessionId` cookie
- [ ] Returns 400 for invalid input (missing reason, invalid action)
- [ ] `schedule_call` action: creates cancellation request, updates to `scheduled_call`, sends admin email
- [ ] `confirm` action: creates cancellation request, updates to `cancelled` with grace period, sends admin email
- [ ] Admin notification email contains business name, reason, and feedback

### Confirmation Pages
- [ ] `/client/cancel/call-scheduled` — shows "Call Scheduled!" with green border, "Back to Dashboard" link
- [ ] `/client/cancel/confirmed` — shows "Cancellation Confirmed" with 7-day grace period notice, "Back to Dashboard" link

### Pending Cancellation Redirect
- [ ] If a pending cancellation exists, visiting `/client/cancel` redirects to `/client/cancel/pending`

### End-to-End Test Scenarios
- [ ] Full flow: Settings → Cancel → Select reason → Continue → Schedule a Call → Call Scheduled page
- [ ] Full flow: Settings → Cancel → Select reason → Continue → Cancel Anyway → Confirmed page
- [ ] Verify cancellation request row created in database with correct status
- [ ] Verify admin receives email notification for both schedule_call and confirm actions

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/client/cancel`, `/client/cancel/call-scheduled`, `/client/cancel/confirmed`, `/api/client/cancel`
- [ ] No regressions in existing routes

---

## 28-revenue-attribution

### Schema Verification
- [ ] `jobs` table exists with columns: id, lead_id, client_id, status, quote_amount, deposit_amount, final_amount, paid_amount, description, address, scheduled_date, completed_date, won_at, lost_at, lost_reason, created_at, updated_at
- [ ] `revenue_events` table exists with columns: id, job_id, client_id, event_type, amount, notes, created_at
- [ ] `job_status` enum has values: lead, quoted, won, lost, completed
- [ ] `jobs.client_id` FK cascades on delete
- [ ] `jobs.lead_id` FK sets null on delete
- [ ] `revenue_events.job_id` FK cascades on delete
- [ ] Indexes exist: `idx_jobs_client`, `idx_jobs_status`

### Revenue Service
- [ ] `createJobFromLead()` creates a job with status "lead" and logs a "job_created" revenue event
- [ ] `updateJobStatus()` updates job status and sets wonAt/lostAt/completedDate appropriately
- [ ] `updateJobStatus("won")` logs a revenue event with the final or quote amount
- [ ] `recordPayment()` increments paidAmount and logs a "payment_received" event
- [ ] `getRevenueStats()` returns correct counts and sums filtered by clientId and date range
- [ ] `getRecentJobs()` returns jobs with lead name/phone, ordered by newest first

### API Routes - GET /api/admin/clients/[id]/jobs
- [ ] Returns 403 for non-admin users
- [ ] Returns jobs list and revenue stats for valid admin request
- [ ] Returns 500 with error message on server failure

### API Routes - POST /api/admin/clients/[id]/jobs
- [ ] Returns 403 for non-admin users
- [ ] Creates a job from a valid leadId and returns jobId
- [ ] Returns 400 with validation details for invalid input (missing leadId, non-UUID)
- [ ] Returns 500 with error message on server failure

### API Routes - PATCH /api/admin/clients/[id]/jobs/[jobId]
- [ ] Returns 403 for non-admin users
- [ ] `action: "update_status"` updates job status correctly
- [ ] `action: "record_payment"` records payment with amount and optional notes
- [ ] Returns 400 for invalid action or missing required fields
- [ ] Returns 500 with error message on server failure

### Revenue Dashboard Page
- [ ] `/admin/clients/[id]/revenue` loads for admin users
- [ ] Redirects non-admin users to `/dashboard`
- [ ] Shows 404 for non-existent client ID
- [ ] Displays client business name in header
- [ ] "Back" button links to `/admin/clients/[id]`

### Revenue Metrics Component
- [ ] ROI banner displays ROI percentage, revenue attributed, and collected amounts
- [ ] Pipeline stats show leads, quoted, won, lost, and win rate
- [ ] Quote value shown under "Quoted" card
- [ ] Average job value card displays correctly
- [ ] All monetary values formatted as dollars (cents / 100)

### Jobs List Component
- [ ] Each job shows lead name or phone number
- [ ] Status badge with correct color: lead (gray), quoted (blue), won (green), lost (red), completed (purple)
- [ ] Quote and final amounts displayed when present
- [ ] Status dropdown allows changing job status
- [ ] Status change triggers API call and page refresh
- [ ] Empty state message shown when no jobs exist

### Client Detail Page Integration
- [ ] "Revenue Tracking" button appears in Actions card on `/admin/clients/[id]`
- [ ] Button links to `/admin/clients/[id]/revenue`

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/admin/clients/[id]/revenue`, `/api/admin/clients/[id]/jobs`, `/api/admin/clients/[id]/jobs/[jobId]`
- [ ] No regressions in existing routes

---

## Phase 17b: Lead Scoring

### Schema Changes
- [ ] `leads` table has new columns: `score` (integer, default 50), `score_updated_at` (timestamp), `score_factors` (jsonb), `temperature` (varchar, default 'warm')
- [ ] Migration file generated in `drizzle/` directory
- [ ] Migration runs successfully against database

### Lead Scoring Service (`src/lib/services/lead-scoring.ts`)
- [ ] `quickScore()` detects high urgency signals (e.g., "asap", "emergency", "leak")
- [ ] `quickScore()` detects budget signals (e.g., "how much", "too expensive", "budget ready")
- [ ] `quickScore()` detects intent signals (e.g., "ready to book", "just looking")
- [ ] `quickScore()` detects satisfaction and frustration signals
- [ ] `calculateEngagement()` returns 0-25 based on response ratio and recency
- [ ] `aiScore()` calls OpenAI gpt-4o-mini and returns structured score factors
- [ ] `aiScore()` falls back to `quickScore()` on JSON parse failure
- [ ] `scoreLead()` combines all factors into total score (0-100)
- [ ] `scoreLead()` sets temperature: hot (>=70), warm (>=40), cold (<40)
- [ ] `scoreLead()` updates lead record in database with score, temperature, scoreFactors, scoreUpdatedAt
- [ ] `scoreClientLeads()` batch scores all leads for a client
- [ ] `getLeadsByTemperature()` returns leads filtered by temperature, sorted by score desc

### Webhook Integration (`src/lib/automations/incoming-sms.ts`)
- [ ] Inbound SMS triggers `scoreLead()` with `useAI: false` (quick mode)
- [ ] High-value signals (high_urgency, high_intent, budget_ready) trigger async AI scoring
- [ ] Scoring errors are caught and logged, do not interrupt SMS flow

### Scoring API Endpoints
- [ ] `GET /api/leads/[id]/score` returns lead score, temperature, scoreFactors, scoreUpdatedAt
- [ ] `GET /api/leads/[id]/score` returns 404 for non-existent lead
- [ ] `GET /api/leads/[id]/score` returns 401 for unauthenticated requests
- [ ] `POST /api/leads/[id]/score` recalculates score (with AI by default)
- [ ] `GET /api/clients/[id]/leads/scores` returns score distribution by temperature with counts and avg scores
- [ ] `GET /api/clients/[id]/leads/scores` returns top 10 hot leads
- [ ] `POST /api/clients/[id]/leads/scores` batch rescores all client leads

### LeadScoreBadge Component (`src/components/leads/lead-score-badge.tsx`)
- [ ] Compact mode shows colored pill with icon and score number
- [ ] Full mode shows card with temperature label, score, and 4-factor breakdown
- [ ] Hot leads show red styling with Flame icon
- [ ] Warm leads show yellow styling with Thermometer icon
- [ ] Cold leads show blue styling with Snowflake icon
- [ ] Tooltip on compact badge shows factor breakdown (urgency, budget, intent, engagement out of 25)
- [ ] Signal tags displayed in full mode when present

### Lead Score Distribution Component (`src/components/leads/lead-score-distribution.tsx`)
- [ ] Temperature distribution bar shows proportional red/yellow/blue segments
- [ ] Legend shows counts for each temperature category
- [ ] Hot leads priority list shows name, phone, and score
- [ ] Empty state shows "No scored leads yet" message

### Leads List Page Integration (`src/app/(dashboard)/leads/page.tsx`)
- [ ] Each lead row shows compact LeadScoreBadge next to status badge
- [ ] Score badge appears for all leads with default score of 50 / warm
- [ ] Badge tooltip works on hover showing score details

### Daily Cron Job (`src/app/api/cron/route.ts`)
- [ ] Lead scoring runs at midnight UTC (hour=0, minutes<10)
- [ ] All active clients' leads are rescored in quick mode (no AI)
- [ ] Cron result includes `leadScoring` with client count and leads scored
- [ ] Errors are caught and logged, do not crash the cron handler

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/api/leads/[id]/score`, `/api/clients/[id]/leads/scores`
- [ ] No regressions in existing routes

## 30-photo-handling

### Database Schema (`src/db/schema/media-attachments.ts`)
- [ ] `media_attachments` table exists with correct columns: id, clientId, leadId, messageId
- [ ] `media_type` enum includes: image, video, audio, document, other
- [ ] Storage columns: storageKey (required), publicUrl, thumbnailKey, thumbnailUrl
- [ ] Twilio columns: twilioMediaSid, twilioMediaUrl
- [ ] AI columns: aiDescription (text), aiTags (jsonb string array)
- [ ] Metadata columns: width, height, duration, fileSize, mimeType, fileName
- [ ] Indexes on leadId, clientId, messageId
- [ ] Schema exported from `src/db/schema/index.ts`
- [ ] Relations defined in `relations.ts` (client, lead, message)
- [ ] Clients, leads, conversations relations include `mediaAttachments: many()`

### Storage Service (`src/lib/services/storage.ts`)
- [ ] `uploadFile()` uploads buffer to R2 and returns key + public URL
- [ ] `uploadImage()` uploads original + generates 300x300 JPEG thumbnail
- [ ] Thumbnail key has `_thumb.jpg` suffix
- [ ] `deleteFile()` removes file from R2
- [ ] `getSignedDownloadUrl()` generates time-limited signed URL
- [ ] `getImageDimensions()` returns width/height using sharp metadata
- [ ] S3 client configured with R2 endpoint and credentials from env vars
- [ ] Each function creates fresh S3 client (no cached instance)

### Media Service (`src/lib/services/media.ts`)
- [ ] `processIncomingMedia()` fetches from Twilio URL with Basic auth
- [ ] Images get uploaded with thumbnail via `uploadImage()`
- [ ] Non-images get uploaded via `uploadFile()`
- [ ] Images are analyzed with OpenAI Vision (gpt-4o-mini)
- [ ] AI analysis returns description + tags as JSON
- [ ] Failed AI analysis falls back to "Image received" / ["unanalyzed"]
- [ ] Media record saved to database with all fields populated
- [ ] `getLeadMedia()` returns all media for a lead, ordered by createdAt desc
- [ ] `getClientMedia()` supports filtering by type, limit, offset
- [ ] `getMessageMedia()` returns media for a specific conversation message
- [ ] `deleteMedia()` removes file + thumbnail from R2, then deletes DB record
- [ ] `generatePhotoAcknowledgment()` returns contextual message based on AI tags
- [ ] Photo acknowledgment handles: roof damage, leak, completed work, before photo
- [ ] Generic acknowledgment includes AI description when available
- [ ] Uses `getDb()` pattern (fresh instance per call)

### Twilio Webhook MMS Handling (`src/app/api/webhooks/twilio/sms/route.ts`)
- [ ] Extracts `NumMedia` from Twilio payload
- [ ] Loops through `MediaUrl0..N`, `MediaContentType0..N`, `MediaSid0..N`
- [ ] Passes `NumMedia` and `MediaItems` array to `handleIncomingSMS()`
- [ ] Body defaults to empty string when undefined (MMS can have no text)

### Incoming SMS Automation (`src/lib/automations/incoming-sms.ts`)
- [ ] `IncomingSMSPayload` interface includes optional `NumMedia` and `MediaItems`
- [ ] Inbound message content shows "[N media attachment(s)]" when no text
- [ ] Message type is "mms" when media is present, "sms" otherwise
- [ ] Inbound message is inserted with `.returning()` to get message ID
- [ ] Each media item calls `processIncomingMedia()` with message ID
- [ ] Failed media processing is caught and logged, doesn't break flow
- [ ] Photo-only messages (no text) get photo acknowledgment response
- [ ] Photo+text messages add media context to AI prompt
- [ ] AI response for photo+text includes "The customer also sent N photo(s) showing: ..."
- [ ] Lead scoring still runs after media processing

### Media API Routes
- [ ] `GET /api/leads/[id]/media` returns all media for a lead (auth required)
- [ ] `GET /api/media/[id]` returns single media record (auth required)
- [ ] `DELETE /api/media/[id]` deletes media from storage and DB (auth required)
- [ ] All routes use `auth()` and return 401 if not authenticated
- [ ] All routes use Next.js 16 async params pattern (`Promise<{ id: string }>`)

### Media Gallery Component (`src/components/media/media-gallery.tsx`)
- [ ] Grid layout: 3 cols mobile, 4 cols md, 6 cols lg
- [ ] Empty state shows icon and "No photos or files yet" message
- [ ] Image thumbnails display in grid with aspect-square
- [ ] Non-image types show appropriate icon (video, audio, document, file)
- [ ] Hover overlay shows zoom icon
- [ ] Clicking opens dialog with full-size image
- [ ] Dialog shows AI description and tags as badges
- [ ] Dialog shows time ago and dimensions
- [ ] Download button opens file in new tab
- [ ] Delete button calls onDelete callback and closes dialog
- [ ] Uses controlled Dialog (open/onOpenChange) instead of DialogTrigger asChild

### Conversation View Media (`src/app/(dashboard)/leads/[id]/`)
- [ ] Lead detail page fetches media attachments from DB
- [ ] Media grouped by messageId into a lookup map
- [ ] Message bubbles show inline photos (thumbnails) for MMS messages
- [ ] Clicking inline photo opens full-size in new tab
- [ ] Non-image attachments show type icon in bubble
- [ ] MMS messages show "MMS" badge in timestamp line
- [ ] `MessageMedia` is a client component for interactive behavior

### Lead Tabs (`src/app/(dashboard)/leads/[id]/lead-tabs.tsx`)
- [ ] Tabs component with "Conversation" and "Photos" tabs
- [ ] Conversation tab shows messages with inline media (same as before)
- [ ] Photos tab shows `LeadMediaTab` with full gallery view
- [ ] Reply form and opt-out card render inside conversation tab via children
- [ ] Media count badge shown on Photos tab when media exists
- [ ] Tab icons: MessageSquare for conversation, ImageIcon for photos

### Lead Media Tab (`src/components/leads/lead-media-tab.tsx`)
- [ ] Fetches media via `/api/leads/[leadId]/media` on mount
- [ ] Shows skeleton loading state (6 square placeholders)
- [ ] Renders `MediaGallery` with fetched items
- [ ] Delete handler calls `/api/media/[id]` DELETE and removes from state
- [ ] Delete shows confirmation dialog before proceeding

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/api/leads/[id]/media`, `/api/media/[id]`
- [ ] Dependencies installed: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `sharp`
- [ ] Skeleton UI component installed
- [ ] No regressions in existing routes

---

## 31-payment-links (Stripe Integration)

### Schema Verification
- [ ] `payments` table exists with columns: `id`, `client_id`, `invoice_id`, `lead_id`, `type`, `amount`, `description`, `stripe_payment_intent_id`, `stripe_payment_link_id`, `stripe_payment_link_url`, `status`, `paid_at`, `link_sent_at`, `link_opened_at`, `link_expires_at`, `metadata`, `created_at`
- [ ] `payment_reminders` table exists with columns: `id`, `payment_id`, `invoice_id`, `reminder_number`, `sent_at`, `message_content`, `lead_replied`, `reply_content`, `created_at`
- [ ] `invoices` table has new columns: `job_id`, `description`, `total_amount`, `paid_amount`, `remaining_amount`, `stripe_customer_id`, `notes`
- [ ] `leads` table has new column: `stripe_customer_id`
- [ ] Indexes exist on `payments` for `client_id`, `lead_id`, `invoice_id`, `status`, `stripe_payment_link_id`
- [ ] Foreign keys: `payments.client_id` -> `clients.id`, `payments.lead_id` -> `leads.id`, `payments.invoice_id` -> `invoices.id`
- [ ] Foreign keys: `payment_reminders.payment_id` -> `payments.id`, `payment_reminders.invoice_id` -> `invoices.id`

### Stripe Service (`src/lib/services/stripe.ts`)
- [ ] `getOrCreateStripeCustomer()` creates a Stripe customer if none exists for the lead
- [ ] `getOrCreateStripeCustomer()` returns existing `stripeCustomerId` from leads table if present
- [ ] `createPaymentLink()` creates a Stripe price + payment link and saves to `payments` table
- [ ] `createPaymentLink()` sets `linkExpiresAt` to 30 days from creation
- [ ] `createInvoiceWithLink()` creates both an invoice record and a Stripe payment link
- [ ] `createDepositLink()` calculates deposit amount as percentage of invoice total
- [ ] `handlePaymentSuccess()` updates payment status to `paid` and sets `paidAt`
- [ ] `handlePaymentSuccess()` updates invoice `paidAmount` and `remainingAmount`
- [ ] `handlePaymentSuccess()` updates invoice status to `paid` when fully paid or `partial` when partially paid
- [ ] `handlePaymentSuccess()` updates job `paidAmount` for revenue attribution
- [ ] `formatAmount()` formats cents to CAD currency string
- [ ] `generatePaymentMessage()` includes overdue messaging when applicable
- [ ] Stripe client is lazy-initialized (does not fail at build time without env vars)

### Stripe Webhook (`/api/webhooks/stripe`)
- [ ] Route registered at `/api/webhooks/stripe`
- [ ] Validates `stripe-signature` header and returns 400 if missing or invalid
- [ ] Handles `checkout.session.completed` — calls `handlePaymentSuccess()`
- [ ] Sends confirmation SMS to lead on successful payment via client's Twilio number
- [ ] Notifies client owner via admin Twilio number on payment receipt
- [ ] Handles `checkout.session.expired` — marks payment as `cancelled`
- [ ] Handles `charge.refunded` — marks payment as `refunded`
- [ ] Returns `{ received: true }` on success

### Payment API Routes
- [ ] `GET /api/payments?clientId=...` returns payments filtered by clientId
- [ ] `GET /api/payments?leadId=...` returns payments filtered by leadId
- [ ] `GET /api/payments` returns 400 if neither clientId nor leadId provided
- [ ] `POST /api/payments` creates a payment link with Zod-validated input
- [ ] `POST /api/payments` converts dollar amount to cents before creating link
- [ ] `POST /api/payments` with `createInvoice: true` creates invoice + payment link
- [ ] `POST /api/payments` returns 400 on invalid input with Zod error details
- [ ] `POST /api/payments/[id]/send` sends payment link via SMS to lead
- [ ] `POST /api/payments/[id]/send` returns 404 if payment not found
- [ ] `POST /api/payments/[id]/send` returns 400 if client has no Twilio number
- [ ] `POST /api/payments/[id]/send` updates `linkSentAt` timestamp after sending
- [ ] Both routes require authentication (401 if no session)

### Payment Reminder Automation
- [ ] `startPaymentReminder()` auto-creates Stripe payment link when no `paymentLink` provided and amount > 0
- [ ] Created payment link URL is saved to the invoice record
- [ ] Payment link URL is included in scheduled reminder messages
- [ ] `paymentReminders` table records are created for each scheduled reminder
- [ ] `markInvoicePaid()` also marks pending payments as `paid`
- [ ] Existing payment sequences are cancelled before creating new ones

### SendPaymentButton Component
- [ ] Dialog opens on button click
- [ ] Amount input accepts decimal values (step 0.01)
- [ ] Description field is optional (defaults to "Payment from {leadName}")
- [ ] Payment type selector offers: Full, Deposit, Progress, Final
- [ ] "Create Payment Link" button calls `POST /api/payments` and shows link
- [ ] Created link is displayed in a read-only input with copy button
- [ ] Copy button copies link to clipboard and shows toast
- [ ] "Send via SMS" button calls `POST /api/payments/[id]/send`
- [ ] Success toast shown and dialog closes after SMS sent
- [ ] Form fields are disabled after payment link is created
- [ ] Form resets when dialog is closed
- [ ] Loading spinner shown during API calls

### Payment Success Page (`/payment/success`)
- [ ] Route registered at `/payment/success`
- [ ] Shows green checkmark icon
- [ ] Shows "Payment Successful!" heading
- [ ] Shows confirmation text about receiving a text
- [ ] Page is statically rendered (no auth required — public page)

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/api/payments`, `/api/payments/[id]/send`, `/api/webhooks/stripe`, `/payment/success`
- [ ] Schema exports: `payments`, `paymentReminders` exported from `src/db/schema/index.ts`
- [ ] Relations defined for `payments` and `paymentReminders` in `relations.ts`
- [ ] No regressions in existing routes

---

## Phase 32: Reputation Monitoring

### Schema Tables
- [ ] `reviews` table created with columns: id, clientId, source, externalId, externalUrl, authorName, authorPhoto, rating, reviewText, hasResponse, responseText, responseDate, sentiment, aiSuggestedResponse, keyTopics, alertSent, alertSentAt, matchedLeadId, reviewDate, fetchedAt, createdAt
- [ ] `review_sources` table created with columns: id, clientId, source, isActive, googlePlaceId, yelpBusinessId, facebookPageId, lastFetchedAt, lastReviewDate, totalReviews, averageRating, lastError, consecutiveErrors, createdAt, updatedAt
- [ ] `review_metrics` table created with columns: id, clientId, period, periodStart, periodEnd, totalReviews, averageRating, star counts, source counts, sentiment counts, respondedCount, avgResponseTimeHours, createdAt
- [ ] All three schemas exported from `src/db/schema/index.ts`
- [ ] Indexes on reviews (clientId, source, reviewDate) and review_sources (clientId)
- [ ] Unique constraint on review_metrics (clientId, period, periodStart)

### Google Places Service (`src/lib/services/google-places.ts`)
- [ ] `fetchGooglePlaceDetails(placeId)` fetches place details from Google Places API
- [ ] Returns null and logs error when API key is missing
- [ ] Returns null and logs error when API returns non-OK status
- [ ] `findGooglePlaceId(businessName, address?)` searches for a place and returns place_id
- [ ] `syncGoogleReviews(clientId)` fetches and saves new reviews for a client
- [ ] Deduplicates reviews by externalId (author_name + time)
- [ ] Updates reviewSources stats (lastFetchedAt, totalReviews, averageRating) after sync
- [ ] Tracks consecutive errors on the reviewSources record
- [ ] Assigns sentiment based on rating (>=4 positive, 3 neutral, <=2 negative)

### Review Monitoring Service (`src/lib/services/review-monitoring.ts`)
- [ ] `syncAllReviews(clientId)` calls syncGoogleReviews and returns results
- [ ] `checkAndAlertNegativeReviews(clientId)` finds unalerted reviews with rating <= 2
- [ ] Generates AI suggested response via OpenAI for each negative review
- [ ] Sends SMS alert to client phone number for each negative review
- [ ] Marks reviews as alertSent=true with timestamp after alerting
- [ ] `generateReviewResponse(review)` generates appropriate tone based on rating
- [ ] `calculateReviewMetrics(clientId, period, date)` aggregates and upserts metrics
- [ ] `getReviewSummary(clientId)` returns totalReviews, averageRating, recentReviews, needsResponse, sources

### Review API Routes
- [ ] `GET /api/admin/clients/[id]/reviews` returns reviews list with summary
- [ ] Supports query params: source, rating, needsResponse, limit
- [ ] Returns 403 for non-admin users
- [ ] `POST /api/admin/clients/[id]/reviews` triggers review sync from all sources
- [ ] `GET /api/admin/clients/[id]/reviews/sources` lists configured review sources
- [ ] `POST /api/admin/clients/[id]/reviews/sources` adds/updates a review source
- [ ] Google source auto-finds Place ID from business name if not provided
- [ ] Returns 400 if Google Place ID cannot be found
- [ ] Validates input with Zod schema
- [ ] Upserts source (updates existing or creates new)

### Cron Job (`src/app/api/cron/route.ts`)
- [ ] Review sync runs hourly (when UTC minutes < 10)
- [ ] Finds reviewSources not fetched in the last hour or never fetched
- [ ] Groups by clientId and syncs each client
- [ ] Calls checkAndAlertNegativeReviews after sync
- [ ] Logs synced count and alerts count
- [ ] Catches and logs errors per-client without stopping the loop

### Review Dashboard Component (`src/components/reviews/review-dashboard.tsx`)
- [ ] Renders 4 summary cards: average rating, total reviews, last 30 days, needs response
- [ ] Star rating display with filled/unfilled stars
- [ ] "Sync Reviews" button triggers POST and refreshes data
- [ ] Spinning animation on refresh icon while syncing
- [ ] Reviews list with source badge and relative date
- [ ] Negative reviews (rating <= 2) highlighted with red border/background
- [ ] AI suggested response shown for reviews with rating <= 3 that have no response
- [ ] "Copy Response" button copies AI suggestion to clipboard
- [ ] "Mark Responded" button marks review as responded (optimistic update)
- [ ] "Responded" badge shown for reviews with hasResponse=true
- [ ] Loading and empty states handled

### Review Source Config Component
- [ ] Input field for Google Place ID with auto-detect option
- [ ] "Link" / "Update" button based on whether source exists
- [ ] Shows error message when linking fails
- [ ] Shows success message when linked
- [ ] Lists connected sources with status badges
- [ ] Shows average rating and total reviews per source
- [ ] Shows last synced date and error status

### Reputation Overview Page (`/admin/reputation`)
- [ ] Lists all active clients with their review sources
- [ ] Shows average rating and total review count per client
- [ ] Shows source badges (google, yelp, etc.)
- [ ] "View Reviews" / "Setup" link to client review page
- [ ] Admin-only access (redirects non-admin)

### Client Detail Integration
- [ ] "Reputation Monitoring" button added to client detail Actions card
- [ ] Links to `/admin/clients/[id]/reviews`
- [ ] "Reputation" link added to admin navigation under Optimization group

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/admin/reputation`, `/admin/clients/[id]/reviews`, `/api/admin/clients/[id]/reviews`, `/api/admin/clients/[id]/reviews/sources`
- [ ] Schema exports: `reviews`, `reviewSources`, `reviewMetrics` exported from `src/db/schema/index.ts`
- [ ] No regressions in existing routes

---

## Phase 19b: Review Response AI

### Schema & Database
- [ ] `responseTemplates` table created in `src/db/schema/response-templates.ts`
- [ ] `reviewResponses` table created in `src/db/schema/review-responses.ts`
- [ ] Both exported from `src/db/schema/index.ts`
- [ ] Google OAuth fields added to `clients` schema: `googleAccessToken`, `googleRefreshToken`, `googleTokenExpiresAt`, `googleBusinessAccountId`, `googleLocationId`
- [ ] Run `npm run db:generate` and `npm run db:migrate` to create tables

### Review Response Generation Service
- [ ] `src/lib/services/review-response.ts` exists
- [ ] `generateReviewResponse()` calls OpenAI with correct prompt per rating (negative/neutral/positive)
- [ ] Tone selector works: professional, friendly, apologetic, thankful
- [ ] `findMatchingTemplate()` scores templates by rating range and keyword match
- [ ] `applyTemplate()` substitutes `{{customer_name}}`, `{{business_name}}`, `{{owner_name}}`
- [ ] `createDraftResponse()` tries template first, falls back to AI generation
- [ ] `regenerateResponse()` supports tone change, shorter, and custom instructions

### Google Business Profile Posting Service
- [ ] `src/lib/services/google-business.ts` exists
- [ ] `postResponseToGoogle()` checks review is from Google source
- [ ] Returns error if Google Business not connected (no `googleAccessToken`)
- [ ] Refreshes expired tokens via `refreshGoogleToken()`
- [ ] Updates response status to `posted` on success
- [ ] Updates review `hasResponse`, `responseText`, `responseDate` on success
- [ ] Logs `postError` on failure

### API Routes — Review Responses
- [ ] `GET /api/admin/reviews/[id]/responses` — lists responses for a review
- [ ] `POST /api/admin/reviews/[id]/responses` — generates draft response (AI or template)
- [ ] Accepts `tone`, `useTemplate`, `templateId` in body
- [ ] Returns 403 for non-admin users
- [ ] Returns 400 for invalid Zod input

### API Routes — Response Management
- [ ] `GET /api/admin/responses/[id]` — returns single response, 404 if not found
- [ ] `PATCH /api/admin/responses/[id]` — updates `responseText` and/or `status`
- [ ] `DELETE /api/admin/responses/[id]` — deletes response
- [ ] All routes return 403 for non-admin users

### API Routes — Regenerate & Post
- [ ] `POST /api/admin/responses/[id]/regenerate` — regenerates with `tone`, `shorter`, or `custom` instructions
- [ ] `POST /api/admin/responses/[id]/post` — posts response to Google Business Profile
- [ ] Returns 400 with error message if posting fails
- [ ] Returns 403 for non-admin users

### API Routes — Response Templates
- [ ] `GET /api/admin/clients/[id]/templates` — lists templates for a client, ordered by usage
- [ ] `POST /api/admin/clients/[id]/templates` — creates new template with Zod validation
- [ ] Accepts `name`, `category`, `templateText`, `variables`, `minRating`, `maxRating`, `keywords`
- [ ] Returns 403 for non-admin users

### Response Editor Component
- [ ] `src/components/reviews/response-editor.tsx` exists
- [ ] Tone selector (professional/friendly/apologetic/thankful) renders
- [ ] "Generate" button calls AI generation API
- [ ] Response text appears in editable textarea
- [ ] Word count displayed in bottom-right
- [ ] "Make shorter", "More friendly", "More apologetic" quick action buttons work
- [ ] "Copy" button copies text to clipboard with toast confirmation
- [ ] "Post to Google" button appears only for Google reviews
- [ ] "Copy & Reply on {source}" button appears for non-Google reviews
- [ ] Loading spinners during generation and posting

### Default Templates Seeder
- [ ] `src/db/seed-templates.ts` exists
- [ ] `seedDefaultTemplates(clientId)` creates 6 templates:
  - 5-Star Thank You (positive, rating 5)
  - 4-Star Appreciation (positive, rating 4)
  - 3-Star Follow Up (neutral, rating 3)
  - Negative Review - Quality Issue (negative, rating ≤2, keywords)
  - Negative Review - Communication Issue (negative, rating ≤2, keywords)
  - Negative Review - Timing/Delays (negative, rating ≤2, keywords)
- [ ] All templates include `{{customer_name}}`, `{{business_name}}`, `{{owner_name}}` variables

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/api/admin/reviews/[id]/responses`, `/api/admin/responses/[id]`, `/api/admin/responses/[id]/regenerate`, `/api/admin/responses/[id]/post`, `/api/admin/clients/[id]/templates`
- [ ] Schema exports: `reviewResponses`, `responseTemplates` exported from `src/db/schema/index.ts`
- [ ] No regressions in existing routes

## 34-calendar-sync

### Schema Verification
- [ ] `src/db/schema/calendar-integrations.ts` exists with `calendarIntegrations` table and `calendarProviderEnum`
- [ ] `src/db/schema/calendar-events.ts` exists with `calendarEvents` table
- [ ] `calendarIntegrations` has columns: id, clientId, provider, isActive, accessToken, refreshToken, tokenExpiresAt, externalAccountId, calendarId, syncEnabled, lastSyncAt, syncDirection, lastError, consecutiveErrors, createdAt, updatedAt
- [ ] `calendarEvents` has columns: id, clientId, leadId, title, description, location, startTime, endTime, isAllDay, timezone, status, provider, externalEventId, lastSyncedAt, syncStatus, assignedTeamMemberId, eventType, jobId, createdAt, updatedAt
- [ ] `calendarProviderEnum` includes: google, jobber, servicetitan, housecall_pro, outlook
- [ ] Both tables exported from `src/db/schema/index.ts`
- [ ] Indexes: client_idx, time_idx, external_idx on calendarEvents; client_idx, provider_idx on calendarIntegrations

### Google Calendar Service
- [ ] `src/lib/services/calendar/google-calendar.ts` exists
- [ ] `getGoogleAuthUrl(clientId)` generates OAuth URL with calendar scopes and client ID as state
- [ ] `handleGoogleCallback(code, clientId)` exchanges code for tokens and upserts integration record
- [ ] `createGoogleEvent(clientId, event)` creates event in Google Calendar and updates local record with external ID
- [ ] `updateGoogleEvent(clientId, event)` updates existing Google Calendar event by external ID
- [ ] `deleteGoogleEvent(clientId, externalEventId)` deletes event from Google Calendar
- [ ] `syncFromGoogleCalendar(clientId, startDate, endDate)` pulls events from Google and creates/updates locally
- [ ] Token refresh handled when `tokenExpiresAt` has passed
- [ ] Error tracking: consecutiveErrors incremented on failure, cleared on success
- [ ] Lead info (name, phone) appended to event description when leadId present

### Calendar Service Facade
- [ ] `src/lib/services/calendar/index.ts` exists
- [ ] `createEvent(input)` inserts local event and syncs to connected providers
- [ ] `updateEvent(eventId, updates)` updates local event and re-syncs to providers
- [ ] `cancelEvent(eventId)` deletes from external calendar and sets status to cancelled
- [ ] `getEvents(clientId, startDate, endDate)` returns events in date range ordered by startTime
- [ ] `getLeadEvents(leadId)` returns up to 10 upcoming events for a lead
- [ ] `fullSync(clientId)` runs inbound sync (-30 to +90 days) and outbound sync for pending events
- [ ] `syncEventToProviders` skips integrations with syncDirection='inbound'
- [ ] Re-exports `getGoogleAuthUrl` and `handleGoogleCallback`

### API Routes — Calendar Events
- [ ] `GET /api/calendar/events?clientId=X&start=Y&end=Z` returns events for date range
- [ ] `GET /api/calendar/events` without clientId returns 400
- [ ] `POST /api/calendar/events` creates event with Zod validation (clientId, title, startTime, endTime required)
- [ ] `POST /api/calendar/events` with missing fields returns 400 with validation details
- [ ] Both endpoints return 401 for unauthenticated requests

### API Routes — Calendar Integrations
- [ ] `GET /api/calendar/integrations?clientId=X` lists integrations (id, provider, isActive, syncEnabled, lastSyncAt, lastError)
- [ ] `GET /api/calendar/integrations` without clientId returns 400
- [ ] `POST /api/calendar/integrations` with `{clientId, provider: 'google'}` returns `{authUrl}`
- [ ] `POST /api/calendar/integrations` with unsupported provider returns 400
- [ ] `DELETE /api/calendar/integrations/[id]` sets isActive=false, syncEnabled=false
- [ ] All endpoints return 401 for unauthenticated requests

### API Routes — Calendar Sync
- [ ] `POST /api/calendar/sync` with `{clientId}` triggers full bidirectional sync
- [ ] Returns `{inbound: {created, updated}, outbound: {synced, failed}}`
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 400 for invalid clientId

### API Routes — OAuth Callback
- [ ] `GET /api/auth/callback/google-calendar?code=X&state=clientId` completes OAuth and redirects to client settings with success
- [ ] `GET /api/auth/callback/google-calendar?error=access_denied&state=clientId` redirects with error=google_denied
- [ ] Missing code or state redirects with error=invalid_callback
- [ ] Exception during token exchange redirects with error=google_failed

### Calendar Integrations UI
- [ ] `src/components/calendar/calendar-integrations.tsx` exists
- [ ] Shows 4 providers: Google Calendar, Jobber, ServiceTitan, Housecall Pro
- [ ] Jobber, ServiceTitan, Housecall Pro show "Coming Soon" badge
- [ ] Unconnected Google Calendar shows "Not connected" with "Connect" button
- [ ] Connected Google Calendar shows green "Connected" status with last sync time
- [ ] Connected integration shows "Disconnect" button and sync (refresh) button
- [ ] Clicking "Connect" calls POST /api/calendar/integrations and redirects to OAuth URL
- [ ] Clicking "Disconnect" confirms via dialog then calls DELETE /api/calendar/integrations/[id]
- [ ] Clicking sync button calls POST /api/calendar/sync and shows spinner during sync
- [ ] Toast notifications for connect errors, disconnect success, sync success/failure
- [ ] Integration errors displayed as red text below provider name
- [ ] Loading state shown while fetching integrations

### Cron Job — Calendar Sync
- [ ] `src/app/api/cron/calendar-sync/route.ts` exists
- [ ] `GET /api/cron/calendar-sync` with valid `Authorization: Bearer CRON_SECRET` runs sync
- [ ] Returns 401 without valid cron secret
- [ ] Only syncs integrations not synced in last 15 minutes
- [ ] Groups by clientId to avoid duplicate syncs
- [ ] Returns `{synced, errors, timestamp}`
- [ ] Continues processing remaining clients if one fails

### Manual Verification Steps
1. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables
2. Enable Google Calendar API in Google Cloud Console
3. Add `http://localhost:3000/api/auth/callback/google-calendar` as authorized redirect URI
4. Start dev server: `npm run dev`
5. Navigate to a client settings page and use the CalendarIntegrations component
6. Click "Connect" for Google Calendar — should redirect to Google OAuth consent screen
7. Approve access — should redirect back to client settings with `?success=google_connected`
8. Verify integration appears as "Connected" in the UI
9. Create event via `POST /api/calendar/events` — verify it appears in Google Calendar
10. Create event in Google Calendar, then click sync — verify it appears locally via `GET /api/calendar/events`
11. Test cron sync: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/calendar-sync`
12. Disconnect calendar — verify events stop syncing

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/api/calendar/events`, `/api/calendar/integrations`, `/api/calendar/integrations/[id]`, `/api/calendar/sync`, `/api/auth/callback/google-calendar`, `/api/cron/calendar-sync`
- [ ] Schema exports: `calendarIntegrations`, `calendarEvents`, `calendarProviderEnum` exported from `src/db/schema/index.ts`
- [ ] No regressions in existing routes

---

## Phase 35: Voice AI

### Schema
- [ ] `voiceCalls` table exported from `src/db/schema/voice-calls.ts`
- [ ] `src/db/schema/index.ts` exports `voiceCalls`
- [ ] `clients` table has new columns: `voiceEnabled`, `voiceMode`, `voiceGreeting`, `voiceVoiceId`, `voiceMaxDuration`

### Webhook Routes
- [ ] `POST /api/webhooks/twilio/voice/ai` — main voice AI webhook handles incoming calls
  - [ ] Finds client by Twilio number
  - [ ] Returns TwiML forwarding call if voice AI is disabled
  - [ ] Checks business hours for `after_hours` mode
  - [ ] Creates lead if not found (source: `voice`)
  - [ ] Creates `voiceCalls` record
  - [ ] Returns TwiML with greeting + `<Gather>` for speech input
- [ ] `POST /api/webhooks/twilio/voice/ai/gather` — AI conversation handler
  - [ ] Processes `SpeechResult` from Twilio
  - [ ] Fetches knowledge base context for client
  - [ ] Sends speech to OpenAI for response generation
  - [ ] Updates voice call transcript
  - [ ] Returns TwiML with AI response + next gather or redirect to transfer
- [ ] `POST /api/webhooks/twilio/voice/ai/transfer` — transfer handler
  - [ ] Transfers call to client owner phone
  - [ ] Falls back to voicemail recording if no phone available
  - [ ] Updates voice call outcome to `transferred`
- [ ] `POST /api/webhooks/twilio/voice/ai/dial-complete` — dial completion handler
  - [ ] Updates voice call status on dial completion
  - [ ] Handles missed/answered outcomes

### Services
- [ ] `src/lib/services/voice-summary.ts` — call summary service
  - [ ] `generateCallSummary(callId)` creates AI summary from transcript
  - [ ] `notifyClientOfCall(callId)` sends SMS notification to client owner

### API Endpoints
- [ ] `GET /api/admin/clients/[id]/voice-calls` — returns voice calls for a client
  - [ ] Requires admin auth (returns 403 for non-admins)
  - [ ] Returns up to 50 calls ordered by most recent
- [ ] `PATCH /api/admin/clients/[id]` — accepts voice fields: `voiceEnabled`, `voiceMode`, `voiceGreeting`, `voiceVoiceId`, `voiceMaxDuration`

### UI Components
- [ ] `src/components/settings/voice-settings.tsx` — voice settings card
  - [ ] Toggle to enable/disable voice AI
  - [ ] Select for answer mode (after_hours, overflow, always)
  - [ ] Mode description updates based on selection
  - [ ] Textarea for custom greeting message
  - [ ] Save button calls PATCH API
- [ ] `src/components/voice/call-history.tsx` — voice call history card
  - [ ] Fetches calls from `/api/admin/clients/[id]/voice-calls`
  - [ ] Shows caller number, intent badge, outcome badge, duration
  - [ ] Shows AI summary when available
  - [ ] Expandable transcript view
  - [ ] Play recording link when available
  - [ ] Relative timestamps (e.g., "2 hours ago")

### Admin Page
- [ ] `/admin/voice-ai` page renders for admin users
- [ ] Shows all active clients with their voice settings and call history
- [ ] "Voice AI" link appears in admin nav under Configuration group

### Navigation
- [ ] Dashboard layout has "Voice AI" link in Configuration group

### Manual Verification Steps
1. Start dev server: `npm run dev`
2. Navigate to `/admin/voice-ai` — should show all active clients
3. Toggle Voice AI on for a client — select a mode and add a greeting
4. Click "Save Voice Settings" — should show success toast
5. Verify PATCH request sent to `/api/admin/clients/[id]` with voice fields
6. Check call history section shows "No voice calls yet" for new clients
7. Configure Twilio Voice webhook URL to `https://yourdomain.com/api/webhooks/twilio/voice/ai`
8. Call the Twilio number after hours — AI should answer with greeting
9. Speak to the AI — should respond conversationally using knowledge base
10. Request to speak to someone — AI should transfer the call
11. After call ends, verify voice call record created in database
12. Refresh `/admin/voice-ai` — call should appear in history with transcript

### Build Verification
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] New routes registered: `/admin/voice-ai`, `/api/admin/clients/[id]/voice-calls`, `/api/webhooks/twilio/voice/ai`, `/api/webhooks/twilio/voice/ai/gather`, `/api/webhooks/twilio/voice/ai/transfer`, `/api/webhooks/twilio/voice/ai/dial-complete`
- [ ] Schema exports: `voiceCalls` exported from `src/db/schema/index.ts`
- [ ] No regressions in existing voice webhook (`/api/webhooks/twilio/voice`)
