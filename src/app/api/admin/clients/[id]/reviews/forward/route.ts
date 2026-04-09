import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const forwardSchema = z.object({
  responseId: z.string().uuid(),
});

/**
 * POST: Forward a review response to the client for their input.
 * Marks the response as forwarded so it appears on the client portal.
 */
export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const { responseId } = forwardSchema.parse(body);

    const db = getDb();

    // Verify response belongs to this client
    const [response] = await db
      .select({ id: reviewResponses.id, status: reviewResponses.status })
      .from(reviewResponses)
      .where(
        and(
          eq(reviewResponses.id, responseId),
          eq(reviewResponses.clientId, clientId)
        )
      )
      .limit(1);

    if (!response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    // Mark as forwarded and set to pending_approval
    await db
      .update(reviewResponses)
      .set({
        forwardedToClient: new Date(),
        status: 'pending_approval',
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId));

    return NextResponse.json({ success: true });
  }
);
