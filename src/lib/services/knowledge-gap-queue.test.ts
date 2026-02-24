import { describe, expect, it } from 'vitest';
import {
  getKnowledgeGapAgeDays,
  isKnowledgeGapStale,
} from '@/lib/services/knowledge-gap-queue';

describe('knowledge gap queue helpers', () => {
  it('flags stale open gaps when due date is in the past', () => {
    const now = new Date('2026-02-24T12:00:00.000Z');
    expect(isKnowledgeGapStale({
      dueAt: new Date('2026-02-23T12:00:00.000Z'),
      status: 'new',
    }, now)).toBe(true);

    expect(isKnowledgeGapStale({
      dueAt: new Date('2026-02-25T12:00:00.000Z'),
      status: 'new',
    }, now)).toBe(false);

    expect(isKnowledgeGapStale({
      dueAt: new Date('2026-02-23T12:00:00.000Z'),
      status: 'verified',
    }, now)).toBe(false);
  });

  it('computes one-decimal age in days', () => {
    const now = new Date('2026-02-24T12:00:00.000Z');
    const firstSeenAt = new Date('2026-02-20T00:00:00.000Z');
    expect(getKnowledgeGapAgeDays(firstSeenAt, now)).toBe(4.5);
  });
});
