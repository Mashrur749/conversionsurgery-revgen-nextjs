import { describe, expect, it } from 'vitest';

import {
  describeBiweeklyPeriod,
  getLatestBiweeklyPeriodEnd,
  getNextBiweeklyPeriodEnd,
  getNextUtcMonthPeriod,
  getUtcMonthPeriodStart,
} from '@/lib/services/cron-catchup';

describe('cron catch-up period helpers', () => {
  it('resolves UTC monthly period boundaries deterministically', () => {
    const now = new Date('2026-03-19T12:15:00.000Z');
    const currentPeriod = getUtcMonthPeriodStart(now);
    const nextPeriod = getNextUtcMonthPeriod(currentPeriod);

    expect(currentPeriod.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(nextPeriod.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('resolves latest bi-weekly period end for even and odd weeks', () => {
    const oddWeekDate = new Date('2026-02-24T12:00:00.000Z'); // ISO week 9 (odd) -> previous even week
    const evenWeekDate = new Date('2026-03-03T12:00:00.000Z'); // ISO week 10 (even)

    const fromEvenWeek = getLatestBiweeklyPeriodEnd(evenWeekDate);
    const fromOddWeek = getLatestBiweeklyPeriodEnd(oddWeekDate);

    expect(fromEvenWeek.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(fromOddWeek.toISOString()).toBe('2026-02-15T00:00:00.000Z');
  });

  it('derives bi-weekly period descriptor and next period end', () => {
    const periodEnd = new Date('2026-03-01T00:00:00.000Z');
    const descriptor = describeBiweeklyPeriod(periodEnd);
    const nextEnd = getNextBiweeklyPeriodEnd(periodEnd);

    expect(descriptor.periodStart).toBe('2026-02-16');
    expect(descriptor.periodEnd).toBe('2026-03-01');
    expect(descriptor.periodKey).toBe('2026-02-16..2026-03-01');
    expect(nextEnd.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });
});
