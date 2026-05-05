import { describe, expect, it } from 'vitest';

import {
  buildFridayPulseMessage,
  isFridayPulseTime,
} from './friday-pulse';
import type { DigestStats } from './weekly-digest';

const baseStats: DigestStats = {
  newLeads: 0,
  appointmentsBooked: 0,
  estimatesInFollowUp: 0,
  jobsWonThisWeek: 0,
  revenueWonThisWeek: 0,
  jobsToCloseOut: 0,
  stuckEstimates: 0,
  probablePipelineValueDollars: 0,
};

// ── buildFridayPulseMessage ──────────────────────────────────────────────────

describe('buildFridayPulseMessage', () => {
  it('produces the exact spec template with active-week numbers', () => {
    const stats: DigestStats = {
      ...baseStats,
      newLeads: 7,
      appointmentsBooked: 3,
      probablePipelineValueDollars: 42000,
    };
    const body = buildFridayPulseMessage(stats);
    expect(body).toBe(
      'This week — 7 new leads, 3 booked, $42,000 probable pipeline. ' +
        'Your system worked while you were on site. Reply with any questions.'
    );
  });

  it('formats large pipeline values with thousands separators', () => {
    const stats: DigestStats = {
      ...baseStats,
      newLeads: 12,
      appointmentsBooked: 5,
      probablePipelineValueDollars: 1234567,
    };
    const body = buildFridayPulseMessage(stats);
    expect(body).toContain('$1,234,567 probable pipeline');
  });

  it('still fires the same template on a quiet week (zeros)', () => {
    const body = buildFridayPulseMessage(baseStats);
    expect(body).toBe(
      'This week — 0 new leads, 0 booked, $0 probable pipeline. ' +
        'Your system worked while you were on site. Reply with any questions.'
    );
  });
});

// ── isFridayPulseTime (timezone gate) ────────────────────────────────────────

describe('isFridayPulseTime', () => {
  // Friday 2026-05-08 16:02 in Edmonton = Friday 2026-05-08 22:02 UTC
  // (America/Edmonton is UTC−6 in May during MDT.)
  const edmontonFriday4pm = new Date('2026-05-08T22:02:00Z');

  it('fires at Friday 16:00 local time in client timezone', () => {
    expect(isFridayPulseTime(edmontonFriday4pm, 'America/Edmonton')).toBe(true);
  });

  it('fires anywhere in the 16:00–16:04 window', () => {
    const at1604 = new Date('2026-05-08T22:04:30Z'); // Edmonton 16:04:30
    expect(isFridayPulseTime(at1604, 'America/Edmonton')).toBe(true);
  });

  it('does not fire at 16:05 local (window closed)', () => {
    const at1605 = new Date('2026-05-08T22:05:00Z'); // Edmonton 16:05
    expect(isFridayPulseTime(at1605, 'America/Edmonton')).toBe(false);
  });

  it('does not fire at 15:59 local (one minute early)', () => {
    const at1559 = new Date('2026-05-08T21:59:00Z'); // Edmonton 15:59
    expect(isFridayPulseTime(at1559, 'America/Edmonton')).toBe(false);
  });

  it('does not fire on Thursday at the same UTC moment', () => {
    // Thursday 2026-05-07 22:02 UTC = Thursday 16:02 Edmonton
    const thursday = new Date('2026-05-07T22:02:00Z');
    expect(isFridayPulseTime(thursday, 'America/Edmonton')).toBe(false);
  });

  it('does not fire on Saturday at the same UTC moment', () => {
    // Saturday 2026-05-09 22:02 UTC = Saturday 16:02 Edmonton
    const saturday = new Date('2026-05-09T22:02:00Z');
    expect(isFridayPulseTime(saturday, 'America/Edmonton')).toBe(false);
  });

  it('respects timezone — same UTC moment is not 4pm in New York', () => {
    // Friday 2026-05-08 22:02 UTC = 18:02 in America/New_York (EDT, UTC−4)
    expect(isFridayPulseTime(edmontonFriday4pm, 'America/New_York')).toBe(false);
  });

  it('fires for New_York client when its own local time hits Friday 16:00', () => {
    // Friday 2026-05-08 16:02 New York = 20:02 UTC
    const newYorkFriday4pm = new Date('2026-05-08T20:02:00Z');
    expect(isFridayPulseTime(newYorkFriday4pm, 'America/New_York')).toBe(true);
  });

  it('handles Pacific timezone correctly (different UTC offset)', () => {
    // Friday 2026-05-08 16:02 Los Angeles = 23:02 UTC (PDT, UTC−7)
    const laFriday4pm = new Date('2026-05-08T23:02:00Z');
    expect(isFridayPulseTime(laFriday4pm, 'America/Los_Angeles')).toBe(true);
    // Same UTC moment is 17:02 in Edmonton — should not fire there.
    expect(isFridayPulseTime(laFriday4pm, 'America/Edmonton')).toBe(false);
  });
});
