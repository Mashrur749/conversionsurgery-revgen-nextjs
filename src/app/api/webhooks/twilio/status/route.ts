import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

/**
 * Twilio message status callback handler.
 * Receives delivery status updates: queued, sent, delivered, failed, undelivered.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    const messageSid = payload.MessageSid;
    const messageStatus = payload.MessageStatus;

    if (!messageSid || !messageStatus) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const db = getDb();
    await db
      .update(conversations)
      .set({ deliveryStatus: messageStatus, updatedAt: new Date() })
      .where(eq(conversations.twilioSid, messageSid));

    return NextResponse.json({ success: true });
  } catch (error) {
    void logInternalError({
      source: '[TwilioStatus] Callback',
      error,
      context: { route: '/api/webhooks/twilio/status' },
    });
    logSanitizedConsoleError('[TwilioStatus] Error processing status callback:', error, {
      route: '/api/webhooks/twilio/status',
    });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
