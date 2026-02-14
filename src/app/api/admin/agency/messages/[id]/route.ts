import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { agencyMessages, clients } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/admin/agency/messages/[id]
 * Single message detail with reply chain (via inReplyTo).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const db = getDb();

  // Get the message
  const [message] = await db
    .select({
      id: agencyMessages.id,
      clientId: agencyMessages.clientId,
      clientName: clients.businessName,
      clientPhone: clients.phone,
      direction: agencyMessages.direction,
      channel: agencyMessages.channel,
      content: agencyMessages.content,
      subject: agencyMessages.subject,
      category: agencyMessages.category,
      promptType: agencyMessages.promptType,
      actionPayload: agencyMessages.actionPayload,
      actionStatus: agencyMessages.actionStatus,
      inReplyTo: agencyMessages.inReplyTo,
      clientReply: agencyMessages.clientReply,
      twilioSid: agencyMessages.twilioSid,
      delivered: agencyMessages.delivered,
      createdAt: agencyMessages.createdAt,
      expiresAt: agencyMessages.expiresAt,
    })
    .from(agencyMessages)
    .leftJoin(clients, eq(agencyMessages.clientId, clients.id))
    .where(eq(agencyMessages.id, id))
    .limit(1);

  if (!message) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // Get reply chain — messages that reference this one or its parent
  const threadId = message.inReplyTo || message.id;
  const replies = await db
    .select({
      id: agencyMessages.id,
      direction: agencyMessages.direction,
      channel: agencyMessages.channel,
      content: agencyMessages.content,
      category: agencyMessages.category,
      actionStatus: agencyMessages.actionStatus,
      clientReply: agencyMessages.clientReply,
      delivered: agencyMessages.delivered,
      createdAt: agencyMessages.createdAt,
    })
    .from(agencyMessages)
    .where(eq(agencyMessages.inReplyTo, threadId))
    .orderBy(desc(agencyMessages.createdAt));

  return NextResponse.json({ message, replies });
}
