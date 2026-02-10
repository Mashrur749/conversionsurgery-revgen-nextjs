import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import type { ConversationStateType } from '../state';

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
});

const RESPONSE_PROMPT = `You are {agentName}, a friendly {agentTone} assistant for {businessName}.
Your job is to help customers with their home service needs.

SERVICES WE OFFER:
{services}

YOUR GOAL: {primaryGoal}

RULES:
1. Keep responses under {maxLength} characters
2. Be {agentTone} but professional
3. {pricingRule}
4. {schedulingRule}
5. Always be helpful and move toward booking
6. If you don't know something, offer to have a team member follow up
7. Don't make promises about timing or pricing without certainty
8. Acknowledge their concerns if they have objections

CURRENT CONTEXT:
- Customer Stage: {stage}
- Customer Sentiment: {sentiment}
- Their Project: {projectInfo}
- Objections to Address: {objections}

KNOWLEDGE CONTEXT (if relevant):
{knowledgeContext}

RECENT CONVERSATION:
{conversation}

STRATEGY FOR THIS RESPONSE:
{strategy}

Generate a response that follows the strategy and moves toward {primaryGoal}.
DO NOT include any prefix like "Agent:" - just write the message text.`;

export async function generateResponse(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Skip if action isn't 'respond' or 'book_appointment'
  if (!['respond', 'book_appointment', 'send_quote', 'request_photos'].includes(state.lastAction || '')) {
    return {};
  }

  const clientSettings = state.clientSettings;
  if (!clientSettings) {
    throw new Error('Client settings not loaded');
  }

  // Determine response strategy based on action
  let strategy = 'Answer their question helpfully.';
  switch (state.lastAction) {
    case 'book_appointment':
      strategy = 'Guide them toward scheduling an appointment. Ask for their availability or offer specific times.';
      break;
    case 'send_quote':
      strategy = 'Acknowledge their request for pricing and explain next steps (site visit, more details needed, etc).';
      break;
    case 'request_photos':
      strategy = 'Ask them to send photos of their project so we can give an accurate estimate.';
      break;
  }

  // Add objection handling to strategy if needed
  if (state.objections.length > 0 && state.signals.sentiment !== 'positive') {
    strategy += ` Also address their concern about: ${state.objections[state.objections.length - 1]}`;
  }

  // Format conversation
  const conversationText = state.messages
    .slice(-8)
    .map(m => {
      const role = m._getType() === 'human' ? 'Customer' : 'Agent';
      return `${role}: ${m.content}`;
    })
    .join('\n');

  // Format project info
  const projectInfo = state.extractedInfo.projectType
    ? `${state.extractedInfo.projectType} (${state.extractedInfo.projectSize || 'size unknown'})`
    : 'Not yet specified';

  const prompt = RESPONSE_PROMPT
    .replace('{agentName}', clientSettings.agentName)
    .replace(/{agentTone}/g, clientSettings.agentTone)
    .replace('{businessName}', clientSettings.businessName)
    .replace('{services}', clientSettings.services.join(', '))
    .replace(/{primaryGoal}/g, clientSettings.primaryGoal === 'book_appointment' ? 'book an appointment' : clientSettings.primaryGoal)
    .replace('{maxLength}', String(clientSettings.maxResponseLength))
    .replace('{pricingRule}', clientSettings.canDiscussPricing
      ? 'You can discuss general pricing ranges'
      : 'DO NOT discuss specific pricing - offer to have someone follow up with a quote')
    .replace('{schedulingRule}', clientSettings.canScheduleAppointments
      ? 'You can offer to schedule appointments'
      : 'Offer to have someone call them to schedule')
    .replace('{stage}', state.stage)
    .replace('{sentiment}', state.signals.sentiment)
    .replace('{projectInfo}', projectInfo)
    .replace('{objections}', state.objections.join(', ') || 'None')
    .replace('{knowledgeContext}', state.knowledgeContext || 'No specific knowledge context')
    .replace('{conversation}', conversationText)
    .replace('{strategy}', strategy);

  const response = await model.invoke([
    new SystemMessage(prompt),
    new HumanMessage('Generate the response message.'),
  ]);

  let responseText = response.content as string;

  // Trim to max length if needed
  if (responseText.length > clientSettings.maxResponseLength) {
    responseText = responseText.substring(0, clientSettings.maxResponseLength - 3) + '...';
  }

  return {
    responseToSend: responseText,
    messages: [new AIMessage(responseText)],
  };
}
