import { Suspense } from 'react';
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';
import { PORTAL_PERMISSIONS } from '@/lib/permissions/constants';
import { requirePortalPagePermission } from '@/lib/permissions/require-portal-page-permission';
import { ConversationsShell } from './conversations-shell';

export default async function ConversationsPage() {
  await requirePortalPagePermission(PORTAL_PERMISSIONS.CONVERSATIONS_VIEW);
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

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

  // Serialize dates to strings for the client component
  const conversations = allLeads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    phone: lead.phone,
    source: lead.source,
    conversationMode: lead.conversationMode,
    actionRequired: lead.actionRequired,
    createdAt: lead.createdAt?.toISOString() ?? new Date().toISOString(),
    lastMessageAt: lead.lastMessageAt ?? null,
    lastMessage: lead.lastMessage ?? null,
    lastMessageDirection: lead.lastMessageDirection ?? null,
    messageCount: Number(lead.messageCount) || 0,
  }));

  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center" style={{ height: 'calc(100dvh - 4.5rem)' }}>
          <div className="text-sm text-muted-foreground">Loading conversations&hellip;</div>
        </div>
      }
    >
      <ConversationsShell initialConversations={conversations} />
    </Suspense>
  );
}
