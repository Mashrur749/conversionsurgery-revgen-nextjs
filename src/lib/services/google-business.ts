import { getDb } from '@/db';
import { reviews, reviewResponses, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { ReviewResponse } from '@/db/schema/review-responses';
import type { Review } from '@/db/schema/reviews';
import type { Client } from '@/db/schema/clients';

/** Result of posting a response to Google Business Profile. */
interface PostResult {
  success: boolean;
  error?: string;
}

/** Shape of the Google token refresh API response. */
interface GoogleTokenResponse {
  access_token?: string;
  expires_in?: number;
}

/** Shape of the Google Business Profile API error response. */
interface GoogleApiErrorResponse {
  error?: { message?: string };
}

/**
 * Post a review response to Google Business Profile via the My Business API.
 *
 * Handles token refresh if the access token has expired, updates the
 * response status to 'posted' on success, and records errors on failure.
 *
 * Requires the client to have a connected Google Business Profile with
 * valid OAuth tokens.
 *
 * @param responseId - The UUID of the review response to post
 * @returns A result object indicating success or failure with an error message
 */
export async function postResponseToGoogle(
  responseId: string
): Promise<PostResult> {
  const db = getDb();

  const [response]: ReviewResponse[] = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.id, responseId))
    .limit(1);

  if (!response) {
    return { success: false, error: 'Response not found' };
  }

  const [review]: Review[] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, response.reviewId))
    .limit(1);

  if (!review || review.source !== 'google') {
    return { success: false, error: 'Not a Google review' };
  }

  const [client]: Client[] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, response.clientId))
    .limit(1);

  if (!client?.googleAccessToken) {
    return { success: false, error: 'Google Business not connected' };
  }

  try {
    // Refresh token if needed
    let accessToken = client.googleAccessToken;
    if (client.googleTokenExpiresAt && new Date(client.googleTokenExpiresAt) < new Date()) {
      accessToken = await refreshGoogleToken(client.id, client.googleRefreshToken!);
    }

    // Post reply via Google Business Profile API
    // The review name format is: accounts/{account_id}/locations/{location_id}/reviews/{review_id}
    const reviewName = review.externalId; // Should store full resource name

    const apiUrl = `https://mybusiness.googleapis.com/v4/${reviewName}/reply`;

    const res = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comment: response.responseText,
      }),
    });

    if (!res.ok) {
      const errorData = (await res.json()) as GoogleApiErrorResponse;
      throw new Error(errorData.error?.message || 'Failed to post response');
    }

    // Update response status
    await db
      .update(reviewResponses)
      .set({
        status: 'posted',
        postedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId));

    // Update review
    await db
      .update(reviews)
      .set({
        hasResponse: true,
        responseText: response.responseText,
        responseDate: new Date(),
      })
      .where(eq(reviews.id, response.reviewId));

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[Reputation] Failed to post response ${responseId} to Google:`, errorMessage);

    await db
      .update(reviewResponses)
      .set({
        postError: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(reviewResponses.id, responseId));

    return { success: false, error: errorMessage };
  }
}

/**
 * Refresh a Google OAuth access token using the stored refresh token,
 * and persist the new access token and expiry to the client record.
 *
 * @param clientId - The UUID of the client whose token to refresh
 * @param refreshToken - The Google OAuth refresh token
 * @returns The new access token string
 * @throws Error if the token refresh request fails
 */
async function refreshGoogleToken(
  clientId: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = (await res.json()) as GoogleTokenResponse;

  if (!data.access_token) {
    throw new Error(`[Reputation] Failed to refresh Google token for client ${clientId}`);
  }

  // Save new token
  const db = getDb();
  await db
    .update(clients)
    .set({
      googleAccessToken: data.access_token,
      googleTokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
    })
    .where(eq(clients.id, clientId));

  return data.access_token;
}
