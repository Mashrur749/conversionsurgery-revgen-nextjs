import { describe, it, expect, vi, afterEach } from 'vitest';
import { isWithinLocalSendWindow } from './send-window';

describe('isWithinLocalSendWindow', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns true during weekday business window in Alberta', () => {
    // Tuesday 11am Mountain Time = Tuesday 5pm UTC (MDT is UTC-6)
    vi.setSystemTime(new Date('2026-04-14T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
  });

  it('returns false before window opens in Alberta timezone', () => {
    // Tuesday 9am Mountain = Tuesday 3pm UTC
    vi.setSystemTime(new Date('2026-04-14T15:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('returns false after window closes in Alberta timezone', () => {
    // Tuesday 3pm Mountain = Tuesday 9pm UTC
    vi.setSystemTime(new Date('2026-04-14T21:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('returns false on Saturday', () => {
    vi.setSystemTime(new Date('2026-04-18T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('returns false on Sunday', () => {
    vi.setSystemTime(new Date('2026-04-19T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('handles edge at exactly window open', () => {
    vi.setSystemTime(new Date('2026-04-14T16:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
  });

  it('handles edge at exactly window close', () => {
    vi.setSystemTime(new Date('2026-04-14T20:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(false);
  });

  it('works with different timezone', () => {
    vi.setSystemTime(new Date('2026-04-14T15:00:00Z'));
    expect(isWithinLocalSendWindow('America/Toronto', 10, 14)).toBe(true);
  });
});
