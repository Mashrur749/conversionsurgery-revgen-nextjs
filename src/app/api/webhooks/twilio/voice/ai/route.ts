import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients, leads, voiceCalls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { getWebhookBaseUrl, xmlAttr } from '@/lib/utils/webhook-url';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

/**
 * [Voice] Twilio webhook for AI-powered voice calls
 * Handles voice AI greeting and routing logic
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const from = payload.From;
    const to = payload.To;
    const callSid = payload.CallSid;

    console.log('[Voice AI] Received webhook:', { callSid, from, to });

    if (!from || !to) {
      return twimlResponse('<Say>Sorry, we could not process your call.</Say><Hangup/>');
    }

    const db = getDb();
    const twilioNumber = normalizePhoneNumber(to);

    // Find client by phone number
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.twilioNumber, twilioNumber),
          eq(clients.status, 'active')
        )
      )
      .limit(1);

    if (!client) {
      console.log('[Voice AI] No client found for number:', twilioNumber);
      return twimlResponse('<Say>Sorry, this number is not configured.</Say><Hangup/>');
    }

    // Check if voice AI is enabled
    if (!client.voiceEnabled) {
      console.log('[Voice AI] Voice AI not enabled for client:', client.id);
      // Standard behavior - ring through
      const forwardTo = client.phone;
      if (forwardTo) {
        return twimlResponse(`<Dial timeout="30"><Number>${forwardTo}</Number></Dial>`);
      }
      return twimlResponse('<Say>Sorry, no one is available right now.</Say><Hangup/>');
    }

    // Check business hours for after_hours mode
    const withinHours = await isWithinBusinessHours(
      client.id,
      client.timezone || 'America/Edmonton'
    );

    // Determine if AI should answer
    const shouldUseAI =
      client.voiceMode === 'always' ||
      (client.voiceMode === 'after_hours' && !withinHours);

    if (!shouldUseAI) {
      // During business hours - try to connect to owner
      console.log('[Voice AI] Within business hours, forwarding to owner');
      const appUrl = getWebhookBaseUrl(request);
      const actionUrl = new URL('/api/webhooks/twilio/voice/ai/dial-complete', appUrl);
      actionUrl.searchParams.set('origFrom', from);
      actionUrl.searchParams.set('origTo', to);

      return twimlResponse(
        `<Dial timeout="20" action="${xmlAttr(actionUrl.toString())}" method="POST">` +
        `<Number>${client.phone}</Number>` +
        `</Dial>`
      );
    }

    // Find or create lead
    const normalizedFrom = normalizePhoneNumber(from);
    const existingLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.clientId, client.id),
          eq(leads.phone, normalizedFrom)
        )
      )
      .limit(1);

    let leadId: string;
    if (existingLeads.length > 0) {
      leadId = existingLeads[0].id;
    } else {
      const [newLead] = await db
        .insert(leads)
        .values({
          clientId: client.id,
          phone: normalizedFrom,
          source: 'voice',
        })
        .returning();
      leadId = newLead.id;
    }

    // Create voice call record
    await db.insert(voiceCalls).values({
      clientId: client.id,
      leadId,
      twilioCallSid: callSid,
      from: normalizedFrom,
      to: twilioNumber,
      direction: 'inbound',
      status: 'in-progress',
      startedAt: new Date(),
    });

    console.log('[Voice AI] Starting AI conversation for call:', callSid);

    // Start AI conversation
    const greeting = client.voiceGreeting ||
      `Hi! Thanks for calling ${client.businessName}. How can I help you today?`;

    const appUrlForTwiml = getWebhookBaseUrl(request);
    const gatherAction = `${appUrlForTwiml}/api/webhooks/twilio/voice/ai/gather`;
    const transferAction = `${appUrlForTwiml}/api/webhooks/twilio/voice/ai/transfer`;

    return twimlResponse(
      `<Say voice="Polly.Matthew">${escapeXml(greeting)}</Say>` +
      `<Gather input="speech" speechTimeout="auto" speechModel="phone_call" enhanced="true" action="${gatherAction}" method="POST"/>` +
      `<Say>I didn't catch that. Let me connect you with someone.</Say>` +
      `<Redirect>${transferAction}</Redirect>`
    );
  } catch (error) {
    console.error('[Voice AI] Webhook error:', error);
    return twimlResponse('<Say>Sorry, there was an error. Please try again later.</Say><Hangup/>');
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
