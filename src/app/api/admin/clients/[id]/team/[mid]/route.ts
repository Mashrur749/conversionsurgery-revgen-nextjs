import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { requireAdmin } from '@/lib/utils/admin-auth';
import { getDb } from '@/db';
import {
  clientMemberships,
  roleTemplates,
  people,
  clients,
  auditLog,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

const updateClientMemberSchema = z.object({
  roleTemplateId: z.string().uuid().optional(),
  permissionOverrides: z.object({
    grant: z.array(z.string()).optional(),
    revoke: z.array(z.string()).optional(),
  }).optional(),
  receiveEscalations: z.boolean().optional(),
  receiveHotTransfers: z.boolean().optional(),
  priority: z.number().int().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session);

    const { id: clientId, mid: membershipId } = await params;
    const body = await request.json();
    const validated = updateClientMemberSchema.parse(body);

    const db = getDb();

    // Load existing membership
    const [existing] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        clientId: clientMemberships.clientId,
        roleTemplateId: clientMemberships.roleTemplateId,
        isOwner: clientMemberships.isOwner,
        personName: people.name,
        clientName: clients.businessName,
        roleSlug: roleTemplates.slug,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .innerJoin(clients, eq(clientMemberships.clientId, clients.id))
      .innerJoin(roleTemplates, eq(clientMemberships.roleTemplateId, roleTemplates.id))
      .where(
        and(
          eq(clientMemberships.id, membershipId),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    // Cannot edit owner through this endpoint (use transfer-ownership instead)
    if (existing.isOwner) {
      return NextResponse.json(
        { error: 'Cannot modify the business owner. Use Transfer Ownership instead.' },
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

      if (template.scope !== 'client') {
        return NextResponse.json(
          { error: 'Only client-scoped role templates can be used' },
          { status: 400 }
        );
      }
    }

    // Build update
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      sessionVersion: sql`session_version + 1`,
    };

    if (validated.roleTemplateId !== undefined) {
      updateData.roleTemplateId = validated.roleTemplateId;
    }
    if (validated.permissionOverrides !== undefined) {
      updateData.permissionOverrides = validated.permissionOverrides;
    }
    if (validated.receiveEscalations !== undefined) {
      updateData.receiveEscalations = validated.receiveEscalations;
    }
    if (validated.receiveHotTransfers !== undefined) {
      updateData.receiveHotTransfers = validated.receiveHotTransfers;
    }
    if (validated.priority !== undefined) {
      updateData.priority = validated.priority;
    }
    if (validated.isActive !== undefined) {
      updateData.isActive = validated.isActive;
    }

    const [updated] = await db
      .update(clientMemberships)
      .set(updateData)
      .where(eq(clientMemberships.id, membershipId))
      .returning();

    // Determine audit action
    let action = 'member.updated';
    if (validated.roleTemplateId) action = 'role.changed';
    if (validated.permissionOverrides) action = 'permission.overridden';

    await db.insert(auditLog).values({
      personId: existing.personId,
      clientId,
      action,
      resourceType: 'client_membership',
      resourceId: membershipId,
      metadata: {
        memberName: existing.personName,
        clientName: existing.clientName,
        changes: Object.keys(validated),
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ membership: updated });
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
    console.error('PATCH /api/admin/clients/[id]/team/[mid] error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  try {
    const session = await auth();
    requireAdmin(session);

    const { id: clientId, mid: membershipId } = await params;
    const db = getDb();

    // Load existing membership
    const [existing] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
        personName: people.name,
        personEmail: people.email,
        clientName: clients.businessName,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .innerJoin(clients, eq(clientMemberships.clientId, clients.id))
      .where(
        and(
          eq(clientMemberships.id, membershipId),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Membership not found' }, { status: 404 });
    }

    if (existing.isOwner) {
      return NextResponse.json(
        { error: 'Cannot remove the business owner. Use Transfer Ownership instead.' },
        { status: 400 }
      );
    }

    // Soft delete
    await db
      .update(clientMemberships)
      .set({
        isActive: false,
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date(),
      })
      .where(eq(clientMemberships.id, membershipId));

    // Audit log
    await db.insert(auditLog).values({
      personId: existing.personId,
      clientId,
      action: 'member.removed',
      resourceType: 'client_membership',
      resourceId: membershipId,
      metadata: {
        memberName: existing.personName,
        memberEmail: existing.personEmail,
        clientName: existing.clientName,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('admin access required')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('DELETE /api/admin/clients/[id]/team/[mid] error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
