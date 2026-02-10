import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import type { ConversationStateType } from '../state';
import type { AgentAction } from '@/lib/types/agent';

const decisionSchema = z.object({
  action: z.enum([
    'respond', 'wait', 'trigger_flow', 'escalate',
    'book_appointment', 'send_quote', 'request_photos',
    'send_payment', 'close_won', 'close_lost'
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

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.3,
}).withStructuredOutput(decisionSchema);

const DECISION_PROMPT = `You are the decision engine for an AI assistant helping a home services contractor.
Your job is to decide the BEST action to take based on the conversation state.

Business: {businessName}
Primary Goal: {primaryGoal}
Booking Aggressiveness: {aggressiveness}/10
Can Discuss Pricing: {canDiscussPricing}
Can Schedule Appointments: {canSchedule}

CURRENT STATE:
- Stage: {stage}
- Sentiment: {sentiment}
- Urgency: {urgency}/100
- Budget: {budget}/100
- Intent: {intent}/100
- Booking Attempts So Far: {bookingAttempts}
- Max Booking Attempts: {maxBookingAttempts}
- Objections: {objections}
- Last Action: {lastAction}

RECENT CONVERSATION:
{conversation}

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

What action should we take?`;

export async function decideAction(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  const clientSettings = state.clientSettings;

  if (!clientSettings) {
    throw new Error('Client settings not loaded');
  }

  // If escalation was flagged in analysis, confirm it
  if (state.needsEscalation) {
    return {
      lastAction: 'escalate',
      decisionReasoning: `Escalation needed: ${state.escalationReason}`,
    };
  }

  // Format conversation
  const conversationText = state.messages
    .slice(-10)
    .map(m => {
      const role = m._getType() === 'human' ? 'Customer' : 'Agent';
      return `${role}: ${m.content}`;
    })
    .join('\n');

  const prompt = DECISION_PROMPT
    .replace('{businessName}', clientSettings.businessName)
    .replace('{primaryGoal}', clientSettings.primaryGoal)
    .replace('{aggressiveness}', String(clientSettings.bookingAggressiveness))
    .replace('{canDiscussPricing}', clientSettings.canDiscussPricing ? 'Yes' : 'No')
    .replace('{canSchedule}', clientSettings.canScheduleAppointments ? 'Yes' : 'No')
    .replace('{stage}', state.stage)
    .replace('{sentiment}', state.signals.sentiment)
    .replace('{urgency}', String(state.signals.urgency))
    .replace('{budget}', String(state.signals.budget))
    .replace('{intent}', String(state.signals.intent))
    .replace('{bookingAttempts}', String(state.bookingAttempts))
    .replace('{maxBookingAttempts}', String(clientSettings.maxBookingAttempts))
    .replace('{objections}', state.objections.join(', ') || 'None')
    .replace('{lastAction}', state.lastAction || 'None')
    .replace('{conversation}', conversationText);

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage('Decide the best action to take.'),
  ]);

  const action = response.action as AgentAction;

  // Handle wait action
  if (action === 'wait' && response.waitDurationMinutes) {
    const waitUntil = new Date();
    waitUntil.setMinutes(waitUntil.getMinutes() + response.waitDurationMinutes);

    return {
      lastAction: action,
      shouldWait: true,
      waitUntil,
      decisionReasoning: response.reasoning,
    };
  }

  // Handle booking attempt
  if (action === 'book_appointment') {
    return {
      lastAction: action,
      bookingAttempts: state.bookingAttempts + 1,
      decisionReasoning: response.reasoning,
    };
  }

  // Handle flow trigger
  if (action === 'trigger_flow' && response.flowToTrigger) {
    return {
      lastAction: action,
      flowToTrigger: response.flowToTrigger,
      decisionReasoning: response.reasoning,
    };
  }

  return {
    lastAction: action,
    decisionReasoning: response.reasoning,
  };
}
