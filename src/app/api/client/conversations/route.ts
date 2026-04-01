import { NextResponse } from 'next/server';
import { getDb, leads, conversations } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

/**
 * GET /api/client/conversations
 * List all conversations for the current client (used for polling the conversation list).
 */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  async ({ session }) => {
    const db = getDb();

    const allLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        phone: leads.phone,
        source: leads.source,
        conversationMode: leads.conversationMode,
        actionRequired: leads.actionRequired,
        createdAt: leads.createdAt,
        lastMessageAt: sql<string>`(
          SELECT created_at FROM conversations
          WHERE lead_id = ${leads.id}
          ORDER BY created_at DESC LIMIT 1
        )`,
        lastMessage: sql<string>`(
          SELECT content FROM conversations
          WHERE lead_id = ${leads.id}
          ORDER BY created_at DESC LIMIT 1
        )`,
        lastMessageDirection: sql<string>`(
          SELECT direction FROM conversations
          WHERE lead_id = ${leads.id}
          ORDER BY created_at DESC LIMIT 1
        )`,
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM conversations WHERE lead_id = ${leads.id}
        )`,
      })
      .from(leads)
      .where(eq(leads.clientId, session.clientId))
      .orderBy(desc(leads.actionRequired), desc(leads.createdAt))
      .limit(50);

    return NextResponse.json({ conversations: allLeads });
  }
);
