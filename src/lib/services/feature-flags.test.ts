/**
 * Tests for the feature-flag resolution service.
 *
 * Resolution order tested:
 *   1. Global pause → all flags false
 *   2. Client column override (true/false) → returned immediately
 *   3. Client column null + system_settings row → system value
 *   4. Client column null + no system_settings row → false (safe default)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock getDb ───────────────────────────────────────────────────────────────
// We intercept at the module level so the service never touches a real DB.
vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/db/schema', () => ({
  clients: { id: 'id' },
  systemSettings: { key: 'key', value: 'value' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  inArray: vi.fn((_col: unknown, vals: unknown) => vals),
}));

import { getDb } from '@/db';
import {
  resolveFeatureFlag,
  resolveFeatureFlags,
  isGlobalAutomationPaused,
} from './feature-flags';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Drizzle-like query chain stub */
function buildDbStub(
  systemSettingsRows: Array<{ key: string; value: string }>,
  clientRow: Record<string, boolean | null> | null
) {
  const makeChain = (result: unknown[]) => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
  });

  return {
    select: vi.fn((columns?: unknown) => {
      // Determine which table is being queried based on columns shape
      // For system_settings queries (no columns arg or has `value` key at root)
      const isSystemSettings =
        columns === undefined ||
        (typeof columns === 'object' &&
          columns !== null &&
          'value' in columns &&
          Object.keys(columns as object).length === 1 &&
          !('dailyDigestEnabled' in (columns as object)));

      if (isSystemSettings) {
        return makeChain(systemSettingsRows);
      }
      // Client query
      return makeChain(clientRow ? [clientRow] : []);
    }),
  };
}

/** Stub that returns the global pause setting */
function buildPauseStub(paused: boolean) {
  return buildDbStub([{ key: 'global.automationPause', value: paused ? 'true' : 'false' }], null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('isGlobalAutomationPaused', () => {
  it('returns true when system_settings has global.automationPause = true', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: 'true' }]),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await isGlobalAutomationPaused();
    expect(result).toBe(true);
  });

  it('returns false when system_settings has global.automationPause = false', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: 'false' }]),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await isGlobalAutomationPaused();
    expect(result).toBe(false);
  });

  it('returns false when no system_settings row exists', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await isGlobalAutomationPaused();
    expect(result).toBe(false);
  });
});

// ─── resolveFeatureFlag ───────────────────────────────────────────────────────

describe('resolveFeatureFlag', () => {
  /**
   * Build a db stub that correctly serves:
   *  - global pause query (key = global.automationPause)
   *  - client column query
   *  - system_settings flag query (key = feature.<flag>.enabled)
   */
  function buildFullDbStub(opts: {
    globalPause: boolean;
    clientColumnValue: boolean | null | undefined; // undefined = no client row
    systemSettingValue: string | undefined; // undefined = no row
  }) {
    const callOrder: string[] = [];
    const db = {
      select: vi.fn(() => {
        const callIdx = callOrder.length;
        callOrder.push('select');
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => {
                // First call = global pause check
                if (callIdx === 0) {
                  return opts.globalPause ? [{ value: 'true' }] : [{ value: 'false' }];
                }
                // Second call = client column (only if not paused)
                if (callIdx === 1) {
                  if (opts.clientColumnValue === undefined) return [];
                  return [{ value: opts.clientColumnValue }];
                }
                // Third call = system_settings flag
                if (callIdx === 2) {
                  if (opts.systemSettingValue === undefined) return [];
                  return [{ value: opts.systemSettingValue }];
                }
                return [];
              }),
            })),
          })),
        };
      }),
    };
    return db;
  }

  it('returns false for all flags when global automation pause is active', async () => {
    const db = buildFullDbStub({ globalPause: true, clientColumnValue: true, systemSettingValue: 'true' });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'dailyDigest');
    expect(result).toBe(false);
  });

  it('returns client true override regardless of system default', async () => {
    const db = buildFullDbStub({ globalPause: false, clientColumnValue: true, systemSettingValue: 'false' });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'dailyDigest');
    expect(result).toBe(true);
  });

  it('returns client false override regardless of system default', async () => {
    const db = buildFullDbStub({ globalPause: false, clientColumnValue: false, systemSettingValue: 'true' });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'dailyDigest');
    expect(result).toBe(false);
  });

  it('falls back to system_settings true when client column is null', async () => {
    const db = buildFullDbStub({ globalPause: false, clientColumnValue: null, systemSettingValue: 'true' });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'dailyDigest');
    expect(result).toBe(true);
  });

  it('returns false (safe default) when client null and no system_settings row', async () => {
    const db = buildFullDbStub({ globalPause: false, clientColumnValue: null, systemSettingValue: undefined });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'dailyDigest');
    expect(result).toBe(false);
  });

  it('returns false for flags with no client column when system_settings row is missing', async () => {
    // engagementSignals has no client column (Wave 2+)
    const db = buildFullDbStub({ globalPause: false, clientColumnValue: undefined, systemSettingValue: undefined });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'engagementSignals');
    expect(result).toBe(false);
  });

  it('resolves system_settings true for flags with no client column', async () => {
    // opsHealthMonitor has no client column, so only 2 DB calls happen:
    //   call 0 = global pause check
    //   call 1 = system_settings flag row (no client column query in between)
    let callCount = 0;
    const db = {
      select: vi.fn(() => {
        const idx = callCount++;
        return {
          from: vi.fn(() => ({
            where: vi.fn(() => ({
              limit: vi.fn(async () => {
                if (idx === 0) return [{ value: 'false' }]; // global pause = false
                if (idx === 1) return [{ value: 'true' }];  // system_settings = true
                return [];
              }),
            })),
          })),
        };
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlag('client-1', 'opsHealthMonitor');
    expect(result).toBe(true);
  });
});

// ─── resolveFeatureFlags (batch) ──────────────────────────────────────────────

describe('resolveFeatureFlags', () => {
  it('returns all false when global pause is active', async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ value: 'true' }]),
          }),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await resolveFeatureFlags('client-1', ['dailyDigest', 'billingReminder', 'engagementSignals']);
    expect(result.dailyDigest).toBe(false);
    expect(result.billingReminder).toBe(false);
    expect(result.engagementSignals).toBe(false);
  });
});
