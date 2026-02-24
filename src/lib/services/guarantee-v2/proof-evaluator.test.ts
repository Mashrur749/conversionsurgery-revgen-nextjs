import { describe, expect, it } from 'vitest';

import {
  evaluateProofWindowStatus,
  REQUIRED_PROOF_QLE_COUNT,
} from './proof-evaluator';

describe('evaluateProofWindowStatus', () => {
  const now = new Date('2026-03-01T00:00:00.000Z');

  it('passes proof when QLE threshold is met', () => {
    const action = evaluateProofWindowStatus({
      status: 'proof_pending',
      qualifiedLeadEngagements: REQUIRED_PROOF_QLE_COUNT,
      now,
      proofWindowEnd: new Date('2026-03-10T00:00:00.000Z'),
    });

    expect(action).toBe('proof_pass');
  });

  it('fails proof when window expired and threshold not met', () => {
    const action = evaluateProofWindowStatus({
      status: 'proof_pending',
      qualifiedLeadEngagements: REQUIRED_PROOF_QLE_COUNT - 1,
      now,
      proofWindowEnd: new Date('2026-02-10T00:00:00.000Z'),
    });

    expect(action).toBe('proof_fail_refund_review');
  });

  it('does nothing when still in active window and under threshold', () => {
    const action = evaluateProofWindowStatus({
      status: 'proof_pending',
      qualifiedLeadEngagements: 2,
      now,
      proofWindowEnd: new Date('2026-03-10T00:00:00.000Z'),
    });

    expect(action).toBe('none');
  });

  it('does nothing for non-pending statuses', () => {
    const action = evaluateProofWindowStatus({
      status: 'proof_passed',
      qualifiedLeadEngagements: 0,
      now,
      proofWindowEnd: new Date('2026-02-10T00:00:00.000Z'),
    });

    expect(action).toBe('none');
  });
});
