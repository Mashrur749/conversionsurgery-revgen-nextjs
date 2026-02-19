/**
 * Portal (client) permission checking middleware.
 * Replaces the current getClientSession() pattern with permission-aware checks.
 *
 * Supports both:
 * - New cookie format (personId + clientId + permissions + sessionVersion)
 * - Legacy cookie format (clientId only — looks up owner membership from DB)
 */
import { getClientSession } from '@/lib/client-auth';
import { getDb } from '@/db';
import { clientMemberships, roleTemplates } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { resolvePermissions, hasAllPermissions } from './resolve';
import type { PortalPermission } from './constants';
import type { PermissionOverrides } from './resolve';

export interface PortalSession {
  personId: string;
  clientId: string;
  membershipId: string;
  permissions: Set<string>;
  isOwner: boolean;
}

/**
 * Get the authenticated client portal session with resolved permissions.
 * Returns null if not authenticated or membership is inactive.
 *
 * New format path: uses personId + clientId from cookie to look up ANY membership
 * (owners, office managers, team members — all work).
 *
 * Legacy format path: uses clientId only and looks up the owner membership
 * (pre-migration fallback).
 */
export async function getPortalSession(): Promise<PortalSession | null> {
  const session = await getClientSession();
  if (!session) return null;

  const { clientId } = session;
  const db = getDb();

  // New format: cookie carries personId + permissions
  if ('personId' in session && session.personId) {
    const [membership] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
        isActive: clientMemberships.isActive,
        roleTemplateId: clientMemberships.roleTemplateId,
        permissionOverrides: clientMemberships.permissionOverrides,
      })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.personId, session.personId),
          eq(clientMemberships.clientId, clientId),
          eq(clientMemberships.isActive, true)
        )
      )
      .limit(1);

    if (!membership) return null;

    // Load role template permissions
    const [template] = await db
      .select({ permissions: roleTemplates.permissions })
      .from(roleTemplates)
      .where(eq(roleTemplates.id, membership.roleTemplateId))
      .limit(1);

    if (!template) return null;

    const overrides = membership.permissionOverrides as PermissionOverrides | null;
    const permissions = resolvePermissions(template.permissions, overrides);

    return {
      personId: membership.personId,
      clientId,
      membershipId: membership.id,
      permissions,
      isOwner: membership.isOwner,
    };
  }

  // Legacy format: clientId only — look up owner membership
  const [membership] = await db
    .select({
      id: clientMemberships.id,
      personId: clientMemberships.personId,
      isOwner: clientMemberships.isOwner,
      isActive: clientMemberships.isActive,
      roleTemplateId: clientMemberships.roleTemplateId,
      permissionOverrides: clientMemberships.permissionOverrides,
    })
    .from(clientMemberships)
    .where(
      and(
        eq(clientMemberships.clientId, clientId),
        eq(clientMemberships.isOwner, true),
        eq(clientMemberships.isActive, true)
      )
    )
    .limit(1);

  if (!membership) {
    // No owner membership yet (pre-migration via SPEC-06).
    // Return null — callers should fall back to the existing getClientSession().
    return null;
  }

  // Load role template permissions
  const [template] = await db
    .select({ permissions: roleTemplates.permissions })
    .from(roleTemplates)
    .where(eq(roleTemplates.id, membership.roleTemplateId))
    .limit(1);

  if (!template) return null;

  const overrides = membership.permissionOverrides as PermissionOverrides | null;
  const permissions = resolvePermissions(template.permissions, overrides);

  return {
    personId: membership.personId,
    clientId,
    membershipId: membership.id,
    permissions,
    isOwner: membership.isOwner,
  };
}

/**
 * Require specific portal permission(s). Throws if not authorized.
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
