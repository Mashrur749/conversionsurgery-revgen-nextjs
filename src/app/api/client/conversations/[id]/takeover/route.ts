import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

/**
 * POST /api/client/conversations/[id]/takeover
 * Take over a conversation from AI to human mode
 */
export const POST = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  async ({ session, params }) => {
    const { clientId } = session;
    const { id } = params;
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
);
