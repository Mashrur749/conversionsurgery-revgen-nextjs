import type { GuaranteeV2Status } from '@/lib/services/guarantee-v2/state-machine';

export const REQUIRED_RECOVERY_ATTRIBUTED_OPPORTUNITIES = 1;

export type RecoveryEvaluationAction =
  | 'none'
  | 'move_to_recovery_pending'
  | 'recovery_pass'
  | 'recovery_fail_refund_review';

interface EvaluateRecoveryWindowInput {
  status: GuaranteeV2Status;
  attributedOpportunities: number;
  now: Date;
  recoveryWindowEnd: Date;
}

export function evaluateRecoveryWindowStatus({
  status,
  attributedOpportunities,
  now,
  recoveryWindowEnd,
}: EvaluateRecoveryWindowInput): RecoveryEvaluationAction {
  if (status !== 'proof_passed' && status !== 'recovery_pending') {
    return 'none';
  }

  if (attributedOpportunities >= REQUIRED_RECOVERY_ATTRIBUTED_OPPORTUNITIES) {
    return 'recovery_pass';
  }

  if (now > recoveryWindowEnd) {
    return 'recovery_fail_refund_review';
  }

  if (status === 'proof_passed') {
    return 'move_to_recovery_pending';
  }

  return 'none';
}
