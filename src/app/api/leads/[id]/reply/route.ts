import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { clients } from '@/db/schema/clients';
import { conversations } from '@/db/schema/conversations';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { eq, and } from 'drizzle-orm';
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

  const clientId = session?.client?.id;
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

    const sendResult = await sendCompliantMessage({
      clientId,
      to: lead.phone,
      from: client.twilioNumber!,
      body: message,
      messageCategory: 'transactional',
      consentBasis: { type: 'existing_consent' },
      leadId: lead.id,
      queueOnQuietHours: false,
      metadata: { source: 'lead_manual_reply' },
    });

    if (sendResult.blocked) {
      return NextResponse.json(
        { error: `Message blocked: ${sendResult.blockReason}` },
        { status: 422 }
      );
    }

    await db.insert(conversations).values({
      leadId: lead.id,
      clientId,
      direction: 'outbound',
      messageType: 'manual',
      content: message,
      twilioSid: sendResult.messageSid || undefined,
    });

    if (lead.actionRequired) {
      await db
        .update(leads)
        .set({ actionRequired: false, actionRequiredReason: null })
        .where(eq(leads.id, lead.id));
    }

    // Monthly message count handled by compliance gateway

    return NextResponse.json({ success: true, sid: sendResult.messageSid });
  } catch (error) {
    console.error('[LeadManagement] Reply error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
