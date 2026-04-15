import { NextRequest } from 'next/server';
import { getDb } from '@/db';
import { clients, clientPhoneNumbers, auditLog } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * Machine detection (AMD) answer values from Twilio that indicate voicemail.
 */
const VOICEMAIL_ANSWERED_BY = new Set([
  'machine_end_beep',
  'machine_end_silence',
  'machine_end_other',
]);

/**
 * AMD answer values where Twilio could not conclusively determine the answer.
 * These should be retried tomorrow rather than marked as definitively failed.
 */
const INCONCLUSIVE_ANSWERED_BY = new Set([
  'unknown',
  'machine_start',
]);

/**
 * Twilio call status callback for forwarding verification calls.
 *
 * Twilio posts to this URL when the verification call completes (or fails).
 * We use the CallStatus and AnsweredBy (AMD) fields to determine whether
 * call forwarding is working correctly and update the client record.
 *
 * Always returns 200 — Twilio retries on non-2xx.
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      // Return 200 to prevent Twilio retries on bad signature
      return new Response('<Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const callSid = payload.CallSid;
    const callStatus = payload.CallStatus;
    const answeredBy = payload.AnsweredBy;
    // `From` is the Twilio number we placed the call from
    const fromNumber = payload.From;

    if (!callSid || !callStatus || !fromNumber) {
      console.warn('[ForwardingVerification] Missing required fields in webhook payload', {
        callSid,
        callStatus,
        fromNumber,
      });
      return new Response('<Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const db = getDb();

    // Look up which client owns this Twilio number
    const [phoneRecord] = await db
      .select({ clientId: clientPhoneNumbers.clientId })
      .from(clientPhoneNumbers)
      .where(
        and(
          eq(clientPhoneNumbers.phoneNumber, fromNumber),
          eq(clientPhoneNumbers.isActive, true)
        )
      )
      .limit(1);

    if (!phoneRecord) {
      console.warn('[ForwardingVerification] No client found for Twilio number', { fromNumber });
      return new Response('<Response/>', {
        status: 200,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const { clientId } = phoneRecord;

    // Determine verification result
    let verificationResult: 'passed' | 'failed' | 'inconclusive';

    if (callStatus === 'completed') {
      // AMD result present — voicemail means forwarding did not connect to a person
      if (answeredBy && VOICEMAIL_ANSWERED_BY.has(answeredBy)) {
        verificationResult = 'failed';
      } else if (answeredBy && INCONCLUSIVE_ANSWERED_BY.has(answeredBy)) {
        // AMD started but could not determine — retry tomorrow instead of hard failing
        verificationResult = 'inconclusive';
      } else {
        // human or no AMD result → forwarding likely works
        verificationResult = 'passed';
      }
    } else {
      // no-answer, busy, failed, canceled
      verificationResult = 'failed';
    }

    // Update the client record
    const now = new Date();
    await db
      .update(clients)
      .set({
        forwardingVerificationStatus: verificationResult,
        // Only stamp verifiedAt on a definitive pass — inconclusive leaves it unchanged
        ...(verificationResult === 'passed' ? { forwardingVerifiedAt: now } : {}),
        updatedAt: now,
      })
      .where(eq(clients.id, clientId));

    // Write audit log
    await db.insert(auditLog).values({
      clientId,
      action: 'forwarding_verification_result',
      metadata: { callSid, callStatus, answeredBy: answeredBy ?? null, result: verificationResult },
    });

    console.log('[ForwardingVerification] Result recorded:', {
      clientId,
      callSid,
      callStatus,
      answeredBy,
      verificationResult,
    });

    return new Response('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    void logInternalError({
      source: '[ForwardingVerification] Status callback',
      error,
      context: { route: '/api/webhooks/twilio/verification-status' },
    });
    logSanitizedConsoleError(
      '[ForwardingVerification] Error processing status callback',
      error,
      { route: '/api/webhooks/twilio/verification-status' }
    );

    // Always return 200 to prevent Twilio retries
    return new Response('<Response/>', {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
}
