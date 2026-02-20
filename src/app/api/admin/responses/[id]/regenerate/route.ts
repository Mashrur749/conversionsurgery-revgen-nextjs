import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { regenerateResponse } from '@/lib/services/review-response';
import { z } from 'zod';
import { safeErrorResponse, permissionErrorResponse } from '@/lib/utils/api-errors';

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
    return permissionErrorResponse(error);
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
    return safeErrorResponse('admin/responses/[id]/regenerate', error, 'Failed to regenerate response');
  }
}
