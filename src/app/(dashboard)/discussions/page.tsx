import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq, desc, sql, count } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

/** Displays a list of the current user's support discussion threads. */
export default async function DiscussionsPage() {
  const session = await auth();
  if (!session) redirect('/login');

  const db = getDb();
  const userEmail = session.user?.email ?? '';

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
    .where(eq(supportMessages.userEmail, userEmail))
    .groupBy(supportMessages.id)
    .orderBy(desc(sql`COALESCE(max(${supportReplies.createdAt}), ${supportMessages.createdAt})`));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Discussions</h1>

      {threads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No discussions yet</p>
          <p className="text-sm mt-1">Use the help button to start a conversation.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/discussions/${thread.id}`}
              className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 line-clamp-2">
                    {thread.message}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span>
                      {new Date(thread.createdAt).toLocaleDateString()}
                    </span>
                    <span>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}</span>
                  </div>
                </div>
                <Badge variant={thread.status === 'open' ? 'default' : 'secondary'}>
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
