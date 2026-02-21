import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviews } from '@/db/schema';
import { eq, desc, and, lte } from 'drizzle-orm';
import { syncAllReviews, getReviewSummary } from '@/lib/services/review-monitoring';

/** GET - List reviews for a client with optional filters. */
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const rating = searchParams.get('rating');
    const needsResponse = searchParams.get('needsResponse');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const db = getDb();
    const conditions = [eq(reviews.clientId, clientId)];

    if (source) {
      conditions.push(eq(reviews.source, source));
    }
    if (rating) {
      conditions.push(eq(reviews.rating, parseInt(rating, 10)));
    }
    if (needsResponse === 'true') {
      conditions.push(lte(reviews.rating, 3));
      conditions.push(eq(reviews.hasResponse, false));
    }

    const results = await db
      .select()
      .from(reviews)
      .where(and(...conditions))
      .orderBy(desc(reviews.reviewDate))
      .limit(limit);

    const summary = await getReviewSummary(clientId);

    return NextResponse.json({ reviews: results, summary });
  }
);

/** POST - Sync reviews from all configured sources for a client. */
export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const results = await syncAllReviews(clientId);
    return NextResponse.json(results);
  }
);
