# Phase 37: Conversation Agent Core (LangGraph)

## Prerequisites
- Phase 36 (Conversation Agent Schema) complete
- Phase 25 (Knowledge AI Integration) complete
- Phase 29 (Lead Scoring) complete

## Goal
Build the intelligent conversation agent using LangGraph that:
1. Maintains state across conversations
2. Detects signals (urgency, budget, sentiment)
3. Decides optimal actions
4. Persists toward booking goal
5. Knows when to escalate to humans

---

## Step 1: Install Dependencies

```bash
npm install @langchain/core @langchain/langgraph @langchain/openai langsmith zod
```

Add to `package.json`:
```json
{
  "dependencies": {
    "@langchain/core": "^0.3.x",
    "@langchain/langgraph": "^0.2.x",
    "@langchain/openai": "^0.3.x",
    "langsmith": "^0.2.x"
  }
}
```

---

## Step 2: Create State Definition

**CREATE** `src/lib/agent/state.ts`:

```typescript
import { Annotation, messagesStateReducer } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';
import type { LeadStage, AgentAction, EscalationReason, LeadSignals } from '@/lib/types/agent';

/**
 * LangGraph state annotation for conversation agent
 */
export const ConversationState = Annotation.Root({
  // Core identifiers
  leadId: Annotation<string>(),
  clientId: Annotation<string>(),
  
  // Conversation messages (LangChain format)
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
  
  // Lead journey stage
  stage: Annotation<LeadStage>({
    reducer: (current, update) => update ?? current,
    default: () => 'new',
  }),
  
  // Signal scores (0-100)
  signals: Annotation<LeadSignals>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({
      urgency: 50,
      budget: 50,
      intent: 50,
      sentiment: 'neutral' as const,
    }),
  }),
  
  // Extracted information
  extractedInfo: Annotation<Record<string, any>>({
    reducer: (current, update) => ({ ...current, ...update }),
    default: () => ({}),
  }),
  
  // Objections raised
  objections: Annotation<string[]>({
    reducer: (current, update) => [...new Set([...current, ...update])],
    default: () => [],
  }),
  
  // Booking attempts counter
  bookingAttempts: Annotation<number>({
    reducer: (current, update) => update,
    default: () => 0,
  }),
  
  // Last action taken
  lastAction: Annotation<AgentAction | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
  
  // Response to send (if any)
  responseToSend: Annotation<string | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
  
  // Flow to trigger (if any)
  flowToTrigger: Annotation<string | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
  
  // Escalation needed
  needsEscalation: Annotation<boolean>({
    reducer: (current, update) => update,
    default: () => false,
  }),
  escalationReason: Annotation<EscalationReason | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
  
  // Should we wait before responding?
  shouldWait: Annotation<boolean>({
    reducer: (current, update) => update,
    default: () => false,
  }),
  waitUntil: Annotation<Date | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
  
  // Client settings (injected at runtime)
  clientSettings: Annotation<{
    businessName: string;
    services: string[];
    agentName: string;
    agentTone: string;
    maxResponseLength: number;
    primaryGoal: string;
    bookingAggressiveness: number;
    maxBookingAttempts: number;
    canDiscussPricing: boolean;
    canScheduleAppointments: boolean;
  } | null>({
    reducer: (current, update) => update ?? current,
    default: () => null,
  }),
  
  // Knowledge context (from RAG)
  knowledgeContext: Annotation<string | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
  
  // Decision reasoning (for logging)
  decisionReasoning: Annotation<string | null>({
    reducer: (current, update) => update,
    default: () => null,
  }),
});

export type ConversationStateType = typeof ConversationState.State;
```

---

## Step 3: Create Analysis Node

**CREATE** `src/lib/agent/nodes/analyze.ts`:

```typescript
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
```

---

## Step 4: Create Decision Node

**CREATE** `src/lib/agent/nodes/decide.ts`:

```typescript
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
```

---

## Step 5: Create Response Generation Node

**CREATE** `src/lib/agent/nodes/respond.ts`:

```typescript
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
    .replace('{agentTone}', clientSettings.agentTone)
    .replace('{businessName}', clientSettings.businessName)
    .replace('{services}', clientSettings.services.join(', '))
    .replace('{primaryGoal}', clientSettings.primaryGoal === 'book_appointment' ? 'book an appointment' : clientSettings.primaryGoal)
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
```

---

## Step 6: Create Graph Builder

**CREATE** `src/lib/agent/graph.ts`:

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { ConversationState, ConversationStateType } from './state';
import { analyzeConversation } from './nodes/analyze';
import { decideAction } from './nodes/decide';
import { generateResponse } from './nodes/respond';

/**
 * Route after analysis - check if escalation needed
 */
function routeAfterAnalysis(state: ConversationStateType): string {
  if (state.needsEscalation) {
    return 'escalate';
  }
  return 'decide';
}

/**
 * Route after decision - what to do next
 */
function routeAfterDecision(state: ConversationStateType): string {
  switch (state.lastAction) {
    case 'respond':
    case 'book_appointment':
    case 'send_quote':
    case 'request_photos':
      return 'respond';
    
    case 'wait':
      return 'end'; // Don't respond, just wait
    
    case 'escalate':
      return 'escalate';
    
    case 'trigger_flow':
      return 'trigger_flow';
    
    case 'close_won':
    case 'close_lost':
      return 'close';
    
    case 'send_payment':
      return 'send_payment';
    
    default:
      return 'end';
  }
}

/**
 * Escalation handler node
 */
async function handleEscalation(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Just mark for escalation - actual queue insertion happens in orchestrator
  return {
    needsEscalation: true,
    stage: 'escalated',
  };
}

/**
 * Flow trigger handler node
 */
async function handleTriggerFlow(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Flow trigger is handled by orchestrator
  return {};
}

/**
 * Close handler node
 */
async function handleClose(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  const newStage = state.lastAction === 'close_won' ? 'booked' : 'lost';
  return {
    stage: newStage,
  };
}

/**
 * Payment link handler node
 */
async function handleSendPayment(
  state: ConversationStateType
): Promise<Partial<ConversationStateType>> {
  // Payment link sending is handled by orchestrator
  return {};
}

/**
 * Build the conversation agent graph
 */
export function buildConversationGraph() {
  const graph = new StateGraph(ConversationState)
    // Add nodes
    .addNode('analyze', analyzeConversation)
    .addNode('decide', decideAction)
    .addNode('respond', generateResponse)
    .addNode('escalate', handleEscalation)
    .addNode('trigger_flow', handleTriggerFlow)
    .addNode('close', handleClose)
    .addNode('send_payment', handleSendPayment)
    
    // Set entry point
    .addEdge('__start__', 'analyze')
    
    // Route after analysis
    .addConditionalEdges('analyze', routeAfterAnalysis, {
      decide: 'decide',
      escalate: 'escalate',
    })
    
    // Route after decision
    .addConditionalEdges('decide', routeAfterDecision, {
      respond: 'respond',
      escalate: 'escalate',
      trigger_flow: 'trigger_flow',
      close: 'close',
      send_payment: 'send_payment',
      end: END,
    })
    
    // Terminal edges
    .addEdge('respond', END)
    .addEdge('escalate', END)
    .addEdge('trigger_flow', END)
    .addEdge('close', END)
    .addEdge('send_payment', END);
  
  return graph.compile();
}

// Export singleton instance
export const conversationAgent = buildConversationGraph();
```

---

## Step 7: Create Orchestrator Service

**CREATE** `src/lib/agent/orchestrator.ts`:

```typescript
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { conversationAgent } from './graph';
import { ConversationStateType } from './state';
import { db } from '@/lib/db';
import { 
  leadContext, 
  agentDecisions, 
  escalationQueue,
  clientAgentSettings,
  messages,
  leads,
  clients,
} from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { sendSMS } from '@/lib/clients/twilio-tracked';
import { trackUsage } from '@/lib/services/usage-tracking';
import { triggerFlow } from '@/lib/services/flow-executor';
import { retrieveKnowledge } from '@/lib/services/knowledge-retrieval';
import type { AgentAction, EscalationReason } from '@/lib/types/agent';

interface ProcessMessageResult {
  action: AgentAction;
  responseSent: boolean;
  responseText?: string;
  escalated: boolean;
  flowTriggered?: string;
  newStage: string;
}

/**
 * Main entry point for processing incoming messages
 */
export async function processIncomingMessage(
  leadId: string,
  messageId: string,
  messageText: string
): Promise<ProcessMessageResult> {
  const startTime = Date.now();
  
  // Load lead and client data
  const [lead] = await db.select().from(leads).where(eq(leads.id, leadId)).limit(1);
  if (!lead) throw new Error(`Lead not found: ${leadId}`);
  
  const [client] = await db.select().from(clients).where(eq(clients.id, lead.clientId)).limit(1);
  if (!client) throw new Error(`Client not found: ${lead.clientId}`);
  
  // Load agent settings
  const [settings] = await db
    .select()
    .from(clientAgentSettings)
    .where(eq(clientAgentSettings.clientId, client.id))
    .limit(1);
  
  // Load or create lead context
  let [context] = await db
    .select()
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);
  
  if (!context) {
    [context] = await db.insert(leadContext).values({
      leadId,
      clientId: client.id,
      stage: 'new',
    }).returning();
  }
  
  // Load conversation history
  const conversationHistory = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .orderBy(desc(messages.createdAt))
    .limit(20);
  
  // Convert to LangChain messages
  const langChainMessages = conversationHistory
    .reverse()
    .map(m => {
      if (m.direction === 'inbound') {
        return new HumanMessage(m.body);
      } else {
        return new AIMessage(m.body);
      }
    });
  
  // Add the new message
  langChainMessages.push(new HumanMessage(messageText));
  
  // Retrieve relevant knowledge
  const knowledge = await retrieveKnowledge(client.id, messageText);
  
  // Build initial state
  const initialState: Partial<ConversationStateType> = {
    leadId,
    clientId: client.id,
    messages: langChainMessages,
    stage: context.stage as any,
    signals: {
      urgency: context.urgencyScore || 50,
      budget: context.budgetScore || 50,
      intent: context.intentScore || 50,
      sentiment: (context.currentSentiment as any) || 'neutral',
    },
    extractedInfo: {
      projectType: context.projectType,
      projectSize: context.projectSize,
      estimatedValue: context.estimatedValue,
      preferredTimeframe: context.preferredTimeframe,
    },
    objections: (context.objections as any[])?.map(o => o.detail) || [],
    bookingAttempts: context.bookingAttempts || 0,
    clientSettings: {
      businessName: client.businessName,
      services: (client.metadata as any)?.services || [],
      agentName: settings?.agentName || 'Assistant',
      agentTone: settings?.agentTone || 'professional',
      maxResponseLength: settings?.maxResponseLength || 300,
      primaryGoal: settings?.primaryGoal || 'book_appointment',
      bookingAggressiveness: settings?.bookingAggressiveness || 5,
      maxBookingAttempts: settings?.maxBookingAttempts || 3,
      canDiscussPricing: settings?.canDiscussPricing || false,
      canScheduleAppointments: settings?.canScheduleAppointments || true,
    },
    knowledgeContext: knowledge,
  };
  
  // Run the agent graph
  const finalState = await conversationAgent.invoke(initialState);
  
  const processingTime = Date.now() - startTime;
  
  // Log the decision
  await db.insert(agentDecisions).values({
    leadId,
    clientId: client.id,
    messageId,
    triggerType: 'inbound_message',
    stageAtDecision: context.stage,
    contextSnapshot: {
      urgencyScore: finalState.signals.urgency,
      budgetScore: finalState.signals.budget,
      intentScore: finalState.signals.intent,
      sentiment: finalState.signals.sentiment,
      recentObjections: finalState.objections.slice(-3),
    },
    action: finalState.lastAction!,
    actionDetails: {
      responseText: finalState.responseToSend,
      flowId: finalState.flowToTrigger,
      escalationReason: finalState.escalationReason,
    },
    reasoning: finalState.decisionReasoning,
    confidence: 80, // TODO: Get from decision node
    processingTimeMs: processingTime,
  });
  
  // Update lead context
  await db.update(leadContext).set({
    stage: finalState.stage,
    urgencyScore: finalState.signals.urgency,
    budgetScore: finalState.signals.budget,
    intentScore: finalState.signals.intent,
    currentSentiment: finalState.signals.sentiment,
    projectType: finalState.extractedInfo.projectType,
    projectSize: finalState.extractedInfo.projectSize,
    estimatedValue: finalState.extractedInfo.estimatedValue,
    preferredTimeframe: finalState.extractedInfo.preferredTimeframe,
    bookingAttempts: finalState.bookingAttempts,
    totalMessages: (context.totalMessages || 0) + 1,
    leadMessages: (context.leadMessages || 0) + 1,
    updatedAt: new Date(),
  }).where(eq(leadContext.id, context.id));
  
  // Track AI usage
  await trackUsage({
    clientId: client.id,
    service: 'openai',
    operation: 'conversation_agent',
    leadId,
    metadata: {
      action: finalState.lastAction,
      processingTimeMs: processingTime,
    },
  });
  
  // Execute action
  let responseSent = false;
  let escalated = false;
  
  // Handle response
  if (finalState.responseToSend && !finalState.needsEscalation) {
    await sendSMS({
      clientId: client.id,
      to: lead.phone,
      from: client.twilioPhoneNumber!,
      body: finalState.responseToSend,
      leadId,
    });
    
    // Save outbound message
    await db.insert(messages).values({
      leadId,
      clientId: client.id,
      direction: 'outbound',
      body: finalState.responseToSend,
      status: 'sent',
    });
    
    responseSent = true;
  }
  
  // Handle escalation
  if (finalState.needsEscalation) {
    await db.insert(escalationQueue).values({
      leadId,
      clientId: client.id,
      reason: finalState.escalationReason as EscalationReason,
      reasonDetails: finalState.decisionReasoning,
      triggerMessageId: messageId,
      priority: finalState.signals.sentiment === 'frustrated' ? 1 : 2,
      conversationSummary: context.conversationSummary,
    });
    
    escalated = true;
  }
  
  // Handle flow trigger
  if (finalState.flowToTrigger) {
    await triggerFlow(finalState.flowToTrigger, leadId);
  }
  
  return {
    action: finalState.lastAction!,
    responseSent,
    responseText: finalState.responseToSend || undefined,
    escalated,
    flowTriggered: finalState.flowToTrigger || undefined,
    newStage: finalState.stage,
  };
}

/**
 * Process a scheduled check (for leads that haven't responded)
 */
export async function processScheduledCheck(leadId: string): Promise<ProcessMessageResult | null> {
  // Load context
  const [context] = await db
    .select()
    .from(leadContext)
    .where(eq(leadContext.leadId, leadId))
    .limit(1);
  
  if (!context) return null;
  
  // Check if we should wait longer
  if (context.stage === 'escalated' || context.stage === 'booked' || context.stage === 'lost') {
    return null;
  }
  
  // Get last message time
  const [lastMessage] = await db
    .select()
    .from(messages)
    .where(eq(messages.leadId, leadId))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  
  if (!lastMessage) return null;
  
  // If last message was from us and they haven't replied in 24 hours, trigger nurture flow
  const hoursSinceLastMessage = (Date.now() - lastMessage.createdAt!.getTime()) / (1000 * 60 * 60);
  
  if (lastMessage.direction === 'outbound' && hoursSinceLastMessage > 24) {
    // Trigger nurture flow
    // This would be handled by the flow system
    return {
      action: 'trigger_flow',
      responseSent: false,
      escalated: false,
      flowTriggered: 'nurture',
      newStage: context.stage,
    };
  }
  
  return null;
}
```

---

## Step 8: Integrate with Webhook

**MODIFY** `src/app/api/webhooks/twilio/incoming/route.ts`:

```typescript
import { processIncomingMessage } from '@/lib/agent/orchestrator';

// Inside the webhook handler, after saving the inbound message:

// Check if AI auto-respond is enabled
const [settings] = await db
  .select()
  .from(clientAgentSettings)
  .where(eq(clientAgentSettings.clientId, client.id))
  .limit(1);

if (settings?.autoRespond !== false) {
  // Process with conversation agent
  const result = await processIncomingMessage(
    lead.id,
    savedMessage.id,
    incomingBody
  );
  
  console.log('Agent result:', result);
}
```

---

## Step 9: Create Scheduled Check Cron

**CREATE** `src/app/api/cron/agent-check/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { leadContext, messages } from '@/lib/db/schema';
import { eq, and, lt, notInArray } from 'drizzle-orm';
import { processScheduledCheck } from '@/lib/agent/orchestrator';

export async function GET() {
  // Find leads that might need follow-up
  const staleLeads = await db
    .select({ leadId: leadContext.leadId })
    .from(leadContext)
    .where(and(
      notInArray(leadContext.stage, ['booked', 'lost', 'escalated']),
      lt(leadContext.updatedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Not updated in 24h
    ))
    .limit(50);
  
  let processed = 0;
  
  for (const { leadId } of staleLeads) {
    try {
      const result = await processScheduledCheck(leadId);
      if (result) processed++;
    } catch (error) {
      console.error(`Error processing lead ${leadId}:`, error);
    }
  }
  
  return NextResponse.json({ processed });
}
```

---

## Environment Variables

```bash
# LangSmith (optional, for tracing)
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your_langsmith_key
LANGCHAIN_PROJECT=conversionsurgery
```

---

## Files Created

| File | Purpose |
|------|---------|
| `src/lib/agent/state.ts` | LangGraph state definition |
| `src/lib/agent/nodes/analyze.ts` | Conversation analysis node |
| `src/lib/agent/nodes/decide.ts` | Action decision node |
| `src/lib/agent/nodes/respond.ts` | Response generation node |
| `src/lib/agent/graph.ts` | Graph builder and compiler |
| `src/lib/agent/orchestrator.ts` | Main orchestration service |
| `src/app/api/cron/agent-check/route.ts` | Scheduled check cron |

---

## Verification

```bash
# 1. Install dependencies
npm install @langchain/core @langchain/langgraph @langchain/openai

# 2. Test the graph
npx ts-node -e "
  const { buildConversationGraph } = require('./src/lib/agent/graph');
  const graph = buildConversationGraph();
  console.log('Graph compiled successfully');
"

# 3. Send test message and check agent decisions table
SELECT * FROM agent_decisions ORDER BY created_at DESC LIMIT 5;

# 4. Check lead context updates
SELECT * FROM lead_context WHERE lead_id = 'xxx';
```

---

## Success Criteria
- [ ] Agent analyzes incoming messages for signals
- [ ] Agent decides appropriate action based on context
- [ ] Agent generates contextual responses
- [ ] Escalation triggers correctly for frustration/threats
- [ ] Booking attempts tracked and limited
- [ ] Agent decisions logged for review
- [ ] Lead context updated after each interaction
- [ ] Knowledge retrieval integrated into responses
