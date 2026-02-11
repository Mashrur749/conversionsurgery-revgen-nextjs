import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { clients } from '@/db/schema/clients';
import { conversations } from '@/db/schema/conversations';
import { sendSMS } from '@/lib/services/twilio';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';

const replySchema = z.object({
  message: z.string().min(1).max(1600),
});

/** POST /api/leads/[id]/reply - Send an SMS reply to a lead and log the conversation. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = (session as { client?: { id?: string } })?.client?.id;
  if (!clientId) {
    return NextResponse.json({ error: 'No client' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = replySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { message } = parsed.data;

    const db = getDb();

    const leadResult = await db
      .select()
      .from(leads)
      .where(and(eq(leads.id, id), eq(leads.clientId, clientId)))
      .limit(1);

    if (!leadResult.length) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    const lead = leadResult[0];

    const clientResult = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!clientResult.length || !clientResult[0].twilioNumber) {
      return NextResponse.json({ error: 'No Twilio number' }, { status: 400 });
    }

    const client = clientResult[0];

    const result = await sendSMS(lead.phone, client.twilioNumber!, message);

    if (!result.success) {
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
    }

    await db.insert(conversations).values({
      leadId: lead.id,
      clientId,
      direction: 'outbound',
      messageType: 'manual',
      content: message,
      twilioSid: result.sid,
    });

    if (lead.actionRequired) {
      await db
        .update(leads)
        .set({ actionRequired: false, actionRequiredReason: null })
        .where(eq(leads.id, lead.id));
    }

    await db
      .update(clients)
      .set({ messagesSentThisMonth: sql`${clients.messagesSentThisMonth} + 1` })
      .where(eq(clients.id, clientId));

    return NextResponse.json({ success: true, sid: result.sid });
  } catch (error) {
    console.error('[LeadManagement] Reply error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
