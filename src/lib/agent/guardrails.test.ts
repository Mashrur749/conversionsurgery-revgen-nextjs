import { describe, it, expect } from 'vitest';
import { buildGuardrailPrompt, assessConfidence, type GuardrailConfig } from './guardrails';

function makeConfig(overrides: Partial<GuardrailConfig> = {}): GuardrailConfig {
  return {
    ownerName: 'Mike',
    businessName: 'Mike\'s Plumbing',
    agentTone: 'professional',
    messagesWithoutResponse: 0,
    canDiscussPricing: false,
    ...overrides,
  };
}

describe('buildGuardrailPrompt', () => {
  describe('core rules', () => {
    it('includes knowledge boundary rule with owner name', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('Let me have Mike get back to you');
    });

    it('includes honesty rule with business name', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('I\'m an AI assistant helping Mike\'s Plumbing');
    });

    it('includes opt-out respect rule', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('treat it exactly like STOP');
    });

    it('includes no-pressure rule', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('Never use urgency/scarcity tactics');
    });

    it('includes privacy rule', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('Never reference other customers');
    });

    it('includes stay-in-lane rule with business name', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('You represent Mike\'s Plumbing only');
    });
  });

  describe('pricing rules', () => {
    it('blocks pricing discussion when canDiscussPricing=false', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ canDiscussPricing: false }));
      expect(prompt).toContain('I\'d want Mike to give you an accurate quote');
    });

    it('allows range-based pricing when canDiscussPricing=true', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ canDiscussPricing: true }));
      expect(prompt).toContain('share only the ranges');
      expect(prompt).toContain('Never quote exact prices');
    });
  });

  describe('harassment prevention', () => {
    it('no warning when 0 messages without response', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ messagesWithoutResponse: 0 }));
      expect(prompt).not.toContain('DO NOT send another unprompted message');
    });

    it('no warning when 1 message without response', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ messagesWithoutResponse: 1 }));
      expect(prompt).not.toContain('DO NOT send another unprompted message');
    });

    it('adds warning when 2+ messages without response', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ messagesWithoutResponse: 2 }));
      expect(prompt).toContain('You have sent 2 messages without a reply');
      expect(prompt).toContain('DO NOT send another unprompted message');
    });

    it('includes correct count at high numbers', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ messagesWithoutResponse: 5 }));
      expect(prompt).toContain('You have sent 5 messages without a reply');
    });
  });

  describe('tone rules', () => {
    it('professional tone rules', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ agentTone: 'professional' }));
      expect(prompt).toContain('Be courteous and direct');
      expect(prompt).toContain('TONE RULES (professional)');
    });

    it('friendly tone rules', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ agentTone: 'friendly' }));
      expect(prompt).toContain('Be warm and conversational');
      expect(prompt).toContain('Light humor is OK');
    });

    it('casual tone rules', () => {
      const prompt = buildGuardrailPrompt(makeConfig({ agentTone: 'casual' }));
      expect(prompt).toContain('Be relaxed and natural');
      expect(prompt).toContain('like texting a friend');
    });
  });

  describe('universal tone rules (all tones)', () => {
    for (const tone of ['professional', 'friendly', 'casual'] as const) {
      it(`includes empathy rule for ${tone} tone`, () => {
        const prompt = buildGuardrailPrompt(makeConfig({ agentTone: tone }));
        expect(prompt).toContain('acknowledge their feelings first');
      });

      it(`includes patience rule for ${tone} tone`, () => {
        const prompt = buildGuardrailPrompt(makeConfig({ agentTone: tone }));
        expect(prompt).toContain('be patient');
      });

      it(`includes one-question-at-a-time rule for ${tone} tone`, () => {
        const prompt = buildGuardrailPrompt(makeConfig({ agentTone: tone }));
        expect(prompt).toContain('Ask only ONE question at a time');
      });

      it(`includes conciseness rule for ${tone} tone`, () => {
        const prompt = buildGuardrailPrompt(makeConfig({ agentTone: tone }));
        expect(prompt).toContain('Keep responses concise');
      });
    }
  });

  describe('confidence levels section', () => {
    it('includes defer-to-owner instruction', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('defer to Mike. Never guess');
    });

    it('includes hedging language guidance', () => {
      const prompt = buildGuardrailPrompt(makeConfig());
      expect(prompt).toContain('Typically');
      expect(prompt).toContain('Usually');
    });
  });
});

describe('assessConfidence', () => {
  it('returns high when 2+ knowledge matches', () => {
    expect(assessConfidence(2, 10)).toBe('high');
    expect(assessConfidence(5, 10)).toBe('high');
  });

  it('returns medium when exactly 1 match', () => {
    expect(assessConfidence(1, 10)).toBe('medium');
  });

  it('returns medium when no KB exists at all', () => {
    expect(assessConfidence(0, 0)).toBe('medium');
  });

  it('returns low when KB exists but no matches', () => {
    expect(assessConfidence(0, 5)).toBe('low');
  });
});
