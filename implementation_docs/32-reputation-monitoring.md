# Phase 19a: Reputation Monitoring

## Prerequisites
- Phase 06 (Review requests) working
- Client business info stored
- Cron jobs operational

## Goal
Monitor Google Business Profile and Yelp for new reviews, alert on negative reviews, track review velocity.

---

## Step 1: Add Review Tables

**MODIFY** `src/lib/db/schema.ts`:

```typescript
// ============================================
// REVIEWS & REPUTATION
// ============================================
export const reviewSourceEnum = pgEnum('review_source', [
  'google',
  'yelp',
  'facebook',
  'bbb',
  'angi',
  'homeadvisor',
  'other',
]);

export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Source info
  source: reviewSourceEnum('source').notNull(),
  externalId: varchar('external_id', { length: 255 }), // ID from source platform
  externalUrl: varchar('external_url', { length: 1000 }),
  
  // Review content
  authorName: varchar('author_name', { length: 255 }),
  authorPhoto: varchar('author_photo', { length: 1000 }),
  rating: integer('rating').notNull(), // 1-5
  reviewText: text('review_text'),
  
  // Response
  hasResponse: boolean('has_response').default(false),
  responseText: text('response_text'),
  responseDate: timestamp('response_date'),
  
  // AI analysis
  sentiment: varchar('sentiment', { length: 20 }), // positive, neutral, negative
  aiSuggestedResponse: text('ai_suggested_response'),
  keyTopics: jsonb('key_topics').$type<string[]>(),
  
  // Alerts
  alertSent: boolean('alert_sent').default(false),
  alertSentAt: timestamp('alert_sent_at'),
  
  // Lead matching
  matchedLeadId: uuid('matched_lead_id').references(() => leads.id, { onDelete: 'set null' }),
  
  // Timestamps
  reviewDate: timestamp('review_date'),
  fetchedAt: timestamp('fetched_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const reviewSources = pgTable('review_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Source config
  source: reviewSourceEnum('source').notNull(),
  isActive: boolean('is_active').default(true),
  
  // Platform-specific IDs
  googlePlaceId: varchar('google_place_id', { length: 255 }),
  yelpBusinessId: varchar('yelp_business_id', { length: 255 }),
  facebookPageId: varchar('facebook_page_id', { length: 255 }),
  
  // Last fetch info
  lastFetchedAt: timestamp('last_fetched_at'),
  lastReviewDate: timestamp('last_review_date'),
  totalReviews: integer('total_reviews').default(0),
  averageRating: real('average_rating'),
  
  // Error tracking
  lastError: text('last_error'),
  consecutiveErrors: integer('consecutive_errors').default(0),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const reviewMetrics = pgTable('review_metrics', {
  id: uuid('id').primaryKey().defaultRandom(),
  clientId: uuid('client_id').references(() => clients.id, { onDelete: 'cascade' }),
  
  // Period
  period: varchar('period', { length: 20 }).notNull(), // daily, weekly, monthly
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  
  // Metrics
  totalReviews: integer('total_reviews').default(0),
  averageRating: real('average_rating'),
  fiveStarCount: integer('five_star_count').default(0),
  fourStarCount: integer('four_star_count').default(0),
  threeStarCount: integer('three_star_count').default(0),
  twoStarCount: integer('two_star_count').default(0),
  oneStarCount: integer('one_star_count').default(0),
  
  // By source
  googleCount: integer('google_count').default(0),
  yelpCount: integer('yelp_count').default(0),
  
  // Sentiment
  positiveCount: integer('positive_count').default(0),
  neutralCount: integer('neutral_count').default(0),
  negativeCount: integer('negative_count').default(0),
  
  // Response metrics
  respondedCount: integer('responded_count').default(0),
  avgResponseTimeHours: real('avg_response_time_hours'),
  
  createdAt: timestamp('created_at').defaultNow(),
});

// Indexes
export const reviewsClientIdx = index('reviews_client_idx').on(reviews.clientId);
export const reviewsSourceIdx = index('reviews_source_idx').on(reviews.source);
export const reviewsDateIdx = index('reviews_date_idx').on(reviews.reviewDate);
```

Run migration:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 2: Create Google Places Service

**CREATE** `src/lib/services/google-places.ts`:

```typescript
import { db } from '@/lib/db';
import { reviews, reviewSources, clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

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
  const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'place_id,name,rating,user_ratings_total,reviews');
  url.searchParams.set('key', GOOGLE_API_KEY);
  
  const response = await fetch(url.toString());
  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.error('Google Places API error:', data.status, data.error_message);
    return null;
  }
  
  return data.result;
}

/**
 * Search for a place by name and address
 */
export async function findGooglePlaceId(
  businessName: string,
  address?: string
): Promise<string | null> {
  const query = address ? `${businessName} ${address}` : businessName;
  
  const url = new URL('https://maps.googleapis.com/maps/api/place/findplacefromtext/json');
  url.searchParams.set('input', query);
  url.searchParams.set('inputtype', 'textquery');
  url.searchParams.set('fields', 'place_id,name,formatted_address');
  url.searchParams.set('key', GOOGLE_API_KEY);
  
  const response = await fetch(url.toString());
  const data = await response.json();
  
  if (data.status !== 'OK' || !data.candidates?.length) {
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
    
    return {
      newReviews: newReviewCount,
      totalReviews: placeDetails.user_ratings_total || 0,
    };
  } catch (err) {
    console.error('Error syncing Google reviews:', err);
    
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
```

---

## Step 3: Create Review Monitoring Service

**CREATE** `src/lib/services/review-monitoring.ts`:

```typescript
import { db } from '@/lib/db';
import { reviews, reviewSources, clients, reviewMetrics } from '@/lib/db/schema';
import { eq, and, gte, lte, desc, isNull } from 'drizzle-orm';
import { syncGoogleReviews } from './google-places';
import { sendSMS } from './twilio';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Sync reviews from all sources for a client
 */
export async function syncAllReviews(clientId: string): Promise<{
  google: { newReviews: number; totalReviews: number };
}> {
  const results = {
    google: { newReviews: 0, totalReviews: 0 },
  };
  
  // Sync Google
  results.google = await syncGoogleReviews(clientId);
  
  // TODO: Add Yelp, Facebook, etc.
  
  return results;
}

/**
 * Check for new negative reviews and alert
 */
export async function checkAndAlertNegativeReviews(clientId: string): Promise<number> {
  // Find unalerted negative reviews
  const negativeReviews = await db
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
  
  if (!client?.ownerPhone) return 0;
  
  let alertCount = 0;
  
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
    const stars = '⭐'.repeat(review.rating);
    const preview = review.reviewText
      ? review.reviewText.substring(0, 100) + (review.reviewText.length > 100 ? '...' : '')
      : 'No text';
    
    await sendSMS({
      to: client.ownerPhone,
      from: process.env.TWILIO_PHONE_NUMBER!,
      body: `🚨 New ${review.rating}-star review on ${review.source}!\n\n${stars}\n"${preview}"\n\nCheck your dashboard to respond.`,
    });
    
    alertCount++;
  }
  
  return alertCount;
}

/**
 * Generate AI response suggestion for a review
 */
export async function generateReviewResponse(review: {
  rating: number;
  reviewText?: string | null;
  authorName?: string | null;
  source: string;
}): Promise<string> {
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
}

/**
 * Calculate and store review metrics for a period
 */
export async function calculateReviewMetrics(
  clientId: string,
  period: 'daily' | 'weekly' | 'monthly',
  date: Date = new Date()
): Promise<void> {
  let periodStart: Date;
  let periodEnd: Date;
  
  if (period === 'daily') {
    periodStart = new Date(date);
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(date);
    periodEnd.setHours(23, 59, 59, 999);
  } else if (period === 'weekly') {
    periodStart = new Date(date);
    periodStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
    periodStart.setHours(0, 0, 0, 0);
    periodEnd = new Date(periodStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);
  } else {
    periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
    periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  }
  
  // Get reviews in period
  const periodReviews = await db
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
    fiveStarCount: periodReviews.filter(r => r.rating === 5).length,
    fourStarCount: periodReviews.filter(r => r.rating === 4).length,
    threeStarCount: periodReviews.filter(r => r.rating === 3).length,
    twoStarCount: periodReviews.filter(r => r.rating === 2).length,
    oneStarCount: periodReviews.filter(r => r.rating === 1).length,
    googleCount: periodReviews.filter(r => r.source === 'google').length,
    yelpCount: periodReviews.filter(r => r.source === 'yelp').length,
    positiveCount: periodReviews.filter(r => r.sentiment === 'positive').length,
    neutralCount: periodReviews.filter(r => r.sentiment === 'neutral').length,
    negativeCount: periodReviews.filter(r => r.sentiment === 'negative').length,
    respondedCount: periodReviews.filter(r => r.hasResponse).length,
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
 * Get review summary for a client
 */
export async function getReviewSummary(clientId: string): Promise<{
  totalReviews: number;
  averageRating: number;
  recentReviews: number;
  needsResponse: number;
  sources: { source: string; count: number; rating: number }[];
}> {
  // Get all review sources
  const sources = await db
    .select()
    .from(reviewSources)
    .where(eq(reviewSources.clientId, clientId));
  
  // Get reviews needing response (negative without response)
  const needsResponseReviews = await db
    .select({ count: reviews.id })
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
    .select({ count: reviews.id })
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
    sources: sources.map(s => ({
      source: s.source,
      count: s.totalReviews || 0,
      rating: s.averageRating || 0,
    })),
  };
}
```

---

## Step 4: Create Review API Routes

**CREATE** `src/app/api/clients/[id]/reviews/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { reviews } from '@/lib/db/schema';
import { eq, desc, and, lte } from 'drizzle-orm';
import { syncAllReviews, getReviewSummary } from '@/lib/services/review-monitoring';

// GET - List reviews for a client
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');
  const rating = searchParams.get('rating');
  const needsResponse = searchParams.get('needsResponse');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  const conditions = [eq(reviews.clientId, params.id)];
  
  if (source) {
    conditions.push(eq(reviews.source, source as any));
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

  const summary = await getReviewSummary(params.id);

  return NextResponse.json({ reviews: results, summary });
}

// POST - Sync reviews from all sources
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await syncAllReviews(params.id);

  return NextResponse.json(results);
}
```

**CREATE** `src/app/api/clients/[id]/reviews/sources/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';
import { reviewSources } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { findGooglePlaceId } from '@/lib/services/google-places';

// GET - List review sources
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sources = await db
    .select()
    .from(reviewSources)
    .where(eq(reviewSources.clientId, params.id));

  return NextResponse.json(sources);
}

// POST - Add/update review source
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { source, placeId, businessName, address } = body;

  // For Google, try to find place ID if not provided
  let googlePlaceId = placeId;
  if (source === 'google' && !googlePlaceId && businessName) {
    googlePlaceId = await findGooglePlaceId(businessName, address);
  }

  if (source === 'google' && !googlePlaceId) {
    return NextResponse.json(
      { error: 'Could not find Google Place ID' },
      { status: 400 }
    );
  }

  // Upsert source
  const [existing] = await db
    .select()
    .from(reviewSources)
    .where(
      eq(reviewSources.clientId, params.id),
      eq(reviewSources.source, source)
    )
    .limit(1);

  if (existing) {
    await db
      .update(reviewSources)
      .set({
        googlePlaceId,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(reviewSources.id, existing.id));
  } else {
    await db.insert(reviewSources).values({
      clientId: params.id,
      source,
      googlePlaceId,
      isActive: true,
    });
  }

  return NextResponse.json({ success: true, googlePlaceId });
}
```

---

## Step 5: Create Review Monitoring Cron

**MODIFY** `src/app/api/cron/hourly/route.ts`:

```typescript
import { syncAllReviews, checkAndAlertNegativeReviews } from '@/lib/services/review-monitoring';
import { db } from '@/lib/db';
import { clients, reviewSources } from '@/lib/db/schema';
import { eq, and, or, isNull, lt } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get clients with review sources that need refresh
  // (not fetched in last hour, or never fetched)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const sourcesToSync = await db
    .select({
      clientId: reviewSources.clientId,
    })
    .from(reviewSources)
    .where(
      and(
        eq(reviewSources.isActive, true),
        or(
          isNull(reviewSources.lastFetchedAt),
          lt(reviewSources.lastFetchedAt, oneHourAgo)
        )
      )
    )
    .groupBy(reviewSources.clientId);

  let synced = 0;
  let alerts = 0;

  for (const { clientId } of sourcesToSync) {
    if (!clientId) continue;
    
    try {
      await syncAllReviews(clientId);
      alerts += await checkAndAlertNegativeReviews(clientId);
      synced++;
    } catch (err) {
      console.error(`Error syncing reviews for client ${clientId}:`, err);
    }
  }

  return NextResponse.json({
    synced,
    alerts,
    timestamp: new Date().toISOString(),
  });
}
```

---

## Step 6: Review Dashboard Component

**CREATE** `src/components/reviews/review-dashboard.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, RefreshCw, AlertTriangle, MessageSquare, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Review {
  id: string;
  source: string;
  authorName: string;
  rating: number;
  reviewText: string;
  reviewDate: string;
  hasResponse: boolean;
  aiSuggestedResponse?: string;
}

interface ReviewSummary {
  totalReviews: number;
  averageRating: number;
  recentReviews: number;
  needsResponse: number;
}

interface ReviewDashboardProps {
  clientId: string;
}

export function ReviewDashboard({ clientId }: ReviewDashboardProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/reviews`);
      const data = await res.json();
      setReviews(data.reviews);
      setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  };

  const syncReviews = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/clients/${clientId}/reviews`, { method: 'POST' });
      await fetchReviews();
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [clientId]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.averageRating}</div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                {renderStars(Math.round(summary.averageRating))}
                <span>avg rating</span>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalReviews}</div>
              <div className="text-sm text-muted-foreground">total reviews</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-600">
                {summary.recentReviews}
              </div>
              <div className="text-sm text-muted-foreground">last 30 days</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-600">
                {summary.needsResponse}
              </div>
              <div className="text-sm text-muted-foreground">needs response</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Reviews</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={syncReviews}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Reviews
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reviews found. Click "Sync Reviews" to fetch.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className={`p-4 rounded-lg border ${
                    review.rating <= 2
                      ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <Badge variant="outline" className="text-xs">
                        {review.source}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.reviewDate), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  
                  <p className="mt-2 text-sm font-medium">{review.authorName}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {review.reviewText || 'No review text'}
                  </p>
                  
                  {/* Actions for negative reviews */}
                  {review.rating <= 3 && !review.hasResponse && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                        Suggested Response
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {review.aiSuggestedResponse || 'Generating...'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline">
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Copy Response
                        </Button>
                        <Button size="sm" variant="ghost">
                          Mark Responded
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {review.hasResponse && (
                    <Badge variant="secondary" className="mt-2">
                      ✓ Responded
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## Step 7: Add to Client Settings

**MODIFY** client settings page to include review source configuration:

```typescript
// In client settings, add review sources section
<Card>
  <CardHeader>
    <CardTitle>Review Monitoring</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div>
      <Label>Google Business Profile</Label>
      <div className="flex gap-2 mt-1">
        <Input
          placeholder="Google Place ID (optional)"
          value={googlePlaceId}
          onChange={(e) => setGooglePlaceId(e.target.value)}
        />
        <Button onClick={linkGoogleBusiness}>
          {googlePlaceId ? 'Update' : 'Link'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        We'll try to find your business automatically based on your company name.
      </p>
    </div>
  </CardContent>
</Card>
```

---

## Files Created/Modified

| File | Action |
|------|--------|
| `src/lib/db/schema.ts` | Modified - Add review tables |
| `src/lib/services/google-places.ts` | Created |
| `src/lib/services/review-monitoring.ts` | Created |
| `src/app/api/clients/[id]/reviews/route.ts` | Created |
| `src/app/api/clients/[id]/reviews/sources/route.ts` | Created |
| `src/app/api/cron/hourly/route.ts` | Modified |
| `src/components/reviews/review-dashboard.tsx` | Created |

---

## Environment Variables

Add to `.env.local`:

```env
GOOGLE_PLACES_API_KEY=your_google_api_key
```

Enable these APIs in Google Cloud Console:
- Places API
- Places API (New) - for latest features

---

## Verification

```bash
# 1. Run migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# 2. Link a Google Business
curl -X POST http://localhost:3000/api/clients/[CLIENT_ID]/reviews/sources \
  -H "Content-Type: application/json" \
  -d '{"source": "google", "businessName": "ABC Roofing", "address": "123 Main St, Denver CO"}'

# 3. Sync reviews
curl -X POST http://localhost:3000/api/clients/[CLIENT_ID]/reviews

# 4. Check reviews fetched
curl http://localhost:3000/api/clients/[CLIENT_ID]/reviews

# 5. Verify negative review alerts
# - Add a test review with 1-2 stars
# - Check that SMS alert was sent
```

## Success Criteria
- [ ] Google Place ID lookup working
- [ ] Reviews syncing from Google
- [ ] Negative reviews trigger SMS alert
- [ ] AI generates response suggestions
- [ ] Review metrics calculated
- [ ] Dashboard shows review summary
