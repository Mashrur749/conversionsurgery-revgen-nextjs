import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { postResponseToGoogle } from '@/lib/services/google-business';
import { z } from 'zod';

const batchApproveSchema = z.object({
  responseIds: z.array(z.string().uuid()).min(1).max(50),
});

/**
 * POST: Batch-approve review responses and post them to Google.
 * Used by the operator to approve drafts for operator_managed clients.
 */
export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const { responseIds } = batchApproveSchema.parse(body);

    const db = getDb();

    // Verify all responses belong to this client and are in approvable state
    const responses = await db
      .select({ id: reviewResponses.id, status: reviewResponses.status })
      .from(reviewResponses)
      .where(
        and(
          eq(reviewResponses.clientId, clientId),
          inArray(reviewResponses.id, responseIds),
          inArray(reviewResponses.status, ['draft', 'pending_approval'])
        )
      );

    if (responses.length === 0) {
      return NextResponse.json({ error: 'No approvable responses found' }, { status: 404 });
    }

    const validIds = responses.map((r) => r.id);
    const now = new Date();

    // Approve all valid responses
    await db
      .update(reviewResponses)
      .set({ status: 'approved', approvedAt: now, updatedAt: now })
      .where(inArray(reviewResponses.id, validIds));

    // Post each to Google
    let posted = 0;
    let postErrors = 0;
    for (const id of validIds) {
      try {
        const result = await postResponseToGoogle(id);
        if (result.success) {
          posted++;
        } else {
          postErrors++;
        }
      } catch {
        postErrors++;
      }
    }

    return NextResponse.json({
      approved: validIds.length,
      posted,
      postErrors,
      skipped: responseIds.length - validIds.length,
    });
  }
);
