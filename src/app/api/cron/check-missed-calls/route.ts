import { NextRequest, NextResponse } from 'next/server';
import { getDb, activeCalls, clients } from '@/db';
import { eq, and, lte } from 'drizzle-orm';
import { handleMissedCall } from '@/lib/automations/missed-call';
import twilio from 'twilio';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * GET handler to check for missed calls via Twilio API polling fallback.
 * Processes active calls that weren't handled by real-time webhooks.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = getDb();
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      logSanitizedConsoleError(
        '[Check Missed Calls] Missing Twilio credentials',
        new Error('TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is missing')
      );
      return NextResponse.json({ error: 'Missing Twilio credentials' }, { status: 500 });
    }

    const client = twilio(accountSid, authToken);

    // Get unprocessed calls from last 31+ seconds (assuming 30s dial timeout)
    // These are calls that action callback didn't handle, so we use polling as fallback
    const thirtyOneSecondsAgo = new Date(Date.now() - 31 * 1000);
    const recentCalls = await db
      .select({
        call: activeCalls,
        clientData: clients,
      })
      .from(activeCalls)
      .innerJoin(clients, eq(activeCalls.clientId, clients.id))
      .where(
        and(
          lte(activeCalls.receivedAt, thirtyOneSecondsAgo),
          eq(activeCalls.processed, false) // Only check calls not already handled
        )
      );

    console.log(`[Check Missed Calls] Found ${recentCalls.length} calls to check`);

    let processed = 0;
    let missedDetected = 0;
    let stillActive = 0;

    for (const { call, clientData } of recentCalls) {
      try {
        // Atomic claim: prevent duplicate processing on concurrent cron runs
        const [claimed] = await db
          .update(activeCalls)
          .set({ processed: true, processedAt: new Date() })
          .where(and(
            eq(activeCalls.id, call.id),
            eq(activeCalls.processed, false)
          ))
          .returning({ id: activeCalls.id });

        if (!claimed) continue;

        // Query Twilio API to get final call status
        const callData = await client.calls(call.callSid).fetch();

        console.log(`[Check Missed Calls] Call ${call.callSid} Twilio snapshot:`, {
          status: callData.status,
          duration: callData.duration,
          answeredBy: (callData as unknown as Record<string, unknown>).answeredBy,
        });

        // Check if call ended with a missed/failed status
        // no-answer means the call wasn't answered within the dial timeout
        const missedStatuses = ['no-answer', 'busy', 'failed', 'canceled'];
        const isMissed = missedStatuses.includes(callData.status);

        if (isMissed) {
          console.log(`[Check Missed Calls - FALLBACK] Missed call detected: ${call.callSid} - status=${callData.status}`);
          console.log('[Check Missed Calls - FALLBACK] Processing via polling (action callback must have failed)');

          // Process as missed call via polling fallback
          await handleMissedCall({
            From: call.callerPhone,
            To: call.twilioNumber,
            CallStatus: callData.status,
            CallSid: call.callSid,
          });

          missedDetected++;
        } else {
          console.log(`[Check Missed Calls - FALLBACK] Call completed (answered): ${call.callSid}`);
        }

        // Delete from active calls (already marked processed by atomic claim)
        await db.delete(activeCalls).where(eq(activeCalls.id, call.id));

        processed++;
      } catch (error: unknown) {
        const errObj = error as Record<string, unknown>;
        // For test SIDs or invalid calls, just clean them up
        if (errObj.status === 404 || errObj.code === 20404) {
          console.log(`[Check Missed Calls] Call ${call.callSid} not found in Twilio (test SID or invalid), cleaning up`);
          await db.delete(activeCalls).where(eq(activeCalls.id, call.id));
          processed++;
        } else {
          // On non-404 errors, unclaim so the call retries next run
          await db
            .update(activeCalls)
            .set({ processed: false, processedAt: null })
            .where(eq(activeCalls.id, call.id));
          logSanitizedConsoleError('[CronScheduling] Error checking call:', error, {
            callSid: call.callSid,
          });
        }
      }
    }

    return NextResponse.json({
      processed,
      missedDetected,
      stillActive: recentCalls.length - processed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return safeErrorResponse('[Cron][check-missed-calls]', error, 'Processing failed');
  }
}
