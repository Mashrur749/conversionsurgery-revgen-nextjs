import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

// GET - Get responses for a review
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
  const responses = await db
    .select()
    .from(reviewResponses)
    .where(eq(reviewResponses.reviewId, id))
    .orderBy(desc(reviewResponses.createdAt));

  return NextResponse.json(responses);
}

// POST - Create new draft response (AI-generated or template-based)
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
    const body = await request.json().catch(() => ({}));
    const data = generateSchema.parse(body);

    const draft = await createDraftResponse(id, {
      useTemplate: data.useTemplate,
      templateId: data.templateId,
      tone: data.tone,
    });

    return NextResponse.json(draft);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('[Review Response] Generate error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate response' },
      { status: 500 }
    );
  }
}
