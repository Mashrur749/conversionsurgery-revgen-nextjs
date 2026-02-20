import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { reviews } from '@/db/schema';
import { eq, desc, and, lte } from 'drizzle-orm';
import { syncAllReviews, getReviewSummary } from '@/lib/services/review-monitoring';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET - List reviews for a client with optional filters. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const rating = searchParams.get('rating');
  const needsResponse = searchParams.get('needsResponse');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const db = getDb();
  const conditions = [eq(reviews.clientId, id)];

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

  const summary = await getReviewSummary(id);

  return NextResponse.json({ reviews: results, summary });
}

/** POST - Sync reviews from all configured sources for a client. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.CLIENTS_EDIT);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const results = await syncAllReviews(id);
    return NextResponse.json(results);
  } catch (error) {
    console.error('[Reputation] Review sync error for client', id, ':', error);
    return NextResponse.json(
      { error: 'Failed to sync reviews' },
      { status: 500 }
    );
  }
}
