import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { logDeleteAudit } from '@/lib/services/audit';

const updateSchema = z.object({
  responseText: z.string().min(1).optional(),
  status: z.enum(['draft', 'pending_approval', 'approved', 'posted', 'rejected']).optional(),
});

/** GET - Get a single review response by ID. */
export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ params }) => {
    const { id } = params;

    const db = getDb();
    const [response] = await db
      .select()
      .from(reviewResponses)
      .where(eq(reviewResponses.id, id))
      .limit(1);

    if (!response) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(response);
  }
);

/** PATCH - Update a review response's text or status. */
export const PATCH = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ request, params }) => {
    const { id } = params;

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.responseText) updates.responseText = data.responseText;
    if (data.status) updates.status = data.status;

    const db = getDb();
    await db
      .update(reviewResponses)
      .set(updates)
      .where(eq(reviewResponses.id, id));

    return NextResponse.json({ success: true });
  }
);

/** DELETE - Delete a draft review response. */
export const DELETE = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ params }) => {
    const { id } = params;

    const db = getDb();
    const [deleted] = await db.delete(reviewResponses).where(eq(reviewResponses.id, id)).returning();
    if (deleted) {
      await logDeleteAudit({ resourceType: 'review_response', resourceId: id });
    }

    return NextResponse.json({ success: true });
  }
);
