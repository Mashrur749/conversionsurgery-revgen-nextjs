import { describe, expect, it } from 'vitest';

import {
  buildGuaranteeBackfillState,
  buildInitialGuaranteeWindowState,
  mapLegacyGuaranteeStatus,
  normalizeGuaranteeV2Status,
  toLegacyGuaranteeStatus,
} from './state-machine';

describe('guarantee-v2 state machine primitives', () => {
  it('maps legacy statuses to v2 statuses deterministically', () => {
    expect(mapLegacyGuaranteeStatus('pending')).toBe('proof_pending');
    expect(mapLegacyGuaranteeStatus('fulfilled')).toBe('proof_passed');
    expect(mapLegacyGuaranteeStatus('refund_review_required')).toBe('proof_failed_refund_review');
  });

  it('normalizes unknown/null values to proof_pending', () => {
    expect(normalizeGuaranteeV2Status(null)).toBe('proof_pending');
    expect(normalizeGuaranteeV2Status(undefined)).toBe('proof_pending');
  });

  it('can convert v2 status to legacy compatibility status', () => {
    expect(toLegacyGuaranteeStatus('proof_pending')).toBe('pending');
    expect(toLegacyGuaranteeStatus('proof_passed')).toBe('pending');
    expect(toLegacyGuaranteeStatus('recovery_pending')).toBe('pending');
    expect(toLegacyGuaranteeStatus('recovery_passed')).toBe('fulfilled');
    expect(toLegacyGuaranteeStatus('proof_failed_refund_review')).toBe('refund_review_required');
    expect(toLegacyGuaranteeStatus('recovery_failed_refund_review')).toBe('refund_review_required');
  });

  it('builds default 30/90-day windows from start date', () => {
    const start = new Date('2026-02-01T00:00:00.000Z');
    const state = buildInitialGuaranteeWindowState(start);

    expect(state.proofStartAt.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    expect(state.proofEndsAt.toISOString()).toBe('2026-03-03T00:00:00.000Z');
    expect(state.recoveryEndsAt.toISOString()).toBe('2026-05-02T00:00:00.000Z');
    expect(state.extensionFactorBasisPoints).toBe(10000);
  });

  it('backfill keeps legacy proof end date and maps status', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const guaranteeStartAt = new Date('2026-01-10T00:00:00.000Z');
    const guaranteeEndsAt = new Date('2026-02-09T00:00:00.000Z');

    const backfill = buildGuaranteeBackfillState({
      createdAt,
      guaranteeStartAt,
      guaranteeEndsAt,
      guaranteeStatus: 'fulfilled',
    });

    expect(backfill.guaranteeStatus).toBe('proof_passed');
    expect(backfill.proofStartAt.toISOString()).toBe('2026-01-10T00:00:00.000Z');
    expect(backfill.proofEndsAt.toISOString()).toBe('2026-02-09T00:00:00.000Z');
    expect(backfill.adjustedProofEndsAt.toISOString()).toBe('2026-02-09T00:00:00.000Z');
  });
});
