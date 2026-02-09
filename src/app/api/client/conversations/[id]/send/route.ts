import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb, leads, conversations, clients } from '@/db';
import { eq, and } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message } = await request.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  const { id } = await params;
  const db = getDb();

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.id, id),
      eq(leads.clientId, clientId)
    ))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.twilioNumber) {
    return NextResponse.json({ error: 'No phone number configured' }, { status: 400 });
  }

  // Send SMS
  await sendSMS(lead.phone, client.twilioNumber, message);

  // Save to database
  const [saved] = await db
    .insert(conversations)
    .values({
      leadId: lead.id,
      clientId,
      direction: 'outbound',
      messageType: 'contractor_response',
      content: message,
    })
    .returning();

  return NextResponse.json({
    message: {
      id: saved.id,
      direction: saved.direction,
      content: saved.content,
      messageType: saved.messageType,
      createdAt: saved.createdAt,
    },
  });
}
