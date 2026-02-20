import { NextRequest, NextResponse } from 'next/server';
import { handleIncomingSMS } from '@/lib/automations/incoming-sms';
import { getDb } from '@/db';
import { webhookLog, clients, clientPhoneNumbers, conversations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

/**
 * POST /api/webhooks/twilio/sms
 * Handle incoming SMS webhooks from Twilio
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    console.log('[Messaging] Twilio SMS webhook:', payload.From, payload.Body?.substring(0, 50));

    // Dedup check — prevent duplicate processing on Twilio webhook retry
    if (payload.MessageSid) {
      const db = getDb();
      const [existing] = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.twilioSid, payload.MessageSid))
        .limit(1);
      if (existing) {
        console.log(`[Messaging] Duplicate MessageSid ${payload.MessageSid} — skipping`);
        return new NextResponse(
          '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
          { headers: { 'Content-Type': 'text/xml' } }
        );
      }
    }

    // Log webhook event — check junction table first, fallback to clients.twilioNumber
    try {
      const db = getDb();
      let logClientId: string | null = null;
      const [junctionRecord] = await db
        .select({ clientId: clientPhoneNumbers.clientId })
        .from(clientPhoneNumbers)
        .where(and(eq(clientPhoneNumbers.phoneNumber, payload.To), eq(clientPhoneNumbers.isActive, true)))
        .limit(1);
      if (junctionRecord) {
        logClientId = junctionRecord.clientId;
      } else {
        const [client] = await db.select({ id: clients.id }).from(clients).where(eq(clients.twilioNumber, payload.To)).limit(1);
        if (client) logClientId = client.id;
      }
      if (logClientId) {
        await db.insert(webhookLog).values({
          clientId: logClientId,
          eventType: 'sms_inbound',
          payload,
          responseStatus: 200,
        });
      }
    } catch {} // Don't block SMS processing on log failure

    // Extract media attachments from MMS
    const numMedia = parseInt(payload.NumMedia || '0', 10);
    const mediaItems: { url: string; contentType: string; sid?: string }[] = [];

    for (let i = 0; i < numMedia; i++) {
      const url = payload[`MediaUrl${i}`];
      const contentType = payload[`MediaContentType${i}`];
      const sid = payload[`MediaSid${i}`];
      if (url && contentType) {
        mediaItems.push({ url, contentType, sid });
      }
    }

    await handleIncomingSMS({
      To: payload.To,
      From: payload.From,
      Body: payload.Body || '',
      MessageSid: payload.MessageSid,
      NumMedia: numMedia,
      MediaItems: mediaItems,
    });

    console.log('[Messaging] SMS webhook processed successfully');

    // Return empty TwiML
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('[Messaging] SMS webhook error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
