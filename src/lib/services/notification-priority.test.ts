/**
 * Tests for notification-priority.ts (FMA 3.1)
 *
 * Classification tests are pure (no DB).
 * Cap-check tests mock the DB via vi.mock('@/db').
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyPriority,
  canSendImmediate,
  type NotificationType,
  type Priority,
} from './notification-priority';

// ---------------------------------------------------------------------------
// DB mock — intercept getDb() to avoid real Neon connections
// ---------------------------------------------------------------------------

const mockCount = vi.fn<() => Promise<{ total: number }[]>>();

vi.mock('@/db', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: mockCount,
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function setP1CountForToday(sent: number) {
  mockCount.mockResolvedValueOnce([{ total: sent }]);
}

// ---------------------------------------------------------------------------
// Classification — pure, no DB
// ---------------------------------------------------------------------------

describe('classifyPriority', () => {
  it.each<[NotificationType, Priority]>([
    // P0
    ['opt_out_confirmation', 'P0'],
    ['compliance_alert', 'P0'],
    ['pause_notification', 'P0'],
    ['resume_notification', 'P0'],
    // P1
    ['booking_confirmation', 'P1'],
    ['escalation_needs_contractor', 'P1'],
    ['hot_transfer_missed', 'P1'],
    ['billing_reminder', 'P1'],
    ['onboarding_reminder', 'P1'],
    // P2
    ['kb_gap_detected', 'P2'],
    ['probable_win', 'P2'],
    ['stuck_estimate', 'P2'],
    ['quote_prompt', 'P2'],
    // P3
    ['pipeline_sms', 'P3'],
    ['report_notification', 'P3'],
  ])('%s → %s', (type, expected) => {
    expect(classifyPriority(type)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// canSendImmediate — P0
// ---------------------------------------------------------------------------

describe('canSendImmediate — P0', () => {
  it('always returns true regardless of DB state', async () => {
    // DB should NOT be called for P0
    const result = await canSendImmediate('client-1', 'P0');
    expect(result).toBe(true);
    expect(mockCount).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// canSendImmediate — P1 (cap enforcement)
// ---------------------------------------------------------------------------

describe('canSendImmediate — P1', () => {
  beforeEach(() => {
    mockCount.mockReset();
  });

  it('returns true when 0 P1 messages sent today', async () => {
    setP1CountForToday(0);
    const result = await canSendImmediate('client-1', 'P1');
    expect(result).toBe(true);
  });

  it('returns true when 1 P1 message sent today (under cap)', async () => {
    setP1CountForToday(1);
    const result = await canSendImmediate('client-1', 'P1');
    expect(result).toBe(true);
  });

  it('returns false when 2 P1 messages sent today (at cap)', async () => {
    setP1CountForToday(2);
    const result = await canSendImmediate('client-1', 'P1');
    expect(result).toBe(false);
  });

  it('returns false when >2 P1 messages sent today (over cap)', async () => {
    setP1CountForToday(5);
    const result = await canSendImmediate('client-1', 'P1');
    expect(result).toBe(false);
  });

  it('returns false when DB returns empty rows (treats as 0 and no cap hit)', async () => {
    // Edge: DB returns [] — should default to 0 → under cap
    mockCount.mockResolvedValueOnce([]);
    const result = await canSendImmediate('client-1', 'P1');
    expect(result).toBe(true);
  });

  it('queries the DB (cap check is per-client)', async () => {
    setP1CountForToday(0);
    await canSendImmediate('client-abc', 'P1');
    expect(mockCount).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// canSendImmediate — P2 / P3 (always queued)
// ---------------------------------------------------------------------------

describe('canSendImmediate — P2 and P3', () => {
  beforeEach(() => {
    mockCount.mockReset();
  });

  it('P2 always returns false', async () => {
    const result = await canSendImmediate('client-1', 'P2');
    expect(result).toBe(false);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('P3 always returns false', async () => {
    const result = await canSendImmediate('client-1', 'P3');
    expect(result).toBe(false);
    expect(mockCount).not.toHaveBeenCalled();
  });
});
