import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/db';
import { escalationQueue } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';

const resolveSchema = z
  .object({
    status: z.enum(['resolved', 'dismissed']),
    resolution: z
      .enum(['handled', 'returned_to_ai', 'no_action', 'converted', 'lost'])
      .optional(),
    resolutionNotes: z.string().max(2000).optional(),
  })
  .strict();

/**
 * PATCH /api/admin/escalations/[id]
 * Resolve or dismiss an escalation.
 *
 * Note: resolvedBy references clientMemberships (not agencyMemberships), so it
 * is intentionally left null when an agency operator resolves directly.
 */
export const PATCH = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT },
  async ({ request, params }) => {
    const { id } = params as unknown as { id: string };
    const body = (await request.json()) as unknown;
    const { status, resolution, resolutionNotes } = resolveSchema.parse(body);

    const db = getDb();
    const now = new Date();

    const [updated] = await db
      .update(escalationQueue)
      .set({
        status,
        resolution: resolution ?? null,
        resolutionNotes: resolutionNotes ?? null,
        resolvedAt: now,
        updatedAt: now,
      })
      .where(eq(escalationQueue.id, id))
      .returning({
        id: escalationQueue.id,
        status: escalationQueue.status,
        resolution: escalationQueue.resolution,
        resolvedAt: escalationQueue.resolvedAt,
      });

    if (!updated) {
      return NextResponse.json({ error: 'Escalation not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  }
);
