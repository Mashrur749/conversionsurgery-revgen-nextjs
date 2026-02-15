import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClientSession } from '@/lib/client-auth';

/**
 * POST /api/client/conversations/[id]/handback
 * Hand back a conversation from human to AI mode
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getClientSession();
  if (!session) {
    console.error('[Messaging] Unauthorized handback attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { clientId } = session;

  const { id } = await params;
  const db = getDb();

  try {
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

    console.log('[Messaging] Conversation handback successful:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Messaging] Handback failed:', error);
    return NextResponse.json(
      { error: 'Failed to hand back conversation' },
      { status: 500 }
    );
  }
}
