import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';

/**
 * POST /api/client/conversations/[id]/handback
 * Hand back a conversation from human to AI mode
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.CONVERSATIONS_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
