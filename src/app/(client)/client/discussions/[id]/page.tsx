import { getClientSession } from '@/lib/client-auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, supportMessages, supportReplies } from '@/db';
import { eq, asc } from 'drizzle-orm';
import { DiscussionThread } from './discussion-thread';

export default async function ClientDiscussionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { id } = await params;
  const db = getDb();

  const [message] = await db
    .select()
    .from(supportMessages)
    .where(eq(supportMessages.id, id))
    .limit(1);

  if (!message || message.userEmail !== session.client.email) {
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
    createdAt: message.createdAt?.toISOString() ?? null,
  };
  const serializedReplies = replies.map((r) => ({
    ...r,
    createdAt: r.createdAt?.toISOString() ?? null,
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
