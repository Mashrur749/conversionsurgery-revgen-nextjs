import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reviewSources } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { findGooglePlaceId } from '@/lib/services/google-places';
import { z } from 'zod';

const addSourceSchema = z.object({
  source: z.enum(['google', 'yelp', 'facebook', 'bbb', 'angi', 'homeadvisor', 'other']),
  placeId: z.string().optional(),
  businessName: z.string().optional(),
  address: z.string().optional(),
});

/** GET - List all review sources for a client. */
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const db = getDb();
    const sources = await db
      .select()
      .from(reviewSources)
      .where(eq(reviewSources.clientId, clientId));

    return NextResponse.json({ sources });
  }
);

/** POST - Add or update a review source for a client. */
export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const parsed = addSourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // For Google, try to find place ID if not provided
    let googlePlaceId = data.placeId;
    if (data.source === 'google' && !googlePlaceId && data.businessName) {
      googlePlaceId = await findGooglePlaceId(data.businessName, data.address) ?? undefined;
    }

    if (data.source === 'google' && !googlePlaceId) {
      return NextResponse.json(
        { error: 'Could not find Google Place ID. Please provide a Place ID directly.' },
        { status: 400 }
      );
    }

    const db = getDb();

    // Check if source already exists
    const [existing] = await db
      .select()
      .from(reviewSources)
      .where(
        and(
          eq(reviewSources.clientId, clientId),
          eq(reviewSources.source, data.source)
        )
      )
      .limit(1);

    if (existing) {
      await db
        .update(reviewSources)
        .set({
          googlePlaceId: googlePlaceId || existing.googlePlaceId,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(reviewSources.id, existing.id));
    } else {
      await db.insert(reviewSources).values({
        clientId,
        source: data.source,
        googlePlaceId: googlePlaceId || null,
        isActive: true,
      });
    }

    return NextResponse.json({ success: true, googlePlaceId });
  }
);
