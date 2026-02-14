import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads, clients, conversations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getClientId } from '@/lib/get-client-id';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { z } from 'zod';

const sendMessageSchema = z.object({
  body: z.string().min(1).max(1600),
  mediaUrl: z.array(z.string().url()).max(10).optional(),
}).strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const clientId = await getClientId();
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  const parsed = sendMessageSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const [client] = await db
    .select({ twilioNumber: clients.twilioNumber })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.twilioNumber) {
    return NextResponse.json({ error: 'No phone number configured' }, { status: 400 });
  }

  const result = await sendCompliantMessage({
    clientId,
    to: lead.phone,
    from: client.twilioNumber,
    body: parsed.data.body,
    mediaUrl: parsed.data.mediaUrl,
    messageCategory: 'transactional',
    consentBasis: { type: 'existing_consent' },
    leadId: lead.id,
  });

  if (result.sent) {
    await db.insert(conversations).values({
      leadId: lead.id,
      clientId,
      direction: 'outbound',
      messageType: 'contractor_response',
      content: parsed.data.body,
      twilioSid: result.messageSid,
      deliveryStatus: 'queued',
      mediaUrl: parsed.data.mediaUrl || null,
    });
  }

  return NextResponse.json({
    success: result.sent,
    blocked: result.blocked,
    blockReason: result.blockReason,
  });
}
