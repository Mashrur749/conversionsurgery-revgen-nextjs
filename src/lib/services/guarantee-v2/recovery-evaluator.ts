import type { GuaranteeV2Status } from '@/lib/services/guarantee-v2/state-machine';

export const REQUIRED_RECOVERY_ATTRIBUTED_OPPORTUNITIES = 1;
export const RECOVERY_PIPELINE_FLOOR_CENTS = 500_000; // $5,000

export type RecoveryEvaluationAction =
  | 'none'
  | 'move_to_recovery_pending'
  | 'recovery_pass'
  | 'recovery_fail_refund_review';

interface EvaluateRecoveryWindowInput {
  status: GuaranteeV2Status;
  attributedOpportunities: number;
  probablePipelineValueCents?: number;
  now: Date;
  recoveryWindowEnd: Date;
}

export function evaluateRecoveryWindowStatus({
  status,
  attributedOpportunities,
  probablePipelineValueCents = 0,
  now,
  recoveryWindowEnd,
}: EvaluateRecoveryWindowInput): RecoveryEvaluationAction {
  if (status !== 'proof_passed' && status !== 'recovery_pending') {
    return 'none';
  }

  const meetsOpportunityThreshold =
    attributedOpportunities >= REQUIRED_RECOVERY_ATTRIBUTED_OPPORTUNITIES;
  const meetsPipelineFloor = probablePipelineValueCents >= RECOVERY_PIPELINE_FLOOR_CENTS;

  if (meetsOpportunityThreshold || meetsPipelineFloor) {
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
