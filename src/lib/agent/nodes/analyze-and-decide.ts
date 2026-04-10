import { z } from 'zod';
import type { ConversationStateType } from '../state';
import type { AgentAction, EscalationReason } from '@/lib/types/agent';
import { getAIProvider } from '@/lib/ai';
import { selectModelTier } from '@/lib/ai/model-routing';

const analyzeAndDecideSchema = z.object({
  // Analysis
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
    'objection', 'escalated', 'booked', 'lost',
  ]),
  escalationNeeded: z.boolean(),
  escalationReason: z.string().optional(),
  keyInsights: z.array(z.string()),

  // Decision
  action: z.enum([
    'respond', 'wait', 'trigger_flow', 'escalate',
    'book_appointment', 'send_quote', 'request_photos',
    'send_payment', 'close_won', 'close_lost',
  ]),
  reasoning: z.string(),
  confidence: z.number().min(0).max(100),
  responseStrategy: z.string().optional(),
  flowToTrigger: z.string().optional(),
  waitDurationMinutes: z.number().optional(),
  alternativeActions: z.array(z.object({
    action: z.string(),
    confidence: z.number(),
    reason: z.string(),
  })),
});

const ANALYZE_AND_DECIDE_PROMPT = `You are analyzing a customer conversation for a home services contractor AND deciding the best next action — in one step.

Business: {businessName}
Services offered: {services}
Primary Goal: {primaryGoal}
Booking Aggressiveness: {aggressiveness}/10
Can Discuss Pricing: {canDiscussPricing}
Can Schedule Appointments: {canSchedule}

## PART 1: ANALYZE the conversation

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
   Escalate if: asking for manager/owner, legal threats, very frustrated, complex technical questions, high-value project (>$10k).
   If escalation is needed, set action to "escalate".

## PART 2: DECIDE the best action

CURRENT STATE:
- Booking Attempts So Far: {bookingAttempts}
- Max Booking Attempts: {maxBookingAttempts}
- Known Objections: {objections}
- Last Action: {lastAction}

AVAILABLE ACTIONS:
1. respond - Send a message to the customer
2. wait - Don't respond yet, let them reply or wait for better timing
3. trigger_flow - Start an automated follow-up sequence
4. escalate - Hand off to a human team member
5. book_appointment - Attempt to schedule an appointment
6. send_quote - Send a price estimate
7. request_photos - Ask them to send photos of their project
8. send_payment - Send a payment link (only if job is confirmed)
9. close_won - Mark as booked/won (they've committed)
10. close_lost - Mark as lost (they've declined or gone elsewhere)

DECISION GUIDELINES:
- If sentiment is frustrated or negative, be extra careful and empathetic
- If they just sent a message, usually respond (don't wait)
- If they haven't responded in a while, consider triggering a follow-up flow
- If intent is high (>70) and you haven't tried booking recently, try to book
- If they've objected to booking {maxBookingAttempts} times, back off
- If the question is too complex or they're upset, escalate
- Don't be too pushy - space out booking attempts
- If they ask about pricing and you can't discuss it, escalate

Recent conversation (newest last):
{conversation}

Analyze this conversation and decide the best action.`;

export async function analyzeAndDecide(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  const clientSettings = state.clientSettings;

  if (!clientSettings) {
    throw new Error('Client settings not loaded');
  }

  // Format conversation for analysis
  const conversationText = state.messages
    .slice(-10)
    .map(m => {
      const role = m._getType() === 'human' ? 'Customer' : 'Agent';
      return `${role}: ${m.content}`;
    })
    .join('\n');

  const prompt = ANALYZE_AND_DECIDE_PROMPT
    .replace('{businessName}', clientSettings.businessName)
    .replace('{services}', clientSettings.services.join(', '))
    .replace('{primaryGoal}', clientSettings.primaryGoal)
    .replace('{aggressiveness}', String(clientSettings.bookingAggressiveness))
    .replace('{canDiscussPricing}', clientSettings.canDiscussPricing ? 'Yes' : 'No')
    .replace('{canSchedule}', clientSettings.canScheduleAppointments ? 'Yes' : 'No')
    .replace('{bookingAttempts}', String(state.bookingAttempts))
    .replace(/{maxBookingAttempts}/g, String(clientSettings.maxBookingAttempts))
    .replace('{objections}', state.objections.join(', ') || 'None')
    .replace('{lastAction}', state.lastAction || 'None')
    .replace('{conversation}', conversationText);

  // Use model routing based on existing signals from prior turns.
  // First message has no prior signals so defaults to fast.
  // decisionConfidence set to 75 (neutral) since this node produces that value.
  const effectiveLeadScore = Math.round(
    (state.signals.urgency + state.signals.budget + state.signals.intent) / 3
  );
  const routing = selectModelTier({
    leadScore: effectiveLeadScore,
    signals: state.signals,
    decisionConfidence: 75,
  });

  const ai = getAIProvider();
  const { data: response } = await ai.chatStructured(
    [
      { role: 'user', content: 'Analyze the conversation and decide the best action.' },
    ],
    analyzeAndDecideSchema,
    {
      systemPrompt: prompt,
      temperature: 0.2,
      model: routing.tier,
    },
  );

  // Safety net: if escalation is needed but action isn't escalate, override
  const action: AgentAction = response.escalationNeeded && response.action !== 'escalate'
    ? 'escalate'
    : response.action as AgentAction;

  // Build state update with analysis results
  const stateUpdate: Partial<ConversationStateType> = {
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
      ? (response.escalationReason as EscalationReason ?? 'other')
      : null,
    lastAction: action,
    decisionReasoning: response.reasoning,
    decisionConfidence: response.confidence,
  };

  // Handle wait action
  if (action === 'wait' && response.waitDurationMinutes) {
    const waitUntil = new Date();
    waitUntil.setMinutes(waitUntil.getMinutes() + response.waitDurationMinutes);
    stateUpdate.shouldWait = true;
    stateUpdate.waitUntil = waitUntil;
  }

  // Handle booking attempt
  if (action === 'book_appointment') {
    stateUpdate.bookingAttempts = state.bookingAttempts + 1;
  }

  // Handle flow trigger
  if (action === 'trigger_flow' && response.flowToTrigger) {
    stateUpdate.flowToTrigger = response.flowToTrigger;
  }

  return stateUpdate;
}
