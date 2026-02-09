import { getDb } from '@/db';
import { reviews, reviewSources } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY || '';

interface GoogleReview {
  author_name: string;
  author_url?: string;
  profile_photo_url?: string;
  rating: number;
  text: string;
  time: number;
  relative_time_description: string;
}

interface PlaceDetails {
  place_id: string;
  name: string;
  rating?: number;
  user_ratings_total?: number;
  reviews?: GoogleReview[];
}

/**
 * Fetch place details including reviews from Google
 */
export async function fetchGooglePlaceDetails(
  placeId: string
): Promise<PlaceDetails | null> {
  if (!GOOGLE_API_KEY) {
    console.error('[Google Places] GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'place_id,name,rating,user_ratings_total,reviews');
  url.searchParams.set('key', GOOGLE_API_KEY);

  const response = await fetch(url.toString());
  const data = (await response.json()) as {
    status: string;
    error_message?: string;
    result?: PlaceDetails;
  };

  if (data.status !== 'OK') {
    console.error('[Google Places] API error:', data.status, data.error_message);
    return null;
  }

  return data.result ?? null;
}

/**
 * Search for a place by name and address
 */
export async function findGooglePlaceId(
  businessName: string,
  address?: string
): Promise<string | null> {
  if (!GOOGLE_API_KEY) {
    console.error('[Google Places] GOOGLE_PLACES_API_KEY not configured');
    return null;
  }

  const query = address ? `${businessName} ${address}` : businessName;

  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id,name,formatted_address');
  url.searchParams.set('key', GOOGLE_API_KEY);

  const response = await fetch(url.toString());
  const data = (await response.json()) as {
    status: string;
    candidates?: { place_id: string; name: string; formatted_address: string }[];
  };

  if (data.status !== 'OK' || !data.candidates?.length) {
    console.error('[Google Places] No candidates found for:', query);
    return null;
  }

  return data.candidates[0].place_id;
}

/**
 * Fetch and save Google reviews for a client
 */
export async function syncGoogleReviews(clientId: string): Promise<{
  newReviews: number;
  totalReviews: number;
}> {
  const db = getDb();

  // Get review source config
  const [source] = await db
    .select()
    .from(reviewSources)
    .where(
      and(
        eq(reviewSources.clientId, clientId),
        eq(reviewSources.source, 'google'),
        eq(reviewSources.isActive, true)
      )
    )
    .limit(1);

  if (!source?.googlePlaceId) {
    return { newReviews: 0, totalReviews: 0 };
  }

  try {
    const placeDetails = await fetchGooglePlaceDetails(source.googlePlaceId);

    if (!placeDetails) {
      await db
        .update(reviewSources)
        .set({
          lastError: 'Failed to fetch place details',
          consecutiveErrors: (source.consecutiveErrors || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(reviewSources.id, source.id));

      return { newReviews: 0, totalReviews: 0 };
    }

    let newReviewCount = 0;

    // Process each review
    if (placeDetails.reviews) {
      for (const review of placeDetails.reviews) {
        // Check if review already exists (by author + time)
        const externalId = `${review.author_name}_${review.time}`;

        const [existing] = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(
            and(
              eq(reviews.clientId, clientId),
              eq(reviews.source, 'google'),
              eq(reviews.externalId, externalId)
            )
          )
          .limit(1);

        if (!existing) {
          await db.insert(reviews).values({
            clientId,
            source: 'google',
            externalId,
            authorName: review.author_name,
            authorPhoto: review.profile_photo_url,
            rating: review.rating,
            reviewText: review.text,
            reviewDate: new Date(review.time * 1000),
            sentiment: review.rating >= 4 ? 'positive' : review.rating === 3 ? 'neutral' : 'negative',
          });

          newReviewCount++;
        }
      }
    }

    // Update source stats
    await db
      .update(reviewSources)
      .set({
        lastFetchedAt: new Date(),
        totalReviews: placeDetails.user_ratings_total || 0,
        averageRating: placeDetails.rating,
        lastError: null,
        consecutiveErrors: 0,
        updatedAt: new Date(),
      })
      .where(eq(reviewSources.id, source.id));

    console.log(`[Google Places] Synced ${newReviewCount} new reviews for client ${clientId}`);

    return {
      newReviews: newReviewCount,
      totalReviews: placeDetails.user_ratings_total || 0,
    };
  } catch (err) {
    console.error('[Google Places] Error syncing reviews:', err);

    await db
      .update(reviewSources)
      .set({
        lastError: err instanceof Error ? err.message : 'Unknown error',
        consecutiveErrors: (source.consecutiveErrors || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(reviewSources.id, source.id));

    return { newReviews: 0, totalReviews: 0 };
  }
}
