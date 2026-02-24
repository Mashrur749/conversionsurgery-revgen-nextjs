import { normalizeGuaranteeV2Status, type GuaranteeStatusValue } from '@/lib/services/guarantee-v2/state-machine';

type GuaranteeStage = 'proof' | 'recovery' | 'fulfilled' | 'refund_review';
type TimelineState = 'pending' | 'active' | 'completed' | 'failed';

export interface GuaranteeSummaryInput {
  guaranteeStatus: string | null;
  guaranteeProofStartAt: Date | null;
  guaranteeProofEndsAt: Date | null;
  guaranteeRecoveryStartAt: Date | null;
  guaranteeRecoveryEndsAt: Date | null;
  guaranteeAdjustedProofEndsAt: Date | null;
  guaranteeAdjustedRecoveryEndsAt: Date | null;
  guaranteeObservedMonthlyLeadAverage: number | null;
  guaranteeExtensionFactorBasisPoints: number | null;
  guaranteeProofQualifiedLeadEngagements: number | null;
  guaranteeRecoveryAttributedOpportunities: number | null;
  guaranteeRefundEligibleAt: Date | null;
  guaranteeNotes: string | null;
}

export interface GuaranteeTimelineItem {
  key: 'proof' | 'recovery';
  label: string;
  state: TimelineState;
  detail: string;
}

export interface GuaranteeSummary {
  status: string;
  statusLabel: string;
  stage: GuaranteeStage;
  stageMessage: string;
  refundReviewRequired: boolean;
  refundEligibleAt: string | null;
  notes: string | null;
  proofQualifiedLeadEngagements: number;
  recoveryAttributedOpportunities: number;
  proofWindow: {
    startAt: string | null;
    endAt: string | null;
    adjustedEndAt: string | null;
  };
  recoveryWindow: {
    startAt: string | null;
    endAt: string | null;
    adjustedEndAt: string | null;
  };
  extension: {
    factorBasisPoints: number;
    factorMultiplier: number;
    observedMonthlyLeadAverage: number | null;
    adjusted: boolean;
  };
  timeline: GuaranteeTimelineItem[];
}

function toIso(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function statusToLabel(status: string): string {
  switch (status) {
    case 'proof_pending':
      return 'Proof In Progress';
    case 'proof_passed':
      return 'Proof Passed';
    case 'proof_failed_refund_review':
      return 'Proof Refund Review';
    case 'recovery_pending':
      return 'Recovery In Progress';
    case 'recovery_passed':
      return 'Guarantee Passed';
    case 'recovery_failed_refund_review':
      return 'Recovery Refund Review';
    default:
      return 'Guarantee In Progress';
  }
}

function statusToStage(status: string): GuaranteeStage {
  if (status === 'recovery_passed') return 'fulfilled';
  if (status === 'proof_failed_refund_review' || status === 'recovery_failed_refund_review') {
    return 'refund_review';
  }
  if (status === 'proof_pending') return 'proof';
  return 'recovery';
}

function statusToStageMessage(status: string): string {
  switch (status) {
    case 'proof_pending':
      return 'Monitoring qualified lead engagements in the proof window.';
    case 'proof_passed':
      return 'Proof-of-life passed. Recovery guarantee evaluation is active.';
    case 'proof_failed_refund_review':
      return 'Proof window ended below threshold. Refund review is required.';
    case 'recovery_pending':
      return 'Monitoring attributed opportunities in the recovery window.';
    case 'recovery_passed':
      return 'Recovery guarantee satisfied.';
    case 'recovery_failed_refund_review':
      return 'Recovery window ended without attributed opportunity. Refund review is required.';
    default:
      return 'Guarantee lifecycle is active.';
  }
}

function buildTimeline(
  status: string,
  proofQualifiedLeadEngagements: number,
  recoveryAttributedOpportunities: number
): GuaranteeTimelineItem[] {
  let proofState: TimelineState = 'pending';
  let recoveryState: TimelineState = 'pending';

  if (status === 'proof_pending') {
    proofState = 'active';
  }
  if (status === 'proof_passed') {
    proofState = 'completed';
    recoveryState = 'pending';
  }
  if (status === 'proof_failed_refund_review') {
    proofState = 'failed';
    recoveryState = 'pending';
  }
  if (status === 'recovery_pending') {
    proofState = 'completed';
    recoveryState = 'active';
  }
  if (status === 'recovery_passed') {
    proofState = 'completed';
    recoveryState = 'completed';
  }
  if (status === 'recovery_failed_refund_review') {
    proofState = 'completed';
    recoveryState = 'failed';
  }

  return [
    {
      key: 'proof',
      label: '30-Day Proof-of-Life',
      state: proofState,
      detail: `${proofQualifiedLeadEngagements}/5 qualified lead engagements`,
    },
    {
      key: 'recovery',
      label: '90-Day Recovery',
      state: recoveryState,
      detail: `${recoveryAttributedOpportunities}/1 attributed opportunities`,
    },
  ];
}

export function buildGuaranteeSummary(input: GuaranteeSummaryInput): GuaranteeSummary {
  const status = normalizeGuaranteeV2Status(
    input.guaranteeStatus as GuaranteeStatusValue
  );
  const proofQualifiedLeadEngagements = input.guaranteeProofQualifiedLeadEngagements ?? 0;
  const recoveryAttributedOpportunities = input.guaranteeRecoveryAttributedOpportunities ?? 0;
  const factorBasisPoints = input.guaranteeExtensionFactorBasisPoints ?? 10000;

  return {
    status,
    statusLabel: statusToLabel(status),
    stage: statusToStage(status),
    stageMessage: statusToStageMessage(status),
    refundReviewRequired:
      status === 'proof_failed_refund_review' || status === 'recovery_failed_refund_review',
    refundEligibleAt: toIso(input.guaranteeRefundEligibleAt),
    notes: input.guaranteeNotes,
    proofQualifiedLeadEngagements,
    recoveryAttributedOpportunities,
    proofWindow: {
      startAt: toIso(input.guaranteeProofStartAt),
      endAt: toIso(input.guaranteeProofEndsAt),
      adjustedEndAt: toIso(input.guaranteeAdjustedProofEndsAt),
    },
    recoveryWindow: {
      startAt: toIso(input.guaranteeRecoveryStartAt),
      endAt: toIso(input.guaranteeRecoveryEndsAt),
      adjustedEndAt: toIso(input.guaranteeAdjustedRecoveryEndsAt),
    },
    extension: {
      factorBasisPoints,
      factorMultiplier: factorBasisPoints / 10000,
      observedMonthlyLeadAverage: input.guaranteeObservedMonthlyLeadAverage,
      adjusted: factorBasisPoints > 10000,
    },
    timeline: buildTimeline(
      status,
      proofQualifiedLeadEngagements,
      recoveryAttributedOpportunities
    ),
  };
}
