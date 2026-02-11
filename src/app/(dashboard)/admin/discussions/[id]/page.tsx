import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { AdminDiscussionThread } from './admin-discussion-thread';

/** Admin detail view for a single support discussion thread with reply management. */
export default async function AdminDiscussionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');
  const isAdmin = (session as any).user?.isAdmin || false;
  if (!isAdmin) redirect('/dashboard');

  const { id } = await params;
  const db = getDb();

  const [message] = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.id, id))
    .limit(1);

  if (!message) notFound();

  const replies = await db
    .select()
    .from(supportReplies)
    .where(eq(supportReplies.supportMessageId, id))
    .orderBy(asc(supportReplies.createdAt));

  // Serialize dates for client component
  const serializedMessage = {
    ...message,
    createdAt: message.createdAt.toISOString(),
  };
  const serializedReplies = replies.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <AdminDiscussionThread
        message={serializedMessage}
        initialReplies={serializedReplies}
      />
    </div>
  );
}
