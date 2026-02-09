import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

// GET - List review sources
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();
  const sources = await db
    .select()
    .from(reviewSources)
    .where(eq(reviewSources.clientId, id));

  return NextResponse.json({ sources });
}

// POST - Add/update review source
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = addSourceSchema.parse(body);

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
          eq(reviewSources.clientId, id),
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
        clientId: id,
        source: data.source,
        googlePlaceId: googlePlaceId || null,
        isActive: true,
      });
    }

    return NextResponse.json({ success: true, googlePlaceId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Add review source error:', error);
    return NextResponse.json(
      { error: 'Failed to add review source' },
      { status: 500 }
    );
  }
}
