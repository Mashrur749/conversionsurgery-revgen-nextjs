import { NextResponse } from 'next/server';
import { getDb } from '@/db';
import { leads } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * POST /api/client/conversations/[id]/handback
 * Hand back a conversation from human to AI mode
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
      return safeErrorResponse('[Messaging][client-conversation.handback]', error, 'Failed to hand back conversation');
    }
  }
);
