import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq, desc, sql, count } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

export default async function ClientDiscussionsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const db = getDb();
  const ownerEmail = session.client.email;

  const threads = await db
    .select({
      id: supportMessages.id,
      message: supportMessages.message,
      status: supportMessages.status,
      createdAt: supportMessages.createdAt,
      replyCount: count(supportReplies.id),
      lastReplyAt: sql<string>`max(${supportReplies.createdAt})`,
    })
    .from(supportMessages)
    .leftJoin(supportReplies, eq(supportMessages.id, supportReplies.supportMessageId))
    .where(eq(supportMessages.userEmail, ownerEmail))
    .groupBy(supportMessages.id)
    .orderBy(desc(sql`COALESCE(max(${supportReplies.createdAt}), ${supportMessages.createdAt})`));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Discussions</h1>

      {threads.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No discussions yet</p>
          <p className="text-sm mt-1">Use the help button to start a conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/client/discussions/${thread.id}`}
              className="block border rounded-lg p-4 hover:bg-[#F8F9FA] transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground line-clamp-2">
                    {thread.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span>
                      {thread.createdAt
                        ? new Date(thread.createdAt).toLocaleDateString()
                        : ''}
                    </span>
                    <span>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</span>
                  </div>
                </div>
                <Badge className={thread.status === 'open' ? 'bg-[#E8F5E9] text-[#3D7A50]' : 'bg-muted text-foreground'}>
                  {thread.status}
                </Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
