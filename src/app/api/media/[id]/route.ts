import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteMedia } from '@/lib/services/media';
import { getDb, mediaAttachments } from '@/db';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(mediaAttachments)
    .where(eq(mediaAttachments.id, id))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(item);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await deleteMedia(id);
  return NextResponse.json({ success: true });
}
