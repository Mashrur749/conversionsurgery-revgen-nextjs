import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { getDb } from '@/db';
import { conversations, clients, leads } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { AIQualityClient } from './ai-quality-client';
import type { FlaggedMessage } from './ai-quality-client';

export const dynamic = 'force-dynamic';

export default async function AIQualityPage() {
  const session = await auth();
  if (!session?.user?.isAgency) redirect('/dashboard');

  const db = getDb();

  const flaggedMessages = await db
    .select({
      id: conversations.id,
      clientId: conversations.clientId,
      leadId: conversations.leadId,
      content: conversations.content,
      flagReason: conversations.flagReason,
      flagNote: conversations.flagNote,
      flaggedAt: conversations.flaggedAt,
      createdAt: conversations.createdAt,
      clientName: clients.businessName,
      leadName: leads.name,
      leadPhone: leads.phone,
    })
    .from(conversations)
    .innerJoin(clients, eq(conversations.clientId, clients.id))
    .leftJoin(leads, eq(conversations.leadId, leads.id))
    .where(eq(conversations.flagged, true))
    .orderBy(desc(conversations.flaggedAt))
    .limit(100);

  const serialized: FlaggedMessage[] = flaggedMessages.map((msg) => ({
    id: msg.id,
    clientId: msg.clientId,
    leadId: msg.leadId,
    content: msg.content,
    flagReason: msg.flagReason,
    flagNote: msg.flagNote,
    flaggedAt: msg.flaggedAt?.toISOString() ?? null,
    createdAt: msg.createdAt.toISOString(),
    clientName: msg.clientName,
    leadName: msg.leadName,
    leadPhone: msg.leadPhone,
  }));

  return <AIQualityClient initialMessages={serialized} />;
}
