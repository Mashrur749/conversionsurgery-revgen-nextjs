import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { ALL_PERMISSIONS, preventEscalation } from '@/lib/permissions';
import { getDb } from '@/db';
import { roleTemplates, agencyMemberships, clientMemberships, auditLog } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1).optional(),
}).strict();

export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async ({ request, session, params }) => {
    const { id } = params;
    const body = await request.json();
    const validated = updateRoleSchema.parse(body);

    const db = getDb();

    // Load existing template
    const [existing] = await db
      .select()
      .from(roleTemplates)
      .where(eq(roleTemplates.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Role template not found' }, { status: 404 });
    }

    if (existing.isBuiltIn) {
      return NextResponse.json(
        { error: 'Built-in role templates cannot be modified' },
        { status: 400 }
      );
    }

    // Validate permissions if provided
    if (validated.permissions) {
      const invalidPerms = validated.permissions.filter(
        (p) => !ALL_PERMISSIONS.includes(p as typeof ALL_PERMISSIONS[number])
      );
      if (invalidPerms.length > 0) {
        return NextResponse.json(
          { error: 'Invalid permissions', details: invalidPerms },
          { status: 400 }
        );
      }

      // Escalation prevention: editor must hold all permissions in the updated role
      try {
        preventEscalation(session.permissions, validated.permissions);
      } catch {
        return NextResponse.json(
          { error: 'Permission escalation denied' },
          { status: 403 }
        );
      }
    }

    const [updated] = await db
      .update(roleTemplates)
      .set({
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.permissions !== undefined && { permissions: validated.permissions }),
        updatedAt: new Date(),
      })
      .where(eq(roleTemplates.id, id))
      .returning();

    // Audit log
    await db.insert(auditLog).values({
      action: 'role.updated',
      resourceType: 'role_template',
      resourceId: id,
      metadata: {
        roleName: updated.name,
        changes: Object.keys(validated),
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ template: updated });
  }
);

export const DELETE = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.TEAM_MANAGE },
  async ({ request, params }) => {
    const { id } = params;
    const db = getDb();

    // Load existing template
    const [existing] = await db
      .select()
      .from(roleTemplates)
      .where(eq(roleTemplates.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Role template not found' }, { status: 404 });
    }

    if (existing.isBuiltIn) {
      return NextResponse.json(
        { error: 'Built-in role templates cannot be deleted' },
        { status: 400 }
      );
    }

    // Check if any agency memberships use this template
    const [agencyUsage] = await db
      .select({ total: count() })
      .from(agencyMemberships)
      .where(eq(agencyMemberships.roleTemplateId, id));

    // Check if any client memberships use this template
    const [clientUsage] = await db
      .select({ total: count() })
      .from(clientMemberships)
      .where(eq(clientMemberships.roleTemplateId, id));

    const totalUsage = (agencyUsage?.total || 0) + (clientUsage?.total || 0);

    if (totalUsage > 0) {
      return NextResponse.json(
        {
          error: `This role is assigned to ${totalUsage} member${totalUsage === 1 ? '' : 's'}. Reassign them first.`,
        },
        { status: 400 }
      );
    }

    await db.delete(roleTemplates).where(eq(roleTemplates.id, id));

    // Audit log
    await db.insert(auditLog).values({
      action: 'role.deleted',
      resourceType: 'role_template',
      resourceId: id,
      metadata: {
        roleName: existing.name,
        scope: existing.scope,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  }
);
