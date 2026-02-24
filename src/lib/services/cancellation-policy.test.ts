import { describe, expect, it } from 'vitest';
import {
  CANCELLATION_NOTICE_DAYS,
  addBusinessDays,
  calculateEffectiveCancellationDate,
} from '@/lib/services/cancellation-policy';

describe('cancellation-policy', () => {
  it('calculates effective cancellation date using 30-day notice', () => {
    const noticeAt = new Date('2026-02-24T12:00:00.000Z');
    const effective = calculateEffectiveCancellationDate(noticeAt);

    expect(CANCELLATION_NOTICE_DAYS).toBe(30);
    expect(effective.toISOString().slice(0, 10)).toBe('2026-03-26');
  });

  it('adds business days while skipping weekends', () => {
    const friday = new Date('2026-02-20T16:00:00.000Z');

    const plusOne = addBusinessDays(friday, 1);
    const plusFive = addBusinessDays(friday, 5);

    expect(plusOne.toISOString().slice(0, 10)).toBe('2026-02-23');
    expect(plusFive.toISOString().slice(0, 10)).toBe('2026-02-27');
  });
});
