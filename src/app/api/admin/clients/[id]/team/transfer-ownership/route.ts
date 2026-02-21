import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
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

const transferSchema = z.object({
  targetMembershipId: z.string().uuid('Valid membership ID is required'),
  confirmName: z.string().min(1, 'Confirmation name is required'),
}).strict();

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const validated = transferSchema.parse(body);

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

    // Find target membership
    const [targetMembership] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        isOwner: clientMemberships.isOwner,
        isActive: clientMemberships.isActive,
        personName: people.name,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(
        and(
          eq(clientMemberships.id, validated.targetMembershipId),
          eq(clientMemberships.clientId, clientId)
        )
      )
      .limit(1);

    if (!targetMembership) {
      return NextResponse.json({ error: 'Target member not found' }, { status: 404 });
    }

    if (!targetMembership.isActive) {
      return NextResponse.json(
        { error: 'Target member is inactive' },
        { status: 400 }
      );
    }

    if (targetMembership.isOwner) {
      return NextResponse.json(
        { error: 'Target is already the owner' },
        { status: 400 }
      );
    }

    // Typed confirmation check
    if (validated.confirmName !== targetMembership.personName) {
      return NextResponse.json(
        { error: 'Confirmation name does not match the target member' },
        { status: 400 }
      );
    }

    // Find the business_owner role template
    const [ownerTemplate] = await db
      .select({ id: roleTemplates.id })
      .from(roleTemplates)
      .where(eq(roleTemplates.slug, 'business_owner'))
      .limit(1);

    if (!ownerTemplate) {
      return NextResponse.json(
        { error: 'Business Owner role template not found' },
        { status: 500 }
      );
    }

    // Find current owner
    const [currentOwner] = await db
      .select({
        id: clientMemberships.id,
        personId: clientMemberships.personId,
        personName: people.name,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(
        and(
          eq(clientMemberships.clientId, clientId),
          eq(clientMemberships.isOwner, true)
        )
      )
      .limit(1);

    // Find the office_manager template as fallback for previous owner
    const [officeManagerTemplate] = await db
      .select({ id: roleTemplates.id })
      .from(roleTemplates)
      .where(eq(roleTemplates.slug, 'office_manager'))
      .limit(1);

    // Transfer: remove owner from current, set on target
    if (currentOwner) {
      await db
        .update(clientMemberships)
        .set({
          isOwner: false,
          roleTemplateId: officeManagerTemplate?.id || currentOwner.id,
          sessionVersion: sql`session_version + 1`,
          updatedAt: new Date(),
        })
        .where(eq(clientMemberships.id, currentOwner.id));
    }

    // Set new owner
    await db
      .update(clientMemberships)
      .set({
        isOwner: true,
        roleTemplateId: ownerTemplate.id,
        sessionVersion: sql`session_version + 1`,
        updatedAt: new Date(),
      })
      .where(eq(clientMemberships.id, validated.targetMembershipId));

    // Audit log
    await db.insert(auditLog).values({
      personId: targetMembership.personId,
      clientId,
      action: 'owner.transferred',
      resourceType: 'client_membership',
      resourceId: validated.targetMembershipId,
      metadata: {
        previousOwnerName: currentOwner?.personName || null,
        newOwnerName: targetMembership.personName,
        clientName: client.businessName,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    });

    return NextResponse.json({ success: true });
  }
);
