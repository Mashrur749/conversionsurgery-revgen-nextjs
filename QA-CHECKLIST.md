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
