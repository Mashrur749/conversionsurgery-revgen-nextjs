import { describe, it, expect } from 'vitest';
import { selectModelTier } from './model-routing';
import type { LeadSignals } from '@/lib/types/agent';

function makeSignals(overrides: Partial<LeadSignals> = {}): LeadSignals {
  return {
    urgency: 50,
    budget: 50,
    intent: 50,
    sentiment: 'neutral',
    ...overrides,
  };
}

describe('selectModelTier', () => {
  it('returns fast for standard lead with normal confidence', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals(),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('fast');
    expect(result.reason).toBe('standard');
  });

  it('returns quality for low confidence', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals(),
      decisionConfidence: 55,
    });
    expect(result.tier).toBe('quality');
    expect(result.reason).toContain('low_confidence');
  });

  it('returns quality for high lead score', () => {
    const result = selectModelTier({
      leadScore: 75,
      signals: makeSignals(),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('quality');
    expect(result.reason).toContain('high_value_lead');
  });

  it('returns quality for high intent score', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals({ intent: 85 }),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('quality');
    expect(result.reason).toContain('high_intent');
  });

  it('returns quality for frustrated + urgent lead', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals({ sentiment: 'frustrated', urgency: 70 }),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('quality');
    expect(result.reason).toContain('frustrated_urgent');
  });

  it('returns fast for frustrated but not urgent lead', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals({ sentiment: 'frustrated', urgency: 40 }),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('fast');
  });

  it('returns fast for negative sentiment (not frustrated)', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals({ sentiment: 'negative', urgency: 80 }),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('fast');
  });

  it('low confidence takes priority over other checks', () => {
    const result = selectModelTier({
      leadScore: 30,
      signals: makeSignals({ intent: 20 }),
      decisionConfidence: 40,
    });
    expect(result.tier).toBe('quality');
    expect(result.reason).toContain('low_confidence');
  });

  it('boundary: leadScore exactly at threshold triggers quality', () => {
    const result = selectModelTier({
      leadScore: 70,
      signals: makeSignals(),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('quality');
  });

  it('boundary: confidence exactly at threshold stays fast', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals(),
      decisionConfidence: 60,
    });
    expect(result.tier).toBe('fast');
  });

  it('boundary: intent exactly at threshold triggers quality', () => {
    const result = selectModelTier({
      leadScore: 50,
      signals: makeSignals({ intent: 80 }),
      decisionConfidence: 80,
    });
    expect(result.tier).toBe('quality');
  });
});
