import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { escalationClaims } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const batchSchema = z
  .object({
    escalationIds: z.array(z.string().uuid()).min(1, 'At least one escalation ID is required'),
    action: z.enum(['acknowledge', 'dismiss']),
    note: z.string().max(500).optional(),
  })
  .strict();

export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request }) => {
    const body = (await request.json()) as unknown;
    const { escalationIds, action } = batchSchema.parse(body);

    const db = getDb();
    const now = new Date();

    const newStatus = action === 'acknowledge' ? 'resolved' : 'dismissed';

    const updated = await db
      .update(escalationClaims)
      .set({
        status: newStatus,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(inArray(escalationClaims.id, escalationIds))
      .returning({ id: escalationClaims.id });

    return NextResponse.json({ updated: updated.length });
  }
);
