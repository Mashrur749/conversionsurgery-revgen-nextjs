export const GUARANTEE_MIN_MONTHLY_LEAD_THRESHOLD = 15;
const BASIS_POINTS_MULTIPLIER = 10000;

interface ComputeExtensionInput {
  observedMonthlyLeadAverage: number;
  currentExtensionFactorBasisPoints?: number | null;
  proofStartAt: Date;
  proofEndsAt: Date;
  recoveryStartAt: Date;
  recoveryEndsAt: Date;
}

export interface GuaranteeExtensionComputation {
  observedMonthlyLeadAverage: number;
  extensionFactorBasisPoints: number;
  adjustedProofEndsAt: Date;
  adjustedRecoveryEndsAt: Date;
  formulaApplied: boolean;
}

export function calculateLowVolumeExtensionFactorBasisPoints(
  observedMonthlyLeadAverage: number
): number {
  if (observedMonthlyLeadAverage <= 0) {
    return BASIS_POINTS_MULTIPLIER;
  }

  if (observedMonthlyLeadAverage >= GUARANTEE_MIN_MONTHLY_LEAD_THRESHOLD) {
    return BASIS_POINTS_MULTIPLIER;
  }

  return Math.round(
    (GUARANTEE_MIN_MONTHLY_LEAD_THRESHOLD / observedMonthlyLeadAverage) *
      BASIS_POINTS_MULTIPLIER
  );
}

export function applyLowVolumeExtensionFormula({
  observedMonthlyLeadAverage,
  currentExtensionFactorBasisPoints,
  proofStartAt,
  proofEndsAt,
  recoveryStartAt,
  recoveryEndsAt,
}: ComputeExtensionInput): GuaranteeExtensionComputation {
  const currentBasisPoints =
    currentExtensionFactorBasisPoints && currentExtensionFactorBasisPoints > 0
      ? currentExtensionFactorBasisPoints
      : BASIS_POINTS_MULTIPLIER;

  const calculatedBasisPoints = calculateLowVolumeExtensionFactorBasisPoints(
    observedMonthlyLeadAverage
  );

  // We never shrink an extension once applied. This is client-favorable and keeps guarantees deterministic.
  const extensionFactorBasisPoints = Math.max(
    currentBasisPoints,
    calculatedBasisPoints
  );

  const proofDurationMs = proofEndsAt.getTime() - proofStartAt.getTime();
  const recoveryDurationMs = recoveryEndsAt.getTime() - recoveryStartAt.getTime();

  const adjustedProofEndsAt = new Date(
    proofStartAt.getTime() +
      Math.round((proofDurationMs * extensionFactorBasisPoints) / BASIS_POINTS_MULTIPLIER)
  );
  const adjustedRecoveryEndsAt = new Date(
    recoveryStartAt.getTime() +
      Math.round((recoveryDurationMs * extensionFactorBasisPoints) / BASIS_POINTS_MULTIPLIER)
  );

  return {
    observedMonthlyLeadAverage,
    extensionFactorBasisPoints,
    adjustedProofEndsAt,
    adjustedRecoveryEndsAt,
    formulaApplied: extensionFactorBasisPoints > BASIS_POINTS_MULTIPLIER,
  };
}
