import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema/review-responses';
import { reviews } from '@/db/schema/reviews';
import { eq, and, inArray } from 'drizzle-orm';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PendingReviews } from './pending-reviews';

export const dynamic = 'force-dynamic';

export default async function ReviewsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.REVIEWS_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

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

  // Serialize Date fields to ISO strings for client component compatibility
  const serialized = pendingResponses.map((r) => ({
    ...r,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    reviewDate: r.reviewDate?.toISOString() ?? null,
  }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs items={[{ label: 'Dashboard', href: '/client' }, { label: 'Reviews' }]} />
      <div>
        <h1 className="text-2xl font-bold">Review Responses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review AI-drafted responses before they are posted. You can edit any response before approving.
        </p>
      </div>
      <PendingReviews initialResponses={serialized} />
    </div>
  );
}
