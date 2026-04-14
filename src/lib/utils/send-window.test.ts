import { describe, it, expect, vi, afterEach } from 'vitest';
import { isWithinLocalSendWindow } from './send-window';

// Standard win-back/dormant overrides: Monday no earlier than 11am, Friday no later than 1pm
const WIN_BACK_OVERRIDES = [
  { day: 1, startHour: 11 },  // Monday: 11am-2pm
  { day: 5, endHour: 13 },    // Friday: 10am-1pm
];

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

  // Day-specific override tests
  it('blocks Monday before 11am with day override', () => {
    // Monday 10:30am Mountain = Monday 4:30pm UTC
    vi.setSystemTime(new Date('2026-04-13T16:30:00Z'));
    // Without override: 10:30am is within 10-14 → true
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
    // With override: Monday starts at 11am → false
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(false);
  });

  it('allows Monday at 11am with day override', () => {
    // Monday 11am Mountain = Monday 5pm UTC
    vi.setSystemTime(new Date('2026-04-13T17:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(true);
  });

  it('blocks Friday at 1pm with day override', () => {
    // Friday 1pm Mountain = Friday 7pm UTC
    vi.setSystemTime(new Date('2026-04-17T19:00:00Z'));
    // Without override: 1pm is within 10-14 → true
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14)).toBe(true);
    // With override: Friday ends at 1pm → false
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(false);
  });

  it('allows Friday at 12pm with day override', () => {
    // Friday 12pm Mountain = Friday 6pm UTC
    vi.setSystemTime(new Date('2026-04-17T18:00:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(true);
  });

  it('Tuesday unaffected by day overrides', () => {
    // Tuesday 10:30am Mountain
    vi.setSystemTime(new Date('2026-04-14T16:30:00Z'));
    expect(isWithinLocalSendWindow('America/Edmonton', 10, 14, WIN_BACK_OVERRIDES)).toBe(true);
  });
});
