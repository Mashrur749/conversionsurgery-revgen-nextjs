import { describe, expect, it } from 'vitest';

import {
  evaluateRecoveryWindowStatus,
  REQUIRED_RECOVERY_ATTRIBUTED_OPPORTUNITIES,
} from './recovery-evaluator';

describe('evaluateRecoveryWindowStatus', () => {
  const now = new Date('2026-05-01T00:00:00.000Z');

  it('moves from proof_passed to recovery_pending when no attributed opportunities yet', () => {
    const action = evaluateRecoveryWindowStatus({
      status: 'proof_passed',
      attributedOpportunities: 0,
      now,
      recoveryWindowEnd: new Date('2026-05-10T00:00:00.000Z'),
    });

    expect(action).toBe('move_to_recovery_pending');
  });

  it('passes recovery when attributed opportunity threshold is met', () => {
    const action = evaluateRecoveryWindowStatus({
      status: 'recovery_pending',
      attributedOpportunities: REQUIRED_RECOVERY_ATTRIBUTED_OPPORTUNITIES,
      now,
      recoveryWindowEnd: new Date('2026-05-10T00:00:00.000Z'),
    });

    expect(action).toBe('recovery_pass');
  });

  it('fails recovery when window expired and threshold not met', () => {
    const action = evaluateRecoveryWindowStatus({
      status: 'recovery_pending',
      attributedOpportunities: 0,
      now,
      recoveryWindowEnd: new Date('2026-04-10T00:00:00.000Z'),
    });

    expect(action).toBe('recovery_fail_refund_review');
  });

  it('does nothing for non-recovery statuses', () => {
    const action = evaluateRecoveryWindowStatus({
      status: 'proof_pending',
      attributedOpportunities: 5,
      now,
      recoveryWindowEnd: new Date('2026-05-10T00:00:00.000Z'),
    });

    expect(action).toBe('none');
  });
});
