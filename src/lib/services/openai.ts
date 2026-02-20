import OpenAI from 'openai';
import { buildKnowledgeContext, searchKnowledge } from './knowledge-base';
import { buildGuardrailPrompt } from '@/lib/agent/guardrails';
import { getDb } from '@/db';
import { clientAgentSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  timeout: 15_000, // 15s timeout — prevents hanging during OpenAI degradation
  maxRetries: 0,   // We handle retries ourselves for better control
});

const OPENAI_MAX_RETRIES = 2;
const OPENAI_RETRY_BASE_DELAY_MS = 1000;

/**
 * Determines if an OpenAI error is retryable (rate limit or server error).
 */
function isRetryableOpenAIError(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    // 429 = rate limited, 5xx = server error
    return error.status === 429 || (error.status !== undefined && error.status >= 500);
  }
  // Network / timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('timeout') || msg.includes('econnreset') || msg.includes('fetch failed');
  }
  return false;
}

// ============================================
// HOT INTENT DETECTION
// ============================================
const HOT_INTENT_TRIGGERS = [
  'ready to schedule',
  'ready to book',
  'can you call me',
  'call me',
  'give me a call',
  'want to proceed',
  'let\'s do it',
  'let\'s move forward',
  'when can you start',
  'i\'m ready',
  'book an appointment',
  'schedule an estimate',
  'come out today',
  'come out tomorrow',
  'available today',
  'available tomorrow',
];

/** Detect if a message contains hot intent signals (FROZEN EXPORT) */
export function detectHotIntent(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return HOT_INTENT_TRIGGERS.some(trigger => lowerMessage.includes(trigger));
}

interface AIResult {
  response: string;
  confidence: number;
  shouldEscalate: boolean;
  escalationReason?: string;
}

// Phrases that ALWAYS trigger escalation
const ESCALATION_TRIGGERS = [
  // Pricing
  'price', 'pricing', 'cost', 'how much', 'quote', 'estimate',
  // Complaints
  'complaint', 'upset', 'frustrated', 'angry', 'unhappy', 'terrible', 'awful',
  // Human request
  'call me', 'speak to someone', 'talk to', 'human', 'person', 'owner',
  // High intent
  'ready to book', 'let\'s do it', 'move forward', 'schedule', 'when can you start',
  // Changes
  'reschedule', 'cancel', 'change',
];

/** Generate an AI response using OpenAI with knowledge base context (FROZEN EXPORT) */
export async function generateAIResponse(
  incomingMessage: string,
  businessName: string,
  ownerName: string,
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  clientId?: string
): Promise<AIResult> {

  // Check for immediate escalation triggers
  const lowerMessage = incomingMessage.toLowerCase();
  for (const trigger of ESCALATION_TRIGGERS) {
    if (lowerMessage.includes(trigger)) {
      return {
        response: '',
        confidence: 1,
        shouldEscalate: true,
        escalationReason: `Contains trigger phrase: "${trigger}"`,
      };
    }
  }

  // Check for too many back-and-forths
  if (conversationHistory.length >= 6) {
    return {
      response: '',
      confidence: 1,
      shouldEscalate: true,
      escalationReason: 'Extended conversation (3+ exchanges)',
    };
  }

  // Build knowledge context if clientId is provided
  let knowledgeSection = '';
  let guardrailSection = '';

  if (clientId) {
    const knowledgeContext = await buildKnowledgeContext(clientId);
    const relevantKnowledge = await searchKnowledge(clientId, incomingMessage);

    if (knowledgeContext) {
      knowledgeSection = `\n## BUSINESS KNOWLEDGE\n${knowledgeContext}`;
    }

    if (relevantKnowledge.length > 0) {
      knowledgeSection += `\n\n## MOST RELEVANT TO THIS QUESTION\n${relevantKnowledge.map(k => `- ${k.title}: ${k.content}`).join('\n')}`;
    }

    // Load agent settings for guardrails
    try {
      const db = getDb();
      const [settings] = await db
        .select()
        .from(clientAgentSettings)
        .where(eq(clientAgentSettings.clientId, clientId))
        .limit(1);

      // Count consecutive outbound messages (messages without response)
      const outboundCount = conversationHistory
        .slice()
        .reverse()
        .findIndex(m => m.role === 'user');
      const messagesWithoutResponse = outboundCount === -1 ? conversationHistory.length : outboundCount;

      guardrailSection = '\n\n' + buildGuardrailPrompt({
        ownerName,
        businessName,
        agentTone: (settings?.agentTone || 'professional') as 'professional' | 'friendly' | 'casual',
        messagesWithoutResponse,
        canDiscussPricing: settings?.canDiscussPricing || false,
      });
    } catch (err) {
      console.error('[OpenAI] Failed to load guardrails:', err);
    }
  }

  const systemPrompt = `You are a helpful text assistant for ${businessName}. ${ownerName} manages the business. Your primary goal: help leads book appointments.
${knowledgeSection}${guardrailSection}`;

  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-10),
      { role: 'user', content: incomingMessage },
    ];

    let completion: OpenAI.Chat.ChatCompletion | undefined;

    for (let attempt = 1; attempt <= OPENAI_MAX_RETRIES + 1; attempt++) {
      try {
        completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages,
          max_tokens: 200,
          temperature: 0.7,
        });
        break; // Success — exit retry loop
      } catch (retryError) {
        if (!isRetryableOpenAIError(retryError) || attempt > OPENAI_MAX_RETRIES) {
          throw retryError;
        }
        const delay = OPENAI_RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[OpenAI] Attempt ${attempt} failed (retryable), retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const response = completion?.choices[0]?.message?.content || '';

    // Confidence based on response quality
    let confidence = 0.85;

    // Lower confidence if response is too short or too long
    if (response.length < 20 || response.length > 320) {
      confidence = 0.6;
    }

    // Lower confidence if response seems uncertain
    const uncertainPhrases = ['i\'m not sure', 'i don\'t know', 'maybe', 'perhaps'];
    if (uncertainPhrases.some(phrase => response.toLowerCase().includes(phrase))) {
      confidence = 0.5;
    }

    return {
      response,
      confidence,
      shouldEscalate: confidence < 0.7,
      escalationReason: confidence < 0.7 ? 'Low AI confidence' : undefined,
    };
  } catch (error) {
    console.error('[OpenAI] AI generation failed after retries:', error);
    return {
      response: '',
      confidence: 0,
      shouldEscalate: true,
      escalationReason: 'AI generation failed',
    };
  }
}
