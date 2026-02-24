import { describe, expect, it } from 'vitest';

import {
  applyLowVolumeExtensionFormula,
  calculateLowVolumeExtensionFactorBasisPoints,
} from './extension-formula';

describe('calculateLowVolumeExtensionFactorBasisPoints', () => {
  it('returns 1.25x for 12 leads/month', () => {
    expect(calculateLowVolumeExtensionFactorBasisPoints(12)).toBe(12500);
  });

  it('returns 1.5x for 10 leads/month', () => {
    expect(calculateLowVolumeExtensionFactorBasisPoints(10)).toBe(15000);
  });

  it('returns 1.875x for 8 leads/month', () => {
    expect(calculateLowVolumeExtensionFactorBasisPoints(8)).toBe(18750);
  });

  it('returns 1x when volume is at or above threshold', () => {
    expect(calculateLowVolumeExtensionFactorBasisPoints(15)).toBe(10000);
    expect(calculateLowVolumeExtensionFactorBasisPoints(22)).toBe(10000);
  });
});

describe('applyLowVolumeExtensionFormula', () => {
  it('applies extension windows based on the computed factor', () => {
    const proofStartAt = new Date('2026-02-01T00:00:00.000Z');
    const proofEndsAt = new Date('2026-03-03T00:00:00.000Z'); // 30 days
    const recoveryStartAt = new Date('2026-02-01T00:00:00.000Z');
    const recoveryEndsAt = new Date('2026-05-02T00:00:00.000Z'); // 90 days

    const result = applyLowVolumeExtensionFormula({
      observedMonthlyLeadAverage: 10,
      currentExtensionFactorBasisPoints: 10000,
      proofStartAt,
      proofEndsAt,
      recoveryStartAt,
      recoveryEndsAt,
    });

    expect(result.extensionFactorBasisPoints).toBe(15000);
    expect(result.adjustedProofEndsAt.toISOString()).toBe('2026-03-18T00:00:00.000Z'); // 45 days
    expect(result.adjustedRecoveryEndsAt.toISOString()).toBe('2026-06-16T00:00:00.000Z'); // 135 days
  });

  it('does not shrink previously applied extension factors', () => {
    const proofStartAt = new Date('2026-02-01T00:00:00.000Z');
    const proofEndsAt = new Date('2026-03-03T00:00:00.000Z');
    const recoveryStartAt = new Date('2026-02-01T00:00:00.000Z');
    const recoveryEndsAt = new Date('2026-05-02T00:00:00.000Z');

    const result = applyLowVolumeExtensionFormula({
      observedMonthlyLeadAverage: 14,
      currentExtensionFactorBasisPoints: 15000,
      proofStartAt,
      proofEndsAt,
      recoveryStartAt,
      recoveryEndsAt,
    });

    expect(result.extensionFactorBasisPoints).toBe(15000);
  });
});
