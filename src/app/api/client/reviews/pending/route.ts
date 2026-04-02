import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema/review-responses';
import { reviews } from '@/db/schema/reviews';
import { eq, and, inArray } from 'drizzle-orm';

/** GET /api/client/reviews/pending — Returns pending review response drafts for the portal client */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.REVIEWS_VIEW },
  async ({ session }) => {
    const { clientId } = session;
    const db = getDb();

    const pendingResponses = await db
      .select({
        id: reviewResponses.id,
        reviewId: reviewResponses.reviewId,
        responseText: reviewResponses.responseText,
        responseType: reviewResponses.responseType,
        status: reviewResponses.status,
        submittedAt: reviewResponses.submittedAt,
        createdAt: reviewResponses.createdAt,
        // Review fields
        authorName: reviews.authorName,
        rating: reviews.rating,
        reviewText: reviews.reviewText,
        source: reviews.source,
        reviewDate: reviews.reviewDate,
        aiSuggestedResponse: reviews.aiSuggestedResponse,
      })
      .from(reviewResponses)
      .innerJoin(reviews, eq(reviewResponses.reviewId, reviews.id))
      .where(
        and(
          eq(reviewResponses.clientId, clientId),
          inArray(reviewResponses.status, ['draft', 'pending_approval'])
        )
      )
      .orderBy(reviewResponses.createdAt);

    return NextResponse.json({ responses: pendingResponses });
  }
);
