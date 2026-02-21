import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { clientMemberships, people, escalationClaims, escalationQueue } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().min(10).optional(),
  email: z.string().email().optional().or(z.literal('')).optional(),
  role: z.string().optional(),
  receiveEscalations: z.boolean().optional(),
  receiveHotTransfers: z.boolean().optional(),
  priority: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();
    const data = parsed.data;

    // Get the membership to find the person
    const [membership] = await db
      .select()
      .from(clientMemberships)
      .where(eq(clientMemberships.id, id))
      .limit(1);

    if (!membership) {
      return Response.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Update membership fields
    const membershipUpdates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.receiveEscalations !== undefined) membershipUpdates.receiveEscalations = data.receiveEscalations;
    if (data.receiveHotTransfers !== undefined) membershipUpdates.receiveHotTransfers = data.receiveHotTransfers;
    if (data.priority !== undefined) membershipUpdates.priority = data.priority;
    if (data.isActive !== undefined) membershipUpdates.isActive = data.isActive;

    // Update person fields
    const personUpdates: Record<string, unknown> = {};
    if (data.name !== undefined) personUpdates.name = data.name;
    if (data.phone !== undefined) personUpdates.phone = data.phone;
    if (data.email !== undefined) personUpdates.email = data.email || null;

    await db.transaction(async (tx) => {
      if (Object.keys(membershipUpdates).length > 1) {
        await tx
          .update(clientMemberships)
          .set(membershipUpdates)
          .where(eq(clientMemberships.id, id));
      }

      if (Object.keys(personUpdates).length > 0) {
        personUpdates.updatedAt = new Date();
        await tx
          .update(people)
          .set(personUpdates)
          .where(eq(people.id, membership.personId));
      }
    });

    // Fetch updated result for response
    const [person] = await db
      .select()
      .from(people)
      .where(eq(people.id, membership.personId))
      .limit(1);

    const [updated] = await db
      .select()
      .from(clientMemberships)
      .where(eq(clientMemberships.id, id))
      .limit(1);

    const member = {
      id: updated.id,
      clientId: updated.clientId,
      name: person?.name || '',
      phone: person?.phone || '',
      email: person?.email || null,
      role: null,
      receiveEscalations: updated.receiveEscalations,
      receiveHotTransfers: updated.receiveHotTransfers,
      priority: updated.priority,
      isActive: updated.isActive,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    return Response.json({ success: true, member });
  } catch (error) {
    console.error('[TeamHours] Team member update error:', error);
    return Response.json({ error: 'Failed to update team member' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const db = getDb();

    // Get the membership
    const [membership] = await db
      .select({ id: clientMemberships.id })
      .from(clientMemberships)
      .where(eq(clientMemberships.id, id))
      .limit(1);

    if (!membership) {
      return Response.json({ error: 'Team member not found' }, { status: 404 });
    }

    // Soft-delete: deactivate the membership
    await db
      .update(clientMemberships)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(clientMemberships.id, id));

    // Release open escalation items assigned to this membership
    await db
      .update(escalationClaims)
      .set({ claimedBy: null, status: 'pending', claimedAt: null })
      .where(and(
        eq(escalationClaims.claimedBy, id),
        inArray(escalationClaims.status, ['pending', 'claimed'])
      ));

    await db
      .update(escalationQueue)
      .set({ assignedTo: null, status: 'pending', assignedAt: null, updatedAt: new Date() })
      .where(and(
        eq(escalationQueue.assignedTo, id),
        inArray(escalationQueue.status, ['assigned', 'in_progress'])
      ));

    return Response.json({ success: true });
  } catch (error) {
    console.error('[TeamHours] Team member deletion error:', error);
    return Response.json({ error: 'Failed to delete team member' }, { status: 500 });
  }
}
