import { NextResponse } from 'next/server';
import { getDb, leads, conversations } from '@/db';
import { eq, and, asc, gt, lt } from 'drizzle-orm';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';

/**
 * GET /api/client/conversations/[id]/messages
 *   ?after=ISO_TIMESTAMP  — delta fetch: only messages after this timestamp (polling)
 *   ?before=ISO_TIMESTAMP — pagination: only messages before this timestamp (load earlier)
 *   ?limit=N              — max number of messages to return (default: unlimited)
 *
 * Returns `{ messages, hasMore }`.
 * `hasMore` is true when a limit was applied and more older messages exist.
 */
export const GET = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.CONVERSATIONS_VIEW },
  async ({ request, session, params }) => {
    const { clientId } = session;
    const { id } = params;
    const url = new URL(request.url);
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 200) : null;

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
    if (before) {
      conditions.push(lt(conversations.createdAt, new Date(before)));
    }

    const query = db
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

    // When a limit is requested, fetch one extra to detect hasMore
    const messages = limit
      ? await query.limit(limit + 1)
      : await query;

    let hasMore = false;
    if (limit && messages.length > limit) {
      hasMore = true;
      messages.pop(); // remove the extra sentinel row
    }

    return NextResponse.json({ messages, hasMore });
  }
);
