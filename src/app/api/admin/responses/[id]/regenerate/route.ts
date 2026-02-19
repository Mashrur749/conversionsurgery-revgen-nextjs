import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { regenerateResponse } from '@/lib/services/review-response';
import { z } from 'zod';

const regenerateSchema = z.object({
  tone: z.enum(['professional', 'friendly', 'apologetic', 'thankful']).optional(),
  shorter: z.boolean().optional(),
  custom: z.string().optional(),
});

/** POST - Regenerate a review response with different parameters. */
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
  } catch (error) {
    console.error('[Reputation] Regenerate response error for', id, ':', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to regenerate response' },
      { status: 500 }
    );
  }
}
