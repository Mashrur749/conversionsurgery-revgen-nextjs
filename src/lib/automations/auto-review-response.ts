import { getDb } from '@/db';
import { clients, reviews, reviewResponses } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createDraftResponse } from '@/lib/services/review-response';
import { postResponseToGoogle } from '@/lib/services/google-business';

/**
 * Auto-generate draft review responses for clients with autoReviewResponseEnabled.
 * Finds reviews that have no response record yet and creates AI/template drafts.
 */
export async function autoGenerateReviewDrafts(): Promise<{
  draftsCreated: number;
  errors: number;
}> {
  const db = getDb();
  let draftsCreated = 0;
  let errors = 0;

  // Get clients with auto-review enabled
  const activeClients = await db
    .select({ id: clients.id })
    .from(clients)
    .where(
      and(
        eq(clients.status, 'active'),
        eq(clients.autoReviewResponseEnabled, true)
      )
    );

  for (const client of activeClients) {
    // Find reviews without any response
    const unrespondedReviews = await db
      .select({ id: reviews.id, rating: reviews.rating })
      .from(reviews)
      .leftJoin(reviewResponses, eq(reviewResponses.reviewId, reviews.id))
      .where(
        and(
          eq(reviews.clientId, client.id),
          eq(reviews.hasResponse, false),
          isNull(reviewResponses.id)
        )
      )
      .limit(10); // Process up to 10 per client per run

    for (const review of unrespondedReviews) {
      try {
        await createDraftResponse(review.id);
        draftsCreated++;
      } catch (err) {
        console.error(`[AutoReview] Failed to create draft for review ${review.id}:`, err);
        errors++;
      }
    }
  }

  console.log(`[AutoReview] Created ${draftsCreated} drafts, ${errors} errors`);
  return { draftsCreated, errors };
}

/**
 * Auto-post approved review responses to Google Business Profile.
 * Finds responses with status='approved' and posts them.
 */
export async function autoPostApprovedResponses(): Promise<{
  posted: number;
  errors: number;
}> {
  const db = getDb();
  let posted = 0;
  let errors = 0;

  // Find all approved responses ready to post
  const approvedResponses = await db
    .select({ id: reviewResponses.id, reviewId: reviewResponses.reviewId })
    .from(reviewResponses)
    .where(eq(reviewResponses.status, 'approved'))
    .limit(20);

  for (const response of approvedResponses) {
    try {
      const result = await postResponseToGoogle(response.id);
      if (result.success) {
        posted++;
      } else {
        console.error(`[AutoReview] Failed to post response ${response.id}: ${result.error}`);
        errors++;
      }
    } catch (err) {
      console.error(`[AutoReview] Error posting response ${response.id}:`, err);
      errors++;
    }
  }

  console.log(`[AutoReview] Posted ${posted} responses, ${errors} errors`);
  return { posted, errors };
}
