import type { GuaranteeV2Status } from '@/lib/services/guarantee-v2/state-machine';

export const REQUIRED_PROOF_QLE_COUNT = 5;

export type ProofEvaluationAction = 'none' | 'proof_pass' | 'proof_fail_refund_review';

interface EvaluateProofWindowInput {
  status: GuaranteeV2Status;
  qualifiedLeadEngagements: number;
  now: Date;
  proofWindowEnd: Date;
}

export function evaluateProofWindowStatus({
  status,
  qualifiedLeadEngagements,
  now,
  proofWindowEnd,
}: EvaluateProofWindowInput): ProofEvaluationAction {
  if (status !== 'proof_pending') return 'none';

  if (qualifiedLeadEngagements >= REQUIRED_PROOF_QLE_COUNT) {
    return 'proof_pass';
  }

  if (now > proofWindowEnd) {
    return 'proof_fail_refund_review';
  }

  return 'none';
}

