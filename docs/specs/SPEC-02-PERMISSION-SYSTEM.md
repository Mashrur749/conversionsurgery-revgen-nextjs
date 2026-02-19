# SPEC-02: Permission System

## Goal

Implement the permission checking infrastructure that enforces access control across the entire application. This includes defining permission constants, building middleware for both API routes and page components, implementing permission resolution (template + overrides), and preventing permission escalation.

## Context

### Problem

The current auth system has only two access levels:
- **Admin**: Checked via `(session as any)?.user?.isAdmin` with an unsafe `as any` cast
- **Client**: Checked via signed cookie containing `clientId`

There is no granular permission checking. All admins see everything. All client portal users see everything for their business.

### Solution

Introduce a flat permission string system with role-based templates and per-user overrides. Every API route and page component checks specific permissions before granting access.

## Dependencies

- **SPEC-01** (Schema Migration): `role_templates`, `client_memberships`, `agency_memberships` tables must exist

## Permission Constants

### File: `src/lib/permissions/constants.ts`

```typescript
// Client portal permissions
export const PORTAL_PERMISSIONS = {
  DASHBOARD:         'portal.dashboard',
  LEADS_VIEW:        'portal.leads.view',
  LEADS_EDIT:        'portal.leads.edit',
  CONVERSATIONS_VIEW:'portal.conversations.view',
  ANALYTICS_VIEW:    'portal.analytics.view',
  REVENUE_VIEW:      'portal.revenue.view',
  KNOWLEDGE_VIEW:    'portal.knowledge.view',
  KNOWLEDGE_EDIT:    'portal.knowledge.edit',
  REVIEWS_VIEW:      'portal.reviews.view',
  TEAM_VIEW:         'portal.team.view',
  TEAM_MANAGE:       'portal.team.manage',
  SETTINGS_VIEW:     'portal.settings.view',
  SETTINGS_EDIT:     'portal.settings.edit',
  SETTINGS_AI:       'portal.settings.ai',
} as const;

// Agency permissions
export const AGENCY_PERMISSIONS = {
  CLIENTS_VIEW:         'agency.clients.view',
  CLIENTS_CREATE:       'agency.clients.create',
  CLIENTS_EDIT:         'agency.clients.edit',
  CLIENTS_DELETE:       'agency.clients.delete',
  FLOWS_VIEW:           'agency.flows.view',
  FLOWS_EDIT:           'agency.flows.edit',
  TEMPLATES_EDIT:       'agency.templates.edit',
  KNOWLEDGE_EDIT:       'agency.knowledge.edit',
  CONVERSATIONS_VIEW:   'agency.conversations.view',
  CONVERSATIONS_RESPOND:'agency.conversations.respond',
  ANALYTICS_VIEW:       'agency.analytics.view',
  ABTESTS_MANAGE:       'agency.abtests.manage',
  AI_EDIT:              'agency.ai.edit',
  BILLING_VIEW:         'agency.billing.view',
  BILLING_MANAGE:       'agency.billing.manage',
  TEAM_MANAGE:          'agency.team.manage',
  SETTINGS_MANAGE:      'agency.settings.manage',
  PHONES_MANAGE:        'agency.phones.manage',
} as const;

export type PortalPermission = typeof PORTAL_PERMISSIONS[keyof typeof PORTAL_PERMISSIONS];
export type AgencyPermission = typeof AGENCY_PERMISSIONS[keyof typeof AGENCY_PERMISSIONS];
export type Permission = PortalPermission | AgencyPermission;

// All permissions as a flat array (for validation)
export const ALL_PORTAL_PERMISSIONS = Object.values(PORTAL_PERMISSIONS);
export const ALL_AGENCY_PERMISSIONS = Object.values(AGENCY_PERMISSIONS);
export const ALL_PERMISSIONS = [...ALL_PORTAL_PERMISSIONS, ...ALL_AGENCY_PERMISSIONS];
```

### File: `src/lib/permissions/templates.ts`

Built-in role template definitions (used for seeding and validation):

```typescript
export const BUILT_IN_TEMPLATES = {
  // Client portal roles
  business_owner: {
    name: 'Business Owner',
    scope: 'client' as const,
    permissions: ALL_PORTAL_PERMISSIONS,
  },
  office_manager: {
    name: 'Office Manager',
    scope: 'client' as const,
    permissions: ALL_PORTAL_PERMISSIONS.filter(
      p => p !== PORTAL_PERMISSIONS.SETTINGS_AI && p !== PORTAL_PERMISSIONS.TEAM_MANAGE
    ),
  },
  team_member: {
    name: 'Team Member',
    scope: 'client' as const,
    permissions: [
      PORTAL_PERMISSIONS.DASHBOARD,
      PORTAL_PERMISSIONS.LEADS_VIEW,
      PORTAL_PERMISSIONS.CONVERSATIONS_VIEW,
    ],
  },
  // Agency roles
  agency_owner: {
    name: 'Agency Owner',
    scope: 'agency' as const,
    permissions: ALL_AGENCY_PERMISSIONS,
  },
  agency_admin: {
    name: 'Agency Admin',
    scope: 'agency' as const,
    permissions: ALL_AGENCY_PERMISSIONS.filter(
      p => p !== AGENCY_PERMISSIONS.BILLING_MANAGE && p !== AGENCY_PERMISSIONS.SETTINGS_MANAGE
    ),
  },
  account_manager: {
    name: 'Account Manager',
    scope: 'agency' as const,
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CLIENTS_EDIT,
      AGENCY_PERMISSIONS.FLOWS_VIEW,
      AGENCY_PERMISSIONS.FLOWS_EDIT,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND,
      AGENCY_PERMISSIONS.ANALYTICS_VIEW,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
      AGENCY_PERMISSIONS.AI_EDIT,
    ],
  },
  content_specialist: {
    name: 'Content Specialist',
    scope: 'agency' as const,
    permissions: [
      AGENCY_PERMISSIONS.CLIENTS_VIEW,
      AGENCY_PERMISSIONS.CONVERSATIONS_VIEW,
      AGENCY_PERMISSIONS.TEMPLATES_EDIT,
      AGENCY_PERMISSIONS.KNOWLEDGE_EDIT,
    ],
  },
};
```

## Permission Resolution

### File: `src/lib/permissions/resolve.ts`

Core function that computes a user&apos;s effective permissions from their role template and overrides.

```typescript
interface PermissionOverrides {
  grant?: string[];
  revoke?: string[];
}

/**
 * Resolve effective permissions from a role template's permissions
 * plus optional per-user overrides.
 *
 * Effective = (templatePermissions + grants) - revokes
 */
export function resolvePermissions(
  templatePermissions: string[],
  overrides: PermissionOverrides | null
): Set<string> {
  const effective = new Set(templatePermissions);

  if (overrides?.grant) {
    for (const p of overrides.grant) {
      effective.add(p);
    }
  }

  if (overrides?.revoke) {
    for (const p of overrides.revoke) {
      effective.delete(p);
    }
  }

  return effective;
}

/**
 * Check if a permission set includes a specific permission.
 */
export function hasPermission(
  permissions: Set<string>,
  required: Permission
): boolean {
  return permissions.has(required);
}

/**
 * Check if a permission set includes ALL of the required permissions.
 */
export function hasAllPermissions(
  permissions: Set<string>,
  required: Permission[]
): boolean {
  return required.every(p => permissions.has(p));
}

/**
 * Check if a permission set includes ANY of the required permissions.
 */
export function hasAnyPermission(
  permissions: Set<string>,
  required: Permission[]
): boolean {
  return required.some(p => permissions.has(p));
}
```

## Permission Checking Middleware

### Client Portal API Routes

### File: `src/lib/permissions/require-portal-permission.ts`

Replaces the current `getClientSession()` pattern. Returns the session with resolved permissions or throws.

```typescript
import { getClientSession } from '@/lib/client-auth';
import { getDb } from '@/db';
import { clientMemberships, roleTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolvePermissions, hasPermission, hasAllPermissions } from './resolve';
import type { PortalPermission } from './constants';

interface PortalSession {
  personId: string;
  clientId: string;
  membershipId: string;
  permissions: Set<string>;
  isOwner: boolean;
}

/**
 * Get the authenticated client portal session with resolved permissions.
 * Returns null if not authenticated or membership is inactive.
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  // ... reads signed cookie, looks up client_membership + role_template,
  // resolves permissions, checks sessionVersion
}

/**
 * Require specific portal permission(s). Throws 403 if not authorized.
 * Use in API route handlers.
 */
export async function requirePortalPermission(
  ...required: PortalPermission[]
): Promise<PortalSession> {
  const session = await getPortalSession();
  if (!session) {
    throw new Error('Unauthorized: not authenticated');
  }
  if (!hasAllPermissions(session.permissions, required)) {
    throw new Error('Forbidden: insufficient permissions');
  }
  return session;
}
```

### Agency Dashboard API Routes

### File: `src/lib/permissions/require-agency-permission.ts`

Replaces the current `requireAdmin(session)` pattern. Returns enriched session with permissions and client scope.

```typescript
import { getAuthSession } from '@/lib/auth-session';
import { getDb } from '@/db';
import { agencyMemberships, roleTemplates, agencyClientAssignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolvePermissions, hasAllPermissions } from './resolve';
import type { AgencyPermission } from './constants';

interface AgencySession {
  personId: string;
  userId: string;
  membershipId: string;
  permissions: Set<string>;
  clientScope: 'all' | 'assigned';
  assignedClientIds: string[] | null; // null means 'all'
}

/**
 * Get the authenticated agency session with resolved permissions.
 * Also resolves client scope (all vs assigned client list).
 */
export async function getAgencySession(): Promise<AgencySession | null> {
  // ... reads NextAuth session, looks up users.personId,
  // then agency_membership + role_template,
  // resolves permissions, loads assigned clients if scoped
}

/**
 * Require specific agency permission(s). Throws 403 if not authorized.
 * Use in API route handlers.
 */
export async function requireAgencyPermission(
  ...required: AgencyPermission[]
): Promise<AgencySession> {
  const session = await getAgencySession();
  if (!session) {
    throw new Error('Unauthorized: not authenticated');
  }
  if (!hasAllPermissions(session.permissions, required)) {
    throw new Error('Forbidden: insufficient permissions');
  }
  return session;
}

/**
 * Check if an agency session has access to a specific client.
 * For 'all' scope, always returns true.
 * For 'assigned' scope, checks agency_client_assignments.
 */
export function canAccessClient(
  session: AgencySession,
  clientId: string
): boolean {
  if (session.clientScope === 'all') return true;
  return session.assignedClientIds?.includes(clientId) ?? false;
}
```

## Permission Escalation Prevention

### File: `src/lib/permissions/escalation-guard.ts`

Prevents users from granting permissions they don&apos;t hold.

```typescript
/**
 * Validate that a granting user holds all permissions they're trying to assign.
 * Throws if escalation is detected.
 *
 * @param granterPermissions - The permissions of the user doing the granting
 * @param targetPermissions - The permissions being assigned to the target
 */
export function preventEscalation(
  granterPermissions: Set<string>,
  targetPermissions: string[]
): void {
  const escalated = targetPermissions.filter(p => !granterPermissions.has(p));
  if (escalated.length > 0) {
    throw new Error(
      `Permission escalation denied: you cannot grant permissions you don't hold: ${escalated.join(', ')}`
    );
  }
}

/**
 * Validate permission overrides. The granting user must hold
 * any permissions they're granting as overrides.
 */
export function validateOverrides(
  granterPermissions: Set<string>,
  overrides: { grant?: string[]; revoke?: string[] }
): void {
  if (overrides.grant) {
    preventEscalation(granterPermissions, overrides.grant);
  }
  // Revoking is always allowed (you can restrict others but not elevate)
}
```

## Client-Side Permission Hook

### File: `src/hooks/use-permissions.ts`

React hook for client components to check permissions (for UI hiding/showing).

```typescript
'use client';

import { createContext, useContext } from 'react';
import type { Permission } from '@/lib/permissions/constants';

interface PermissionContextValue {
  permissions: string[];
  isOwner: boolean;
  personId: string;
  clientId?: string;
}

export const PermissionContext = createContext<PermissionContextValue>({
  permissions: [],
  isOwner: false,
  personId: '',
});

export function usePermissions() {
  const ctx = useContext(PermissionContext);

  return {
    ...ctx,
    hasPermission: (p: Permission) => ctx.permissions.includes(p),
    hasAnyPermission: (ps: Permission[]) => ps.some(p => ctx.permissions.includes(p)),
    hasAllPermissions: (ps: Permission[]) => ps.every(p => ctx.permissions.includes(p)),
  };
}
```

**Usage in components:**

```tsx
const { hasPermission } = usePermissions();

// Hide nav item if user lacks permission
{hasPermission('portal.analytics.view') && (
  <Link href="/client/analytics">Analytics</Link>
)}

// Disable button if user lacks edit permission
<Button disabled={!hasPermission('portal.leads.edit')}>
  Edit Lead
</Button>
```

**Note:** Client-side checks are for UX only. Server-side permission checks (API routes) are the security boundary.

## Migration Path for Existing Code

### Replacing `requireAdmin(session)`

**Before:**
```typescript
const session = await getServerSession(authOptions);
requireAdmin(session); // throws if not admin
```

**After:**
```typescript
const session = await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_VIEW);
// session now includes permissions, clientScope, assignedClientIds
```

### Replacing `getClientSession()`

**Before:**
```typescript
const session = await getClientSession();
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const { clientId } = session;
```

**After:**
```typescript
const session = await requirePortalPermission(PORTAL_PERMISSIONS.LEADS_VIEW);
// session now includes personId, clientId, permissions, isOwner
```

## File Checklist

| # | File | Action |
|---|------|--------|
| 1 | `src/lib/permissions/constants.ts` | CREATE |
| 2 | `src/lib/permissions/templates.ts` | CREATE |
| 3 | `src/lib/permissions/resolve.ts` | CREATE |
| 4 | `src/lib/permissions/require-portal-permission.ts` | CREATE |
| 5 | `src/lib/permissions/require-agency-permission.ts` | CREATE |
| 6 | `src/lib/permissions/escalation-guard.ts` | CREATE |
| 7 | `src/lib/permissions/index.ts` | CREATE (barrel export) |
| 8 | `src/hooks/use-permissions.ts` | CREATE |

## Implementation Steps

1. Create `src/lib/permissions/` directory
2. Write `constants.ts` with all permission strings and types
3. Write `templates.ts` with built-in role template definitions
4. Write `resolve.ts` with permission resolution logic
5. Write `escalation-guard.ts` with escalation prevention
6. Write `require-portal-permission.ts` (depends on updated `client-auth.ts` from SPEC-03)
7. Write `require-agency-permission.ts` (depends on updated `auth-session.ts` from SPEC-03)
8. Write `index.ts` barrel export
9. Write `use-permissions.ts` React hook
10. Run `npm run typecheck`

**Note:** Steps 6-7 depend on the auth flow changes in SPEC-03. The permission resolution logic (steps 2-5) can be implemented independently and tested with unit tests.

## Verification

- [ ] All permission constants defined and typed
- [ ] `resolvePermissions()` correctly applies grants and revokes
- [ ] `preventEscalation()` blocks attempts to grant unowned permissions
- [ ] `hasPermission` / `hasAllPermissions` / `hasAnyPermission` work correctly
- [ ] `usePermissions` hook provides correct API for client components
- [ ] `npm run typecheck` passes
- [ ] No `as any` casts in permission checking code

## Risks

- **Performance**: Permission resolution happens on every request. Mitigate by caching resolved permissions in the session cookie/token (not re-querying DB each time).
- **Missing permissions**: If a new feature is added without a corresponding permission, it defaults to accessible. Mitigate by requiring explicit permission checks in API route creation checklist.
