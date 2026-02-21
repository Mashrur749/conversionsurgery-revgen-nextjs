import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWebhookBaseUrl } from '@/lib/utils/webhook-url';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

/**
 * [Voice] Twilio webhook for transferring AI calls to humans
 * Handles hot transfer from AI to business owner
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const callSid = payload.CallSid;

    console.log('[Voice AI Transfer] Transfer requested for call:', callSid);

    const db = getDb();

    // Get call and client
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    if (!call) {
      console.error('[Voice AI Transfer] No call record found for:', callSid);
      return twimlResponse(
        '<Say>Unable to transfer. Please try again later.</Say><Hangup/>'
      );
    }

    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, call.clientId))
      .limit(1);

    const transferTo = client?.phone;

    if (!transferTo) {
      console.log('[Voice AI Transfer] No forwarding number available');

      // Update call outcome
      await db
        .update(voiceCalls)
        .set({ outcome: 'voicemail', updatedAt: new Date() })
        .where(eq(voiceCalls.id, call.id));

      const appUrl = getWebhookBaseUrl(request);
      const recordingAction = `${appUrl}/api/webhooks/twilio/voice/ai/recording`;
      const transcriptionCallback = `${appUrl}/api/webhooks/twilio/voice/ai/transcription`;

      return twimlResponse(
        '<Say>I\'m sorry, no one is available right now. Please leave a message after the beep.</Say>' +
        `<Record maxLength="120" action="${recordingAction}" transcribe="true" transcribeCallback="${transcriptionCallback}"/>`
      );
    }

    // Update call record
    await db
      .update(voiceCalls)
      .set({
        outcome: 'transferred',
        transferredTo: transferTo,
        updatedAt: new Date(),
      })
      .where(eq(voiceCalls.id, call.id));

    console.log('[Voice AI Transfer] Transferring to:', transferTo);

    const appUrl = getWebhookBaseUrl(request);
    const dialAction = `${appUrl}/api/webhooks/twilio/voice/ai/dial-complete`;

    return twimlResponse(
      '<Say voice="Polly.Matthew">Connecting you now. Please hold.</Say>' +
      `<Dial callerId="${call.to}" timeout="30" action="${dialAction}">` +
      `<Number>${transferTo}</Number>` +
      '</Dial>'
    );
  } catch (error) {
    console.error('[Voice AI Transfer] Error:', error);
    return twimlResponse('<Say>Sorry, there was an error. Please try again later.</Say><Hangup/>');
  }
}
