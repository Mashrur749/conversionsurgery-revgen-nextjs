import { NextRequest, NextResponse } from 'next/server';
import { getDb, voiceCalls, clients } from '@/db';
import { eq, and, isNull, lte } from 'drizzle-orm';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { normalizePhoneNumber, formatPhoneNumber } from '@/lib/utils/phone';

/**
 * GET handler: notify contractors of pending voice callback requests.
 *
 * Finds voice_calls where:
 *   - callbackRequested = true
 *   - callbackNotifiedAt IS NULL (not yet notified)
 *   - callbackTime is in the past or within the next 2 hours (due or coming up soon)
 *
 * Sends an SMS to the client (contractor/owner) with caller details and a
 * tap-to-call link, then stamps callbackNotifiedAt to prevent re-sends.
 *
 * Runs every 30 minutes during business hours via the cron orchestrator.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // Find callback requests that are due (past) or coming up within 2 hours
    // and have not been notified yet.
    const pendingCallbacks = await db
      .select({
        call: voiceCalls,
        clientPhone: clients.phone,
        clientTwilioNumber: clients.twilioNumber,
        clientId: clients.id,
        clientStatus: clients.status,
        clientTimezone: clients.timezone,
      })
      .from(voiceCalls)
      .innerJoin(clients, eq(voiceCalls.clientId, clients.id))
      .where(
        and(
          eq(voiceCalls.callbackRequested, true),
          isNull(voiceCalls.callbackNotifiedAt),
          lte(voiceCalls.callbackTime, twoHoursFromNow)
        )
      );

    console.log(`[Voice Callbacks] Found ${pendingCallbacks.length} pending callback(s) to notify`);

    let notified = 0;
    let skipped = 0;

    for (const { call, clientPhone, clientTwilioNumber, clientId, clientStatus, clientTimezone } of pendingCallbacks) {
      // Skip paused/cancelled clients — sendCompliantMessage would block anyway,
      // but we skip early to avoid unnecessary DB writes.
      if (clientStatus === 'paused' || clientStatus === 'cancelled') {
        skipped++;
        continue;
      }

      if (!clientPhone || !clientTwilioNumber) {
        logSanitizedConsoleError(
          '[Voice Callbacks] Client missing phone or Twilio number, skipping',
          undefined,
          { callId: call.id, clientId }
        );
        skipped++;
        continue;
      }

      const normalizedCallerPhone = normalizePhoneNumber(call.from);
      const formattedCallerPhone = formatPhoneNumber(call.from);
      const normalizedOwnerPhone = normalizePhoneNumber(clientPhone);

      const callbackTimeLabel = call.callbackTime
        ? call.callbackTime.toLocaleTimeString('en-CA', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: clientTimezone || 'America/New_York',
          })
        : 'no specific time';

      const smsBody =
        `Callback requested: ${formattedCallerPhone} asked for a callback at ${callbackTimeLabel}. ` +
        `Tap to call: tel:${normalizedCallerPhone}`;

      try {
        const result = await sendCompliantMessage({
          clientId,
          to: normalizedOwnerPhone,
          from: clientTwilioNumber,
          body: smsBody,
          messageClassification: 'proactive_outreach',
          messageCategory: 'transactional',
          consentBasis: { type: 'existing_consent' },
          metadata: { source: 'voice_callback_cron', voiceCallId: call.id },
        });

        if (result.sent || result.queued) {
          // Stamp notified time atomically — only mark if the send succeeded
          await db
            .update(voiceCalls)
            .set({ callbackNotifiedAt: new Date() })
            .where(
              and(
                eq(voiceCalls.id, call.id),
                isNull(voiceCalls.callbackNotifiedAt)
              )
            );
          notified++;
          console.log(`[Voice Callbacks] Notified owner for call ${call.id} (caller: ${normalizedCallerPhone})`);
        } else {
          logSanitizedConsoleError(
            '[Voice Callbacks] SMS blocked or failed',
            undefined,
            { callId: call.id, blockReason: result.blockReason }
          );
          skipped++;
        }
      } catch (sendError) {
        // Log and continue — never mark notified on a failed send (resilience rule)
        logSanitizedConsoleError('[Voice Callbacks] SMS send error:', sendError, {
          callId: call.id,
          clientId,
        });
        skipped++;
      }
    }

    return NextResponse.json({
      notified,
      skipped,
      total: pendingCallbacks.length,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    return safeErrorResponse('[Cron][voice-callbacks]', error, 'Voice callback notifications failed');
  }
}
