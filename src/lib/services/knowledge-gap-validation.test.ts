import { describe, expect, it } from 'vitest';
import {
  calculateKnowledgeGapPriorityScore,
  computeKnowledgeGapDueAt,
  isHighPriorityKnowledgeGap,
  validateKnowledgeGapTransition,
} from '@/lib/services/knowledge-gap-validation';

describe('knowledge gap validation', () => {
  it('calculates capped priority score from occurrences + confidence', () => {
    expect(calculateKnowledgeGapPriorityScore({ occurrences: 1, confidenceLevel: 'medium' })).toBe(2);
    expect(calculateKnowledgeGapPriorityScore({ occurrences: 5, confidenceLevel: 'low' })).toBe(8);
    expect(calculateKnowledgeGapPriorityScore({ occurrences: 20, confidenceLevel: 'low' })).toBe(10);
  });

  it('computes due date policy tiers by priority', () => {
    const now = new Date('2026-02-24T10:00:00.000Z');
    expect(computeKnowledgeGapDueAt(9, now).toISOString()).toBe('2026-02-25T10:00:00.000Z');
    expect(computeKnowledgeGapDueAt(7, now).toISOString()).toBe('2026-02-26T10:00:00.000Z');
    expect(computeKnowledgeGapDueAt(5, now).toISOString()).toBe('2026-02-27T10:00:00.000Z');
    expect(computeKnowledgeGapDueAt(3, now).toISOString()).toBe('2026-03-01T10:00:00.000Z');
  });

  it('requires kb link + note + resolver before resolve', () => {
    const result = validateKnowledgeGapTransition({
      currentStatus: 'in_progress',
      nextStatus: 'resolved',
      priorityScore: 6,
      kbEntryId: null,
      resolutionNote: 'short',
      resolvedByPersonId: null,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' | ')).toContain('KB entry is required');
    expect(result.errors.join(' | ')).toContain('Resolution note must be at least 10 characters');
    expect(result.errors.join(' | ')).toContain('Resolver is required');
  });

  it('enforces independent verification for high-priority gaps', () => {
    expect(isHighPriorityKnowledgeGap(8)).toBe(true);

    const invalid = validateKnowledgeGapTransition({
      currentStatus: 'resolved',
      nextStatus: 'verified',
      priorityScore: 8,
      kbEntryId: 'kb_1',
      resolutionNote: 'Resolved by KB update with pricing FAQ and scope details',
      resolvedByPersonId: 'person_1',
      verifiedByPersonId: 'person_1',
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.join(' | ')).toContain('different person');

    const valid = validateKnowledgeGapTransition({
      currentStatus: 'resolved',
      nextStatus: 'verified',
      priorityScore: 8,
      kbEntryId: 'kb_1',
      resolutionNote: 'Resolved by KB update with pricing FAQ and scope details',
      resolvedByPersonId: 'person_1',
      verifiedByPersonId: 'person_2',
    });
    expect(valid.valid).toBe(true);
  });
});
