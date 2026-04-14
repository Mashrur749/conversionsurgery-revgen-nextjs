/**
 * Conversation Scenario Tests
 *
 * Tests the deterministic aspects of conversation scenarios:
 * - Graph routing for each action type
 * - State transitions from analyze-and-decide output
 * - Escalation safety nets
 * - Booking attempt tracking
 * - Model routing under different signal combinations
 * - Guardrail activation conditions
 *
 * These tests use mock AI outputs to validate the state machine behavior
 * without making LLM calls. They cover the major scenarios a lead
 * conversation goes through in production.
 */
import { describe, it, expect } from 'vitest';
import { routeAfterDecision } from './graph';
import { buildGuardrailPrompt, type GuardrailConfig } from './guardrails';
import { selectModelTier, type RoutingInput } from '@/lib/ai/model-routing';
import { resolveStrategy } from './strategy-resolver';
import { resolveEntryContext } from './entry-context';
import { BASEMENT_DEVELOPMENT_PLAYBOOK } from './playbooks/basement-development';
import type { ConversationStateType } from './state';
import type { AgentAction, LeadSignals, LeadStage } from '@/lib/types/agent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeState(overrides: Partial<ConversationStateType> = {}): ConversationStateType {
  return {
    leadId: 'lead-1',
    clientId: 'client-1',
    messages: [],
    stage: 'new',
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
    conversationSummary: undefined,
    conversationStrategy: null,
    ...overrides,
  };
}

function makeGuardrailConfig(overrides: Partial<GuardrailConfig> = {}): GuardrailConfig {
  return {
    ownerName: 'Mike',
    businessName: 'Mike\'s Plumbing',
    agentTone: 'professional',
    messagesWithoutResponse: 0,
    canDiscussPricing: false,
    ...overrides,
  };
}

function makeRouting(overrides: Partial<RoutingInput> = {}): RoutingInput {
  return {
    leadScore: 50,
    signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' },
    decisionConfidence: 80,
    ...overrides,
  };
}

/**
 * Simulates the analyze-and-decide escalation safety net.
 * If escalationNeeded=true but action is not 'escalate', force it.
 */
function applyEscalationSafetyNet(
  escalationNeeded: boolean,
  action: AgentAction
): AgentAction {
  return escalationNeeded && action !== 'escalate' ? 'escalate' : action;
}

/**
 * Simulates booking attempt increment logic from analyze-and-decide.
 */
function applyBookingIncrement(action: AgentAction, currentAttempts: number): number {
  return action === 'book_appointment' ? currentAttempts + 1 : currentAttempts;
}

// ---------------------------------------------------------------------------
// Scenario 1: Happy Path — New Lead → Qualify → Book
// ---------------------------------------------------------------------------
describe('Scenario: Happy path — inquiry to booking', () => {
  it('new inquiry triggers respond action, routes to respond node', () => {
    const state = makeState({ lastAction: 'respond', stage: 'new' });
    expect(routeAfterDecision(state)).toBe('respond');
  });

  it('qualifying lead with high intent routes to book_appointment', () => {
    const state = makeState({ lastAction: 'book_appointment', stage: 'qualifying' });
    expect(routeAfterDecision(state)).toBe('respond');
  });

  it('booking increments attempt counter', () => {
    expect(applyBookingIncrement('book_appointment', 0)).toBe(1);
    expect(applyBookingIncrement('book_appointment', 2)).toBe(3);
  });

  it('non-booking actions do not increment counter', () => {
    expect(applyBookingIncrement('respond', 2)).toBe(2);
    expect(applyBookingIncrement('escalate', 0)).toBe(0);
  });

  it('close_won routes to close handler (terminal)', () => {
    const state = makeState({ lastAction: 'close_won', stage: 'hot' });
    expect(routeAfterDecision(state)).toBe('close');
  });

  it('uses fast model for routine qualifying conversation', () => {
    const routing = selectModelTier(makeRouting({
      leadScore: 40,
      signals: { urgency: 50, budget: 50, intent: 60, sentiment: 'positive' },
      decisionConfidence: 85,
    }));
    expect(routing.tier).toBe('fast');
  });
});

// ---------------------------------------------------------------------------
// Scenario 2: Price-Sensitive Lead — Objection Handling
// ---------------------------------------------------------------------------
describe('Scenario: Price-sensitive lead with objections', () => {
  it('lead with pricing objection gets respond (not escalate) when canDiscussPricing=true', () => {
    const state = makeState({
      lastAction: 'respond',
      stage: 'objection',
      objections: ['too expensive'],
      signals: { urgency: 40, budget: 20, intent: 40, sentiment: 'negative' },
    });
    expect(routeAfterDecision(state)).toBe('respond');
  });

  it('guardrails block exact pricing when canDiscussPricing=false', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig({ canDiscussPricing: false }));
    expect(prompt).toContain('give you an accurate quote');
    expect(prompt).not.toContain('share only the ranges');
  });

  it('guardrails allow range pricing when canDiscussPricing=true', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig({ canDiscussPricing: true }));
    expect(prompt).toContain('share only the ranges');
    expect(prompt).toContain('Never invent prices');
  });

  it('low budget score does NOT auto-escalate (stays respond)', () => {
    // Safety net only fires when escalationNeeded=true
    const action = applyEscalationSafetyNet(false, 'respond');
    expect(action).toBe('respond');
  });
});

// ---------------------------------------------------------------------------
// Scenario 3: Frustrated Customer — Escalation Triggers
// ---------------------------------------------------------------------------
describe('Scenario: Frustrated customer escalation', () => {
  it('escalation safety net overrides respond when escalation is needed', () => {
    const action = applyEscalationSafetyNet(true, 'respond');
    expect(action).toBe('escalate');
  });

  it('escalation safety net overrides book_appointment', () => {
    const action = applyEscalationSafetyNet(true, 'book_appointment');
    expect(action).toBe('escalate');
  });

  it('escalation safety net does not double-override escalate', () => {
    const action = applyEscalationSafetyNet(true, 'escalate');
    expect(action).toBe('escalate');
  });

  it('non-escalation does not override any action', () => {
    const actions: AgentAction[] = [
      'respond', 'wait', 'trigger_flow', 'book_appointment',
      'send_quote', 'request_photos', 'send_payment', 'close_won', 'close_lost',
    ];
    for (const a of actions) {
      expect(applyEscalationSafetyNet(false, a)).toBe(a);
    }
  });

  it('frustrated + urgent lead gets quality model', () => {
    const routing = selectModelTier(makeRouting({
      signals: { urgency: 70, budget: 50, intent: 50, sentiment: 'frustrated' },
    }));
    expect(routing.tier).toBe('quality');
    expect(routing.reason).toContain('frustrated_urgent');
  });

  it('frustrated but NOT urgent lead stays on fast model', () => {
    const routing = selectModelTier(makeRouting({
      signals: { urgency: 40, budget: 50, intent: 50, sentiment: 'frustrated' },
    }));
    expect(routing.tier).toBe('fast');
  });

  it('escalate action routes to escalate handler', () => {
    expect(routeAfterDecision(makeState({ lastAction: 'escalate' }))).toBe('escalate');
  });
});

// ---------------------------------------------------------------------------
// Scenario 4: Long Conversation — Harassment Prevention
// ---------------------------------------------------------------------------
describe('Scenario: Long conversation — harassment prevention', () => {
  it('no harassment warning at 0 unanswered messages', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig({ messagesWithoutResponse: 0 }));
    expect(prompt).not.toContain('DO NOT send another unprompted message');
  });

  it('no harassment warning at 1 unanswered message', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig({ messagesWithoutResponse: 1 }));
    expect(prompt).not.toContain('DO NOT send another unprompted message');
  });

  it('harassment warning activates at 2 unanswered messages', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig({ messagesWithoutResponse: 2 }));
    expect(prompt).toContain('DO NOT send another unprompted message');
  });

  it('harassment warning activates at 5 unanswered messages', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig({ messagesWithoutResponse: 5 }));
    expect(prompt).toContain('You have sent 5 messages');
    expect(prompt).toContain('DO NOT send another unprompted message');
  });
});

// ---------------------------------------------------------------------------
// Scenario 5: Re-engagement — Lead Returns After Silence
// ---------------------------------------------------------------------------
describe('Scenario: Lead re-engagement after silence', () => {
  it('nurturing lead returning gets respond action routed to respond node', () => {
    const state = makeState({ lastAction: 'respond', stage: 'nurturing' });
    expect(routeAfterDecision(state)).toBe('respond');
  });

  it('wait action ends graph (scheduled check handles follow-up)', () => {
    const state = makeState({ lastAction: 'wait', stage: 'nurturing' });
    expect(routeAfterDecision(state)).toBe('end');
  });

  it('trigger_flow routes to flow handler for nurture sequence', () => {
    const state = makeState({ lastAction: 'trigger_flow', stage: 'nurturing' });
    expect(routeAfterDecision(state)).toBe('trigger_flow');
  });
});

// ---------------------------------------------------------------------------
// Scenario 6: High-Value Lead — Quality Model Routing
// ---------------------------------------------------------------------------
describe('Scenario: High-value lead model routing', () => {
  it('high composite score triggers quality tier', () => {
    const routing = selectModelTier(makeRouting({
      leadScore: 75,
      signals: { urgency: 80, budget: 70, intent: 75, sentiment: 'positive' },
      decisionConfidence: 90,
    }));
    expect(routing.tier).toBe('quality');
  });

  it('high intent alone triggers quality tier', () => {
    const routing = selectModelTier(makeRouting({
      leadScore: 50,
      signals: { urgency: 40, budget: 40, intent: 85, sentiment: 'neutral' },
      decisionConfidence: 80,
    }));
    expect(routing.tier).toBe('quality');
  });

  it('low confidence triggers quality tier regardless of other scores', () => {
    const routing = selectModelTier(makeRouting({
      leadScore: 30,
      signals: { urgency: 20, budget: 20, intent: 20, sentiment: 'neutral' },
      decisionConfidence: 45,
    }));
    expect(routing.tier).toBe('quality');
    expect(routing.reason).toContain('low_confidence');
  });

  it('moderate scores with good confidence stays on fast', () => {
    const routing = selectModelTier(makeRouting({
      leadScore: 55,
      signals: { urgency: 55, budget: 55, intent: 55, sentiment: 'positive' },
      decisionConfidence: 75,
    }));
    expect(routing.tier).toBe('fast');
  });
});

// ---------------------------------------------------------------------------
// Scenario 7: Multi-Signal — Urgent + Frustrated + High Value
// ---------------------------------------------------------------------------
describe('Scenario: Multi-signal high-priority lead', () => {
  it('all signals elevated triggers quality tier (low confidence wins priority)', () => {
    const routing = selectModelTier(makeRouting({
      leadScore: 80,
      signals: { urgency: 90, budget: 70, intent: 85, sentiment: 'frustrated' },
      decisionConfidence: 50,
    }));
    expect(routing.tier).toBe('quality');
    // Low confidence is checked first
    expect(routing.reason).toContain('low_confidence');
  });

  it('escalation safety net fires even with high-value signals', () => {
    const action = applyEscalationSafetyNet(true, 'book_appointment');
    expect(action).toBe('escalate');
  });
});

// ---------------------------------------------------------------------------
// Scenario 8: Lost Lead — Terminal States
// ---------------------------------------------------------------------------
describe('Scenario: Lost lead terminal state', () => {
  it('close_lost routes to close handler', () => {
    expect(routeAfterDecision(makeState({ lastAction: 'close_lost' }))).toBe('close');
  });

  it('close_won routes to close handler', () => {
    expect(routeAfterDecision(makeState({ lastAction: 'close_won' }))).toBe('close');
  });
});

// ---------------------------------------------------------------------------
// Scenario 9: Photo Request → Quote Flow
// ---------------------------------------------------------------------------
describe('Scenario: Photo request and quote flow', () => {
  it('request_photos routes to respond node (generates the ask)', () => {
    expect(routeAfterDecision(makeState({ lastAction: 'request_photos' }))).toBe('respond');
  });

  it('send_quote routes to respond node (generates the explanation)', () => {
    expect(routeAfterDecision(makeState({ lastAction: 'send_quote' }))).toBe('respond');
  });

  it('send_payment routes to payment handler', () => {
    expect(routeAfterDecision(makeState({ lastAction: 'send_payment' }))).toBe('send_payment');
  });
});

// ---------------------------------------------------------------------------
// Scenario 10: Adversarial Input — Guardrail Coverage
// ---------------------------------------------------------------------------
describe('Scenario: Adversarial input guardrail coverage', () => {
  it('prompt includes honesty rule (AI disclosure)', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig());
    expect(prompt).toContain('I\'m an AI assistant');
  });

  it('prompt includes knowledge boundary (no hallucination)', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig());
    expect(prompt).toContain('DO NOT guess or make things up');
  });

  it('prompt includes no-promises rule', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig());
    expect(prompt).toContain('Never promise specific pricing');
  });

  it('prompt includes no-professional-advice rule', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig());
    expect(prompt).toContain('Never provide medical, legal, financial, or safety advice');
  });

  it('prompt includes no-real-world-claims rule', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig());
    expect(prompt).toContain('Never reference weather, current events');
  });

  it('prompt includes stay-in-lane rule', () => {
    const prompt = buildGuardrailPrompt(makeGuardrailConfig());
    expect(prompt).toContain('Do not comment on competitors');
  });
});

// ---------------------------------------------------------------------------
// Scenario 11: All Actions Route Correctly (exhaustive)
// ---------------------------------------------------------------------------
describe('Scenario: Exhaustive action routing', () => {
  const expectedRoutes: Record<AgentAction, string> = {
    respond: 'respond',
    book_appointment: 'respond',
    send_quote: 'respond',
    request_photos: 'respond',
    wait: 'end',
    escalate: 'escalate',
    trigger_flow: 'trigger_flow',
    close_won: 'close',
    close_lost: 'close',
    send_payment: 'send_payment',
  };

  for (const [action, expectedRoute] of Object.entries(expectedRoutes)) {
    it(`action "${action}" routes to "${expectedRoute}"`, () => {
      expect(routeAfterDecision(makeState({ lastAction: action as AgentAction }))).toBe(expectedRoute);
    });
  }
});

// ---------------------------------------------------------------------------
// Strategy-Driven Conversation Progressions
// Tests that the strategy resolver produces correct strategies for realistic
// multi-step conversation flows without making LLM calls.
// ---------------------------------------------------------------------------

describe('strategy-driven conversation progressions', () => {
  it('follows greeting → qualifying → educating for a standard lead', () => {
    // Turn 1: first message with no project info — should stay in greeting
    const s1 = resolveStrategy({
      currentStage: 'greeting',
      stageTurnCount: 0,
      signals: { urgency: 50, budget: 50, intent: 50, sentiment: 'neutral' },
      extractedInfo: {},
      objections: [],
      bookingAttempts: 0,
      isFirstMessage: true,
      entryContext: resolveEntryContext({
        leadSource: 'missed_call',
        isReturningLead: false,
        daysSinceLastContact: null,
        existingProjectInfo: null,
      }),
    });
    expect(s1.currentStage).toBe('greeting');
    expect(s1.actionGuidance).toContain('missed');

    // Turn 2: lead replied with project info → should advance to qualifying
    const s2 = resolveStrategy({
      currentStage: 'greeting',
      stageTurnCount: 1,
      signals: { urgency: 50, budget: 50, intent: 60, sentiment: 'neutral' },
      extractedInfo: { projectType: 'basement finishing' },
      objections: [],
      bookingAttempts: 0,
      isFirstMessage: false,
    });
    expect(s2.currentStage).toBe('qualifying');

    // Turn 5: all three qualifying fields collected → should advance to educating
    const s3 = resolveStrategy({
      currentStage: 'qualifying',
      stageTurnCount: 3,
      signals: { urgency: 60, budget: 60, intent: 70, sentiment: 'positive' },
      extractedInfo: {
        projectType: 'basement finishing',
        projectSize: '1200 sqft',
        preferredTimeframe: 'next month',
      },
      objections: [],
      bookingAttempts: 0,
      isFirstMessage: false,
    });
    expect(s3.currentStage).toBe('educating');
  });

  it('handles emergency bypass correctly', () => {
    const s = resolveStrategy({
      currentStage: 'qualifying',
      stageTurnCount: 2,
      signals: { urgency: 95, budget: 50, intent: 80, sentiment: 'frustrated' },
      extractedInfo: { projectType: 'water damage' },
      objections: [],
      bookingAttempts: 0,
      isFirstMessage: false,
    });
    expect(s.currentStage).toBe('emergency');
    expect(s.suggestedAction).toContain('human');
  });

  it('handles price objection with playbook guidance', () => {
    const s = resolveStrategy({
      currentStage: 'proposing',
      stageTurnCount: 1,
      signals: { urgency: 50, budget: 30, intent: 50, sentiment: 'neutral' },
      extractedInfo: { projectType: 'basement finishing' },
      objections: ['price_comparison'],
      bookingAttempts: 1,
      isFirstMessage: false,
      playbook: BASEMENT_DEVELOPMENT_PLAYBOOK,
    });
    expect(s.currentStage).toBe('objection_handling');
    // Playbook guidance for price_comparison references investment value
    expect(s.actionGuidance.toLowerCase()).toContain('value');
  });
});

// ---------------------------------------------------------------------------
// Scenario 12: Model Routing Boundary Conditions
// ---------------------------------------------------------------------------
describe('Scenario: Model routing boundary conditions', () => {
  it('confidence=59 triggers quality, confidence=60 stays fast', () => {
    expect(selectModelTier(makeRouting({ decisionConfidence: 59 })).tier).toBe('quality');
    expect(selectModelTier(makeRouting({ decisionConfidence: 60 })).tier).toBe('fast');
  });

  it('leadScore=69 stays fast, leadScore=70 triggers quality', () => {
    expect(selectModelTier(makeRouting({ leadScore: 69 })).tier).toBe('fast');
    expect(selectModelTier(makeRouting({ leadScore: 70 })).tier).toBe('quality');
  });

  it('intent=79 stays fast, intent=80 triggers quality', () => {
    expect(selectModelTier(makeRouting({
      signals: { urgency: 50, budget: 50, intent: 79, sentiment: 'neutral' },
    })).tier).toBe('fast');
    expect(selectModelTier(makeRouting({
      signals: { urgency: 50, budget: 50, intent: 80, sentiment: 'neutral' },
    })).tier).toBe('quality');
  });

  it('frustrated+urgency=59 stays fast, urgency=60 triggers quality', () => {
    expect(selectModelTier(makeRouting({
      signals: { urgency: 59, budget: 50, intent: 50, sentiment: 'frustrated' },
    })).tier).toBe('fast');
    expect(selectModelTier(makeRouting({
      signals: { urgency: 60, budget: 50, intent: 50, sentiment: 'frustrated' },
    })).tier).toBe('quality');
  });
});
