export const KNOWLEDGE_GAP_STATUSES = [
  'new',
  'in_progress',
  'blocked',
  'resolved',
  'verified',
] as const;

export type KnowledgeGapStatus = (typeof KNOWLEDGE_GAP_STATUSES)[number];

export const KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD = 8;

const STATUS_TRANSITIONS: Record<KnowledgeGapStatus, KnowledgeGapStatus[]> = {
  new: ['in_progress', 'blocked', 'resolved'],
  in_progress: ['blocked', 'resolved', 'new'],
  blocked: ['in_progress', 'resolved'],
  resolved: ['verified', 'in_progress', 'blocked'],
  verified: ['in_progress', 'blocked'],
};

export interface KnowledgeGapTransitionValidationInput {
  currentStatus: KnowledgeGapStatus;
  nextStatus: KnowledgeGapStatus;
  priorityScore: number;
  resolutionNote?: string | null;
  kbEntryId?: string | null;
  resolvedByPersonId?: string | null;
  verifiedByPersonId?: string | null;
}

export function isHighPriorityKnowledgeGap(priorityScore: number): boolean {
  return priorityScore >= KNOWLEDGE_GAP_HIGH_PRIORITY_THRESHOLD;
}

export function calculateKnowledgeGapPriorityScore(input: {
  occurrences: number;
  confidenceLevel: string;
}): number {
  const normalizedOccurrences = Math.max(1, input.occurrences);
  const confidenceBoost = input.confidenceLevel === 'low' ? 3 : 1;
  return Math.max(1, Math.min(10, normalizedOccurrences + confidenceBoost));
}

export function computeKnowledgeGapDueAt(priorityScore: number, now: Date = new Date()): Date {
  const dueAt = new Date(now);

  if (priorityScore >= 9) {
    dueAt.setDate(dueAt.getDate() + 1);
    return dueAt;
  }

  if (priorityScore >= 7) {
    dueAt.setDate(dueAt.getDate() + 2);
    return dueAt;
  }

  if (priorityScore >= 5) {
    dueAt.setDate(dueAt.getDate() + 3);
    return dueAt;
  }

  dueAt.setDate(dueAt.getDate() + 5);
  return dueAt;
}

export function validateKnowledgeGapTransition(
  input: KnowledgeGapTransitionValidationInput
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const allowedTargets = STATUS_TRANSITIONS[input.currentStatus] ?? [];

  if (input.currentStatus !== input.nextStatus && !allowedTargets.includes(input.nextStatus)) {
    errors.push(`Cannot transition from ${input.currentStatus} to ${input.nextStatus}`);
  }

  if (input.nextStatus === 'resolved') {
    if (!input.kbEntryId) {
      errors.push('KB entry is required before resolving a knowledge gap');
    }

    if (!input.resolutionNote || input.resolutionNote.trim().length < 10) {
      errors.push('Resolution note must be at least 10 characters');
    }

    if (!input.resolvedByPersonId) {
      errors.push('Resolver is required before marking resolved');
    }
  }

  if (input.nextStatus === 'verified') {
    if (!input.verifiedByPersonId) {
      errors.push('Verifier is required before marking verified');
    }

    if (!input.kbEntryId) {
      errors.push('KB entry link is required before verification');
    }

    if (isHighPriorityKnowledgeGap(input.priorityScore)) {
      if (!input.resolvedByPersonId) {
        errors.push('High-priority gaps must be resolved before verification');
      } else if (input.verifiedByPersonId === input.resolvedByPersonId) {
        errors.push('High-priority gaps require reviewer verification by a different person');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
