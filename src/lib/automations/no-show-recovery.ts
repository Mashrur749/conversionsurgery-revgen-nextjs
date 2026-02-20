/**
 * No-Show Recovery Automation
 *
 * Detects missed appointments and sends AI-personalized follow-ups.
 * Sequence: first message same evening (or next morning), second 2 days later.
 * Max 2 attempts, all through compliance gateway.
 */

import OpenAI from 'openai';
import { getDb } from '@/db';
import { appointments, leads, clients, conversations, scheduledMessages } from '@/db/schema';
import { eq, and, lte, sql, inArray } from 'drizzle-orm';
import { buildAIContext } from '@/lib/agent/context-builder';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { trackUsage } from '@/lib/services/usage-tracking';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/**
 * Detects appointments that are 2+ hours past their time and still 'scheduled'.
 * Marks them as no_show and triggers the first recovery message.
 */
export async function processNoShows(): Promise<{
  detected: number;
  messaged: number;
  errors: string[];
}> {
  const db = getDb();
  const errors: string[] = [];
  let detected = 0;
  let messaged = 0;

  // Find appointments that are 2+ hours past their scheduled time and still 'scheduled'
  const noShows = await db
    .select({
      appointment: appointments,
      lead: leads,
      client: clients,
    })
    .from(appointments)
    .innerJoin(leads, eq(appointments.leadId, leads.id))
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .where(and(
      eq(appointments.status, 'scheduled'),
      // appointment_date + appointment_time + 2 hours < now
      lte(
        sql`(${appointments.appointmentDate}::date + ${appointments.appointmentTime}::time + interval '2 hours')`,
        sql`now()`
      )
    ));

  if (noShows.length === 0) {
    return { detected: 0, messaged: 0, errors: [] };
  }

  detected = noShows.length;

  // Batch update: mark all appointments as no_show at once
  const appointmentIds = noShows.map(({ appointment }) => appointment.id);
  await db
    .update(appointments)
    .set({ status: 'no_show', updatedAt: new Date() })
    .where(inArray(appointments.id, appointmentIds));

  // Filter to actionable leads (has Twilio number)
  const actionableNoShows = noShows.filter(({ client }) => {
    if (!client.twilioNumber) {
      errors.push(`Client ${client.id}: no Twilio number`);
      return false;
    }
    return true;
  });

  // Process with concurrency limit (max 5 concurrent AI + SMS operations)
  const CONCURRENCY = 5;
  for (let i = 0; i < actionableNoShows.length; i += CONCURRENCY) {
    const batch = actionableNoShows.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async ({ appointment, lead, client }) => {
        const message = await generateNoShowMessage(
          client.id,
          lead.id,
          lead.name || 'there',
          appointment.appointmentDate,
          appointment.appointmentTime,
          client.businessName,
          client.ownerName,
          1
        );

        if (!message) {
          errors.push(`Lead ${lead.id}: AI generation failed`);
          return;
        }

        const result = await sendCompliantMessage({
          clientId: client.id,
          to: lead.phone,
          from: client.twilioNumber!,
          body: message,
          messageCategory: 'transactional',
          consentBasis: { type: 'existing_consent' },
          leadId: lead.id,
          queueOnQuietHours: true,
          metadata: {
            source: 'no_show_recovery',
            attempt: 1,
            appointmentId: appointment.id,
          },
        });

        if (result.sent || result.queued) {
          messaged++;

          if (result.sent) {
            await db.insert(conversations).values({
              leadId: lead.id,
              clientId: client.id,
              direction: 'outbound',
              messageType: 'ai_response',
              content: message,
            });
          }

          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + 2);
          followUpDate.setHours(10, 0, 0, 0);

          await db.insert(scheduledMessages).values({
            leadId: lead.id,
            clientId: client.id,
            sendAt: followUpDate,
            sequenceType: 'no_show_followup',
            sequenceStep: 2,
            content: '__AI_GENERATE__',
          });
        }
      })
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`Batch error: ${reason}`);
      }
    }
  }

  return { detected, messaged, errors };
}

/**
 * Processes second no-show follow-up messages.
 * Called by the scheduled message processor when it encounters 'no_show_followup_2' type.
 */
export async function processNoShowFollowUp(
  leadId: string,
  clientId: string
): Promise<string | null> {
  const db = getDb();

  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);

  if (!lead || !client || !client.twilioNumber) return null;

  // Find the most recent no-show appointment
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(and(
      eq(appointments.leadId, leadId),
      eq(appointments.status, 'no_show')
    ))
    .limit(1);

  if (!appointment) return null;

  const message = await generateNoShowMessage(
    clientId,
    leadId,
    lead.name || 'there',
    appointment.appointmentDate,
    appointment.appointmentTime,
    client.businessName,
    client.ownerName,
    2 // second attempt
  );

  return message;
}

/**
 * Generates an AI-personalized no-show follow-up using the context pipeline.
 */
async function generateNoShowMessage(
  clientId: string,
  leadId: string,
  leadName: string,
  appointmentDate: string,
  appointmentTime: string,
  businessName: string,
  ownerName: string,
  attempt: number
): Promise<string | null> {
  try {
    const context = await buildAIContext({
      clientId,
      leadId,
      purpose: 'no_show_recovery',
    });

    const attemptPrompt = attempt === 1
      ? `This is the FIRST follow-up after a no-show. Be warm and understanding. Reference their specific project if known.`
      : `This is the SECOND and FINAL follow-up. Be even shorter and more casual. Give them an easy out.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are writing a no-show follow-up SMS from ${ownerName} at ${businessName}.
The customer "${leadName}" missed their appointment on ${appointmentDate} at ${appointmentTime}.

${attemptPrompt}

${context.guardrailText}

Rules:
- 1-2 short sentences maximum
- Sound like a real person texting, not a bot
- Be warm and understanding — no guilt, no pressure
- Reference their specific project/need from conversation history if available
- Offer to reschedule, make it easy
- Do NOT use exclamation marks excessively
- Do NOT mention how long it's been
- Do NOT use "just checking in"

Conversation context:
${context.conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

Project info: ${context.lead.projectInfo.type || 'unknown'}`,
        },
        {
          role: 'user',
          content: `Write a follow-up text message (attempt ${attempt} of 2).`,
        },
      ],
      temperature: 0.8,
      max_tokens: 150,
    });

    const text = response.choices[0]?.message?.content?.trim();

    trackUsage({
      clientId,
      service: 'openai',
      operation: 'no_show_recovery',
      leadId,
      metadata: { attempt, model: 'gpt-4o-mini' },
    }).catch(() => {});

    return text || null;
  } catch (err) {
    console.error('[NoShowRecovery] AI generation error:', err);
    return null;
  }
}
