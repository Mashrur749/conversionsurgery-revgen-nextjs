import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getLeadMedia } from '@/lib/services/media';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const media = await getLeadMedia(id);
  return NextResponse.json(media);
}
