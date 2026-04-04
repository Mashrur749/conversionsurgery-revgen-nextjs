/**
 * Twilio ConversationRelay WebSocket message types.
 *
 * Inbound: messages FROM Twilio TO our server.
 * Outbound: messages FROM our server TO Twilio.
 */

// ── Inbound (Twilio → Server) ──────────────────────────────────────────

export interface CRSetupMessage {
  type: 'setup';
  sessionId: string;
  callSid: string;
  from: string;
  to: string;
  direction: string;
  callStatus: string;
  customParameters: Record<string, string>;
}

export interface CRPromptMessage {
  type: 'prompt';
  voicePrompt: string;
  lang?: string;
  last: boolean;
}

export interface CRInterruptMessage {
  type: 'interrupt';
  utteranceUntilInterrupt: string;
  durationUntilInterruptMs: number;
}

export interface CRDtmfMessage {
  type: 'dtmf';
  digit: string;
}

export interface CRErrorMessage {
  type: 'error';
  description: string;
}

export type CRInboundMessage =
  | CRSetupMessage
  | CRPromptMessage
  | CRInterruptMessage
  | CRDtmfMessage
  | CRErrorMessage;

// ── Outbound (Server → Twilio) ─────────────────────────────────────────

export interface CRTextMessage {
  type: 'text';
  token: string;
  last: boolean;
  lang?: string;
  interruptible?: boolean;
  preemptible?: boolean;
}

export interface CREndMessage {
  type: 'end';
  handoffData?: string;
}

export type CROutboundMessage = CRTextMessage | CREndMessage;

// ── Session State ───────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolResultMessage {
  role: 'user';
  content: Array<{
    type: 'tool_result';
    tool_use_id: string;
    content: string;
  }>;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface SessionContext {
  callSid: string;
  clientId: string;
  leadId: string;

  // Loaded on setup
  businessName: string;
  ownerName: string;
  ownerPhone: string | null;
  greeting: string;
  agentTone: 'professional' | 'friendly' | 'casual';
  canDiscussPricing: boolean;
  knowledgeContext: string;
  timezone: string;

  // Conversation state
  conversationHistory: Array<ConversationMessage | ToolResultMessage | { role: 'assistant'; content: Array<{ type: 'text'; text: string } | ToolUseBlock> }>;
  fullTranscript: string;
  detectedIntent: string | null;
  callbackRequested: boolean;
}

// ── Environment ─────────────────────────────────────────────────────────

export interface Env {
  VOICE_SESSION: DurableObjectNamespace;
  ANTHROPIC_API_KEY: string;
  DATABASE_URL: string;
  ENVIRONMENT: string;
}

// ── Handoff Data (passed via ConversationRelay end → action URL) ────────

export interface HandoffData {
  reasonCode: 'live-agent-handoff' | 'callback-scheduled' | 'call-ended';
  reason: string;
  callSummary: string;
  transcript: string;
  callerIntent: string | null;
  callbackRequested: boolean;
  transferTo?: string;
  callerName?: string;
  projectType?: string;
}
