import { NextRequest, NextResponse } from 'next/server';
import { getDb, activeCalls, clients } from '@/db';
import { eq, and, lte, sql } from 'drizzle-orm';
import { handleMissedCall } from '@/lib/automations/missed-call';
import twilio from 'twilio';

/**
 * Verifies cron secret to prevent unauthorized access.
 * @param request - The incoming Next.js request
 * @returns True if the request is authorized, false otherwise
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

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
      console.error('[Check Missed Calls] Missing Twilio credentials');
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
        // Query Twilio API to get final call status
        const callData = await client.calls(call.callSid).fetch();

        console.log(`[Check Missed Calls] Call ${call.callSid} full Twilio data:`, {
          status: callData.status,
          duration: callData.duration,
          answeredBy: (callData as any).answeredBy,
          direction: callData.direction,
          to: callData.to,
          from: callData.from,
          // Log all available properties
          allKeys: Object.keys(callData).filter(k => !k.startsWith('_'))
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

        // Mark as processed and delete from active calls
        await db
          .update(activeCalls)
          .set({
            processed: true,
            processedAt: new Date(),
          })
          .where(eq(activeCalls.id, call.id));

        // Now delete it
        await db.delete(activeCalls).where(eq(activeCalls.id, call.id));

        processed++;
      } catch (error: any) {
        // For test SIDs or invalid calls, just clean them up
        if (error.status === 404 || error.code === 20404) {
          console.log(`[Check Missed Calls] Call ${call.callSid} not found in Twilio (test SID or invalid), cleaning up`);
          await db.delete(activeCalls).where(eq(activeCalls.id, call.id));
          processed++;
        } else {
          console.error(`[CronScheduling] Error checking call ${call.callSid}:`, error.message);
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
    console.error('[CronScheduling] Check missed calls cron error:', error);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
