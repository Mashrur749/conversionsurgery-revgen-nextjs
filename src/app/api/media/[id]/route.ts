import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { deleteMedia } from '@/lib/services/media';
import { getDb, mediaAttachments } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().uuid('Invalid media attachment ID'),
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
    const db = getDb();
    const [item] = await db
      .select()
      .from(mediaAttachments)
      .where(eq(mediaAttachments.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: 'Media attachment not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err) {
    console.error('[Media API] GET /api/media/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    await deleteMedia(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Media API] DELETE /api/media/[id] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
