import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { clientMemberships, roleTemplates, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  requirePortalPermission,
  PORTAL_PERMISSIONS,
  preventEscalation,
  invalidateClientSession,
} from '@/lib/permissions';

const updateMemberSchema = z
  .object({
    roleTemplateId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    receiveEscalations: z.boolean().optional(),
    receiveHotTransfers: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

/**
 * PATCH /api/client/team/[id]
 * Update a team member (role, status, escalation settings).
 * Requires: portal.team.manage
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.TEAM_MANAGE);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { clientId, personId: granterId, permissions: granterPermissions } = session;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const db = getDb();

    // Load the membership to update
    const [membership] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
        clientId: clientMemberships.clientId,
      })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.id, id),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Cannot modify the owner
    if (membership.isOwner) {
      return NextResponse.json(
        { error: 'Cannot modify the business owner.' },
        { status: 403 }
      );
    }

    // Cannot modify yourself
    if (membership.personId === granterId) {
      return NextResponse.json(
        { error: 'Cannot modify your own membership.' },
        { status: 403 }
      );
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    const { roleTemplateId, isActive, receiveEscalations, receiveHotTransfers } = parsed.data;

    // If changing role, check escalation prevention
    if (roleTemplateId) {
      const [targetTemplate] = await db
        .select({
          permissions: roleTemplates.permissions,
          scope: roleTemplates.scope,
        })
        .from(roleTemplates)
        .where(eq(roleTemplates.id, roleTemplateId))
        .limit(1);

      if (!targetTemplate) {
        return NextResponse.json(
          { error: 'Role template not found' },
          { status: 404 }
        );
      }

      if (targetTemplate.scope !== 'client') {
        return NextResponse.json(
          { error: 'Invalid role template scope. Must be a client role.' },
          { status: 400 }
        );
      }

      if (!session.isOwner) {
        try {
          preventEscalation(granterPermissions, targetTemplate.permissions);
        } catch (escalationError) {
          return NextResponse.json(
            { error: escalationError instanceof Error ? escalationError.message : 'Permission escalation denied' },
            { status: 403 }
          );
        }
      }

      updateData.roleTemplateId = roleTemplateId;
    }

    if (isActive !== undefined) updateData.isActive = isActive;
    if (receiveEscalations !== undefined) updateData.receiveEscalations = receiveEscalations;
    if (receiveHotTransfers !== undefined) updateData.receiveHotTransfers = receiveHotTransfers;

    await db
      .update(clientMemberships)
      .set(updateData)
      .where(eq(clientMemberships.id, id));

    // Invalidate the target user's session so they get fresh permissions
    if (roleTemplateId || isActive === false) {
      await invalidateClientSession(id);
    }

    // Audit log
    await db.insert(auditLog).values({
      personId: granterId,
      clientId,
      action: isActive === false ? 'team.member_deactivated' : 'team.member_updated',
      resourceType: 'client_membership',
      resourceId: id,
      metadata: {
        targetPersonId: membership.personId,
        changes: parsed.data,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ClientTeam PATCH] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update team member' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/client/team/[id]
 * Remove a team member (deactivate membership).
 * Requires: portal.team.manage
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.TEAM_MANAGE);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { clientId, personId: granterId } = session;

  try {
    const db = getDb();

    // Load the membership
    const [membership] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
      })
      .from(clientMemberships)
      .where(
        and(
          eq(clientMemberships.id, id),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (!membership) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    if (membership.isOwner) {
      return NextResponse.json(
        { error: 'Cannot remove the business owner.' },
        { status: 403 }
      );
    }

    if (membership.personId === granterId) {
      return NextResponse.json(
        { error: 'Cannot remove yourself.' },
        { status: 403 }
      );
    }

    // Deactivate (soft delete)
    await db
      .update(clientMemberships)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clientMemberships.id, id));

    // Invalidate session
    await invalidateClientSession(id);

    // Audit log
    await db.insert(auditLog).values({
      personId: granterId,
      clientId,
      action: 'team.member_removed',
      resourceType: 'client_membership',
      resourceId: id,
      metadata: { targetPersonId: membership.personId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[ClientTeam DELETE] Error:', error);
    return NextResponse.json(
      { error: 'Failed to remove team member' },
      { status: 500 }
    );
  }
}
