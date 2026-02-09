import OpenAI from 'openai';
import { buildKnowledgeContext, searchKnowledge } from './knowledge-base';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

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
  if (clientId) {
    const knowledgeContext = await buildKnowledgeContext(clientId);
    const relevantKnowledge = await searchKnowledge(clientId, incomingMessage);

    if (knowledgeContext) {
      knowledgeSection = `\n${knowledgeContext}`;
    }

    if (relevantKnowledge.length > 0) {
      knowledgeSection += `\nMOST RELEVANT TO THIS QUESTION:\n${relevantKnowledge.map(k => `- ${k.title}: ${k.content}`).join('\n')}`;
    }
  }

  const systemPrompt = `You are a helpful text assistant for ${businessName}.
${knowledgeSection}

GUIDELINES:
- Be friendly, professional, and helpful
- Answer questions using the business information provided above
- If you don't have specific information, offer to have ${ownerName} follow up
- Keep responses concise (1-3 sentences for simple questions)
- For complex questions, provide helpful information and offer to schedule a call
- Never make up information not provided above
- If asked about pricing, refer to the pricing information or offer a free estimate
- Always represent the business positively
- Sound like a real text message, not a corporate bot
- Ask ONE question at a time to keep the conversation going`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-10),
        { role: 'user', content: incomingMessage },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const response = completion.choices[0]?.message?.content || '';

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
    console.error('OpenAI error:', error);
    return {
      response: '',
      confidence: 0,
      shouldEscalate: true,
      escalationReason: 'AI generation failed',
    };
  }
}
