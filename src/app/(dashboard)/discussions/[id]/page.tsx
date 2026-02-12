import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { DiscussionThread } from './discussion-thread';

/** Displays a single discussion thread with its replies for the current user. */
export default async function DiscussionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect('/login');

  const { id } = await params;
  const db = getDb();
  const userEmail = session.user?.email ?? '';

  const [message] = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.id, id))
    .limit(1);

  if (!message || message.userEmail !== userEmail) {
    notFound();
  }

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
      <DiscussionThread
        message={serializedMessage}
        initialReplies={serializedReplies}
      />
    </div>
  );
}
