import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/db';
import { leads, conversations, clients } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';
import { z } from 'zod';

const sendMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /api/client/conversations/[id]/send
 * Send a message to a lead
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    console.error('[Messaging] Unauthorized send attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const validation = sendMessageSchema.safeParse(body);

  if (!validation.success) {
    console.error('[Messaging] Invalid message payload:', validation.error.flatten().fieldErrors);
    return NextResponse.json(
      { error: 'Validation failed', details: validation.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { message } = validation.data;

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
    console.error('[Messaging] Lead not found:', id);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client?.twilioNumber) {
    console.error('[Messaging] No phone number configured for client:', clientId);
    return NextResponse.json({ error: 'No phone number configured' }, { status: 400 });
  }

  try {
    // Send SMS
    const twilioSid = await sendSMS(lead.phone, message, client.twilioNumber);

    // Save to database
    const [saved] = await db
      .insert(conversations)
      .values({
        leadId: lead.id,
        clientId,
        direction: 'outbound',
        messageType: 'contractor_response',
        content: message,
        twilioSid,
      })
      .returning();

    console.log('[Messaging] Message sent successfully:', saved.id);

    return NextResponse.json({
      message: {
        id: saved.id,
        direction: saved.direction,
        content: saved.content,
        messageType: saved.messageType,
        createdAt: saved.createdAt,
      },
    });
  } catch (error) {
    console.error('[Messaging] Failed to send message:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
