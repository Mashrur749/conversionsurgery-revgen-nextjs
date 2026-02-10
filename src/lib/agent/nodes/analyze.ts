import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { ConversationStateType } from '../state';

const analysisSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'frustrated']),
  sentimentConfidence: z.number().min(0).max(100),
  urgencyScore: z.number().min(0).max(100),
  budgetScore: z.number().min(0).max(100),
  intentScore: z.number().min(0).max(100),
  detectedObjections: z.array(z.string()),
  extractedInfo: z.object({
    projectType: z.string().optional(),
    projectSize: z.string().optional(),
    estimatedValue: z.number().optional(),
    preferredTimeframe: z.string().optional(),
    propertyType: z.string().optional(),
    specificRequests: z.array(z.string()).optional(),
  }),
  suggestedStage: z.enum([
    'new', 'qualifying', 'nurturing', 'hot',
    'objection', 'escalated', 'booked', 'lost'
  ]),
  escalationNeeded: z.boolean(),
  escalationReason: z.string().optional(),
  keyInsights: z.array(z.string()),
});

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.1,
}).withStructuredOutput(analysisSchema);

const ANALYSIS_PROMPT = `You are analyzing a customer conversation for a home services contractor.
Your job is to extract signals, sentiment, and key information from the conversation.

Business: {businessName}
Services offered: {services}

Analyze the conversation and determine:

1. SENTIMENT: How is the customer feeling right now?
   - positive: Happy, interested, engaged
   - neutral: Just gathering info, no strong emotion
   - negative: Unhappy, disappointed, concerned
   - frustrated: Angry, impatient, upset

2. SCORES (0-100):
   - urgencyScore: How soon do they need service? (100 = emergency/today, 0 = just browsing)
   - budgetScore: How willing are they to pay? (100 = money no object, 0 = very price sensitive)
   - intentScore: How likely are they to book? (100 = ready to book now, 0 = unlikely)

3. STAGE: What stage of the buying journey are they in?
   - new: First contact, just inquiring
   - qualifying: We're learning about their needs
   - nurturing: Not ready yet, need to stay in touch
   - hot: Showing strong buying signals
   - objection: Has concerns we need to address
   - escalated: Needs human intervention
   - booked: Appointment scheduled
   - lost: Unresponsive, went elsewhere, not interested

4. OBJECTIONS: List any concerns or objections they've raised
   Examples: "too expensive", "need to think about it", "comparing other quotes", "bad timing"

5. EXTRACTED INFO: Pull out any project details mentioned

6. ESCALATION: Should a human take over?
   Escalate if: asking for manager/owner, legal threats, very frustrated, complex technical questions, high-value project (>$10k)

Recent conversation (newest last):
{conversation}

Analyze this conversation now.`;

export async function analyzeConversation(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  const messages = state.messages;
  const clientSettings = state.clientSettings;

  if (!clientSettings) {
    throw new Error('Client settings not loaded');
  }

  // Format conversation for analysis
  const conversationText = messages
    .slice(-10) // Last 10 messages for context
    .map(m => {
      const role = m._getType() === 'human' ? 'Customer' : 'Agent';
      return `${role}: ${m.content}`;
    })
    .join('\n');

  const prompt = ANALYSIS_PROMPT
    .replace('{businessName}', clientSettings.businessName)
    .replace('{services}', clientSettings.services.join(', '))
    .replace('{conversation}', conversationText);

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage('Analyze the conversation above.'),
  ]);

  // Update state with analysis results
  return {
    signals: {
      urgency: response.urgencyScore,
      budget: response.budgetScore,
      intent: response.intentScore,
      sentiment: response.sentiment,
    },
    stage: response.suggestedStage,
    objections: response.detectedObjections,
    extractedInfo: {
      ...state.extractedInfo,
      ...response.extractedInfo,
    },
    needsEscalation: response.escalationNeeded,
    escalationReason: response.escalationNeeded
      ? (response.escalationReason as any)
      : null,
  };
}
