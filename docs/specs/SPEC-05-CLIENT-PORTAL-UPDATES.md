# SPEC-05: Client Portal Updates

## Goal

Update the client portal to respect the new permission system. Navigation items are shown/hidden based on permissions. API routes check permissions before returning data. Multi-business users get a business switcher. The welcome experience for invited team members is thoughtful.

## Context

### Problem

Currently, every client portal user sees the full navigation and has access to every feature. There is no concept of a user with limited access (e.g., a team member who can only view leads and conversations).

### Solution

- Wrap client portal layout with a `PermissionProvider` that makes permissions available to all client components
- Gate navigation items based on permissions
- Add permission checks to all client API routes
- Add a business switcher for multi-business users
- Create a welcome experience for newly invited team members
- Handle access revocation gracefully (redirect + message)

## Dependencies

- **SPEC-01** (Schema): `client_memberships`, `people` tables
- **SPEC-02** (Permissions): Permission constants, `usePermissions()` hook, `requirePortalPermission()`
- **SPEC-03** (Auth Flows): `getPortalSession()` returns permissions

## Changes

### 1. Permission Provider in Client Layout

**File:** `src/app/(client)/layout.tsx`

Wrap the client layout with a `PermissionProvider` that reads permissions from the session and makes them available to all child components.

```tsx
// In server layout:
const session = await getPortalSession();
if (!session) redirect('/client-login');

// Pass permissions to client component wrapper
<PermissionProvider
  permissions={session.permissions}
  isOwner={session.isOwner}
  personId={session.personId}
  clientId={session.clientId}
>
  <ClientNav
    businessName={session.client.businessName}
    permissions={session.permissions}
    isOwner={session.isOwner}
  />
  {children}
</PermissionProvider>
```

**File:** `src/components/permission-provider.tsx` (NEW)

```tsx
'use client';

import { PermissionContext } from '@/hooks/use-permissions';

export function PermissionProvider({
  children,
  permissions,
  isOwner,
  personId,
  clientId,
}: {
  children: React.ReactNode;
  permissions: string[];
  isOwner: boolean;
  personId: string;
  clientId: string;
}) {
  return (
    <PermissionContext.Provider value={{ permissions, isOwner, personId, clientId }}>
      {children}
    </PermissionContext.Provider>
  );
}
```

### 2. Permission-Gated Navigation

**File:** `src/components/client-nav.tsx`

Currently shows all nav items unconditionally. Update to check permissions:

```tsx
const navItems = [
  { href: '/client', label: 'Dashboard', permission: PORTAL_PERMISSIONS.DASHBOARD },
  { href: '/client/conversations', label: 'Conversations', permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  { href: '/client/revenue', label: 'Revenue', permission: PORTAL_PERMISSIONS.REVENUE_VIEW },
  { href: '/client/analytics', label: 'Analytics', permission: PORTAL_PERMISSIONS.ANALYTICS_VIEW },
  { href: '/client/reviews', label: 'Reviews', permission: PORTAL_PERMISSIONS.REVIEWS_VIEW },
  { href: '/client/knowledge', label: 'Knowledge', permission: PORTAL_PERMISSIONS.KNOWLEDGE_VIEW },
  { href: '/client/settings', label: 'Settings', permission: PORTAL_PERMISSIONS.SETTINGS_VIEW },
];

// In render:
{navItems
  .filter(item => permissions.includes(item.permission))
  .map(item => (
    <Link key={item.href} href={item.href} ...>
      {item.label}
    </Link>
  ))
}
```

**Mobile nav** also needs the same gating.

### 3. API Permission Checks

Every `/api/client/*` route currently uses:
```typescript
const session = await getClientSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

Replace with permission-specific checks:

| Route Pattern | Required Permission |
|--------------|-------------------|
| `GET /api/client/dashboard` | `portal.dashboard` |
| `GET /api/client/leads` | `portal.leads.view` |
| `PATCH /api/client/leads/[id]` | `portal.leads.edit` |
| `GET /api/client/conversations` | `portal.conversations.view` |
| `GET /api/client/analytics` | `portal.analytics.view` |
| `GET /api/client/revenue` | `portal.revenue.view` |
| `GET /api/client/knowledge` | `portal.knowledge.view` |
| `POST /api/client/knowledge` | `portal.knowledge.edit` |
| `GET /api/client/reviews` | `portal.reviews.view` |
| `GET /api/client/team` | `portal.team.view` |
| `POST /api/client/team` | `portal.team.manage` |
| `GET /api/client/settings` | `portal.settings.view` |
| `PATCH /api/client/settings` | `portal.settings.edit` |
| `PATCH /api/client/settings/ai` | `portal.settings.ai` |

**Implementation pattern:**

```typescript
// Before:
const session = await getClientSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const { clientId } = session;

// After:
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';

try {
  const session = await requirePortalPermission(PORTAL_PERMISSIONS.LEADS_VIEW);
  const { clientId, personId } = session;
  // ... rest of handler
} catch {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### 4. Business Switcher

**For users with access to multiple businesses.**

**File:** `src/components/business-switcher.tsx` (NEW)

Displayed in the client nav header when the user has multiple client_memberships.

```tsx
UI: Dropdown in the header showing current business name
  [v] Acme Plumbing
      -----------
      Acme Plumbing (current)
      Smith Electric
      -----------
      [Sign out]

On business switch:
  POST /api/client/auth/switch-business { clientId }
  -> Validates membership exists and is active
  -> Regenerates session cookie with new clientId + permissions
  -> Redirect to /client (dashboard)
```

**API endpoint:** `src/app/api/client/auth/switch-business/route.ts` (NEW)

```
POST /api/client/auth/switch-business
Body: { clientId: string }

1. Get current session (personId from cookie)
2. Verify active client_membership for personId + new clientId
3. Load role_template + overrides for the new membership
4. Regenerate cookie with new clientId + permissions + sessionVersion
5. Audit log: auth.business_switched
6. Return { success: true }
```

**Conditional rendering:** Only show the switcher if the person has 2+ active memberships. Check this at layout level:

```typescript
// In client layout (server component):
const db = getDb();
const memberships = await db
  .select({ clientId: clientMemberships.clientId, businessName: clients.businessName })
  .from(clientMemberships)
  .innerJoin(clients, eq(clients.id, clientMemberships.clientId))
  .where(and(
    eq(clientMemberships.personId, session.personId),
    eq(clientMemberships.isActive, true),
    eq(clients.status, 'active')
  ));

const showSwitcher = memberships.length > 1;

<ClientNav
  businessName={session.client.businessName}
  businesses={showSwitcher ? memberships : undefined}
  ...
/>
```

### 5. Welcome Experience for Invited Members

When a person is invited to a client&apos;s portal (via SPEC-04, Client Team &amp; Access page), they need a smooth first-login experience.

**Flow:**

```
1. Agency adds "Jane Smith" (jane@acme.com) as Office Manager for Acme Plumbing
2. Jane receives SMS/email: "You've been invited to view Acme Plumbing's dashboard on ConversionSurgery. Log in: [link]"
3. Jane clicks link -> /client-login (pre-filled with her email/phone from the invite)
4. Jane enters OTP
5. Since this is her first login, show welcome screen:
   - "Welcome to Acme Plumbing"
   - "You have access as Office Manager"
   - "Here's what you can do:" [list of accessible features based on permissions]
   - [Get Started] button -> /client
6. Subsequent logins skip the welcome screen
```

**Welcome detection:** Check `people.lastLoginAt` &mdash; if null, this is the first login.

**File:** `src/app/(client)/welcome/page.tsx` (NEW)

```
Route: /client/welcome

Server component:
  - Get portal session
  - If person.lastLoginAt is not null, redirect to /client
  - Load role template name + permissions

UI:
  <Card className="max-w-lg mx-auto mt-12">
    <CardHeader>
      <CardTitle>Welcome to {businessName}</CardTitle>
      <p>You've been added as {roleName}.</p>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground mb-4">
        Here's what you can access:
      </p>
      <ul className="space-y-2">
        {permissions includes dashboard && <li>📊 Dashboard overview</li>}
        {permissions includes leads.view && <li>📋 View incoming leads</li>}
        {permissions includes conversations.view && <li>💬 Read conversations</li>}
        ... etc
      </ul>
    </CardContent>
    <CardFooter>
      <Button asChild className="w-full">
        <Link href="/client">Get Started</Link>
      </Button>
    </CardFooter>
  </Card>
```

### 6. Access Revocation Handling

When a user&apos;s access is revoked (membership deactivated), their next request will fail the sessionVersion check. Handle this gracefully.

**In `getPortalSession()`:**

```
If sessionVersion check fails:
  1. Clear the session cookie
  2. Return null
```

**In client layout:**

```
If getPortalSession() returns null:
  Check if there's a revocation flag in the URL query
  redirect('/client-login?revoked=true')
```

**In client-login page:**

```
If URL has ?revoked=true:
  Show info banner: "Your access has been updated. Please contact your administrator if you need access."
```

### 7. Client Portal Team Page

**For business owners and team managers to view who has portal access.**

**Route:** `/client/team`

**Permission required:** `portal.team.view`

```
Page Title: "Team"
Subtitle: "People who have access to this portal."

List:
  | Name | Role | Status |
  |------|------|--------|
  | You (Owner) | Business Owner | Active |
  | Jane Smith | Office Manager | Active |
  | Bob Johnson | Team Member | Active |

If user has portal.team.manage:
  [+ Add Team Member] button
  Edit/Remove actions on each row

If user only has portal.team.view:
  Read-only list, no action buttons
```

**Note:** This is a simplified version of the admin&apos;s Client Team &amp; Access page. The client portal team page lets the business owner (or authorized manager) manage their own team without needing agency intervention.

**API endpoints:**

```
GET  /api/client/team          - List memberships for current client (requires portal.team.view)
POST /api/client/team          - Add member (requires portal.team.manage)
PATCH /api/client/team/[id]    - Update member (requires portal.team.manage)
DELETE /api/client/team/[id]   - Remove member (requires portal.team.manage)
```

**Escalation prevention:** When a client portal user adds a team member, they can only assign role templates with permissions they themselves hold. Business owners can assign any client-scoped role. An office manager cannot assign business_owner role.

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `src/components/permission-provider.tsx` | CREATE |
| 2 | `src/app/(client)/layout.tsx` | MODIFY (add PermissionProvider + business list) |
| 3 | `src/components/client-nav.tsx` | MODIFY (permission-gated nav items + business switcher) |
| 4 | `src/components/business-switcher.tsx` | CREATE |
| 5 | `src/app/api/client/auth/switch-business/route.ts` | CREATE |
| 6 | `src/app/(client)/welcome/page.tsx` | CREATE |
| 7 | `src/app/(client)/client/team/page.tsx` | CREATE |
| 8 | `src/app/api/client/team/route.ts` | CREATE |
| 9 | `src/app/api/client/team/[id]/route.ts` | CREATE |
| 10 | `src/app/(auth)/client-login/page.tsx` | MODIFY (add revoked banner) |
| 11 | All existing `/api/client/*` routes | MODIFY (add permission checks) |

## Implementation Steps

1. Create `PermissionProvider` component
2. Update client layout to wrap children in `PermissionProvider`
3. Update `client-nav.tsx` to gate nav items by permission
4. Create `business-switcher.tsx` component
5. Create `/api/client/auth/switch-business` endpoint
6. Update client layout to load business list for switcher
7. Create welcome page at `/client/welcome`
8. Create team page at `/client/team` with API endpoints
9. Update all existing `/api/client/*` routes with permission checks
10. Add revoked banner to client-login page
11. Run `npm run typecheck` and `npm run build`

## Verification

- [ ] Nav items hidden for users without corresponding permissions
- [ ] Team member role user sees only Dashboard, Leads, Conversations in nav
- [ ] API routes return 403 for insufficient permissions
- [ ] Business switcher appears for multi-business users
- [ ] Business switching regenerates cookie with correct permissions
- [ ] Welcome page shown on first login, skipped thereafter
- [ ] Access revocation results in graceful redirect with message
- [ ] Team page shows members (read-only for viewers, editable for managers)
- [ ] Client-side permission escalation prevention works
- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes

## Risks

- **Existing page components**: Many client pages use `getClientSession()` directly. Need to systematically update all of them. Use grep to find all instances.
- **Business switcher state**: Switching businesses changes the URL context. Any client-side state (filters, form data) will be lost. This is acceptable since the user is switching to a different business.
- **Permission caching**: Permissions are in the cookie. If an agency admin changes a user&apos;s permissions while they&apos;re logged in, the user won&apos;t see the change until `sessionVersion` forces a re-login. This is by design (session invalidation).
