import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { callAttempts, clients, leads } from '@/db/schema';
import { handleNoAnswer } from '@/lib/services/ring-group';
import { eq } from 'drizzle-orm';
import twilio from 'twilio';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

/**
 * [Voice] Twilio webhook for ring group dial result
 * Handles completion status and no-answer scenarios
 */
export async function POST(request: NextRequest) {
  const payload = await validateAndParseTwilioWebhook(request);
  if (!payload) {
    const twiml = new VoiceResponse();
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const url = new URL(request.url);
  const attemptId = url.searchParams.get('attemptId');

  const dialCallStatus = payload.DialCallStatus;

  if (!attemptId) {
    const twiml = new VoiceResponse();
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  const db = getDb();

  const [attempt] = await db
    .select()
    .from(callAttempts)
    .where(eq(callAttempts.id, attemptId))
    .limit(1);

  if (!attempt) {
    const twiml = new VoiceResponse();
    twiml.hangup();
    return new NextResponse(twiml.toString(), {
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  await db
    .update(callAttempts)
    .set({
      status: dialCallStatus === 'completed' ? 'answered' : 'no-answer',
      endedAt: new Date(),
    })
    .where(eq(callAttempts.id, attemptId));

  if (dialCallStatus !== 'completed' && dialCallStatus !== 'answered') {
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, attempt.clientId))
      .limit(1);

    const [lead] = await db
      .select()
      .from(leads)
      .where(eq(leads.id, attempt.leadId))
      .limit(1);

    if (client && lead) {
      await handleNoAnswer({
        leadId: lead.id,
        clientId: client.id,
        leadPhone: lead.phone,
        twilioNumber: client.twilioNumber!,
      });
    }
  }

  const twiml = new VoiceResponse();
  twiml.hangup();

  return new NextResponse(twiml.toString(), {
    headers: { 'Content-Type': 'text/xml' },
  });
}
