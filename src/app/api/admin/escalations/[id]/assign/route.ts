import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, escalationQueue, clientMemberships } from '@/db';
import { eq, and } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const assignSchema = z
  .object({
    assignedTo: z.string().uuid().nullable(),
  })
  .strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request, params }) => {
    const { id } = params as unknown as { id: string };
    const body = (await request.json()) as unknown;
    const { assignedTo } = assignSchema.parse(body);

    const db = getDb();
    const now = new Date();

    // If assigning to a member, verify they belong to the same client as this escalation
    if (assignedTo !== null) {
      const [escalation] = await db
        .select({ clientId: escalationQueue.clientId })
        .from(escalationQueue)
        .where(eq(escalationQueue.id, id));

      if (!escalation) {
        return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
      }

      const [membership] = await db
        .select({ id: clientMemberships.id })
        .from(clientMemberships)
        .where(
          and(
            eq(clientMemberships.id, assignedTo),
            eq(clientMemberships.clientId, escalation.clientId),
            eq(clientMemberships.isActive, true)
          )
        );

      if (!membership) {
        return NextResponse.json(
          { error: 'Team member not found for this client' },
          { status: 400 }
        );
      }
    }

    const [updated] = await db
      .update(escalationQueue)
      .set({
        assignedTo: assignedTo ?? undefined,
        assignedAt: assignedTo ? now : undefined,
        status: assignedTo ? 'assigned' : 'pending',
        updatedAt: now,
      })
      .where(eq(escalationQueue.id, id))
      .returning({ id: escalationQueue.id, assignedTo: escalationQueue.assignedTo });

    if (!updated) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
    }

    return NextResponse.json({ id: updated.id, assignedTo: updated.assignedTo });
  }
);
