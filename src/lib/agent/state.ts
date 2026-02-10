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
