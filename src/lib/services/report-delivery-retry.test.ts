import { describe, expect, it } from 'vitest';
import {
  evaluateReportDeliveryRetryEligibility,
  getReportDeliveryBackoffMs,
  getReportDeliveryNextRetryAt,
  REPORT_DELIVERY_RETRY_POLICY,
} from '@/lib/services/report-delivery-retry';

describe('report delivery retry policy', () => {
  it('applies exponential backoff with max cap', () => {
    expect(getReportDeliveryBackoffMs(1)).toBe(30 * 60 * 1000);
    expect(getReportDeliveryBackoffMs(2)).toBe(60 * 60 * 1000);
    expect(getReportDeliveryBackoffMs(3)).toBe(120 * 60 * 1000);
    expect(getReportDeliveryBackoffMs(6)).toBe(
      REPORT_DELIVERY_RETRY_POLICY.maxBackoffMinutes * 60 * 1000
    );
  });

  it('computes next retry from failedAt and attempt count', () => {
    const failedAt = new Date('2026-02-24T10:00:00.000Z');
    const nextRetryAt = getReportDeliveryNextRetryAt(failedAt, 2);
    expect(nextRetryAt.toISOString()).toBe('2026-02-24T11:00:00.000Z');
  });

  it('blocks retries until backoff window is reached', () => {
    const failedAt = new Date('2026-02-24T10:00:00.000Z');
    const pending = evaluateReportDeliveryRetryEligibility(
      {
        state: 'failed',
        attemptCount: 1,
        failedAt,
        lastStateAt: failedAt,
      },
      new Date('2026-02-24T10:10:00.000Z')
    );

    expect(pending.eligible).toBe(false);
    expect(pending.reason).toBe('backoff_pending');

    const eligible = evaluateReportDeliveryRetryEligibility(
      {
        state: 'failed',
        attemptCount: 1,
        failedAt,
        lastStateAt: failedAt,
      },
      new Date('2026-02-24T10:31:00.000Z')
    );

    expect(eligible.eligible).toBe(true);
    expect(eligible.reason).toBe('eligible');
  });

  it('marks attempts at policy cap as terminal', () => {
    const failedAt = new Date('2026-02-24T10:00:00.000Z');
    const eligibility = evaluateReportDeliveryRetryEligibility(
      {
        state: 'failed',
        attemptCount: REPORT_DELIVERY_RETRY_POLICY.maxAttempts,
        failedAt,
        lastStateAt: failedAt,
      },
      new Date('2026-02-24T12:00:00.000Z')
    );

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reason).toBe('retry_exhausted');
  });
});

