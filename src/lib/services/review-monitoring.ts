import { getDb } from '@/db';
import { reviews, reviewSources, clients, reviewMetrics } from '@/db/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { syncGoogleReviews } from './google-places';
import { sendSMS } from './twilio';
import type { Review } from '@/db/schema/reviews';
import type { ReviewSource } from '@/db/schema/review-sources';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Input shape for generating an AI review response suggestion. */
interface ReviewResponseInput {
  rating: number;
  reviewText?: string | null;
  authorName?: string | null;
  source: string;
}

/** Per-source review sync result counts. */
interface SyncResult {
  newReviews: number;
  totalReviews: number;
}

/** Aggregated review summary for a client across all sources. */
interface ReviewSummaryResult {
  totalReviews: number;
  averageRating: number;
  recentReviews: number;
  needsResponse: number;
  sources: { source: string; count: number; rating: number }[];
}

/**
 * Sync reviews from all configured sources for a client.
 *
 * Currently supports Google Places; additional sources (Yelp, Facebook, etc.)
 * will be added as integrations become available.
 *
 * @param clientId - The UUID of the client whose reviews to sync
 * @returns Per-source sync results with new/total review counts
 */
export async function syncAllReviews(clientId: string): Promise<{
  google: SyncResult;
}> {
  const results: { google: SyncResult } = {
    google: { newReviews: 0, totalReviews: 0 },
  };

  // Sync Google
  results.google = await syncGoogleReviews(clientId);

  // TODO: Add Yelp, Facebook, etc.

  return results;
}

/**
 * Find unalerted negative reviews (rating <= 2), generate AI suggestions,
 * and send SMS alerts to the client owner.
 *
 * @param clientId - The UUID of the client to check for negative reviews
 * @returns The number of alerts sent
 */
export async function checkAndAlertNegativeReviews(clientId: string): Promise<number> {
  const db = getDb();

  // Find unalerted negative reviews
  const negativeReviews: Review[] = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.clientId, clientId),
        lte(reviews.rating, 2),
        eq(reviews.alertSent, false)
      )
    )
    .orderBy(desc(reviews.reviewDate));

  if (negativeReviews.length === 0) return 0;

  // Get client info
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.phone) {
    console.warn(`[ReviewMonitoring] Client ${clientId} has no phone number, skipping alerts`);
    return 0;
  }

  let alertCount = 0;
  const twilioNumber = client.twilioNumber || process.env.TWILIO_PHONE_NUMBER || '';

  for (const review of negativeReviews) {
    // Generate AI suggested response
    const suggestedResponse = await generateReviewResponse(review);

    // Save suggested response
    await db
      .update(reviews)
      .set({
        aiSuggestedResponse: suggestedResponse,
        alertSent: true,
        alertSentAt: new Date(),
      })
      .where(eq(reviews.id, review.id));

    // Alert owner via SMS
    const preview = review.reviewText
      ? review.reviewText.substring(0, 100) + (review.reviewText.length > 100 ? '...' : '')
      : 'No text';

    if (twilioNumber) {
      await sendSMS(
        client.phone,
        `New ${review.rating}-star review on ${review.source}!\n\n"${preview}"\n\nCheck your dashboard to respond.`,
        twilioNumber
      );
    }

    alertCount++;
  }

  console.log(`[ReviewMonitoring] Sent ${alertCount} negative review alerts for client ${clientId}`);
  return alertCount;
}

/**
 * Generate an AI-powered response suggestion for a single review using OpenAI.
 *
 * The prompt varies based on the review rating:
 * - 1-2 stars: empathetic, offers to make it right
 * - 3 stars: acknowledges concerns, invites to improve
 * - 4-5 stars: warm gratitude
 *
 * @param review - The review data to generate a response for
 * @returns The generated response text, or an empty string on failure
 */
export async function generateReviewResponse(review: ReviewResponseInput): Promise<string> {
  const isNegative = review.rating <= 2;
  const isNeutral = review.rating === 3;

  const prompt = isNegative
    ? `Generate a professional, empathetic response to this negative review.
       Acknowledge their concerns, apologize for the experience, and offer to make it right.
       Keep it under 150 words. Don't be defensive.`
    : isNeutral
    ? `Generate a professional response to this 3-star review.
       Thank them for feedback, acknowledge any concerns, and express desire to improve.
       Keep it under 100 words.`
    : `Generate a brief, warm thank-you response to this positive review.
       Express genuine gratitude and invite them back.
       Keep it under 75 words.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You write review responses for a contractor business. Be professional, authentic, and human. Never use phrases like "We apologize for any inconvenience" - be specific and genuine.`,
        },
        {
          role: 'user',
          content: `${prompt}

Review from ${review.authorName || 'a customer'} (${review.rating} stars):
"${review.reviewText || 'No text provided'}"`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    return response.choices[0].message.content || '';
  } catch (err) {
    console.error('[ReviewMonitoring] Error generating AI response:', err);
    return '';
  }
}

/**
 * Calculate and upsert review metrics for a given time period.
 *
 * Aggregates star counts, sentiment breakdown, and response rates
 * for the specified period type (daily/weekly/monthly).
 *
 * @param clientId - The UUID of the client
 * @param period - The aggregation period: 'daily', 'weekly', or 'monthly'
 * @param date - The reference date for calculating the period bounds (defaults to now)
 */
export async function calculateReviewMetrics(
  clientId: string,
  period: 'daily' | 'weekly' | 'monthly',
  date: Date = new Date()
): Promise<void> {
  const db = getDb();

  let periodStart: Date;
  let periodEnd: Date;

  if (period === 'daily') {
    periodStart = new Date(date);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(date);
    periodEnd.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    periodStart = new Date(date);
    periodStart.setDate(date.getDate() - date.getDay());
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
    periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  // Get reviews in period
  const periodReviews: Review[] = await db
    .select()
    .from(reviews)
    .where(
      and(
        eq(reviews.clientId, clientId),
        gte(reviews.reviewDate, periodStart),
        lte(reviews.reviewDate, periodEnd)
      )
    );

  if (periodReviews.length === 0) return;

  // Calculate metrics
  const metrics = {
    totalReviews: periodReviews.length,
    averageRating: periodReviews.reduce((sum, r) => sum + r.rating, 0) / periodReviews.length,
    fiveStarCount: periodReviews.filter((r) => r.rating === 5).length,
    fourStarCount: periodReviews.filter((r) => r.rating === 4).length,
    threeStarCount: periodReviews.filter((r) => r.rating === 3).length,
    twoStarCount: periodReviews.filter((r) => r.rating === 2).length,
    oneStarCount: periodReviews.filter((r) => r.rating === 1).length,
    googleCount: periodReviews.filter((r) => r.source === 'google').length,
    yelpCount: periodReviews.filter((r) => r.source === 'yelp').length,
    positiveCount: periodReviews.filter((r) => r.sentiment === 'positive').length,
    neutralCount: periodReviews.filter((r) => r.sentiment === 'neutral').length,
    negativeCount: periodReviews.filter((r) => r.sentiment === 'negative').length,
    respondedCount: periodReviews.filter((r) => r.hasResponse).length,
  };

  // Upsert metrics
  await db
    .insert(reviewMetrics)
    .values({
      clientId,
      period,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      ...metrics,
    })
    .onConflictDoUpdate({
      target: [reviewMetrics.clientId, reviewMetrics.period, reviewMetrics.periodStart],
      set: metrics,
    });
}

/**
 * Get a high-level review summary for a client, including total counts,
 * average rating, recent activity, and per-source breakdown.
 *
 * @param clientId - The UUID of the client
 * @returns Aggregated review summary with source-level detail
 */
export async function getReviewSummary(clientId: string): Promise<ReviewSummaryResult> {
  const db = getDb();

  // Get all review sources
  const sources: ReviewSource[] = await db
    .select()
    .from(reviewSources)
    .where(eq(reviewSources.clientId, clientId));

  // Get reviews needing response (negative without response)
  const needsResponseReviews = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.clientId, clientId),
        lte(reviews.rating, 3),
        eq(reviews.hasResponse, false)
      )
    );

  // Get recent reviews (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentReviews = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(
      and(
        eq(reviews.clientId, clientId),
        gte(reviews.reviewDate, thirtyDaysAgo)
      )
    );

  // Calculate totals
  const totalReviews = sources.reduce((sum, s) => sum + (s.totalReviews || 0), 0);
  const weightedRating = sources.reduce(
    (sum, s) => sum + (s.averageRating || 0) * (s.totalReviews || 0),
    0
  );
  const averageRating = totalReviews > 0 ? weightedRating / totalReviews : 0;

  return {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    recentReviews: recentReviews.length,
    needsResponse: needsResponseReviews.length,
    sources: sources.map((s) => ({
      source: s.source,
      count: s.totalReviews || 0,
      rating: s.averageRating || 0,
    })),
  };
}
