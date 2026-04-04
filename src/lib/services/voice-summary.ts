import { getDb } from '@/db';
import { voiceCalls, clients, systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getTrackedAI } from '@/lib/ai';
import { sendSMS } from './twilio';
import { normalizePhoneNumber } from '@/lib/utils/phone';

/**
 * [Voice] Generate an AI summary of a voice call transcript
 * @param callId - The voice call ID
 */
export async function generateCallSummary(callId: string): Promise<string> {
  const db = getDb();

  const [call] = await db
    .select()
    .from(voiceCalls)
    .where(eq(voiceCalls.id, callId))
    .limit(1);

  if (!call?.transcript) return '';

  const ai = getTrackedAI({ clientId: call.clientId, operation: 'voice_summary' });
  const result = await ai.chat(
    [{ role: 'user', content: call.transcript }],
    {
      systemPrompt: `Summarize this phone call transcript in 2-3 sentences. Include:
- What the caller wanted
- Key details mentioned
- Outcome or next steps`,
      temperature: 0.5,
      maxTokens: 150,
    },
  );

  const summary = result.content;

  await db
    .update(voiceCalls)
    .set({ aiSummary: summary, updatedAt: new Date() })
    .where(eq(voiceCalls.id, callId));

  return summary;
}

/**
 * [Voice] Notify the client of a completed voice call via SMS
 * @param callId - The voice call ID
 */
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

  // Route voice call notifications to operator first, fall back to contractor
  const [operatorRow] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'operator_phone'))
    .limit(1);
  const operatorPhone = operatorRow?.value ? normalizePhoneNumber(operatorRow.value) : null;
  const notifyPhone = operatorPhone ?? client.phone;

  const summary = call.aiSummary || (await generateCallSummary(callId));

  const durationMin = Math.round((call.duration || 0) / 60);
  const callbackLine = call.callbackRequested ? '\nCallback requested!' : '';

  const message =
    `Voice call for ${client.businessName}\n` +
    `From: ${call.from}\n` +
    `Duration: ${durationMin}min\n` +
    `Intent: ${call.callerIntent || 'Unknown'}` +
    callbackLine +
    `\n\n${summary}`;

  const twilioFrom = client.twilioNumber || process.env.TWILIO_PHONE_NUMBER!;

  await sendSMS(notifyPhone, message, twilioFrom);

  console.log('[Voice] Notification sent to:', notifyPhone);
}
