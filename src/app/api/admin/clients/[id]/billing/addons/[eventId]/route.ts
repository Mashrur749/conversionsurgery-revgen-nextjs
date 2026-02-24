import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { addonBillingEvents } from '@/db/schema';

const patchSchema = z.object({
  disputeStatus: z.enum(['none', 'reviewing', 'disputed', 'resolved']),
  disputeNote: z.string().max(2000).optional().nullable(),
});

export const PATCH = adminClientRoute(
  {
    permission: AGENCY_PERMISSIONS.BILLING_MANAGE,
    clientIdFrom: (params: { id: string; eventId: string }) => params.id,
  },
  async ({ clientId, params, request, session }) => {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const db = getDb();
    const { disputeStatus, disputeNote } = parsed.data;
    const now = new Date();

    const updatePayload: Partial<typeof addonBillingEvents.$inferInsert> = {
      disputeStatus,
      disputeNote: disputeNote ?? null,
      updatedAt: now,
    };

    if (disputeStatus === 'none') {
      updatePayload.disputedAt = null;
      updatePayload.resolvedAt = null;
      updatePayload.resolvedBy = null;
    } else if (disputeStatus === 'resolved') {
      updatePayload.resolvedAt = now;
      updatePayload.resolvedBy = session.userId;
      updatePayload.disputedAt = updatePayload.disputedAt ?? now;
    } else {
      updatePayload.disputedAt = now;
      updatePayload.resolvedAt = null;
      updatePayload.resolvedBy = null;
    }

    const [updated] = await db
      .update(addonBillingEvents)
      .set(updatePayload)
      .where(and(
        eq(addonBillingEvents.id, params.eventId),
        eq(addonBillingEvents.clientId, clientId)
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Add-on billing event not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, event: updated });
  }
);
