import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls, leads, clients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { createEscalation } from '@/lib/services/escalation';
import { sendAlert } from '@/lib/services/agency-communication';

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

    console.log('[Voice AI Dial Complete] Status update', {
      dialCallStatus,
      callSidSuffix: callSid ? callSid.slice(-8) : null,
    });

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
            updatedAt: new Date(),
          })
          .where(eq(voiceCalls.id, call.id));
      } else {
        await db
          .update(voiceCalls)
          .set({
            status: 'completed',
            outcome: call.outcome || 'transferred',
            endedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(voiceCalls.id, call.id));
      }
    }

    // If the dial failed, send homeowner SMS, create escalation, notify team member
    if (MISSED_STATUSES.has(dialCallStatus)) {
      if (call?.leadId) {
        // Run side effects in parallel — never fail the TwiML response
        void (async () => {
          try {
            const db2 = getDb();

            const [[lead], [client]] = await Promise.all([
              db2.select().from(leads).where(eq(leads.id, call.leadId!)).limit(1),
              db2
                .select({
                  businessName: clients.businessName,
                  twilioNumber: clients.twilioNumber,
                  phone: clients.phone,
                })
                .from(clients)
                .where(eq(clients.id, call.clientId))
                .limit(1),
            ]);

            if (lead && client?.twilioNumber) {
              // 1. SMS to homeowner via compliance gateway
              await sendCompliantMessage({
                clientId: call.clientId,
                to: lead.phone,
                from: client.twilioNumber,
                body: `${client.businessName} tried to connect you with a team member but they're currently unavailable. Someone will call you back shortly.`,
                messageClassification: 'proactive_outreach',
                messageCategory: 'transactional',
                consentBasis: { type: 'existing_consent' },
                leadId: lead.id,
              });

              // 2. Create P1 escalation entry in the triage dashboard
              try {
                await createEscalation(
                  lead.id,
                  lead.id, // no conversation thread — use lead id as placeholder
                  'Missed hot transfer — team member unavailable',
                  'critical'
                );
              } catch (escErr) {
                console.error('[Voice AI Dial Complete] Failed to create escalation:', escErr);
              }
            }

            // 3. Notify the team member who was dialled (if phone is on the call record)
            if (call.transferredTo && lead) {
              await sendAlert({
                clientId: call.clientId,
                message: `Missed transfer: ${lead.name} called and was transferred to you but the call was not answered. Please call them back at ${lead.phone}.`,
                isUrgent: true,
              });
            }
          } catch (sideEffectErr) {
            logSanitizedConsoleError('[Voice AI Dial Complete] Side-effect error on missed transfer:', sideEffectErr, {
              callId: call.id,
              leadId: call.leadId,
            });
          }
        })();
      }

      return twimlResponse(
        '<Say>Sorry, no one was available to take your call. We&apos;ll call you back soon. Goodbye!</Say><Hangup/>'
      );
    }

    return twimlResponse('');
  } catch (error) {
    void logInternalError({
      source: '[Voice AI Dial Complete] Webhook',
      error,
      context: { route: '/api/webhooks/twilio/voice/ai/dial-complete' },
    });
    logSanitizedConsoleError('[Voice AI Dial Complete] Error:', error, {
      route: '/api/webhooks/twilio/voice/ai/dial-complete',
    });
    return twimlResponse('');
  }
}
