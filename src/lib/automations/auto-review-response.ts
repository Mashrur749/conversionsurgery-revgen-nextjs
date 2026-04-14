import { getDb } from '@/db';
import { clients, reviews, reviewResponses } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { createDraftResponse } from '@/lib/services/review-response';
import { postResponseToGoogle } from '@/lib/services/google-business';

/** Rating threshold: reviews at or above this are auto-approved for operator_managed clients. */
const POSITIVE_RATING_THRESHOLD = 4;

/**
 * Auto-generate draft review responses for clients with autoReviewResponseEnabled.
 * Finds reviews that have no response record yet and creates AI/template drafts.
 *
 * For operator_managed clients:
 * - Positive reviews (rating >= 4): auto-approve and post immediately
 * - Neutral/negative reviews (rating <= 3): hold as pending_approval for operator review
 *
 * For client_approves clients:
 * - All drafts stay as 'draft' for contractor approval
 */
export async function autoGenerateReviewDrafts(): Promise<{
  draftsCreated: number;
  autoApproved: number;
  errors: number;
}> {
  const db = getDb();
  let draftsCreated = 0;
  let autoApproved = 0;
  let errors = 0;

  // Get clients with auto-review enabled
  const activeClients = await db
    .select({
      id: clients.id,
      reviewApprovalMode: clients.reviewApprovalMode,
      businessName: clients.businessName,
    })
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
        const draft = await createDraftResponse(review.id);
        draftsCreated++;

        // Operator-managed: auto-approve positive, hold negative
        if (client.reviewApprovalMode === 'operator_managed' && draft) {
          const draftId = draft.id;
          const rating = review.rating ?? 0;

          if (rating >= POSITIVE_RATING_THRESHOLD) {
            // Auto-approve and post positive reviews
            await db
              .update(reviewResponses)
              .set({ status: 'approved', approvedAt: new Date(), updatedAt: new Date() })
              .where(eq(reviewResponses.id, draftId));
            autoApproved++;
          } else {
            // Hold negative reviews for operator review
            await db
              .update(reviewResponses)
              .set({ status: 'pending_approval', updatedAt: new Date() })
              .where(eq(reviewResponses.id, draftId));
          }
        }
        // client_approves: leave as 'draft' (current behavior)
      } catch (err) {
        console.error(`[AutoReview] Failed to create draft for review ${review.id}:`, err);
        errors++;
      }
    }
  }

  console.log(`[AutoReview] Created ${draftsCreated} drafts, ${autoApproved} auto-approved, ${errors} errors`);
  return { draftsCreated, autoApproved, errors };
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
