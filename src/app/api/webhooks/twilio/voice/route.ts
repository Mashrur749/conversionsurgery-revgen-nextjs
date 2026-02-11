import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients, activeCalls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { handleMissedCall } from '@/lib/automations/missed-call';

const MISSED_STATUSES = new Set(['no-answer', 'busy', 'failed', 'canceled']);

function emptyTwiml() {
  return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response/>', {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

/**
 * [Voice] Twilio voice webhook for incoming calls
 * Handles initial call routing and dial outcome callbacks
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(formData.entries()) as Record<string, string>;

    const from = payload.From;
    const to = payload.To;
    const callStatus = (payload.CallStatus || '').toLowerCase();
    const dialCallStatus = (payload.DialCallStatus || '').toLowerCase();

    // Helpful logging
    console.log('[Twilio Voice] Received webhook at:', new Date().toISOString());
    console.log('[Twilio Voice] payload keys:', Object.keys(payload));
    console.log('[Twilio Voice] core:', {
      CallSid: payload.CallSid,
      ParentCallSid: payload.ParentCallSid,
      from,
      to,
      callStatus,
      dialCallStatus,
      mode: request.nextUrl.searchParams.get('mode'),
      fullUrl: request.nextUrl.toString(),
    });

    /**
     * PHASE 2: Dial outcome callback (FAST PATH)
     * Triggered by <Dial action="..."> when forwarding leg ends.
     * This is the primary/fast path for missed call detection (2-3 seconds latency).
     */
    if (dialCallStatus) {
      const db = getDb();
      const originalFrom = request.nextUrl.searchParams.get('origFrom') || from;
      const originalTo = request.nextUrl.searchParams.get('origTo') || to;

      console.log('[Voice Phase 2] Dial outcome received:', {
        dialCallStatus,
        originalFrom,
        originalTo,
        CallSid: payload.CallSid,
      });

      if (MISSED_STATUSES.has(dialCallStatus)) {
        console.log('[Voice Phase 2] Missed call detected - processing immediately');

        // Process missed call
        await handleMissedCall({
          From: originalFrom,
          To: originalTo,
          CallStatus: dialCallStatus,
          CallSid: payload.CallSid,
        });

        // Mark as processed in database so polling doesn't reprocess it
        await db
          .update(activeCalls)
          .set({
            processed: true,
            processedAt: new Date(),
          })
          .where(eq(activeCalls.callSid, payload.CallSid))
          .catch((err) => {
            console.error('[Voice Phase 2] Failed to mark call as processed:', err);
          });
      } else {
        console.log('[Voice Phase 2] Dial ended successfully (answered):', dialCallStatus);

        // Still mark as processed since the call was answered
        await db
          .update(activeCalls)
          .set({
            processed: true,
            processedAt: new Date(),
          })
          .where(eq(activeCalls.callSid, payload.CallSid))
          .catch((err) => {
            console.error('[Voice Phase 2] Failed to mark answered call as processed:', err);
          });
      }

      // Callbacks don't need call-control TwiML, empty response is fine
      return emptyTwiml();
    }

    /**
     * PHASE 1: Initial incoming call webhook
     * Twilio calls this immediately when the number is dialed.
     */
    if (!from || !to) return emptyTwiml();

    const db = getDb();
    const twilioNumber = normalizePhoneNumber(to);

    const clientResult = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.twilioNumber, twilioNumber),
          eq(clients.status, 'active')
        )
      )
      .limit(1);

    if (!clientResult.length) {
      console.log('[Voice] No client found for Twilio number:', twilioNumber);
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, we could not process your call.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const client = clientResult[0];
    if (!client.phone) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Sorry, the business line is not currently available.</Say></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error('[Voice] NEXT_PUBLIC_APP_URL is missing');
      return emptyTwiml();
    }

    // Dial action callback URL (phase 2)
    const actionUrl = new URL('/api/webhooks/twilio/voice', appUrl);
    actionUrl.searchParams.set('mode', 'dial-result');
    actionUrl.searchParams.set('origFrom', from);
    actionUrl.searchParams.set('origTo', to);

    // Store active call for polling-based missed call detection
    await db.insert(activeCalls).values({
      callSid: payload.CallSid,
      clientId: client.id,
      callerPhone: from,
      twilioNumber: to,
      receivedAt: new Date(),
    }).catch((err) => {
      console.error('[Voice] Failed to store active call:', err);
    });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" answerOnBridge="true" action="${actionUrl.toString()}" method="POST">
    <Number>${client.phone}</Number>
  </Dial>
</Response>`;

    console.log('[Voice] Forwarding call to owner:', client.phone);
    console.log('[Voice] Call SID stored for polling:', payload.CallSid);

    return new NextResponse(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (error) {
    console.error('[Voice] Webhook error:', error);
    return emptyTwiml();
  }
}
