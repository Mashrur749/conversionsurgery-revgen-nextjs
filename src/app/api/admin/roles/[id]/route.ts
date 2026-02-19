import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { getDb } from '@/db';
import { roleTemplates, agencyMemberships, clientMemberships, auditLog } from '@/db/schema';
import { eq, count } from 'drizzle-orm';
import { z } from 'zod';
import { ALL_PERMISSIONS } from '@/lib/permissions';

const updateRoleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  permissions: z.array(z.string()).min(1).optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session);

    const { id } = await params;
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('admin access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('PATCH /api/admin/roles/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update role template' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session);

    const { id } = await params;
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
  } catch (error) {
    if (error instanceof Error && error.message.includes('admin access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('DELETE /api/admin/roles/[id] error:', error);
    return NextResponse.json({ error: 'Failed to delete role template' }, { status: 500 });
  }
}
