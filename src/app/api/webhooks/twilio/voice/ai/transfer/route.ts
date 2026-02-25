import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWebhookBaseUrl } from '@/lib/utils/webhook-url';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

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

    console.log('[Voice AI Transfer] Transfer requested', {
      callSidSuffix: callSid ? callSid.slice(-8) : null,
    });

    const db = getDb();

    // Get call and client
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    if (!call) {
      void logInternalError({
        source: '[Voice AI Transfer] Missing call record',
        error: new Error('Voice call record not found'),
        context: {
          route: '/api/webhooks/twilio/voice/ai/transfer',
          callSidSuffix: callSid ? callSid.slice(-8) : null,
        },
      });
      logSanitizedConsoleError('[Voice AI Transfer] No call record found', new Error('Missing voice call record'), {
        callSidSuffix: callSid ? callSid.slice(-8) : null,
      });
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

    console.log('[Voice AI Transfer] Transferring call', {
      callSidSuffix: callSid ? callSid.slice(-8) : null,
      transferToSuffix: transferTo ? transferTo.slice(-4) : null,
    });

    const appUrl = getWebhookBaseUrl(request);
    const dialAction = `${appUrl}/api/webhooks/twilio/voice/ai/dial-complete`;

    return twimlResponse(
      '<Say voice="Polly.Matthew">Connecting you now. Please hold.</Say>' +
      `<Dial callerId="${call.to}" timeout="30" action="${dialAction}">` +
      `<Number>${transferTo}</Number>` +
      '</Dial>'
    );
  } catch (error) {
    void logInternalError({
      source: '[Voice AI Transfer] Webhook',
      error,
      context: { route: '/api/webhooks/twilio/voice/ai/transfer' },
    });
    logSanitizedConsoleError('[Voice AI Transfer] Error:', error, {
      route: '/api/webhooks/twilio/voice/ai/transfer',
    });
    return twimlResponse('<Say>Sorry, there was an error. Please try again later.</Say><Hangup/>');
  }
}
