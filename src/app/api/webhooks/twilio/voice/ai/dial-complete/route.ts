import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

const MISSED_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

/**
 * [Voice] Twilio webhook for dial completion status
 * Updates voice call records when transfer completes
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const callSid = payload.CallSid;
    const dialCallStatus = (payload.DialCallStatus || '').toLowerCase();

    console.log('[Voice AI Dial Complete] Status:', dialCallStatus, 'CallSid:', callSid);

    const db = getDb();

    // Update voice call record if it exists
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    if (call) {
      if (MISSED_STATUSES.has(dialCallStatus)) {
        await db
          .update(voiceCalls)
          .set({
            status: 'completed',
            outcome: 'dropped',
            endedAt: new Date(),
          })
          .where(eq(voiceCalls.id, call.id));
      } else {
        await db
          .update(voiceCalls)
          .set({
            status: 'completed',
            outcome: call.outcome || 'transferred',
            endedAt: new Date(),
          })
          .where(eq(voiceCalls.id, call.id));
      }
    }

    // If the dial failed, offer voicemail
    if (MISSED_STATUSES.has(dialCallStatus)) {
      return twimlResponse(
        '<Say>Sorry, no one was available to take your call. We\'ll call you back soon. Goodbye!</Say><Hangup/>'
      );
    }

    return twimlResponse('');
  } catch (error) {
    console.error('[Voice AI Dial Complete] Error:', error);
    return twimlResponse('');
  }
}
