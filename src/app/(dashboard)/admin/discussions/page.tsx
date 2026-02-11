import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getDb, supportMessages, supportReplies } from '@/db';
import { desc, sql, count, eq } from 'drizzle-orm';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { MessageSquare } from 'lucide-react';

export default async function AdminDiscussionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const isAdmin = (session as any).user?.isAdmin || false;
  if (!isAdmin) redirect('/dashboard');

  const { status: statusFilter } = await searchParams;

  const db = getDb();

  const conditions = [];
  if (statusFilter === 'open' || statusFilter === 'resolved') {
    conditions.push(eq(supportMessages.status, statusFilter));
  }

  const threads = await db
    .select({
      id: supportMessages.id,
      userEmail: supportMessages.userEmail,
      message: supportMessages.message,
      status: supportMessages.status,
      createdAt: supportMessages.createdAt,
      replyCount: count(supportReplies.id),
      lastReplyAt: sql<string>`max(${supportReplies.createdAt})`,
    })
    .from(supportMessages)
    .leftJoin(supportReplies, eq(supportMessages.id, supportReplies.supportMessageId))
    .where(conditions.length > 0 ? conditions[0] : undefined)
    .groupBy(supportMessages.id)
    .orderBy(desc(sql`COALESCE(max(${supportReplies.createdAt}), ${supportMessages.createdAt})`));

  const currentFilter = statusFilter || 'all';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Support Discussions</h1>
        <div className="flex gap-1">
          {['all', 'open', 'resolved'].map((f) => (
            <Link
              key={f}
              href={f === 'all' ? '/admin/discussions' : `/admin/discussions?status=${f}`}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                currentFilter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Link>
          ))}
        </div>
      </div>

      {threads.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No discussions</p>
          <p className="text-sm mt-1">Support messages from users will appear here.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/admin/discussions/${thread.id}`}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-gray-900">
                    {thread.userEmail}
                  </span>
                  <Badge
                    variant={thread.status === 'open' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {thread.status}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 line-clamp-1">
                  {thread.message}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-500">
                  {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {thread.lastReplyAt
                    ? new Date(thread.lastReplyAt).toLocaleDateString()
                    : thread.createdAt
                    ? new Date(thread.createdAt).toLocaleDateString()
                    : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
