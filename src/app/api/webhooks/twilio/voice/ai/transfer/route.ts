import { NextRequest, NextResponse } from 'next/server';
import { getDb, voiceCalls, clients } from '@/db';
import { eq } from 'drizzle-orm';

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(formData.entries()) as Record<string, string>;

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
        .set({ outcome: 'voicemail' })
        .where(eq(voiceCalls.id, call.id));

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
      })
      .where(eq(voiceCalls.id, call.id));

    console.log('[Voice AI Transfer] Transferring to:', transferTo);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
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
