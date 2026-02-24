import { describe, expect, it } from 'vitest';

import { buildGuaranteeSummary } from './summary';

describe('buildGuaranteeSummary', () => {
  it('maps proof pending status to proof stage timeline', () => {
    const summary = buildGuaranteeSummary({
      guaranteeStatus: 'proof_pending',
      guaranteeProofStartAt: new Date('2026-02-01T00:00:00.000Z'),
      guaranteeProofEndsAt: new Date('2026-03-03T00:00:00.000Z'),
      guaranteeRecoveryStartAt: new Date('2026-02-01T00:00:00.000Z'),
      guaranteeRecoveryEndsAt: new Date('2026-05-02T00:00:00.000Z'),
      guaranteeAdjustedProofEndsAt: new Date('2026-03-03T00:00:00.000Z'),
      guaranteeAdjustedRecoveryEndsAt: new Date('2026-05-02T00:00:00.000Z'),
      guaranteeObservedMonthlyLeadAverage: 18,
      guaranteeExtensionFactorBasisPoints: 10000,
      guaranteeProofQualifiedLeadEngagements: 3,
      guaranteeRecoveryAttributedOpportunities: 0,
      guaranteeRefundEligibleAt: null,
      guaranteeNotes: null,
    });

    expect(summary.stage).toBe('proof');
    expect(summary.timeline[0].state).toBe('active');
    expect(summary.timeline[1].state).toBe('pending');
    expect(summary.refundReviewRequired).toBe(false);
  });

  it('marks refund review status and extension details', () => {
    const summary = buildGuaranteeSummary({
      guaranteeStatus: 'recovery_failed_refund_review',
      guaranteeProofStartAt: new Date('2026-02-01T00:00:00.000Z'),
      guaranteeProofEndsAt: new Date('2026-03-03T00:00:00.000Z'),
      guaranteeRecoveryStartAt: new Date('2026-02-01T00:00:00.000Z'),
      guaranteeRecoveryEndsAt: new Date('2026-05-02T00:00:00.000Z'),
      guaranteeAdjustedProofEndsAt: new Date('2026-03-18T00:00:00.000Z'),
      guaranteeAdjustedRecoveryEndsAt: new Date('2026-06-16T00:00:00.000Z'),
      guaranteeObservedMonthlyLeadAverage: 10,
      guaranteeExtensionFactorBasisPoints: 15000,
      guaranteeProofQualifiedLeadEngagements: 5,
      guaranteeRecoveryAttributedOpportunities: 0,
      guaranteeRefundEligibleAt: new Date('2026-06-17T00:00:00.000Z'),
      guaranteeNotes: 'Recovery guarantee missed.',
    });

    expect(summary.stage).toBe('refund_review');
    expect(summary.refundReviewRequired).toBe(true);
    expect(summary.extension.adjusted).toBe(true);
    expect(summary.extension.factorMultiplier).toBe(1.5);
    expect(summary.timeline[1].state).toBe('failed');
  });
});
