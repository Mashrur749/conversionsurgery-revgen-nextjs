export const GUARANTEE_V2_STATUSES = [
  'proof_pending',
  'proof_passed',
  'proof_failed_refund_review',
  'recovery_pending',
  'recovery_passed',
  'recovery_failed_refund_review',
] as const;

export const LEGACY_GUARANTEE_STATUSES = [
  'pending',
  'fulfilled',
  'refund_review_required',
] as const;

export type GuaranteeV2Status = (typeof GUARANTEE_V2_STATUSES)[number];
export type LegacyGuaranteeStatus = (typeof LEGACY_GUARANTEE_STATUSES)[number];
export type GuaranteeStatusValue = GuaranteeV2Status | LegacyGuaranteeStatus | null | undefined;

export const PROOF_WINDOW_DAYS = 30;
export const RECOVERY_WINDOW_DAYS = 90;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

export function isGuaranteeV2Status(value: string | null | undefined): value is GuaranteeV2Status {
  if (!value) return false;
  return GUARANTEE_V2_STATUSES.includes(value as GuaranteeV2Status);
}

export function mapLegacyGuaranteeStatus(value: LegacyGuaranteeStatus): GuaranteeV2Status {
  switch (value) {
    case 'pending':
      return 'proof_pending';
    case 'fulfilled':
      return 'proof_passed';
    case 'refund_review_required':
      return 'proof_failed_refund_review';
    default:
      return 'proof_pending';
  }
}

export function normalizeGuaranteeV2Status(value: GuaranteeStatusValue): GuaranteeV2Status {
  if (!value) return 'proof_pending';
  if (isGuaranteeV2Status(value)) return value;
  return mapLegacyGuaranteeStatus(value as LegacyGuaranteeStatus);
}

export function toLegacyGuaranteeStatus(value: GuaranteeStatusValue): LegacyGuaranteeStatus {
  const normalized = normalizeGuaranteeV2Status(value);
  if (normalized === 'proof_pending') return 'pending';
  if (normalized === 'proof_passed') return 'pending';
  if (normalized === 'recovery_pending') return 'pending';
  if (normalized === 'proof_failed_refund_review') return 'refund_review_required';
  if (normalized === 'recovery_failed_refund_review') return 'refund_review_required';
  return 'fulfilled'; // recovery_passed
}

export interface GuaranteeWindowState {
  proofStartAt: Date;
  proofEndsAt: Date;
  recoveryStartAt: Date;
  recoveryEndsAt: Date;
  adjustedProofEndsAt: Date;
  adjustedRecoveryEndsAt: Date;
  extensionFactorBasisPoints: number;
}

export function buildInitialGuaranteeWindowState(startAt: Date): GuaranteeWindowState {
  const proofStartAt = new Date(startAt);
  const proofEndsAt = new Date(proofStartAt.getTime() + PROOF_WINDOW_DAYS * MS_IN_DAY);
  const recoveryStartAt = new Date(proofStartAt);
  const recoveryEndsAt = new Date(proofStartAt.getTime() + RECOVERY_WINDOW_DAYS * MS_IN_DAY);

  return {
    proofStartAt,
    proofEndsAt,
    recoveryStartAt,
    recoveryEndsAt,
    adjustedProofEndsAt: new Date(proofEndsAt),
    adjustedRecoveryEndsAt: new Date(recoveryEndsAt),
    extensionFactorBasisPoints: 10000,
  };
}

interface LegacyBackfillInput {
  createdAt: Date;
  guaranteeStartAt: Date | null;
  guaranteeEndsAt: Date | null;
  guaranteeStatus: GuaranteeStatusValue;
}

export interface GuaranteeBackfillState extends GuaranteeWindowState {
  guaranteeStatus: GuaranteeV2Status;
}

export function buildGuaranteeBackfillState(input: LegacyBackfillInput): GuaranteeBackfillState {
  const baseStart = input.guaranteeStartAt ?? input.createdAt;
  const defaults = buildInitialGuaranteeWindowState(baseStart);

  const proofEndsAt = input.guaranteeEndsAt ?? defaults.proofEndsAt;
  const normalizedStatus = normalizeGuaranteeV2Status(input.guaranteeStatus);

  return {
    ...defaults,
    proofEndsAt,
    adjustedProofEndsAt: new Date(proofEndsAt),
    guaranteeStatus: normalizedStatus,
  };
}
