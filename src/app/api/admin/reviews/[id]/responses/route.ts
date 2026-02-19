import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { reviewResponses } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { createDraftResponse } from '@/lib/services/review-response';
import { z } from 'zod';

const generateSchema = z.object({
  useTemplate: z.boolean().optional(),
  templateId: z.string().uuid().optional(),
  tone: z.enum(['professional', 'friendly', 'apologetic', 'thankful']).optional(),
});

/** GET - Get all responses for a specific review. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;

  const db = getDb();
  const responses = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.reviewId, id))
    .orderBy(desc(reviewResponses.createdAt));

  return NextResponse.json(responses);
}

/** POST - Create a new draft response (AI-generated or template-based). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const draft = await createDraftResponse(id, {
      useTemplate: data.useTemplate,
      templateId: data.templateId,
      tone: data.tone,
    });

    return NextResponse.json(draft);
  } catch (error) {
    console.error('[Reputation] Generate response error for review', id, ':', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate response' },
      { status: 500 }
    );
  }
}
