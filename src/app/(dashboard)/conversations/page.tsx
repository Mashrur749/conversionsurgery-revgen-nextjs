import { auth } from '@/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb } from '@/db';
import { conversations, leads } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

export default async function ConversationsPage() {
  const session = await auth();
  const clientId = await getClientId();

  if (session?.user?.isAgency && !clientId) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-semibold mb-2">Select a Client</h2>
        <p className="text-muted-foreground">
          Use the dropdown in the header to select a client to view.
        </p>
      </div>
    );
  }

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
              <div className="py-12 text-center">
                <p className="text-muted-foreground mb-2">No conversations yet</p>
                <p className="text-sm text-muted-foreground">Conversations will appear here when leads respond to automated messages.</p>
              </div>
            ) : (
              allConversations.map(({ conversation, lead }) => (
                <Link
                  key={conversation.id}
                  href={`/leads/${lead.id}`}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-3 md:p-4 hover:bg-[#F8F9FA] transition-colors gap-2"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {lead.name || formatPhoneNumber(lead.phone)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
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
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:text-right shrink-0">
                    <Badge
                      variant={conversation.direction === 'inbound' ? 'default' : 'outline'}
                    >
                      {conversation.direction}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
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
