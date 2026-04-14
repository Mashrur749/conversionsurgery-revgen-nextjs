/**
 * Win-Back Sequences
 *
 * Re-engages stale leads with AI-personalized, human-like messages.
 * Triggers 25-35 days after last contact (randomized).
 * Max 2 attempts, then marks lead dormant.
 */

import { getDb } from '@/db';
import { leads, clients, conversations, scheduledMessages, consentRecords } from '@/db/schema';
import { eq, and, lte, gte, not, inArray, sql, desc } from 'drizzle-orm';
import { buildAIContext } from '@/lib/agent/context-builder';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import { getTrackedAI } from '@/lib/ai';
import { checkOutputGuardrails } from '@/lib/agent/output-guard';
import { sanitizeForPrompt } from '@/lib/utils/prompt-sanitize';
import { truncateAtSentence } from '@/lib/utils/text';
import { isWithinLocalSendWindow } from '@/lib/utils/send-window';

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
  const WIN_BACK_DAY_OVERRIDES = [
    { day: 1, startHour: 11 },  // Monday: 11am-2pm (no early Monday)
    { day: 5, endHour: 13 },    // Friday: 10am-1pm (early Friday cutoff)
  ];

  if (!isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_DAY_OVERRIDES)) {
    return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] };
  }

  // Find leads that:
  // 1. Status is 'contacted' or 'estimate_sent' (engaged but didn't progress)
  // 2. Not opted out
  // 3. Not already won, lost, or dormant
  // 4. Last activity was 25-35 days ago (last message, or createdAt for imported leads with no messages)
  const staleCutoffMax = new Date(Date.now() - MIN_DAYS_STALE * 24 * 60 * 60 * 1000);
  const staleCutoffMin = new Date(Date.now() - MAX_DAYS_STALE * 24 * 60 * 60 * 1000);

  const staleLeads = await db
    .select({
      lead: leads,
      client: clients,
      lastMessageAt: sql<Date>`coalesce(max(${conversations.createdAt}), ${leads.createdAt})`.as('last_activity'),
    })
    .from(leads)
    .innerJoin(clients, eq(leads.clientId, clients.id))
    .leftJoin(conversations, eq(conversations.leadId, leads.id))
    .where(and(
      inArray(leads.status, ['contacted', 'estimate_sent']),
      eq(leads.optedOut, false),
    ))
    .groupBy(leads.id, clients.id)
    .having(and(
      lte(sql`coalesce(max(${conversations.createdAt}), ${leads.createdAt})`, staleCutoffMax),
      gte(sql`coalesce(max(${conversations.createdAt}), ${leads.createdAt})`, staleCutoffMin),
    ));

  if (staleLeads.length === 0) {
    return { eligible: 0, messaged: 0, markedDormant: 0, errors: [] };
  }

  // Batch check: which leads already have sent win-back messages (eliminates N+1)
  // Filter on sent=true so cancelled win-back records don't block future attempts
  const leadIds = staleLeads.map(({ lead }) => lead.id);
  const existingWinBacks = await db
    .select({ leadId: scheduledMessages.leadId })
    .from(scheduledMessages)
    .where(and(
      inArray(scheduledMessages.leadId, leadIds),
      eq(scheduledMessages.sequenceType, 'win_back'),
      eq(scheduledMessages.sent, true),
    ));
  const alreadySentSet = new Set(existingWinBacks.map(r => r.leadId));

  // Batch check: which leads have unsent, uncancelled scheduled messages from any OTHER sequence type
  // These leads are already in an active flow and should not receive win-back
  const activeSequenceRows = await db
    .select({ leadId: scheduledMessages.leadId })
    .from(scheduledMessages)
    .where(and(
      inArray(scheduledMessages.leadId, leadIds),
      eq(scheduledMessages.sent, false),
      eq(scheduledMessages.cancelled, false),
      not(eq(scheduledMessages.sequenceType, 'win_back')),
    ));
  const hasActiveSequenceSet = new Set(activeSequenceRows.map(r => r.leadId));

  // For estimate_sent leads, check if they have a recent inbound reply.
  // A "still thinking" reply resets their engagement clock — give them 45 days from
  // that reply before win-back fires (instead of the standard 25-35 day outbound-only window).
  const estimateSentLeadIds = staleLeads
    .filter(({ lead }) => lead.status === 'estimate_sent')
    .map(({ lead }) => lead.id);

  const recentInboundSet = new Set<string>();
  if (estimateSentLeadIds.length > 0) {
    const quietCutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    const recentInboundRows = await db
      .select({ leadId: conversations.leadId })
      .from(conversations)
      .where(
        and(
          inArray(conversations.leadId, estimateSentLeadIds),
          eq(conversations.direction, 'inbound'),
          gte(conversations.createdAt, quietCutoff)
        )
      )
      .groupBy(conversations.leadId);
    for (const row of recentInboundRows) {
      if (row.leadId) recentInboundSet.add(row.leadId);
    }
  }

  // Filter to actionable leads
  const actionableLeads = staleLeads.filter(({ lead, client }) => {
    if (alreadySentSet.has(lead.id)) return false;
    if (hasActiveSequenceSet.has(lead.id)) return false;
    // Skip estimate_sent leads that replied within the past 45 days —
    // they engaged more recently than the outbound-only window shows
    if (recentInboundSet.has(lead.id)) return false;
    if (!client.twilioNumber) {
      errors.push(`Client ${client.id}: no Twilio number`);
      return false;
    }
    return true;
  });

  eligible = staleLeads.length;

  // Process with concurrency limit (max 5 concurrent AI + SMS operations)
  const CONCURRENCY = 5;
  for (let i = 0; i < actionableLeads.length; i += CONCURRENCY) {
    const batch = actionableLeads.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async ({ lead, client }) => {
        const message = await generateWinBackMessage(
          client.id,
          lead.id,
          lead.name || 'there',
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
          from: client.twilioNumber as string,
          body: message,
          messageClassification: 'proactive_outreach',
          messageCategory: 'marketing',
          consentBasis: { type: 'existing_consent' },
          leadId: lead.id,
          queueOnQuietHours: true,
          metadata: { source: 'win_back', attempt: 1 },
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

          const secondDelay = SECOND_ATTEMPT_MIN_DAYS + Math.floor(
            Math.random() * (SECOND_ATTEMPT_MAX_DAYS - SECOND_ATTEMPT_MIN_DAYS)
          );
          const followUpDate = new Date();
          followUpDate.setDate(followUpDate.getDate() + secondDelay);
          followUpDate.setHours(10 + Math.floor(Math.random() * 4), 0, 0, 0);

          await db.insert(scheduledMessages).values({
            leadId: lead.id,
            clientId: client.id,
            sendAt: followUpDate,
            sequenceType: 'win_back',
            sequenceStep: 2,
            content: '__AI_GENERATE__',
          });

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
          await db
            .update(leads)
            .set({ status: 'dormant', updatedAt: new Date() })
            .where(eq(leads.id, lead.id));
          markedDormant++;
        }
      })
    );

    // Collect errors from rejected promises
    for (const result of results) {
      if (result.status === 'rejected') {
        const reason = result.reason instanceof Error ? result.reason.message : 'Unknown error';
        errors.push(`Batch error: ${reason}`);
      }
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

  // If they replied (status changed from 'contacted' or 'estimate_sent'), don't send
  if (!['contacted', 'estimate_sent'].includes(lead.status as string)) return null;

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

    const ai = getTrackedAI({ clientId, operation: 'win_back', leadId, metadata: { attempt } });
    const result = await ai.chat(
      [
        {
          role: 'user',
          content: `Write a re-engagement text (attempt ${attempt} of 2) for ${leadName}.`,
        },
      ],
      {
        systemPrompt: `You're writing a casual follow-up text from ${sanitizeForPrompt(ownerName)} at ${sanitizeForPrompt(businessName)}.
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
        temperature: 0.6,
        maxTokens: 100,
      },
    );

    let text = result.content.trim();
    if (!text) return null;

    // Apply safe truncation (SMS limit)
    text = truncateAtSentence(text, 160);

    // Post-generation safety check
    const guardResult = checkOutputGuardrails(text, '', { canDiscussPricing: false });
    if (!guardResult.passed) {
      console.warn(`[WinBack] Output guard blocked: ${guardResult.violation}`);
      return null; // Skip this lead — don't send a bad message
    }

    return text;
  } catch (err) {
    console.error('[WinBack] AI generation error:', err);
    return null;
  }
}
