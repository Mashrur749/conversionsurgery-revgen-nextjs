import { getDb } from '@/db';
import { leads } from '@/db/schema/leads';
import { conversations } from '@/db/schema/conversations';
import { eq, desc, and, gte } from 'drizzle-orm';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Individual scoring factors that compose a lead's total score (each 0-25). */
export interface ScoreFactors {
  urgency: number;
  budget: number;
  engagement: number;
  intent: number;
  signals: string[];
  lastAnalysis: string;
}

/** Result returned by the main `scoreLead` function. */
export interface ScoringResult {
  score: number;
  temperature: 'hot' | 'warm' | 'cold';
  factors: ScoreFactors;
}

/** Result returned by `scoreClientLeads` batch scoring. */
export interface BatchScoringResult {
  updated: number;
  errors: number;
}

// Signal patterns for quick scoring (no AI needed)
const URGENCY_SIGNALS = {
  high: [
    /asap/i, /urgent/i, /emergency/i, /today/i, /right away/i,
    /leak/i, /flood/i, /damage/i, /broken/i, /not working/i,
    /insurance claim/i, /storm damage/i,
  ],
  medium: [
    /this week/i, /soon/i, /schedule/i, /available/i,
    /when can you/i, /how soon/i,
  ],
  low: [
    /just looking/i, /thinking about/i, /maybe/i, /someday/i,
    /no rush/i, /whenever/i, /next year/i,
  ],
};

const BUDGET_SIGNALS = {
  high: [
    /money.*(not|isn't|isnt).*(issue|problem|concern)/i,
    /budget.*ready/i, /can afford/i, /approved/i,
    /insurance.*cover/i, /finance/i, /payment plan/i,
  ],
  medium: [
    /how much/i, /cost/i, /price/i, /estimate/i, /quote/i,
  ],
  low: [
    /too expensive/i, /can't afford/i, /budget.*tight/i,
    /cheaper/i, /discount/i, /too much/i,
  ],
};

const INTENT_SIGNALS = {
  high: [
    /ready to (start|book|schedule|hire)/i,
    /let's (do it|proceed|move forward)/i,
    /when can you (start|come|begin)/i,
    /i want to/i, /we decided/i, /going with you/i,
  ],
  medium: [
    /interested/i, /considering/i, /comparing/i,
    /tell me more/i, /what's included/i,
  ],
  low: [
    /just (browsing|looking|curious)/i,
    /not sure/i, /still thinking/i, /maybe later/i,
  ],
};

const SATISFACTION_SIGNALS = [
  /looks great/i, /amazing/i, /perfect/i, /love it/i,
  /thank you/i, /happy/i, /excellent/i, /wonderful/i,
  /recommend/i, /great job/i, /impressed/i,
];

const FRUSTRATION_SIGNALS = [
  /disappointed/i, /frustrated/i, /upset/i, /angry/i,
  /taking too long/i, /not happy/i, /problem/i,
  /still waiting/i, /no response/i, /ignored/i,
];

/**
 * Quick-score a conversation using regex pattern matching (no AI call needed).
 * @param conversationText - The full conversation text to analyze.
 * @returns Partial score factors with urgency, budget, intent, and detected signals.
 */
export function quickScore(conversationText: string): Partial<ScoreFactors> {
  const signals: string[] = [];
  let urgency = 12;
  let budget = 12;
  let intent = 12;

  // Check urgency
  if (URGENCY_SIGNALS.high.some(p => p.test(conversationText))) {
    urgency = 22;
    signals.push('high_urgency');
  } else if (URGENCY_SIGNALS.low.some(p => p.test(conversationText))) {
    urgency = 5;
    signals.push('low_urgency');
  } else if (URGENCY_SIGNALS.medium.some(p => p.test(conversationText))) {
    urgency = 15;
    signals.push('medium_urgency');
  }

  // Check budget
  if (BUDGET_SIGNALS.high.some(p => p.test(conversationText))) {
    budget = 22;
    signals.push('budget_ready');
  } else if (BUDGET_SIGNALS.low.some(p => p.test(conversationText))) {
    budget = 5;
    signals.push('price_sensitive');
  } else if (BUDGET_SIGNALS.medium.some(p => p.test(conversationText))) {
    budget = 12;
    signals.push('price_inquiry');
  }

  // Check intent
  if (INTENT_SIGNALS.high.some(p => p.test(conversationText))) {
    intent = 22;
    signals.push('high_intent');
  } else if (INTENT_SIGNALS.low.some(p => p.test(conversationText))) {
    intent = 5;
    signals.push('low_intent');
  } else if (INTENT_SIGNALS.medium.some(p => p.test(conversationText))) {
    intent = 12;
    signals.push('considering');
  }

  // Check satisfaction/frustration (affects overall)
  if (SATISFACTION_SIGNALS.some(p => p.test(conversationText))) {
    signals.push('satisfied');
  }
  if (FRUSTRATION_SIGNALS.some(p => p.test(conversationText))) {
    signals.push('frustrated');
    intent = Math.max(intent - 5, 0);
  }

  return { urgency, budget, intent, signals };
}

/**
 * Calculate an engagement score (0-25) based on message response patterns and recency.
 * @param leadId - The UUID of the lead to evaluate.
 * @returns A numeric engagement score between 0 and 25.
 */
export async function calculateEngagement(leadId: string): Promise<number> {
  const db = getDb();
  const recentMessages = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.leadId, leadId),
        gte(conversations.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      )
    )
    .orderBy(desc(conversations.createdAt))
    .limit(20);

  if (recentMessages.length === 0) return 5;

  const inbound = recentMessages.filter(m => m.direction === 'inbound').length;
  const outbound = recentMessages.filter(m => m.direction === 'outbound').length;

  // Response ratio
  const responseRatio = outbound > 0 ? inbound / outbound : 0;

  // Recent activity bonus
  const lastMessage = recentMessages[0];
  const hoursSinceLastMessage = lastMessage
    ? (Date.now() - new Date(lastMessage.createdAt!).getTime()) / (1000 * 60 * 60)
    : 999;

  let engagement = 12;

  // High response ratio = engaged
  if (responseRatio > 0.8) engagement += 8;
  else if (responseRatio > 0.5) engagement += 4;
  else if (responseRatio < 0.2) engagement -= 5;

  // Recent activity = engaged
  if (hoursSinceLastMessage < 1) engagement += 5;
  else if (hoursSinceLastMessage < 24) engagement += 3;
  else if (hoursSinceLastMessage > 72) engagement -= 5;

  return Math.max(0, Math.min(25, engagement));
}

/**
 * AI-powered lead scoring using GPT-4o-mini for deeper conversation analysis.
 * Falls back to `quickScore` if the AI response cannot be parsed.
 * @param conversationText - The full conversation text to analyze.
 * @returns Complete score factors with AI-determined urgency, budget, intent, and signals.
 */
export async function aiScore(conversationText: string): Promise<ScoreFactors> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are a lead scoring AI for a contractor. Analyze this conversation and return a JSON score.

Score each factor 0-25:
- urgency: How urgent is their need? (emergency=25, browsing=0)
- budget: Are they ready to pay? (budget ready=25, price sensitive=0)
- intent: How ready to hire? (ready now=25, just looking=0)

Also list detected signals as strings.

Return ONLY valid JSON:
{
  "urgency": <number>,
  "budget": <number>,
  "intent": <number>,
  "signals": ["signal1", "signal2"]
}`,
      },
      {
        role: 'user',
        content: `Conversation:\n${conversationText}`,
      },
    ],
    temperature: 0.3,
    max_tokens: 200,
  });

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return {
      urgency: Math.min(25, Math.max(0, result.urgency || 12)),
      budget: Math.min(25, Math.max(0, result.budget || 12)),
      intent: Math.min(25, Math.max(0, result.intent || 12)),
      engagement: 0,
      signals: result.signals || [],
      lastAnalysis: new Date().toISOString(),
    };
  } catch {
    const quick = quickScore(conversationText);
    return {
      urgency: quick.urgency || 12,
      budget: quick.budget || 12,
      intent: quick.intent || 12,
      engagement: 0,
      signals: quick.signals || [],
      lastAnalysis: new Date().toISOString(),
    };
  }
}

/**
 * Score a single lead by combining pattern-matched or AI-derived factors with engagement.
 * Updates the lead's score, temperature, and factors in the database.
 * @param leadId - The UUID of the lead to score.
 * @param options - Optional configuration; set `useAI` to true for AI-powered analysis.
 * @returns The computed score, temperature classification, and individual factors.
 */
export async function scoreLead(
  leadId: string,
  options: { useAI?: boolean } = {}
): Promise<ScoringResult> {
  const db = getDb();

  // Get recent conversation
  const recentMessages = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(desc(conversations.createdAt))
    .limit(30);

  const conversationText = recentMessages
    .reverse()
    .map(m => `${m.direction === 'inbound' ? 'Lead' : 'Us'}: ${m.content}`)
    .join('\n');

  // Get factors
  let factors: ScoreFactors;

  if (options.useAI && conversationText.length > 50) {
    factors = await aiScore(conversationText);
  } else {
    const quick = quickScore(conversationText);
    factors = {
      urgency: quick.urgency || 12,
      budget: quick.budget || 12,
      intent: quick.intent || 12,
      engagement: 0,
      signals: quick.signals || [],
      lastAnalysis: new Date().toISOString(),
    };
  }

  // Calculate engagement
  factors.engagement = await calculateEngagement(leadId);

  // Total score
  const score = factors.urgency + factors.budget + factors.engagement + factors.intent;

  // Temperature
  let temperature: 'hot' | 'warm' | 'cold';
  if (score >= 70) temperature = 'hot';
  else if (score >= 40) temperature = 'warm';
  else temperature = 'cold';

  // Update lead in database
  await db
    .update(leads)
    .set({
      score,
      temperature,
      scoreFactors: factors,
      scoreUpdatedAt: new Date(),
    })
    .where(eq(leads.id, leadId));

  return { score, temperature, factors };
}

/**
 * Batch-score all leads belonging to a client.
 * @param clientId - The UUID of the client whose leads should be scored.
 * @param options - Optional configuration; set `useAI` to true for AI-powered analysis.
 * @returns Counts of successfully updated leads and errors encountered.
 */
export async function scoreClientLeads(
  clientId: string,
  options: { useAI?: boolean } = {}
): Promise<BatchScoringResult> {
  const db = getDb();
  const clientLeads = await db
    .select({ id: leads.id })
    .from(leads)
    .where(eq(leads.clientId, clientId));

  let updated = 0;
  let errors = 0;

  for (const lead of clientLeads) {
    try {
      await scoreLead(lead.id, options);
      updated++;
    } catch (err) {
      console.error(`[LeadScoring] Error scoring lead ${lead.id}:`, err);
      errors++;
    }
  }

  return { updated, errors };
}

/**
 * Retrieve leads for a client filtered by temperature classification, ordered by score descending.
 * @param clientId - The UUID of the client.
 * @param temperature - The temperature bucket to filter by ('hot', 'warm', or 'cold').
 * @returns Array of lead records matching the specified temperature.
 */
export async function getLeadsByTemperature(
  clientId: string,
  temperature: 'hot' | 'warm' | 'cold'
) {
  const db = getDb();
  return db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        eq(leads.temperature, temperature)
      )
    )
    .orderBy(desc(leads.score));
}
