import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema/review-responses';
import { eq, and } from 'drizzle-orm';

/** POST /api/client/reviews/[responseId]/approve — Approve a pending review response draft */
export const POST = portalRoute<{ responseId: string }>(
  { permission: PORTAL_PERMISSIONS.REVIEWS_VIEW },
  async ({ session, params }) => {
    const { clientId, personId } = session;
    const { responseId } = params;
    const db = getDb();

    const [existing] = await db
      .select({ id: reviewResponses.id, status: reviewResponses.status })
      .from(reviewResponses)
      .where(
        and(
          eq(reviewResponses.id, responseId),
          eq(reviewResponses.clientId, clientId)
        )
      )
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Review response not found' }, { status: 404 });
    }

    if (existing.status === 'approved') {
      return NextResponse.json({ error: 'Already approved' }, { status: 409 });
    }

    if (existing.status === 'posted') {
      return NextResponse.json({ error: 'Response has already been posted' }, { status: 409 });
    }

    const [updated] = await db
      .update(reviewResponses)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: personId || null,
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId))
      .returning({ id: reviewResponses.id, status: reviewResponses.status });

    return NextResponse.json({ response: updated });
  }
);
