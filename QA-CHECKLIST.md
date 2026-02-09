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
