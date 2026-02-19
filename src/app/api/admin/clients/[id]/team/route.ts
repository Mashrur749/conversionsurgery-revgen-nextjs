import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import {
  people,
  clientMemberships,
  roleTemplates,
  clients,
  auditLog,
} from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { normalizePhoneNumber } from '@/lib/utils/phone';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);

    const { id: clientId } = await params;
    const db = getDb();

    // Verify client exists
    const [client] = await db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const members = await db
      .select({
        membershipId: clientMemberships.id,
        personId: people.id,
        name: people.name,
        email: people.email,
        phone: people.phone,
        avatarUrl: people.avatarUrl,
        roleTemplateId: clientMemberships.roleTemplateId,
        roleName: roleTemplates.name,
        roleSlug: roleTemplates.slug,
        rolePermissions: roleTemplates.permissions,
        permissionOverrides: clientMemberships.permissionOverrides,
        isOwner: clientMemberships.isOwner,
        receiveEscalations: clientMemberships.receiveEscalations,
        receiveHotTransfers: clientMemberships.receiveHotTransfers,
        priority: clientMemberships.priority,
        isActive: clientMemberships.isActive,
        joinedAt: clientMemberships.createdAt,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .innerJoin(roleTemplates, eq(clientMemberships.roleTemplateId, roleTemplates.id))
      .where(eq(clientMemberships.clientId, clientId));

    return NextResponse.json({
      client,
      members,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.message.includes('Forbidden') || error.message.includes('admin access required')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }
    console.error('GET /api/admin/clients/[id]/team error:', error);
    return NextResponse.json({ error: 'Failed to load client team' }, { status: 500 });
  }
}

const addMemberSchema = z.object({
  personId: z.string().uuid().optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(10).optional(),
  roleTemplateId: z.string().uuid('Valid role template ID is required'),
  permissionOverrides: z.object({
    grant: z.array(z.string()).optional(),
    revoke: z.array(z.string()).optional(),
  }).optional(),
  receiveEscalations: z.boolean().default(false),
  receiveHotTransfers: z.boolean().default(false),
  priority: z.number().int().min(1).max(10).default(1),
}).strict().refine(
  (data) => data.personId || data.name,
  { message: 'Either personId or name is required' }
).refine(
  (data) => data.personId || data.email || data.phone,
  { message: 'Either personId, email, or phone is required for new members' }
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CLIENTS_EDIT);

    const { id: clientId } = await params;
    const body = await request.json();
    const validated = addMemberSchema.parse(body);

    const db = getDb();

    // Verify client exists
    const [client] = await db
      .select({ id: clients.id, businessName: clients.businessName })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Verify role template exists and is client-scoped
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
        { error: 'Only client-scoped role templates can be used for client members' },
        { status: 400 }
      );
    }

    // Find or create person
    let person: { id: string; name: string; email: string | null; phone: string | null };

    if (validated.personId) {
      const [existingPerson] = await db
        .select({ id: people.id, name: people.name, email: people.email, phone: people.phone })
        .from(people)
        .where(eq(people.id, validated.personId))
        .limit(1);

      if (!existingPerson) {
        return NextResponse.json({ error: 'Person not found' }, { status: 404 });
      }
      person = existingPerson;
    } else {
      // Try to find by email first
      if (validated.email) {
        const [byEmail] = await db
          .select({ id: people.id, name: people.name, email: people.email, phone: people.phone })
          .from(people)
          .where(eq(people.email, validated.email))
          .limit(1);

        if (byEmail) {
          person = byEmail;
        } else {
          const normalizedPhone = validated.phone
            ? normalizePhoneNumber(validated.phone)
            : null;

          const [created] = await db
            .insert(people)
            .values({
              name: validated.name!,
              email: validated.email || null,
              phone: normalizedPhone,
            })
            .returning();

          person = { id: created.id, name: created.name, email: created.email, phone: created.phone };
        }
      } else if (validated.phone) {
        const normalizedPhone = normalizePhoneNumber(validated.phone);
        const [byPhone] = await db
          .select({ id: people.id, name: people.name, email: people.email, phone: people.phone })
          .from(people)
          .where(eq(people.phone, normalizedPhone))
          .limit(1);

        if (byPhone) {
          person = byPhone;
        } else {
          const [created] = await db
            .insert(people)
            .values({
              name: validated.name!,
              phone: normalizedPhone,
            })
            .returning();

          person = { id: created.id, name: created.name, email: created.email, phone: created.phone };
        }
      } else {
        return NextResponse.json(
          { error: 'Email or phone is required for new members' },
          { status: 400 }
        );
      }
    }

    // Check if person already has a membership for this client
    const [existingMembership] = await db
      .select({ id: clientMemberships.id })
      .from(clientMemberships)
      .where(eq(clientMemberships.personId, person.id))
      .limit(1);

    if (existingMembership) {
      // Check if it's for this specific client
      const [forThisClient] = await db
        .select({ id: clientMemberships.id })
        .from(clientMemberships)
        .where(eq(clientMemberships.personId, person.id))
        .limit(1);

      // More specific check with both personId and clientId
      const { and } = await import('drizzle-orm');
      const [duplicate] = await db
        .select({ id: clientMemberships.id })
        .from(clientMemberships)
        .where(
          and(
            eq(clientMemberships.personId, person.id),
            eq(clientMemberships.clientId, clientId)
          )
        )
        .limit(1);

      if (duplicate) {
        return NextResponse.json(
          { error: 'This person already has access to this client' },
          { status: 400 }
        );
      }
    }

    // Create membership
    const [membership] = await db
      .insert(clientMemberships)
      .values({
        personId: person.id,
        clientId,
        roleTemplateId: validated.roleTemplateId,
        permissionOverrides: validated.permissionOverrides || null,
        isOwner: false,
        receiveEscalations: validated.receiveEscalations,
        receiveHotTransfers: validated.receiveHotTransfers,
        priority: validated.priority,
        isActive: true,
      })
      .returning();

    // Audit log
    await db.insert(auditLog).values({
      personId: person.id,
      clientId,
      action: 'member.invited',
      resourceType: 'client_membership',
      resourceId: membership.id,
      metadata: {
        memberName: person.name,
        memberEmail: person.email,
        clientName: client.businessName,
        role: template.slug,
        roleName: template.name,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({
      membership: {
        ...membership,
        person,
        role: template,
      },
    });
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
    console.error('POST /api/admin/clients/[id]/team error:', error);
    return NextResponse.json({ error: 'Failed to add team member' }, { status: 500 });
  }
}
