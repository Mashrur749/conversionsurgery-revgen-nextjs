/**
 * Agency permission checking middleware.
 * Replaces the current requireAdmin(session) pattern with permission-aware checks.
 */
import { getAuthSession } from '@/lib/auth-session';
import { getDb } from '@/db';
import {
  agencyMemberships,
  roleTemplates,
  agencyClientAssignments,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolvePermissions, hasAllPermissions } from './resolve';
import { ALL_AGENCY_PERMISSIONS, type AgencyPermission } from './constants';

export interface AgencySession {
  personId: string;
  userId: string;
  membershipId: string;
  permissions: Set<string>;
  clientScope: 'all' | 'assigned';
  assignedClientIds: string[] | null; // null means 'all'
  isLegacy?: boolean;
}

/**
 * Get the authenticated agency session with resolved permissions.
 * Also resolves client scope (all vs assigned client list).
 * Returns null if not authenticated or not an agency member.
 *
 * Legacy admins (pre-SPEC-06 migration) receive ALL agency permissions
 * so they can continue using the admin UI during the transition.
 */
export async function getAgencySession(): Promise<AgencySession | null> {
  const authResult = await getAuthSession();
  if (!authResult) return null;

  const { user } = authResult;
  const db = getDb();

  // If user has personId, use new path
  if (user.personId) {
    const [membership] = await db
      .select({
        id: agencyMemberships.id,
        personId: agencyMemberships.personId,
        roleTemplateId: agencyMemberships.roleTemplateId,
        clientScope: agencyMemberships.clientScope,
        isActive: agencyMemberships.isActive,
        sessionVersion: agencyMemberships.sessionVersion,
      })
      .from(agencyMemberships)
      .where(eq(agencyMemberships.personId, user.personId))
      .limit(1);

    if (!membership || !membership.isActive) return null;

    // Load role template
    const [template] = await db
      .select({ permissions: roleTemplates.permissions })
      .from(roleTemplates)
      .where(eq(roleTemplates.id, membership.roleTemplateId))
      .limit(1);

    if (!template) return null;

    const permissions = resolvePermissions(template.permissions, null);

    // Load assigned clients if scoped
    let assignedClientIds: string[] | null = null;
    if (membership.clientScope === 'assigned') {
      const assignments = await db
        .select({ clientId: agencyClientAssignments.clientId })
        .from(agencyClientAssignments)
        .where(eq(agencyClientAssignments.agencyMembershipId, membership.id));

      assignedClientIds = assignments.map((a) => a.clientId);
    }

    return {
      personId: membership.personId,
      userId: user.id,
      membershipId: membership.id,
      permissions,
      clientScope: membership.clientScope as 'all' | 'assigned',
      assignedClientIds,
    };
  }

  // Legacy path: check users.isAdmin flag
  if (!user.isAdmin) return null;

  // Legacy admins get ALL agency permissions during transition.
  // After SPEC-06 migration links them to a person + agency_membership,
  // they will use the new path above instead.
  return {
    personId: '',
    userId: user.id,
    membershipId: '',
    permissions: new Set<string>(ALL_AGENCY_PERMISSIONS),
    clientScope: 'all',
    assignedClientIds: null,
    isLegacy: true,
  };
}

/**
 * Require specific agency permission(s). Throws if not authorized.
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

/**
 * Require agency permission AND client access in one call.
 * Use in /api/admin/clients/[id]/* route handlers.
 * Throws 'Unauthorized' if not authenticated, 'Forbidden' if insufficient
 * permissions or client not in scope.
 */
export async function requireAgencyClientPermission(
  clientId: string,
  ...required: AgencyPermission[]
): Promise<AgencySession> {
  const session = await requireAgencyPermission(...required);
  if (!canAccessClient(session, clientId)) {
    throw new Error('Forbidden: client not in scope');
  }
  return session;
}
