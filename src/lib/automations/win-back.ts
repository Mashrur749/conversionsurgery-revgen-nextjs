/**
 * Win-Back Sequences
 *
 * Re-engages stale leads with AI-personalized, human-like messages.
 * Triggers 25-35 days after last contact (randomized).
 * Max 2 attempts, then marks lead dormant.
 */

import OpenAI from 'openai';
import { getDb } from '@/db';
import { leads, clients, conversations, scheduledMessages, consentRecords } from '@/db/schema';
import { eq, and, lte, gte, not, inArray, sql, desc } from 'drizzle-orm';
import { buildAIContext } from '@/lib/agent/context-builder';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { trackUsage } from '@/lib/services/usage-tracking';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Win-back window: 25-35 days since last message
const MIN_DAYS_STALE = 25;
const MAX_DAYS_STALE = 35;

// Second attempt: 20-30 days after first win-back
const SECOND_ATTEMPT_MIN_DAYS = 20;
const SECOND_ATTEMPT_MAX_DAYS = 30;

/**
 * Identifies stale leads eligible for win-back and sends first AI message.
 * Should run daily (e.g., 10am).
 */
export async function processWinBacks(): Promise<{
  eligible: number;
  messaged: number;
  markedDormant: number;
  errors: string[];
}> {
  const db = getDb();
  const errors: string[] = [];
  let eligible = 0;
  let messaged = 0;
  let markedDormant = 0;

  // Check timing: only send 10am-2pm weekdays, never Monday morning or Friday afternoon
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat

  if (dayOfWeek === 0 || dayOfWeek === 6) return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] };
  if (hour < 10 || hour >= 14) return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] };
  if (dayOfWeek === 1 && hour < 11) return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] }; // No Monday before 11am
  if (dayOfWeek === 5 && hour >= 13) return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] }; // No Friday after 1pm

  // Find leads that:
  // 1. Status is 'contacted' (engaged but didn't progress)
  // 2. Not opted out
  // 3. Not already won, lost, or dormant
  // 4. Last message was 25-35 days ago
  const staleCutoffMax = new Date(Date.now() - MIN_DAYS_STALE * 24 * 60 * 60 * 1000);
  const staleCutoffMin = new Date(Date.now() - MAX_DAYS_STALE * 24 * 60 * 60 * 1000);

  const staleLeads = await db
    .select({
      lead: leads,
      client: clients,
      lastMessageAt: sql<Date>`max(${conversations.createdAt})`.as('last_msg'),
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .innerJoin(conversations, eq(conversations.leadId, leads.id))
    .where(and(
      eq(leads.status, 'contacted'),
      eq(leads.optedOut, false),
      not(inArray(leads.status, ['won', 'lost', 'dormant', 'opted_out'])),
    ))
    .groupBy(leads.id, clients.id)
    .having(and(
      lte(sql`max(${conversations.createdAt})`, staleCutoffMax),
      gte(sql`max(${conversations.createdAt})`, staleCutoffMin),
    ));

  for (const { lead, client } of staleLeads) {
    eligible++;

    if (!client.twilioNumber) {
      errors.push(`Client ${client.id}: no Twilio number`);
      continue;
    }

    // Check if we already sent a win-back for this lead
    const existingWinBack = await db
      .select()
      .from(scheduledMessages)
      .where(and(
        eq(scheduledMessages.leadId, lead.id),
        eq(scheduledMessages.sequenceType, 'win_back'),
      ))
      .limit(1);

    if (existingWinBack.length > 0) {
      continue; // Already sent or scheduled a win-back
    }

    try {
      const message = await generateWinBackMessage(
        client.id,
        lead.id,
        lead.name || 'there',
        client.businessName,
        client.ownerName,
        1 // first attempt
      );

      if (!message) {
        errors.push(`Lead ${lead.id}: AI generation failed`);
        continue;
      }

      const result = await sendCompliantMessage({
        clientId: client.id,
        to: lead.phone,
        from: client.twilioNumber,
        body: message,
        messageCategory: 'marketing',
        consentBasis: { type: 'existing_consent' },
        leadId: lead.id,
        queueOnQuietHours: true,
        metadata: {
          source: 'win_back',
          attempt: 1,
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

        // Schedule second attempt 20-30 days later (randomized)
        const secondDelay = SECOND_ATTEMPT_MIN_DAYS + Math.floor(
          Math.random() * (SECOND_ATTEMPT_MAX_DAYS - SECOND_ATTEMPT_MIN_DAYS)
        );
        const followUpDate = new Date();
        followUpDate.setDate(followUpDate.getDate() + secondDelay);
        followUpDate.setHours(10 + Math.floor(Math.random() * 4), 0, 0, 0); // 10am-1pm

        await db.insert(scheduledMessages).values({
          leadId: lead.id,
          clientId: client.id,
          sendAt: followUpDate,
          sequenceType: 'win_back',
          sequenceStep: 2,
          content: '__AI_GENERATE__',
        });

        // Record that first win-back was sent
        await db.insert(scheduledMessages).values({
          leadId: lead.id,
          clientId: client.id,
          sendAt: new Date(),
          sequenceType: 'win_back',
          sequenceStep: 1,
          content: message,
          sent: true,
          sentAt: new Date(),
        });
      } else if (result.blocked) {
        // Consent expired or opted out — mark dormant
        await db
          .update(leads)
          .set({ status: 'dormant', updatedAt: new Date() })
          .where(eq(leads.id, lead.id));
        markedDormant++;
      }
    } catch (err) {
      errors.push(`Lead ${lead.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  return { eligible, messaged, markedDormant, errors };
}

/**
 * Processes second win-back attempt.
 * Called by the scheduled message processor when encountering win_back step 2.
 * If lead still hasn't replied, sends final message and marks dormant.
 */
export async function processWinBackFollowUp(
  leadId: string,
  clientId: string
): Promise<string | null> {
  const db = getDb();

  // Check if lead has replied since first win-back
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) return null;

  // If they replied (status changed from 'contacted'), don't send
  if (lead.status !== 'contacted') return null;

  const [client] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
  if (!client) return null;

  const message = await generateWinBackMessage(
    clientId,
    leadId,
    lead.name || 'there',
    client.businessName,
    client.ownerName,
    2 // second attempt
  );

  // After second attempt, mark lead as dormant regardless
  await db
    .update(leads)
    .set({ status: 'dormant', updatedAt: new Date() })
    .where(eq(leads.id, leadId));

  return message;
}

/**
 * Generates an AI win-back message with strict human-like tone.
 */
async function generateWinBackMessage(
  clientId: string,
  leadId: string,
  leadName: string,
  businessName: string,
  ownerName: string,
  attempt: number
): Promise<string | null> {
  try {
    const context = await buildAIContext({
      clientId,
      leadId,
      purpose: 'win_back',
    });

    const attemptPrompt = attempt === 1
      ? `This is the FIRST re-engagement. Reference their specific project naturally.`
      : `This is the FINAL follow-up. Even shorter — just a soft "still here if you need us" vibe. 1 sentence max.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You're writing a casual follow-up text from ${ownerName} at ${businessName}.
Write like a real person texting — not a marketer, not a chatbot.

${attemptPrompt}

Rules:
- 1-2 short sentences maximum
- Reference their specific project from conversation history
- Give them an easy out — "no rush", "whenever you're ready"
- NEVER mention how long it's been since you last talked
- NEVER use "just checking in"
- NEVER use urgency, scarcity, or promotional language
- NEVER reference weather, news, or unverifiable external claims
- Sound slightly informal — contractions, short sentences
- End with a soft ask, not a hard CTA
- Do NOT start with "Hi" or "Hello" — just jump in casually

Good: "Hey Mike, just wanted to follow up on the deck project. Let me know if you'd like to get that estimate set up."
Bad: "Hi Michael! Just checking in about your recent inquiry. We'd love to help!"

${context.guardrailText}

Conversation context:
${context.conversationHistory.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

Project info: ${context.lead.projectInfo.type || 'unknown'}`,
        },
        {
          role: 'user',
          content: `Write a re-engagement text (attempt ${attempt} of 2) for ${leadName}.`,
        },
      ],
      temperature: 0.9,
      max_tokens: 100,
    });

    const text = response.choices[0]?.message?.content?.trim();

    trackUsage({
      clientId,
      service: 'openai',
      operation: 'win_back',
      leadId,
      metadata: { attempt, model: 'gpt-4o-mini' },
    }).catch(() => {});

    return text || null;
  } catch (err) {
    console.error('[WinBack] AI generation error:', err);
    return null;
  }
}
