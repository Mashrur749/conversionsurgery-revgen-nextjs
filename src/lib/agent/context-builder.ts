/**
 * Centralized AI Context Pipeline.
 *
 * Assembles a standard context bundle for EVERY AI-generated message in the system.
 * Used by: legacy generateAIResponse, LangGraph agent, no-show recovery, win-back, booking.
 *
 * This ensures every AI response has:
 * - Full customer context (who they are, what stage, what they want)
 * - Business knowledge (what we can answer)
 * - Guardrails (what we must never do)
 * - Time awareness (business hours, season, day of week)
 * - Compliance state (consent type, message count)
 */

import { getDb } from '@/db';
import {
  leads,
  clients,
  conversations,
  clientAgentSettings,
  leadContext,
  businessHours,
  flowExecutions,
  knowledgeBase,
  knowledgeGaps,
} from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { buildKnowledgeContext, searchKnowledge } from '@/lib/services/knowledge-base';
import { isWithinBusinessHours } from '@/lib/services/business-hours';
import { buildGuardrailPrompt, assessConfidence, type ConfidenceLevel } from './guardrails';

// ============================================================
// Types
// ============================================================

export interface BuildContextParams {
  clientId: string;
  leadId: string;
  /** Current inbound message for knowledge search relevance */
  currentMessage?: string;
  /** Max conversation history messages to include (default: 20) */
  maxHistoryMessages?: number;
  /** Purpose of the AI generation — affects prompt framing */
  purpose?: 'conversation' | 'no_show_recovery' | 'win_back' | 'booking' | 'follow_up';
}

export interface AIContextBundle {
  // Customer
  lead: {
    id: string;
    name: string;
    phone: string;
    source: string;
    stage: string;
    sentiment: string;
    signals: { urgency: number; budget: number; intent: number };
    projectInfo: {
      type: string | null;
      size: string | null;
      estimatedValue: number | null;
      timeframe: string | null;
    };
    objections: string[];
    isNew: boolean;
    bookingAttempts: number;
    conversationCount: number;
  };

  // Conversation
  conversationHistory: { role: 'user' | 'assistant'; content: string }[];

  // Business
  business: {
    name: string;
    ownerName: string;
    timezone: string;
    isWithinBusinessHours: boolean;
    businessHoursDisplay: string;
  };

  // Agent settings
  agent: {
    name: string;
    tone: 'professional' | 'friendly' | 'casual';
    maxResponseLength: number;
    primaryGoal: string;
    bookingAggressiveness: number;
    maxBookingAttempts: number;
    canDiscussPricing: boolean;
    canScheduleAppointments: boolean;
  };

  // Knowledge
  knowledge: string;
  relevantKnowledge: string | null;

  // Time context
  timeContext: {
    timeOfDay: string;
    dayOfWeek: string;
    season: string;
    localTime: string;
    isBusinessHours: boolean;
  };

  // Compliance
  compliance: {
    messagesWithoutResponse: number;
    consentType: string | null;
  };

  // AI generation
  confidenceLevel: ConfidenceLevel;
  systemPrompt: string;
  guardrailText: string;
}

// ============================================================
// Main builder
// ============================================================

export async function buildAIContext(params: BuildContextParams): Promise<AIContextBundle> {
  const {
    clientId,
    leadId,
    currentMessage,
    maxHistoryMessages = 20,
    purpose = 'conversation',
  } = params;

  const db = getDb();

  // ---- Parallel data loading ----
  const [
    leadResult,
    clientResult,
    agentSettingsResult,
    leadContextResult,
    historyResult,
    flowCountResult,
    knowledgeCountResult,
  ] = await Promise.all([
    db.select().from(leads).where(eq(leads.id, leadId)).limit(1),
    db.select().from(clients).where(eq(clients.id, clientId)).limit(1),
    db.select().from(clientAgentSettings).where(eq(clientAgentSettings.clientId, clientId)).limit(1),
    db.select().from(leadContext).where(eq(leadContext.leadId, leadId)).limit(1),
    db.select().from(conversations).where(eq(conversations.leadId, leadId)).orderBy(desc(conversations.createdAt)).limit(maxHistoryMessages),
    db.select({ count: sql<number>`count(*)` }).from(flowExecutions).where(eq(flowExecutions.leadId, leadId)),
    db.select({ count: sql<number>`count(*)` }).from(knowledgeBase).where(and(eq(knowledgeBase.clientId, clientId), eq(knowledgeBase.isActive, true))),
  ]);

  const lead = leadResult[0];
  const client = clientResult[0];
  const settings = agentSettingsResult[0];
  const context = leadContextResult[0];
  const totalKnowledgeEntries = Number(knowledgeCountResult[0]?.count) || 0;

  if (!lead || !client) {
    throw new Error(`Lead or client not found: lead=${leadId}, client=${clientId}`);
  }

  // ---- Knowledge context ----
  let knowledge = '';
  let relevantKnowledge: string | null = null;
  let knowledgeMatchCount = 0;

  try {
    knowledge = await buildKnowledgeContext(clientId);
  } catch (err) {
    console.error('[ContextBuilder] Knowledge context failed:', err);
  }

  if (currentMessage) {
    try {
      const matches = await searchKnowledge(clientId, currentMessage);
      knowledgeMatchCount = matches.length;
      if (matches.length > 0) {
        relevantKnowledge = matches
          .map(m => `[${m.category}] ${m.title}: ${m.content}`)
          .join('\n\n');
      }
    } catch (err) {
      console.error('[ContextBuilder] Knowledge search failed:', err);
    }
  }

  // ---- Conversation history ----
  const history = historyResult.reverse();
  const conversationHistory = history.map(msg => ({
    role: (msg.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: msg.content,
  }));

  // Count consecutive outbound messages at the end (messages without response)
  let messagesWithoutResponse = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].direction === 'outbound') {
      messagesWithoutResponse++;
    } else {
      break;
    }
  }

  // ---- Business hours + time context ----
  const timezone = client.timezone || 'America/Edmonton';
  let isInBusinessHours = false;
  try {
    isInBusinessHours = await isWithinBusinessHours(clientId, timezone);
  } catch {
    // Default to true if check fails
    isInBusinessHours = true;
  }

  const now = new Date();
  const localTimeStr = now.toLocaleString('en-CA', { timeZone: timezone });
  const localHour = new Date(localTimeStr).getHours();
  const localDay = new Date(localTimeStr).toLocaleDateString('en-CA', { timeZone: timezone, weekday: 'long' });
  const month = now.getMonth();

  const timeOfDay =
    localHour < 12 ? 'morning' :
    localHour < 17 ? 'afternoon' :
    localHour < 21 ? 'evening' : 'night';

  const season =
    month >= 2 && month <= 4 ? 'spring' :
    month >= 5 && month <= 7 ? 'summer' :
    month >= 8 && month <= 10 ? 'fall' : 'winter';

  // ---- Business hours display ----
  let businessHoursDisplay = '';
  try {
    const hoursResult = await db
      .select()
      .from(businessHours)
      .where(eq(businessHours.clientId, clientId))
      .orderBy(businessHours.dayOfWeek);
    if (hoursResult.length > 0) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      businessHoursDisplay = hoursResult
        .map(h => `${dayNames[h.dayOfWeek]}: ${h.isOpen ? `${h.openTime}–${h.closeTime}` : 'Closed'}`)
        .join(', ');
    }
  } catch {
    // Non-critical
  }

  // ---- Build structured data ----
  const isNew = !context || history.length <= 1;

  const leadBundle = {
    id: lead.id,
    name: lead.name || 'there',
    phone: lead.phone,
    source: lead.source || 'unknown',
    stage: context?.stage || 'new',
    sentiment: (context?.currentSentiment as string) || 'neutral',
    signals: {
      urgency: context?.urgencyScore || 50,
      budget: context?.budgetScore || 50,
      intent: context?.intentScore || 50,
    },
    projectInfo: {
      type: context?.projectType || null,
      size: context?.projectSize || null,
      estimatedValue: context?.estimatedValue || null,
      timeframe: context?.preferredTimeframe || null,
    },
    objections: ((context?.objections as Array<{ detail: string }>) || []).map(o => o.detail),
    isNew,
    bookingAttempts: context?.bookingAttempts || 0,
    conversationCount: history.length,
  };

  const agentBundle = {
    name: settings?.agentName || 'Assistant',
    tone: (settings?.agentTone || 'professional') as 'professional' | 'friendly' | 'casual',
    maxResponseLength: settings?.maxResponseLength || 300,
    primaryGoal: settings?.primaryGoal || 'book_appointment',
    bookingAggressiveness: settings?.bookingAggressiveness || 5,
    maxBookingAttempts: settings?.maxBookingAttempts || 3,
    canDiscussPricing: settings?.canDiscussPricing || false,
    canScheduleAppointments: settings?.canScheduleAppointments ?? true,
  };

  const timeContext = {
    timeOfDay,
    dayOfWeek: localDay,
    season,
    localTime: localTimeStr,
    isBusinessHours: isInBusinessHours,
  };

  // ---- Guardrails ----
  const guardrailText = buildGuardrailPrompt({
    ownerName: client.ownerName,
    businessName: client.businessName,
    agentTone: agentBundle.tone,
    messagesWithoutResponse,
    canDiscussPricing: agentBundle.canDiscussPricing,
  });

  // ---- Confidence assessment ----
  const confidenceLevel = assessConfidence(knowledgeMatchCount, totalKnowledgeEntries);

  // ---- Assemble system prompt ----
  const systemPrompt = buildSystemPrompt({
    purpose,
    business: {
      name: client.businessName,
      ownerName: client.ownerName,
      businessHoursDisplay,
    },
    agent: agentBundle,
    lead: leadBundle,
    knowledge,
    relevantKnowledge,
    timeContext,
    guardrailText,
  });

  return {
    lead: leadBundle,
    conversationHistory,
    business: {
      name: client.businessName,
      ownerName: client.ownerName,
      timezone,
      isWithinBusinessHours: isInBusinessHours,
      businessHoursDisplay,
    },
    agent: agentBundle,
    knowledge,
    relevantKnowledge,
    timeContext,
    compliance: {
      messagesWithoutResponse,
      consentType: null, // Populated by compliance gateway if needed
    },
    confidenceLevel,
    systemPrompt,
    guardrailText,
  };
}

// ============================================================
// System prompt assembly
// ============================================================

interface SystemPromptParams {
  purpose: string;
  business: { name: string; ownerName: string; businessHoursDisplay: string };
  agent: AIContextBundle['agent'];
  lead: AIContextBundle['lead'];
  knowledge: string;
  relevantKnowledge: string | null;
  timeContext: AIContextBundle['timeContext'];
  guardrailText: string;
}

function buildSystemPrompt(params: SystemPromptParams): string {
  const { purpose, business, agent, lead, knowledge, relevantKnowledge, timeContext, guardrailText } = params;

  const purposeFrame = getPurposeFrame(purpose, business.name, business.ownerName, agent.primaryGoal);

  const projectSection = lead.projectInfo.type
    ? `\nCUSTOMER PROJECT: ${lead.projectInfo.type}${lead.projectInfo.size ? ` (${lead.projectInfo.size})` : ''}${lead.projectInfo.estimatedValue ? ` — est. $${lead.projectInfo.estimatedValue}` : ''}${lead.projectInfo.timeframe ? ` — wants it ${lead.projectInfo.timeframe}` : ''}`
    : '';

  const objectionsSection = lead.objections.length > 0
    ? `\nCUSTOMER CONCERNS: ${lead.objections.join(', ')}`
    : '';

  const hoursSection = business.businessHoursDisplay
    ? `\nBUSINESS HOURS: ${business.businessHoursDisplay}`
    : '';

  return `${purposeFrame}

## BUSINESS KNOWLEDGE
${knowledge || 'No business knowledge configured yet. Defer all specific questions to ' + business.ownerName + '.'}
${relevantKnowledge ? `\n## MOST RELEVANT TO THIS QUESTION\n${relevantKnowledge}` : ''}

## CUSTOMER CONTEXT
- Name: ${lead.name}
- Source: ${lead.source}
- Stage: ${lead.stage}
- Sentiment: ${lead.sentiment}
- Conversation messages so far: ${lead.conversationCount}
- ${lead.isNew ? 'This is a NEW lead — first conversation.' : `Returning lead — ${lead.bookingAttempts} booking attempts so far.`}${projectSection}${objectionsSection}

## CURRENT TIME
- ${timeContext.dayOfWeek} ${timeContext.timeOfDay} (${timeContext.localTime})
- Season: ${timeContext.season}
- Business hours: ${timeContext.isBusinessHours ? 'OPEN now' : 'CLOSED now'}${hoursSection}

## AGENT SETTINGS
- Tone: ${agent.tone}
- Max response length: ${agent.maxResponseLength} characters
- Goal: ${agent.primaryGoal}
- Booking aggressiveness: ${agent.bookingAggressiveness}/10

${guardrailText}`;
}

function getPurposeFrame(
  purpose: string,
  businessName: string,
  ownerName: string,
  primaryGoal: string
): string {
  switch (purpose) {
    case 'no_show_recovery':
      return `You are reaching out on behalf of ${businessName} to a customer who missed their appointment. Your goal is to reschedule — be understanding, not accusatory. People miss appointments for real reasons.`;

    case 'win_back':
      return `You are texting a previous lead for ${businessName} who went quiet. Sound like a real person, not a marketer. Be brief, genuine, and give them a reason to re-engage. Maximum 2 attempts — if they don't respond, stop.`;

    case 'booking':
      return `You are helping a customer of ${businessName} schedule an appointment over text. Be conversational — suggest times, confirm details, and handle rescheduling naturally.`;

    case 'follow_up':
      return `You are following up with a lead for ${businessName}. Keep it brief and natural — check if they still need help or have questions.`;

    default:
      return `You are a helpful text assistant for ${businessName}. ${ownerName} manages the business. Your primary goal: ${primaryGoal.replace(/_/g, ' ')}. Respond naturally over SMS — keep it concise and helpful.`;
  }
}

// ============================================================
// Knowledge gap tracking
// ============================================================

/**
 * Track a knowledge gap — a question the AI couldn't answer confidently.
 * Called after AI generation when confidence is low.
 * Deduplicates by matching similar questions for the same client.
 */
export async function trackKnowledgeGap(
  clientId: string,
  question: string,
  confidenceLevel: ConfidenceLevel,
  category?: string
): Promise<void> {
  if (confidenceLevel === 'high') return; // No gap to track

  const db = getDb();
  const normalizedQuestion = question.toLowerCase().trim().substring(0, 500);

  // Check for existing similar gap (simple substring match)
  const existing = await db
    .select()
    .from(knowledgeGaps)
    .where(and(
      eq(knowledgeGaps.clientId, clientId),
      sql`LOWER(${knowledgeGaps.question}) LIKE ${'%' + normalizedQuestion.substring(0, 50) + '%'}`
    ))
    .limit(1);

  if (existing.length > 0) {
    // Increment occurrences
    await db
      .update(knowledgeGaps)
      .set({
        occurrences: sql`${knowledgeGaps.occurrences} + 1`,
        lastSeenAt: new Date(),
      })
      .where(eq(knowledgeGaps.id, existing[0].id));
  } else {
    // Create new gap
    await db.insert(knowledgeGaps).values({
      clientId,
      question: question.substring(0, 500),
      category,
      confidenceLevel,
    });
  }
}
