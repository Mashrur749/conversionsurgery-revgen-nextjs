import { NextResponse } from 'next/server';
import { getDb, leads, conversations } from '@/db';
import { eq, and, asc, gt } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

/**
 * GET /api/client/conversations/[id]/messages?after=ISO_TIMESTAMP
 * Fetch messages for a conversation. If `after` is provided, only returns
 * messages created after that timestamp (used for polling).
 */
export const GET = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  async ({ request, session, params }) => {
    const { clientId } = session;
    const { id } = params;
    const url = new URL(request.url);
    const after = url.searchParams.get('after');

    const db = getDb();

    // Verify lead belongs to this client
    const [lead] = await db
      .select({ id: leads.id })
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
      .limit(1);

    if (!lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const conditions = [eq(conversations.leadId, id)];
    if (after) {
      conditions.push(gt(conversations.createdAt, new Date(after)));
    }

    const messages = await db
      .select({
        id: conversations.id,
        direction: conversations.direction,
        content: conversations.content,
        messageType: conversations.messageType,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(and(...conditions))
      .orderBy(asc(conversations.createdAt));

    return NextResponse.json({ messages });
  }
);
