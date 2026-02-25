import { NextRequest, NextResponse } from 'next/server';
import { handleAgencyInboundSMS } from '@/lib/services/agency-communication';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

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

    console.log('[Agency SMS] Inbound webhook received', {
      messageSid,
      fromSuffix: from ? from.slice(-4) : null,
      toSuffix: to ? to.slice(-4) : null,
      bodyLength: body.length,
    });

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
      void logInternalError({
        source: '[Agency SMS] Handler',
        error: err,
        context: {
          route: '/api/webhooks/twilio/agency-sms',
          messageSidSuffix: messageSid ? messageSid.slice(-8) : null,
          fromSuffix: from ? from.slice(-4) : null,
          toSuffix: to ? to.slice(-4) : null,
        },
      });
      logSanitizedConsoleError('[Agency SMS] Handler error:', err, {
        messageSidSuffix: messageSid ? messageSid.slice(-8) : null,
      });
    });

    return emptyTwiml();
  } catch (error) {
    void logInternalError({
      source: '[Agency SMS] Webhook',
      error,
      context: { route: '/api/webhooks/twilio/agency-sms' },
    });
    logSanitizedConsoleError('[Agency SMS] Webhook error:', error, {
      route: '/api/webhooks/twilio/agency-sms',
    });
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
