import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb, voiceCalls } from '@/db';
import { eq, desc } from 'drizzle-orm';

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
  const calls = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.clientId, id))
    .orderBy(desc(voiceCalls.createdAt))
    .limit(50);

  return NextResponse.json(calls);
}
