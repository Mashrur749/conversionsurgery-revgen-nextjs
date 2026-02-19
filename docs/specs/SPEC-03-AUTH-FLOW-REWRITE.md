# SPEC-03: Auth Flow Rewrite

## Goal

Rewrite both authentication flows (client portal OTP and agency dashboard magic link) to use the new `people` + memberships model. After this spec, auth resolves to a person with permissions, not just a clientId or isAdmin boolean.

## Context

### Current Client Portal Auth Flow

```
1. User enters phone or email on /client-login
2. API matches against clients.phone or clients.email
3. OTP sent to that phone/email
4. User enters OTP code
5. API verifies OTP, returns clientId
6. Signed cookie set: clientId.hmacSignature
7. getClientSession() verifies cookie, returns { clientId, client }
```

**Problems:**
- Only matches the business owner (whoever&apos;s contact info is on the `clients` row)
- No way for a team member (PA, office manager) to log in
- Session contains only `clientId`, no person identity or permissions
- If a person has multiple businesses, they can only access the one matching their phone/email

### Current Agency Dashboard Auth Flow

```
1. User enters email on /login
2. NextAuth sends magic link email
3. User clicks link, NextAuth creates session
4. Session callback enriches with isAdmin, clientId, adminUsers.role
5. requireAdmin(session) checks (session as any)?.user?.isAdmin
```

**Problems:**
- `isAdmin` is a boolean on the `users` table, not a role
- Admin role comes from a separate `admin_users` table with unused `passwordHash`
- No granular permissions, just admin/super_admin
- No client scoping (every admin sees everything)
- Uses `as any` casts for type safety

### Target State

```
Client Portal:
1. User enters phone or email on /client-login
2. API looks up people by phone/email
3. API finds active client_memberships for that person
4. OTP sent
5. User verifies OTP
6. If person has multiple client_memberships -> business picker
7. Signed cookie: personId.clientId.permissions.sessionVersion.hmacSignature
8. getPortalSession() verifies cookie + sessionVersion, returns rich session

Agency Dashboard:
1. User enters email on /login
2. NextAuth sends magic link
3. Session callback: users.personId -> agency_memberships -> role_template
4. Session enriched with personId, permissions, clientScope, assignedClientIds
5. requireAgencyPermission('agency.clients.view') replaces requireAdmin()
```

## Dependencies

- **SPEC-01** (Schema): `people`, `client_memberships`, `agency_memberships`, `agency_client_assignments` tables
- **SPEC-02** (Permissions): Permission constants, resolution functions

## Changes

### 1. OTP Service Rewrite

**File:** `src/lib/services/otp.ts`

Currently, `createAndSendPhoneOTP` looks up `clients.phone` and `createAndSendEmailOTP` looks up `clients.email`. These need to look up `people` instead, then find active `client_memberships`.

**New flow:**

```
createAndSendPhoneOTP(rawPhone):
  1. Normalize phone
  2. Find person: SELECT * FROM people WHERE phone = normalizedPhone
  3. If no person, silent fail (return success)
  4. Find active memberships: SELECT cm.* FROM client_memberships cm
     JOIN clients c ON cm.clientId = c.id
     WHERE cm.personId = person.id AND cm.isActive = true AND c.status = 'active'
  5. If no active memberships, silent fail
  6. Rate limit check (per person, not per phone)
  7. Create OTP record (link to personId instead of clientId)
  8. Send SMS using first membership's client twilioNumber (or platform number)
```

```
createAndSendEmailOTP(rawEmail):
  1. Normalize email
  2. Find person: SELECT * FROM people WHERE email = normalizedEmail
  3. If no person, silent fail
  4. Find active memberships (same as above)
  5. If no active memberships, silent fail
  6. Rate limit check (per person)
  7. Create OTP record (link to personId)
  8. Send email
```

**OTP codes table change:**

The `otp_codes` table currently has `clientId` (NOT NULL). Change to:
- Add `personId` column (uuid, FK -> people.id, NOT NULL)
- Make `clientId` nullable (it&apos;s no longer known at OTP creation time when a person has multiple businesses)
- Add index on `personId`

### 2. OTP Verification + Business Picker

**File:** `src/app/api/client/auth/verify-otp/route.ts`

Currently returns `{ success: true, clientId }`. New flow:

```
verifyOTP(identifier, code, method):
  1. Find OTP record (unchanged)
  2. Verify code (unchanged)
  3. On success, return personId (not clientId)

POST /api/client/auth/verify-otp response:
  If person has exactly 1 active client_membership:
    { success: true, personId, clientId, businessName }
    -> Auto-set session cookie, redirect to /client

  If person has multiple active client_memberships:
    { success: true, personId, businesses: [{ clientId, businessName }] }
    -> Show business picker UI
    -> User selects business
    -> POST /api/client/auth/select-business { personId, clientId }
    -> Set session cookie, redirect to /client
```

### 3. New API: Select Business

**File:** `src/app/api/client/auth/select-business/route.ts` (NEW)

Called after OTP verification when a person has multiple businesses.

```
POST /api/client/auth/select-business
Body: { personId: string, clientId: string }

1. Verify that personId has an active client_membership for clientId
2. Load role_template + permissionOverrides
3. Resolve effective permissions
4. Set signed cookie with: personId, clientId, permissions array, sessionVersion
5. Update people.lastLoginAt
6. Audit log: auth.login
7. Return { success: true }
```

### 4. Client Session Cookie Rewrite

**File:** `src/lib/client-auth.ts`

The signed cookie currently contains only `clientId`. New cookie payload:

```typescript
interface ClientSessionPayload {
  personId: string;
  clientId: string;
  permissions: string[];  // Resolved permission strings
  sessionVersion: number; // From client_memberships.sessionVersion
}
```

**Cookie format:** `base64(JSON.stringify(payload)).hmacSignature`

**`getClientSession()` changes:**

```
1. Read cookie, verify HMAC signature
2. Decode payload
3. Check sessionVersion against DB:
   SELECT sessionVersion FROM client_memberships
   WHERE personId = payload.personId AND clientId = payload.clientId AND isActive = true
4. If DB sessionVersion > cookie sessionVersion -> return null (session invalidated)
5. Return { personId, clientId, permissions, isOwner, client }
```

**Performance note:** The sessionVersion check is the only DB query on every request. Permission checks are done against the cached permissions in the cookie. When permissions change, sessionVersion is bumped, forcing a re-login that refreshes the cookie.

### 5. Business Picker UI

**File:** `src/app/(auth)/client-login/page.tsx` (MODIFY)

After OTP verification, if multiple businesses are returned:

```
State: showBusinessPicker = true, businesses = [...]

UI:
<Card>
  <CardHeader>
    <CardTitle>Select Business</CardTitle>
    <p>You have access to multiple businesses. Select one to continue.</p>
  </CardHeader>
  <CardContent>
    {businesses.map(b => (
      <button
        key={b.clientId}
        onClick={() => selectBusiness(b.clientId)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent rounded-lg"
      >
        <span className="font-medium">{b.businessName}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    ))}
  </CardContent>
</Card>
```

### 6. NextAuth Session Enrichment

**File:** `src/auth.ts`

The session callback currently does:
1. Look up `users.isAdmin` and `users.clientId`
2. If admin, look up `adminUsers.role`
3. If non-admin, look up or auto-link `clients`

**New session callback:**

```
session callback({ session, user }):
  1. Look up users.personId
  2. If personId is null -> legacy user, handle gracefully (see SPEC-06)

  3. Look up agency_membership:
     SELECT am.*, rt.permissions, rt.slug
     FROM agency_memberships am
     JOIN role_templates rt ON am.roleTemplateId = rt.id
     WHERE am.personId = personId AND am.isActive = true

  4. If agency membership found:
     session.user.personId = personId
     session.user.permissions = rt.permissions
     session.user.role = rt.slug
     session.user.clientScope = am.clientScope
     session.user.isAgency = true

     If am.clientScope === 'assigned':
       Load assigned client IDs from agency_client_assignments
       session.user.assignedClientIds = [...]

  5. If no agency membership, check client_memberships:
     (This handles the case where a business owner logs in via magic link
      instead of OTP — redirect them to /client)

  6. Return enriched session
```

**Type augmentation** (`src/types/next-auth.d.ts`):

```typescript
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string;
      personId?: string;
      permissions?: string[];
      role?: string;
      clientScope?: 'all' | 'assigned';
      assignedClientIds?: string[];
      isAgency?: boolean;
    };
    client?: {
      id: string;
      businessName: string;
      ownerName: string;
    };
  }
}
```

### 7. Session Invalidation

When permissions or roles change for a membership, `sessionVersion` must be incremented.

**File:** `src/lib/permissions/session-invalidation.ts` (NEW)

```typescript
/**
 * Increment sessionVersion on a client membership.
 * The user's next request will fail sessionVersion check and they'll be logged out.
 */
export async function invalidateClientSession(
  membershipId: string
): Promise<void> {
  const db = getDb();
  await db.update(clientMemberships)
    .set({ sessionVersion: sql`session_version + 1` })
    .where(eq(clientMemberships.id, membershipId));
}

/**
 * Increment sessionVersion on an agency membership.
 */
export async function invalidateAgencySession(
  membershipId: string
): Promise<void> {
  const db = getDb();
  await db.update(agencyMemberships)
    .set({ sessionVersion: sql`session_version + 1` })
    .where(eq(agencyMemberships.id, membershipId));
}
```

**Called when:**
- Role template is changed on a membership
- Permission overrides are modified
- Membership is deactivated
- Client is suspended

### 8. Agency Auth Session Update

**File:** `src/lib/auth-session.ts`

Currently returns `{ user: { id, email, name }, session, clientId }`. Update to:

```typescript
interface AuthSessionResult {
  user: {
    id: string;
    email: string;
    name: string | null;
    personId: string | null;
  };
  session: {
    sessionToken: string;
    expires: Date;
  };
  // Agency-specific (null if not an agency member)
  agency: {
    membershipId: string;
    permissions: string[];
    role: string;
    clientScope: 'all' | 'assigned';
    assignedClientIds: string[] | null;
    sessionVersion: number;
  } | null;
}
```

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `src/db/schema/otp-codes.ts` | MODIFY (add personId, make clientId nullable) |
| 2 | `src/lib/services/otp.ts` | REWRITE (look up people instead of clients) |
| 3 | `src/app/api/client/auth/send-otp/route.ts` | MODIFY (pass personId context) |
| 4 | `src/app/api/client/auth/verify-otp/route.ts` | MODIFY (return personId + business list) |
| 5 | `src/app/api/client/auth/select-business/route.ts` | CREATE (business picker endpoint) |
| 6 | `src/lib/client-auth.ts` | REWRITE (new cookie payload with permissions + sessionVersion) |
| 7 | `src/app/(auth)/client-login/page.tsx` | MODIFY (add business picker state + UI) |
| 8 | `src/auth.ts` | MODIFY (session callback uses people + memberships) |
| 9 | `src/lib/auth-session.ts` | MODIFY (return agency session with permissions) |
| 10 | `src/lib/utils/admin-auth.ts` | MODIFY (use agency permissions instead of isAdmin check) |
| 11 | `src/lib/permissions/session-invalidation.ts` | CREATE |
| 12 | `src/types/next-auth.d.ts` | CREATE or MODIFY (type augmentation) |

## Implementation Steps

1. Modify `otp-codes.ts` schema: add `personId`, make `clientId` nullable
2. Run `npm run db:generate` to produce migration
3. Rewrite `otp.ts` service to look up `people` table
4. Modify `send-otp/route.ts` to work with new OTP service
5. Modify `verify-otp/route.ts` to return personId + business list
6. Create `select-business/route.ts` endpoint
7. Rewrite `client-auth.ts` with new cookie payload and sessionVersion check
8. Add business picker UI to `client-login/page.tsx`
9. Modify `auth.ts` session callback for agency memberships
10. Update `auth-session.ts` return type
11. Update `admin-auth.ts` to use permission-based checks
12. Create `session-invalidation.ts`
13. Create/update `next-auth.d.ts` type declarations
14. Run `npm run typecheck`
15. Run `npm run build`

## Verification

- [ ] Client portal login works for business owner (single business)
- [ ] Client portal login shows business picker for multi-business person
- [ ] Business selection sets correct cookie with permissions
- [ ] Session invalidation works (change role -> user logged out on next request)
- [ ] Agency login enriches session with permissions and client scope
- [ ] `getPortalSession()` returns permissions from cookie
- [ ] `getAgencySession()` returns permissions from DB session
- [ ] `npm run typecheck` passes with no `as any` casts in auth code
- [ ] `npm run build` passes

## Risks

- **Cookie size**: Storing permissions in the cookie increases its size. With 14 portal permissions, the JSON is ~400 bytes; after base64 + HMAC, ~700 bytes. Well within cookie limits (4KB).
- **Session callback N+1**: The NextAuth session callback will do 2-3 queries per request (user, agency_membership, client_assignments). This is acceptable for DB sessions which are already doing a query per request. Consider caching if it becomes a bottleneck.
- **Backward compatibility**: During migration (SPEC-06), some users will not have `personId`. The auth flows must handle this gracefully by falling back to the current behavior.
