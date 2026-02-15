import { NextRequest, NextResponse } from 'next/server';
import { handleAgencyInboundSMS } from '@/lib/services/agency-communication';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

/**
 * Twilio SMS webhook for the agency number.
 * Handles inbound messages from clients (business owners) to the agency.
 * Returns empty TwiML — all replies are sent programmatically.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return emptyTwiml();
    }

    const from = payload.From;
    const to = payload.To;
    const body = payload.Body || '';
    const messageSid = payload.MessageSid || '';

    console.log('[Agency SMS] Inbound:', { from, to, body: body.substring(0, 50), messageSid });

    if (!from || !body) {
      return emptyTwiml();
    }

    // Process in background — don't block the Twilio response
    handleAgencyInboundSMS({
      From: from,
      To: to,
      Body: body,
      MessageSid: messageSid,
    }).catch((err) => {
      console.error('[Agency SMS] Handler error:', err);
    });

    return emptyTwiml();
  } catch (error) {
    console.error('[Agency SMS] Webhook error:', error);
    return emptyTwiml();
  }
}

function emptyTwiml() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response/>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    }
  );
}
