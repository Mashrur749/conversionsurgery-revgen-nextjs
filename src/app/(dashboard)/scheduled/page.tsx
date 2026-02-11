import { auth } from '@/lib/auth';
import { getClientId } from '@/lib/get-client-id';
import { getDb } from '@/db';
import { scheduledMessages, leads } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';

export const dynamic = 'force-dynamic';

export default async function ScheduledPage() {
  const session = await auth();
  const clientId = await getClientId();

  if (session?.user?.isAdmin && !clientId) {
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

  const pending = await db
    .select({
      id: scheduledMessages.id,
      content: scheduledMessages.content,
      sendAt: scheduledMessages.sendAt,
      sequenceType: scheduledMessages.sequenceType,
      sequenceStep: scheduledMessages.sequenceStep,
      leadId: scheduledMessages.leadId,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(scheduledMessages)
    .leftJoin(leads, eq(scheduledMessages.leadId, leads.id))
    .where(and(
      eq(scheduledMessages.clientId, clientId),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false)
    ))
    .orderBy(asc(scheduledMessages.sendAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scheduled Messages</h1>
        <p className="text-muted-foreground">{pending.length} messages pending</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {pending.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No scheduled messages. They'll appear here when sequences are started.
              </div>
            ) : (
              pending.map((msg) => (
                <Link
                  key={msg.id}
                  href={`/leads/${msg.leadId}`}
                  className="block p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-1">
                    <div>
                      <p className="font-medium">
                        {msg.leadName || formatPhoneNumber(msg.leadPhone || '')}
                      </p>
                      <div className="flex gap-2 mt-1 flex-wrap">
                        <Badge variant="outline">{msg.sequenceType}</Badge>
                        <Badge variant="secondary">Step {msg.sequenceStep}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground shrink-0">
                      {format(new Date(msg.sendAt), 'MMM d, h:mm a')}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {msg.content}
                  </p>
                </Link>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
