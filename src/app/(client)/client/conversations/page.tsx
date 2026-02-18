import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, leads, conversations } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default async function ConversationsPage() {
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
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM conversations WHERE lead_id = ${leads.id}
      )`,
    })
    .from(leads)
    .where(eq(leads.clientId, session.clientId))
    .orderBy(desc(leads.actionRequired), desc(leads.createdAt))
    .limit(50);

  const modeColors: Record<string, string> = {
    ai: 'bg-sage-light text-forest',
    human: 'bg-[#E8F5E9] text-[#3D7A50]',
    paused: 'bg-muted text-foreground',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conversations</h1>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className={modeColors.ai}>AI</Badge>
          <Badge variant="outline" className={modeColors.human}>Human</Badge>
        </div>
      </div>

      <div className="space-y-2">
        {allLeads.map((lead) => (
          <Link key={lead.id} href={`/client/conversations/${lead.id}`}>
            <Card className={`hover:bg-[#F8F9FA] transition-colors ${
              lead.actionRequired ? 'border-l-4 border-l-sienna' : ''
            }`}>
              <CardContent className="py-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {lead.name || lead.phone}
                      </p>
                      <Badge className={modeColors[lead.conversationMode || 'ai']} variant="outline">
                        {lead.conversationMode || 'ai'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {lead.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{lead.messageCount} msgs</p>
                    <p>
                      {lead.lastMessageAt
                        ? formatDistanceToNow(new Date(lead.lastMessageAt), { addSuffix: true })
                        : formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {allLeads.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-2">No conversations yet</p>
              <p className="text-sm text-muted-foreground">Conversations will appear here when leads respond to your automated messages.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
