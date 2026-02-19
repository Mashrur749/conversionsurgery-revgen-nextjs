import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';

/**
 * POST /api/client/conversations/[id]/takeover
 * Take over a conversation from AI to human mode
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
        conversationMode: 'human',
        humanTakeoverAt: new Date(),
        humanTakeoverBy: 'client',
        actionRequired: false,
      })
      .where(and(
        eq(leads.id, id),
        eq(leads.clientId, clientId)
      ));

    console.log('[Messaging] Conversation takeover successful:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Messaging] Takeover failed:', error);
    return NextResponse.json(
      { error: 'Failed to take over conversation' },
      { status: 500 }
    );
  }
}
