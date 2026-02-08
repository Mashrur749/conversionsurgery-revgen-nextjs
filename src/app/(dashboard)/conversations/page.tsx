import { auth } from '@/lib/auth';
import { getDb, conversations, leads } from '@/db';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  const session = await auth();
  const clientId = (session as any).client?.id;

  if (!clientId) {
    return <div>No client linked</div>;
  }

  const db = getDb();

  const allConversations = await db
    .select({
      conversation: conversations,
      lead: leads,
    })
    .from(conversations)
    .innerJoin(leads, eq(conversations.leadId, leads.id))
    .where(eq(conversations.clientId, clientId))
    .orderBy(desc(conversations.createdAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-muted-foreground">{allConversations.length} messages</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {allConversations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              allConversations.map(({ conversation, lead }) => (
                <Link
                  key={conversation.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-start justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium">
                      {lead.name || formatPhoneNumber(lead.phone)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate pr-4">
                      {conversation.direction === 'inbound' ? '← ' : '→ '}
                      {conversation.content.substring(0, 80)}
                      {conversation.content.length > 80 ? '...' : ''}
                    </p>
                    {conversation.messageType && (
                      <Badge variant="outline" className="text-xs">
                        {conversation.messageType.replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <Badge
                      variant={conversation.direction === 'inbound' ? 'default' : 'outline'}
                    >
                      {conversation.direction}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-2">
                      {format(new Date(conversation.createdAt!), 'MMM d, h:mm a')}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
