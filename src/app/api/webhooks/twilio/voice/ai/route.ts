import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { clients, leads, voiceCalls } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { normalizePhoneNumber } from '@/lib/utils/phone';
import { getWebhookBaseUrl, xmlAttr } from '@/lib/utils/webhook-url';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';
import { isOpsKillSwitchEnabled, OPS_KILL_SWITCH_KEYS } from '@/lib/services/ops-kill-switches';

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

    console.log('[Voice AI] Received webhook:', {
      callSidSuffix: callSid ? callSid.slice(-8) : null,
      fromSuffix: from ? from.slice(-4) : null,
      toSuffix: to ? to.slice(-4) : null,
    });

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
      console.log('[Voice AI] No client found for number suffix:', {
        toSuffix: twilioNumber ? twilioNumber.slice(-4) : null,
      });
      return twimlResponse('<Say>Sorry, this number is not configured.</Say><Hangup/>');
    }

    const voiceAiKillSwitchEnabled = await isOpsKillSwitchEnabled(
      OPS_KILL_SWITCH_KEYS.VOICE_AI
    );
    if (voiceAiKillSwitchEnabled) {
      console.log('[Voice AI] Global kill switch enabled - bypassing AI', {
        clientId: client.id,
      });
      const forwardTo = client.phone;
      if (forwardTo) {
        return twimlResponse(`<Dial timeout="30"><Number>${forwardTo}</Number></Dial>`);
      }
      return twimlResponse('<Say>Sorry, no one is available right now.</Say><Hangup/>');
    }

    // Check if voice AI is enabled
    if (!client.voiceEnabled) {
      console.log('[Voice AI] Voice AI disabled for client', { clientId: client.id });
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
      console.log('[Voice AI] Within business hours, forwarding to owner', { clientId: client.id });
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

    console.log('[Voice AI] Starting AI conversation for call', {
      callSidSuffix: callSid ? callSid.slice(-8) : null,
      clientId: client.id,
    });

    // Start ConversationRelay AI conversation
    const greeting = client.voiceGreeting ||
      `Hi! Thanks for calling ${client.businessName}. How can I help you today?`;

    const appUrl = getWebhookBaseUrl(request);
    const sessionEndAction = `${appUrl}/api/webhooks/twilio/voice/ai/session-end`;
    const voiceWsUrl = process.env.VOICE_WS_URL;

    if (!voiceWsUrl) {
      console.error('[Voice AI] VOICE_WS_URL not configured — falling back to direct dial');
      const forwardTo = client.phone;
      if (forwardTo) {
        return twimlResponse(`<Dial timeout="30"><Number>${forwardTo}</Number></Dial>`);
      }
      return twimlResponse('<Say>Sorry, no one is available right now.</Say><Hangup/>');
    }

    // Build ElevenLabs voice string or fall back to Amazon Polly
    let ttsProvider = 'ElevenLabs';
    let voiceAttr = 'ZF6FPAbjXT4488VcRRnw-flash_v2_5-1.0_0.7_0.8'; // Default ElevenLabs voice
    if (client.voiceVoiceId) {
      voiceAttr = `${client.voiceVoiceId}-flash_v2_5-1.0_0.7_0.8`;
    } else {
      // No ElevenLabs voice selected — use Amazon Polly as fallback
      ttsProvider = 'Amazon';
      voiceAttr = 'Matthew-Neural';
    }

    // Build transcription hints from business name + common service terms
    const hints = escapeXml(client.businessName || '');

    return twimlResponse(
      `<Connect action="${xmlAttr(sessionEndAction)}">` +
        `<ConversationRelay ` +
          `url="${xmlAttr(voiceWsUrl + '/ws')}" ` +
          `welcomeGreeting="${escapeXml(greeting)}" ` +
          `ttsProvider="${ttsProvider}" ` +
          `voice="${voiceAttr}" ` +
          `transcriptionProvider="Deepgram" ` +
          `interruptSensitivity="medium" ` +
          `dtmfDetection="true" ` +
          `${ttsProvider === 'ElevenLabs' ? 'elevenlabsTextNormalization="on" ' : ''}` +
          `hints="${hints}">` +
          `<Parameter name="clientId" value="${client.id}" />` +
          `<Parameter name="leadId" value="${leadId}" />` +
          `<Parameter name="callSid" value="${callSid}" />` +
        `</ConversationRelay>` +
      `</Connect>`
    );
  } catch (error) {
    void logInternalError({
      source: '[Voice AI] Webhook',
      error,
      context: { route: '/api/webhooks/twilio/voice/ai' },
    });
    logSanitizedConsoleError('[Voice AI] Webhook error:', error, {
      route: '/api/webhooks/twilio/voice/ai',
    });
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
