import { describe, it, expect } from 'vitest';
import { routeAfterDecision, handleEscalation, handleClose } from './graph';
import type { ConversationStateType } from './state';
import type { AgentAction } from '@/lib/types/agent';

function makeState(overrides: Partial<ConversationStateType> = {}): ConversationStateType {
  return {
    leadId: 'lead-1',
    clientId: 'client-1',
    messages: [],
    stage: 'qualifying',
    signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' },
    extractedInfo: {},
    objections: [],
    bookingAttempts: 0,
    lastAction: null,
    responseToSend: null,
    flowToTrigger: null,
    needsEscalation: false,
    escalationReason: null,
    shouldWait: false,
    waitUntil: null,
    clientSettings: null,
    knowledgeContext: null,
    guardrailText: null,
    decisionReasoning: null,
    decisionConfidence: 80,
    ...overrides,
  };
}

describe('routeAfterDecision', () => {
  describe('routes to respond node', () => {
    const responseActions: AgentAction[] = ['respond', 'book_appointment', 'send_quote', 'request_photos'];

    for (const action of responseActions) {
      it(`routes "${action}" to respond`, () => {
        expect(routeAfterDecision(makeState({ lastAction: action }))).toBe('respond');
      });
    }
  });

  describe('routes to specialized handlers', () => {
    it('routes "wait" to end (no response)', () => {
      expect(routeAfterDecision(makeState({ lastAction: 'wait' }))).toBe('end');
    });

    it('routes "escalate" to escalate handler', () => {
      expect(routeAfterDecision(makeState({ lastAction: 'escalate' }))).toBe('escalate');
    });

    it('routes "trigger_flow" to flow handler', () => {
      expect(routeAfterDecision(makeState({ lastAction: 'trigger_flow' }))).toBe('trigger_flow');
    });

    it('routes "send_payment" to payment handler', () => {
      expect(routeAfterDecision(makeState({ lastAction: 'send_payment' }))).toBe('send_payment');
    });
  });

  describe('routes close actions', () => {
    it('routes "close_won" to close handler', () => {
      expect(routeAfterDecision(makeState({ lastAction: 'close_won' }))).toBe('close');
    });

    it('routes "close_lost" to close handler', () => {
      expect(routeAfterDecision(makeState({ lastAction: 'close_lost' }))).toBe('close');
    });
  });

  describe('fallback', () => {
    it('routes null action to end', () => {
      expect(routeAfterDecision(makeState({ lastAction: null }))).toBe('end');
    });
  });
});

describe('handleEscalation', () => {
  it('marks for escalation and sets stage', async () => {
    const result = await handleEscalation(makeState({ stage: 'hot' }));
    expect(result.needsEscalation).toBe(true);
    expect(result.stage).toBe('escalated');
  });
});

describe('handleClose', () => {
  it('sets stage to booked for close_won', async () => {
    const result = await handleClose(makeState({ lastAction: 'close_won' }));
    expect(result.stage).toBe('booked');
  });

  it('sets stage to lost for close_lost', async () => {
    const result = await handleClose(makeState({ lastAction: 'close_lost' }));
    expect(result.stage).toBe('lost');
  });
});
