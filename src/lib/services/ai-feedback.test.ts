import { describe, it, expect } from 'vitest';
import { FLAG_REASONS, type FlagReason } from './ai-feedback';

describe('ai-feedback constants', () => {
  it('FLAG_REASONS contains all expected categories', () => {
    expect(FLAG_REASONS).toContain('wrong_tone');
    expect(FLAG_REASONS).toContain('inaccurate');
    expect(FLAG_REASONS).toContain('too_pushy');
    expect(FLAG_REASONS).toContain('hallucinated');
    expect(FLAG_REASONS).toContain('off_topic');
    expect(FLAG_REASONS).toContain('other');
  });

  it('FLAG_REASONS has exactly 6 categories', () => {
    expect(FLAG_REASONS).toHaveLength(6);
  });

  it('FLAG_REASONS is a readonly tuple', () => {
    // Type-level check: this should compile without error
    const reasons: readonly FlagReason[] = FLAG_REASONS;
    expect(reasons).toBeDefined();
  });

  it('each reason is a non-empty string', () => {
    for (const reason of FLAG_REASONS) {
      expect(typeof reason).toBe('string');
      expect(reason.length).toBeGreaterThan(0);
    }
  });
});
