import { auth } from '@/lib/auth';
import { getDb, scheduledMessages, leads } from '@/db';
import { eq, and, desc } from 'drizzle-orm';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

export default async function ScheduledPage() {
  const session = await auth();
  const clientId = (session as any).client?.id;

  if (!clientId) {
    return <div>No client linked</div>;
  }

  const db = getDb();

  const messages = await db
    .select({
      message: scheduledMessages,
      lead: leads,
    })
    .from(scheduledMessages)
    .innerJoin(leads, eq(scheduledMessages.leadId, leads.id))
    .where(and(
      eq(scheduledMessages.clientId, clientId),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ))
    .orderBy(scheduledMessages.sendAt)
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduled Messages</h1>
        <p className="text-muted-foreground">{messages.length} pending</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {messages.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No scheduled messages
              </div>
            ) : (
              messages.map(({ message, lead }) => (
                <Link
                  key={message.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-start justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-medium">
                      {lead.name || formatPhoneNumber(lead.phone)}
                    </p>
                    <p className="text-sm text-muted-foreground truncate pr-4">
                      {message.content.substring(0, 80)}...
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{message.sequenceType}</Badge>
                      <Badge variant="secondary">Step {message.sequenceStep}</Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-medium">
                      {format(new Date(message.sendAt), 'MMM d')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(message.sendAt), 'h:mm a')}
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
