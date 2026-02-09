import { NextRequest, NextResponse } from 'next/server';
import { handleIncomingSMS } from '@/lib/automations/incoming-sms';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(formData.entries()) as Record<string, string>;

    console.log('Twilio SMS webhook:', payload.From, payload.Body?.substring(0, 50));

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

    // Return empty TwiML
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  } catch (error) {
    console.error('SMS webhook error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}
