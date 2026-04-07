import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls, callerIntentEnum } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { generateCallSummary, notifyClientOfCall } from '@/lib/services/voice-summary';
import { getWebhookBaseUrl, xmlAttr } from '@/lib/utils/webhook-url';

interface HandoffData {
  reasonCode: 'live-agent-handoff' | 'callback-scheduled' | 'call-ended';
  reason: string;
  callSummary: string;
  transcript: string;
  callerIntent: string | null;
  callbackRequested: boolean;
  transferTo?: string;
  callerName?: string;
  projectType?: string;
}

const MISSED_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);

type CallerIntent = (typeof callerIntentEnum.enumValues)[number];
const VALID_CALLER_INTENTS = new Set<string>(callerIntentEnum.enumValues);

function toCallerIntent(value: string | null | undefined): CallerIntent | null {
  if (value && VALID_CALLER_INTENTS.has(value)) return value as CallerIntent;
  return null;
}

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

/**
 * [Voice] ConversationRelay session-end handler.
 *
 * Called by Twilio when the ConversationRelay session ends (via the action URL
 * on <Connect>). Receives HandoffData from the Durable Object and handles:
 * - Live agent transfer (return <Dial> TwiML)
 * - Callback scheduling (update DB, notify contractor)
 * - Normal call end (save transcript, generate summary, notify contractor)
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const callSid = payload.CallSid;
    const sessionDuration = parseInt(payload.SessionDuration || '0', 10);
    const handoffDataRaw = payload.HandoffData;

    console.log('[Voice Session End] Received:', {
      callSidSuffix: callSid?.slice(-8),
      sessionDuration,
      hasHandoff: !!handoffDataRaw,
    });

    const db = getDb();

    // Find the voice call record
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    // Parse handoff data from the Durable Object
    let handoff: HandoffData | null = null;
    if (handoffDataRaw) {
      try {
        handoff = JSON.parse(handoffDataRaw) as HandoffData;
      } catch {
        console.error('[Voice Session End] Failed to parse HandoffData');
      }
    }

    // Update voice call record with session data
    if (call) {
      await db
        .update(voiceCalls)
        .set({
          status: 'completed',
          duration: sessionDuration,
          transcript: handoff?.transcript || call.transcript,
          callerIntent: toCallerIntent(handoff?.callerIntent) ?? call.callerIntent,
          callbackRequested: handoff?.callbackRequested || call.callbackRequested,
          outcome: handoff?.reasonCode === 'live-agent-handoff'
            ? 'transferred'
            : handoff?.reasonCode === 'callback-scheduled'
              ? 'qualified'
              : 'qualified',
          endedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(voiceCalls.id, call.id));
    }

    // ── Handle: Transfer to human ─────────────────────────────────────
    if (handoff?.reasonCode === 'live-agent-handoff') {
      const transferTo = handoff.transferTo;

      if (!transferTo) {
        // No phone to transfer to — inform caller
        return twimlResponse(
          '<Say>I apologize, but no one is available right now. We will call you back shortly. Goodbye.</Say><Hangup/>'
        );
      }

      console.log('[Voice Session End] Transferring to:', {
        transferToSuffix: transferTo.slice(-4),
      });

      // Update call with transfer target
      if (call) {
        await db
          .update(voiceCalls)
          .set({ transferredTo: transferTo, outcome: 'transferred', updatedAt: new Date() })
          .where(eq(voiceCalls.id, call.id));
      }

      const appUrl = getWebhookBaseUrl(request);
      const dialCompleteAction = `${appUrl}/api/webhooks/twilio/voice/ai/dial-complete`;

      return twimlResponse(
        '<Say>Please hold while I connect you.</Say>' +
        `<Dial timeout="30" action="${xmlAttr(dialCompleteAction)}">` +
          `<Number>${transferTo}</Number>` +
        `</Dial>`
      );
    }

    // ── Handle: Callback scheduled ────────────────────────────────────
    if (handoff?.reasonCode === 'callback-scheduled') {
      // Fire post-call processing in background
      if (call) {
        void firePostCallProcessing(call.id);
      }

      return twimlResponse(
        `<Say>Great, ${handoff.callerName ? handoff.callerName + ', ' : ''}we will have someone call you back. Have a great day!</Say><Hangup/>`
      );
    }

    // ── Handle: Normal call end ───────────────────────────────────────
    if (call) {
      void firePostCallProcessing(call.id);
    }

    return twimlResponse('');
  } catch (error) {
    void logInternalError({
      source: '[Voice Session End] Webhook',
      error,
      context: { route: '/api/webhooks/twilio/voice/ai/session-end' },
    });
    logSanitizedConsoleError('[Voice Session End] Error:', error, {
      route: '/api/webhooks/twilio/voice/ai/session-end',
    });
    return twimlResponse('');
  }
}

/**
 * Fire-and-forget post-call processing:
 * 1. Generate AI summary
 * 2. Notify contractor
 */
async function firePostCallProcessing(callId: string): Promise<void> {
  try {
    await generateCallSummary(callId);
    await notifyClientOfCall(callId);
  } catch (err) {
    logSanitizedConsoleError('[Voice Session End] Post-call processing error:', err, { callId });
  }
}
