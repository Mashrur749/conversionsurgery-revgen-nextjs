import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb, leads } from '@/db';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const db = getDb();

  await db
    .update(leads)
    .set({
      conversationMode: 'ai',
      humanTakeoverAt: null,
      humanTakeoverBy: null,
    })
    .where(and(
      eq(leads.id, id),
      eq(leads.clientId, clientId)
    ));

  return NextResponse.json({ success: true });
}
