import { getDb, voiceCalls, clients } from '@/db';
import { eq } from 'drizzle-orm';
import OpenAI from 'openai';
import { sendSMS } from './twilio';

export async function generateCallSummary(callId: string): Promise<string> {
  const db = getDb();

  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.id, callId))
    .limit(1);

  if (!call?.transcript) return '';

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Summarize this phone call transcript in 2-3 sentences. Include:
- What the caller wanted
- Key details mentioned
- Outcome or next steps`,
      },
      {
        role: 'user',
        content: call.transcript,
      },
    ],
    temperature: 0.5,
    max_tokens: 150,
  });

  const summary = response.choices[0].message.content || '';

  await db
    .update(voiceCalls)
    .set({ aiSummary: summary })
    .where(eq(voiceCalls.id, callId));

  return summary;
}

export async function notifyClientOfCall(callId: string): Promise<void> {
  const db = getDb();

  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.id, callId))
    .limit(1);

  if (!call) return;

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, call.clientId))
    .limit(1);

  if (!client?.phone) return;

  const summary = call.aiSummary || (await generateCallSummary(callId));

  const durationMin = Math.round((call.duration || 0) / 60);
  const callbackLine = call.callbackRequested ? '\nCallback requested!' : '';

  const message =
    `New AI call from ${call.from}\n` +
    `Duration: ${durationMin}min\n` +
    `Intent: ${call.callerIntent || 'Unknown'}` +
    callbackLine +
    `\n\n${summary}`;

  const twilioFrom = client.twilioNumber || process.env.TWILIO_PHONE_NUMBER!;

  await sendSMS(client.phone, twilioFrom, message);

  console.log('[Voice Summary] Notification sent to:', client.phone);
}
