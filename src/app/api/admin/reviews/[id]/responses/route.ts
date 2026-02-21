import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
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
export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ params }) => {
    const { id } = params;

    const db = getDb();
    const responses = await db
      .select()
      .from(reviewResponses)
      .where(eq(reviewResponses.reviewId, id))
      .orderBy(desc(reviewResponses.createdAt));

    return NextResponse.json(responses);
  }
);

/** POST - Create a new draft response (AI-generated or template-based). */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ request, params }) => {
    const { id } = params;

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
  }
);
