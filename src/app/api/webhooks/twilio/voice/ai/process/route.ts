import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls, clients, knowledgeBase, conversations, clientAgentSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWebhookBaseUrl } from '@/lib/utils/webhook-url';
import { getTrackedAI } from '@/lib/ai';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';
import { buildGuardrailPrompt } from '@/lib/agent/guardrails';
import { logInternalError, logSanitizedConsoleError } from '@/lib/services/internal-error-log';

function twimlResponse(twiml: string) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response>${twiml}</Response>`,
    { status: 200, headers: { 'Content-Type': 'text/xml' } }
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * [Voice] AI processing endpoint — heavy handler
 * Called via <Redirect> from /gather after filler phrase.
 * Loads context, generates AI response, returns TwiML.
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const callSid = payload.CallSid;
    const appUrl = getWebhookBaseUrl(request);
    const db = getDb();

    // Get call record (transcript already updated by /gather)
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    if (!call) {
      void logInternalError({
        source: '[Voice AI Process] Missing call record',
        error: new Error('Voice call record not found'),
        context: {
          route: '/api/webhooks/twilio/voice/ai/process',
          callSidSuffix: callSid ? callSid.slice(-8) : null,
        },
      });
      logSanitizedConsoleError('[Voice AI Process] No call record found', new Error('Missing voice call record'), {
        callSidSuffix: callSid ? callSid.slice(-8) : null,
      });
      return twimlResponse('<Say>Sorry, there was an error. Goodbye.</Say><Hangup/>');
    }

    // Get client and knowledge base
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, call.clientId))
      .limit(1);

    const knowledge = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.clientId, call.clientId));

    const knowledgeContext = knowledge
      .map((k) => `${k.category}: ${k.title} - ${k.content}`)
      .join('\n');

    const [agentSettings] = await db
      .select()
      .from(clientAgentSettings)
      .where(eq(clientAgentSettings.clientId, call.clientId))
      .limit(1);

    let smsHistorySection = 'No prior SMS history available.';
    if (call.leadId) {
      const history = await db
        .select({
          direction: conversations.direction,
          content: conversations.content,
          createdAt: conversations.createdAt,
        })
        .from(conversations)
        .where(eq(conversations.leadId, call.leadId))
        .orderBy(conversations.createdAt)
        .limit(15);

      if (history.length > 0) {
        smsHistorySection = history
          .map((m) => `${m.direction === 'inbound' ? 'Caller' : 'Business'}: ${m.content}`)
          .join('\n');
      }
    }

    const messagesWithoutResponse = (call.transcript || '')
      .split('\n')
      .reverse()
      .findIndex((line) => line.startsWith('Caller:'));

    const guardrails = buildGuardrailPrompt({
      ownerName: client?.ownerName || 'the owner',
      businessName: client?.businessName || 'the business',
      agentTone: (agentSettings?.agentTone || 'professional') as 'professional' | 'friendly' | 'casual',
      messagesWithoutResponse: messagesWithoutResponse === -1
        ? 0
        : messagesWithoutResponse,
      canDiscussPricing: agentSettings?.canDiscussPricing || false,
    });

    const currentTranscript = call.transcript || '';

    // Generate AI response
    const ai = getTrackedAI({ clientId: call.clientId, operation: 'voice_ai_gather' });
    const aiResult = await ai.chat(
      [
        {
          role: 'user',
          content: `Conversation so far:\n${currentTranscript}\n\nRespond to the caller.`,
        },
      ],
      {
        systemPrompt: `You are a phone assistant for ${client?.businessName || 'the business'}, a contractor.

Your capabilities:
1. Answer questions about services and pricing
2. Collect lead information (name, project details)
3. Schedule callbacks
4. Transfer to a human if needed

Knowledge base:
${knowledgeContext}

Recent SMS conversation history (if any):
${smsHistorySection}

${guardrails}

Respond conversationally and briefly (under 50 words).
End with a question or next step.

If the caller wants to:
- Get a quote: Collect project details, then offer callback
- Schedule appointment: Collect preferred time, confirm callback
- Speak to someone: Transfer immediately
- Emergency: Transfer immediately

Return JSON:
{
  "response": "What you say to caller",
  "intent": "quote|schedule|question|complaint|transfer|other",
  "shouldTransfer": false,
  "callbackRequested": false
}`,
        temperature: 0.7,
        maxTokens: 200,
      },
    );

    let result: {
      response: string;
      intent: string;
      shouldTransfer: boolean;
      callbackRequested: boolean;
    };

    try {
      const content = aiResult.content || '{}';
      result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    } catch {
      result = {
        response: "I'm sorry, I didn't quite understand. Could you repeat that?",
        intent: 'other',
        shouldTransfer: false,
        callbackRequested: false,
      };
    }

    // Update call record with AI response
    await db
      .update(voiceCalls)
      .set({
        transcript: `${currentTranscript}\nAI: ${result.response}`,
        callerIntent: result.intent,
        callbackRequested: result.callbackRequested,
        updatedAt: new Date(),
      })
      .where(eq(voiceCalls.id, call.id));

    const gatherAction = `${appUrl}/api/webhooks/twilio/voice/ai/gather`;
    const transferAction = `${appUrl}/api/webhooks/twilio/voice/ai/transfer`;

    // Check if should transfer
    if (result.shouldTransfer) {
      return twimlResponse(
        '<Say voice="Polly.Matthew">Let me connect you with someone right now.</Say>' +
        `<Redirect>${transferAction}</Redirect>`
      );
    }

    // Continue conversation
    return twimlResponse(
      `<Say voice="Polly.Matthew">${escapeXml(result.response)}</Say>` +
      `<Gather input="speech" speechTimeout="auto" speechModel="phone_call" enhanced="true" action="${gatherAction}" method="POST"/>` +
      '<Say>Are you still there?</Say>' +
      `<Gather input="speech" speechTimeout="3" action="${gatherAction}"/>` +
      '<Say>I\'ll have someone call you back. Goodbye!</Say><Hangup/>'
    );
  } catch (error) {
    void logInternalError({
      source: '[Voice AI Process] Webhook',
      error,
      context: {
        route: '/api/webhooks/twilio/voice/ai/process',
      },
    });
    logSanitizedConsoleError('[Voice AI Process] Error:', error, {
      route: '/api/webhooks/twilio/voice/ai/process',
    });
    return twimlResponse('<Say>Sorry, there was an error. Please try again later.</Say><Hangup/>');
  }
}
