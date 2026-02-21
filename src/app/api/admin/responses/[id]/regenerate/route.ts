import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { regenerateResponse } from '@/lib/services/review-response';
import { z } from 'zod';

const regenerateSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'apologetic', 'thankful']).optional(),
  shorter: z.boolean().optional(),
  custom: z.string().optional(),
});

/** POST - Regenerate a review response with different parameters. */
export const POST = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CONVERSATIONS_RESPOND },
  async ({ request, params }) => {
    const { id } = params;

    const body = await request.json();
    const parsed = regenerateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const newText = await regenerateResponse(id, {
      tone: data.tone,
      shorter: data.shorter,
      custom: data.custom,
    });

    return NextResponse.json({ responseText: newText });
  }
);
