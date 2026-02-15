import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

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
      .set({ deliveryStatus: messageStatus })
      .where(eq(conversations.twilioSid, messageSid));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[TwilioStatus] Error processing status callback:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
