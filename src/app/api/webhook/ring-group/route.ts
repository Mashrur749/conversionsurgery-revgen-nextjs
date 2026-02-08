import { NextRequest, NextResponse } from 'next/server';
import { recordCallAnswered, recordCallMissed } from '@/lib/services/hot-transfer';

/**
 * POST /api/webhook/ring-group
 * Webhook for Twilio ring group call status updates
 * Called when a team member answers, declines, or misses a call
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const params = new URLSearchParams(body);

    const callId = params.get('CallId');
    const callStatus = params.get('CallStatus'); // ringing, answered, completed, failed
    const answeredBy = params.get('AnsweredBy');
    const duration = params.get('CallDuration') ? parseInt(params.get('CallDuration')!) : 0;

    console.log('[Ring Group Webhook] Event:', {
      callId,
      callStatus,
      answeredBy,
      duration,
    });

    if (!callId) {
      return NextResponse.json({ error: 'Missing CallId' }, { status: 400 });
    }

    // Record the outcome
    if (callStatus === 'answered' && answeredBy) {
      await recordCallAnswered(callId, answeredBy, duration);
      console.log('[Ring Group Webhook] Call answered by:', answeredBy);
    } else if (callStatus === 'no-answer' || callStatus === 'failed') {
      await recordCallMissed(callId);
      console.log('[Ring Group Webhook] Call missed or failed');
    } else if (callStatus === 'ringing') {
      console.log('[Ring Group Webhook] Call ringing');
    }

    // Return TwiML response
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>Call recorded</Message>
      </Response>`;

    return new NextResponse(twimlResponse, {
      headers: { 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    console.error('[Ring Group Webhook] Error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
