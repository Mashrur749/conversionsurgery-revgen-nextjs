import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import {
  agencyMemberships,
  agencyClientAssignments,
  roleTemplates,
  people,
  auditLog,
} from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

const updateMemberSchema = z.object({
  roleTemplateId: z.string().uuid().optional(),
  clientScope: z.enum(['all', 'assigned']).optional(),
  assignedClientIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.TEAM_MANAGE);

    const { id } = await params;
    const body = await request.json();
    const validated = updateMemberSchema.parse(body);

    const db = getDb();

    // Load existing membership with role info
    const [existing] = await db
      .select({
        id: agencyMemberships.id,
        personId: agencyMemberships.personId,
        roleTemplateId: agencyMemberships.roleTemplateId,
        clientScope: agencyMemberships.clientScope,
        isActive: agencyMemberships.isActive,
        roleSlug: roleTemplates.slug,
        personName: people.name,
      })
      .from(agencyMemberships)
      .innerJoin(people, eq(agencyMemberships.personId, people.id))
      .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
      .where(eq(agencyMemberships.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot edit agency owner
    if (existing.roleSlug === 'agency_owner') {
      return NextResponse.json(
        { error: 'Cannot modify the agency owner' },
        { status: 400 }
      );
    }

    // Validate new role template if provided
    if (validated.roleTemplateId) {
      const [template] = await db
        .select()
        .from(roleTemplates)
        .where(eq(roleTemplates.id, validated.roleTemplateId))
        .limit(1);

      if (!template) {
        return NextResponse.json({ error: 'Role template not found' }, { status: 404 });
      }

      if (template.scope !== 'agency') {
        return NextResponse.json(
          { error: 'Only agency-scoped role templates can be used' },
          { status: 400 }
        );
      }

      if (template.slug === 'agency_owner') {
        return NextResponse.json(
          { error: 'Cannot assign the Agency Owner role' },
          { status: 400 }
        );
      }
    }

    // Build update set
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (validated.roleTemplateId !== undefined) {
      updateData.roleTemplateId = validated.roleTemplateId;
    }
    if (validated.clientScope !== undefined) {
      updateData.clientScope = validated.clientScope;
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive;
    }

    // Bump session version to force re-auth
    updateData.sessionVersion = sql`session_version + 1`;

    const [updated] = await db
      .update(agencyMemberships)
      .set(updateData)
      .where(eq(agencyMemberships.id, id))
      .returning();

    // Update client assignments if scope changed to assigned
    if (validated.clientScope === 'assigned' && validated.assignedClientIds) {
      // Remove old assignments
      await db
        .delete(agencyClientAssignments)
        .where(eq(agencyClientAssignments.agencyMembershipId, id));

      // Add new ones
      if (validated.assignedClientIds.length > 0) {
        await db.insert(agencyClientAssignments).values(
          validated.assignedClientIds.map((clientId) => ({
            agencyMembershipId: id,
            clientId,
          }))
        );
      }
    } else if (validated.clientScope === 'all') {
      // Remove all assignments when switching to all
      await db
        .delete(agencyClientAssignments)
        .where(eq(agencyClientAssignments.agencyMembershipId, id));
    }

    // Audit log
    const auditMetadata: Record<string, unknown> = {
      memberName: existing.personName,
    };

    if (validated.roleTemplateId) {
      auditMetadata.previousRoleTemplateId = existing.roleTemplateId;
      auditMetadata.newRoleTemplateId = validated.roleTemplateId;
    }
    if (validated.clientScope) {
      auditMetadata.previousClientScope = existing.clientScope;
      auditMetadata.newClientScope = validated.clientScope;
    }
    if (validated.isActive !== undefined) {
      auditMetadata.previousActive = existing.isActive;
      auditMetadata.newActive = validated.isActive;
    }

    await db.insert(auditLog).values({
      personId: existing.personId,
      action: validated.roleTemplateId ? 'role.changed' : 'member.updated',
      resourceType: 'agency_membership',
      resourceId: id,
      metadata: auditMetadata,
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ membership: updated });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('admin access required')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PATCH /api/admin/team/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.TEAM_MANAGE);

    const { id } = await params;
    const db = getDb();

    // Load existing membership
    const [existing] = await db
      .select({
        id: agencyMemberships.id,
        personId: agencyMemberships.personId,
        roleSlug: roleTemplates.slug,
        personName: people.name,
        personEmail: people.email,
      })
      .from(agencyMemberships)
      .innerJoin(people, eq(agencyMemberships.personId, people.id))
      .innerJoin(roleTemplates, eq(agencyMemberships.roleTemplateId, roleTemplates.id))
      .where(eq(agencyMemberships.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Cannot remove agency owner
    if (existing.roleSlug === 'agency_owner') {
      return NextResponse.json(
        { error: 'Cannot remove the agency owner' },
        { status: 400 }
      );
    }

    // Soft delete: deactivate and bump session version
    await db
      .update(agencyMemberships)
      .set({
        isActive: false,
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date(),
      })
      .where(eq(agencyMemberships.id, id));

    // Audit log
    await db.insert(auditLog).values({
      personId: existing.personId,
      action: 'member.removed',
      resourceType: 'agency_membership',
      resourceId: id,
      metadata: {
        memberName: existing.personName,
        memberEmail: existing.personEmail,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('admin access required')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('DELETE /api/admin/team/[id] error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
