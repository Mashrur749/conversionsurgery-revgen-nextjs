import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getLeadMedia } from '@/lib/services/media';
import { z } from 'zod';

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
  } catch (err) {
    console.error('[Media API] GET /api/leads/[id]/media error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
