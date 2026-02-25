import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getLeadMedia } from '@/lib/services/media';
import { z } from 'zod';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const paramsSchema = z.object({
  id: z.string().uuid('Invalid lead ID'),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawParams = await params;
    const parsed = paramsSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { id } = parsed.data;
    const media = await getLeadMedia(id);
    return NextResponse.json(media);
  } catch (error) {
    return safeErrorResponse('[Media API][leads.media.get]', error, 'Internal server error');
  }
}
