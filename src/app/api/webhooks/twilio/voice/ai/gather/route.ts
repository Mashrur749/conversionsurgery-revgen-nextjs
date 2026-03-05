import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWebhookBaseUrl } from '@/lib/utils/webhook-url';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { isOpsKillSwitchEnabled, OPS_KILL_SWITCH_KEYS } from '@/lib/services/ops-kill-switches';

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

const FILLER_PHRASES = [
  'One moment please...',
  'Let me look into that...',
  'Sure, give me just a second...',
];

/**
 * [Voice] Twilio webhook for AI speech gathering — thin handler
 * Captures caller speech, returns filler phrase, redirects to /process for heavy AI work
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const callSid = payload.CallSid;
    const speechResult = payload.SpeechResult;
    const appUrl = getWebhookBaseUrl(request);

    const voiceAiKillSwitchEnabled = await isOpsKillSwitchEnabled(
      OPS_KILL_SWITCH_KEYS.VOICE_AI
    );
    if (voiceAiKillSwitchEnabled) {
      const transferAction = `${appUrl}/api/webhooks/twilio/voice/ai/transfer`;
      return twimlResponse(
        '<Say voice="Polly.Matthew">Connecting you with our team now.</Say>' +
        `<Redirect>${transferAction}</Redirect>`
      );
    }

    console.log('[Voice AI Gather] Speech received', {
      callSid,
      speechLength: speechResult ? speechResult.length : 0,
    });

    if (!speechResult) {
      return twimlResponse(
        '<Say voice="Polly.Matthew">I didn\'t catch that. Could you please repeat?</Say>' +
        `<Gather input="speech" speechTimeout="auto" speechModel="phone_call" enhanced="true" action="${appUrl}/api/webhooks/twilio/voice/ai/gather" method="POST"/>` +
        '<Say>I\'ll have someone call you back. Goodbye!</Say><Hangup/>'
      );
    }

    // Quick DB write: append caller speech to transcript
    const db = getDb();
    const [call] = await db
      .select({ id: voiceCalls.id, transcript: voiceCalls.transcript })
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    if (!call) {
      void logInternalError({
        source: '[Voice AI Gather] Missing call record',
        error: new Error('Voice call record not found'),
        context: {
          route: '/api/webhooks/twilio/voice/ai/gather',
          callSidSuffix: callSid ? callSid.slice(-8) : null,
        },
      });
      logSanitizedConsoleError('[Voice AI Gather] No call record found', new Error('Missing voice call record'), {
        callSidSuffix: callSid ? callSid.slice(-8) : null,
      });
      return twimlResponse('<Say>Sorry, there was an error. Goodbye.</Say><Hangup/>');
    }

    // Update transcript with caller speech before redirecting
    const currentTranscript = call.transcript || '';
    const newTranscript = `${currentTranscript}\nCaller: ${speechResult}`;
    await db
      .update(voiceCalls)
      .set({ transcript: newTranscript, updatedAt: new Date() })
      .where(eq(voiceCalls.id, call.id));

    // Return filler phrase + redirect to processing endpoint
    const filler = FILLER_PHRASES[Date.now() % FILLER_PHRASES.length];
    const processAction = `${appUrl}/api/webhooks/twilio/voice/ai/process`;

    return twimlResponse(
      `<Say voice="Polly.Matthew">${filler}</Say>` +
      `<Redirect>${processAction}</Redirect>`
    );
  } catch (error) {
    void logInternalError({
      source: '[Voice AI Gather] Webhook',
      error,
      context: {
        route: '/api/webhooks/twilio/voice/ai/gather',
      },
    });
    logSanitizedConsoleError('[Voice AI Gather] Error:', error, {
      route: '/api/webhooks/twilio/voice/ai/gather',
    });
    return twimlResponse('<Say>Sorry, there was an error. Please try again later.</Say><Hangup/>');
  }
}
