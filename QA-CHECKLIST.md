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
