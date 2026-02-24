import { describe, expect, it } from 'vitest';

import { isLeadEligibleForEstimateNudge } from './estimate-nudge';

describe('isLeadEligibleForEstimateNudge', () => {
  const now = new Date('2026-02-24T00:00:00.000Z');
  const staleUpdatedAt = new Date('2026-02-18T00:00:00.000Z'); // 6 days old
  const recentUpdatedAt = new Date('2026-02-22T00:00:00.000Z'); // 2 days old

  it('returns true for stale contacted lead without blockers', () => {
    const eligible = isLeadEligibleForEstimateNudge({
      status: 'contacted',
      updatedAt: staleUpdatedAt,
      optedOut: false,
      hasActiveEstimateSequence: false,
      nudgedWithinCooldown: false,
      now,
    });

    expect(eligible).toBe(true);
  });

  it('returns false for non-contacted status', () => {
    const eligible = isLeadEligibleForEstimateNudge({
      status: 'estimate_sent',
      updatedAt: staleUpdatedAt,
      optedOut: false,
      hasActiveEstimateSequence: false,
      nudgedWithinCooldown: false,
      now,
    });

    expect(eligible).toBe(false);
  });

  it('returns false when lead is not stale enough', () => {
    const eligible = isLeadEligibleForEstimateNudge({
      status: 'contacted',
      updatedAt: recentUpdatedAt,
      optedOut: false,
      hasActiveEstimateSequence: false,
      nudgedWithinCooldown: false,
      now,
    });

    expect(eligible).toBe(false);
  });

  it('returns false when cooldown already applies', () => {
    const eligible = isLeadEligibleForEstimateNudge({
      status: 'contacted',
      updatedAt: staleUpdatedAt,
      optedOut: false,
      hasActiveEstimateSequence: false,
      nudgedWithinCooldown: true,
      now,
    });

    expect(eligible).toBe(false);
  });

  it('returns false when active estimate sequence exists', () => {
    const eligible = isLeadEligibleForEstimateNudge({
      status: 'contacted',
      updatedAt: staleUpdatedAt,
      optedOut: false,
      hasActiveEstimateSequence: true,
      nudgedWithinCooldown: false,
      now,
    });

    expect(eligible).toBe(false);
  });
});
