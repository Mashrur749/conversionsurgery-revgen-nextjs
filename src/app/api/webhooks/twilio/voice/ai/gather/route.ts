import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/db';
import { voiceCalls, clients, knowledgeBase } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getWebhookBaseUrl } from '@/lib/utils/webhook-url';
import OpenAI from 'openai';
import { validateAndParseTwilioWebhook } from '@/lib/services/twilio';

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
 * [Voice] Twilio webhook for AI speech gathering
 * Processes caller speech and generates AI responses
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await validateAndParseTwilioWebhook(request);
    if (!payload) {
      return twimlResponse('<Say>Request validation failed.</Say>');
    }

    const callSid = payload.CallSid;
    const speechResult = payload.SpeechResult;

    console.log('[Voice AI Gather] Speech result for call:', callSid, speechResult);

    const appUrl = getWebhookBaseUrl(request);

    if (!speechResult) {
      return twimlResponse(
        '<Say voice="Polly.Matthew">I didn\'t catch that. Could you please repeat?</Say>' +
        `<Gather input="speech" speechTimeout="auto" speechModel="phone_call" enhanced="true" action="${appUrl}/api/webhooks/twilio/voice/ai/gather" method="POST"/>` +
        '<Say>I\'ll have someone call you back. Goodbye!</Say><Hangup/>'
      );
    }

    const db = getDb();

    // Get call record
    const [call] = await db
      .select()
      .from(voiceCalls)
      .where(eq(voiceCalls.twilioCallSid, callSid))
      .limit(1);

    if (!call) {
      console.error('[Voice AI Gather] No call record found for:', callSid);
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

    // Update transcript
    const currentTranscript = call.transcript || '';
    const newTranscript = `${currentTranscript}\nCaller: ${speechResult}`;

    // Generate AI response
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a phone assistant for ${client?.businessName || 'the business'}, a contractor.

Your capabilities:
1. Answer questions about services and pricing
2. Collect lead information (name, project details)
3. Schedule callbacks
4. Transfer to a human if needed

Knowledge base:
${knowledgeContext}

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
        },
        {
          role: 'user',
          content: `Conversation so far:\n${newTranscript}\n\nRespond to the caller.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 200,
    });

    let result: {
      response: string;
      intent: string;
      shouldTransfer: boolean;
      callbackRequested: boolean;
    };

    try {
      const content = aiResponse.choices[0].message.content || '{}';
      result = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
    } catch {
      result = {
        response: "I'm sorry, I didn't quite understand. Could you repeat that?",
        intent: 'other',
        shouldTransfer: false,
        callbackRequested: false,
      };
    }

    // Update call record
    await db
      .update(voiceCalls)
      .set({
        transcript: `${newTranscript}\nAI: ${result.response}`,
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
    console.error('[Voice AI Gather] Error:', error);
    return twimlResponse('<Say>Sorry, there was an error. Please try again later.</Say><Hangup/>');
  }
}
