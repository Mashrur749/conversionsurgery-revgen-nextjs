import { getClientSession } from '@/lib/client-auth';
import { redirect, notFound } from 'next/navigation';
import { getDb, leads, conversations } from '@/db';
import { eq, and, asc } from 'drizzle-orm';
import { ConversationView } from './conversation-view';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ConversationDetailPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const { id } = await params;
  const db = getDb();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.id, id),
      eq(leads.clientId, session.clientId)
    ))
    .limit(1);

  if (!lead) notFound();

  const messages = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(asc(conversations.createdAt));

  return (
    <ConversationView
      lead={{
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        conversationMode: lead.conversationMode,
        actionRequired: lead.actionRequired,
      }}
      messages={messages.map((m) => ({
        id: m.id,
        direction: m.direction,
        content: m.content,
        messageType: m.messageType,
        createdAt: m.createdAt,
      }))}
    />
  );
}
