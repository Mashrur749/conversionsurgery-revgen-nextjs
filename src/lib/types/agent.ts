import type {
  LeadContext,
  NewLeadContext,
  AgentDecision,
  NewAgentDecision,
  EscalationQueueItem,
  NewEscalationQueueItem,
  EscalationRule,
  NewEscalationRule,
  ConversationCheckpoint,
  NewConversationCheckpoint,
  ClientAgentSettings,
  NewClientAgentSettings,
} from '@/db/schema';

// Re-export schema-inferred types
export type {
  LeadContext,
  NewLeadContext,
  AgentDecision,
  NewAgentDecision,
  EscalationQueueItem,
  NewEscalationQueueItem,
  EscalationRule,
  NewEscalationRule,
  ConversationCheckpoint,
  NewConversationCheckpoint,
  ClientAgentSettings,
  NewClientAgentSettings,
};

// Lead stage type
export type LeadStage =
  | 'new'
  | 'qualifying'
  | 'nurturing'
  | 'hot'
  | 'objection'
  | 'escalated'
  | 'booked'
  | 'lost';

// Agent action type
export type AgentAction =
  | 'respond'
  | 'wait'
  | 'trigger_flow'
  | 'escalate'
  | 'book_appointment'
  | 'send_quote'
  | 'request_photos'
  | 'send_payment'
  | 'close_won'
  | 'close_lost';

// Escalation reason type
export type EscalationReason =
  | 'explicit_request'
  | 'frustrated_sentiment'
  | 'legal_threat'
  | 'repeated_objection'
  | 'complex_technical'
  | 'high_value_lead'
  | 'negative_review_threat'
  | 'pricing_negotiation'
  | 'complaint'
  | 'emergency'
  | 'other';

// Signal scores interface
export interface LeadSignals {
  urgency: number; // 0-100
  budget: number; // 0-100
  intent: number; // 0-100
  sentiment: 'positive' | 'neutral' | 'negative' | 'frustrated';
}

// Lead state for LangGraph
export interface LeadState {
  leadId: string;
  clientId: string;
  stage: LeadStage;
  signals: LeadSignals;
  conversationHistory: Array<{
    role: 'lead' | 'agent' | 'human';
    content: string;
    timestamp: string;
  }>;
  objections: string[];
  extractedInfo: Record<string, unknown>;
  bookingAttempts: number;
  lastAction: AgentAction | null;
  humanNeededReason?: EscalationReason;
}
