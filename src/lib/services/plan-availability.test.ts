import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));
vi.mock('@/db/schema', () => ({
  plans: { id: 'id', slug: 'slug', maxActiveClients: 'max_active_clients' },
  subscriptions: { id: 'id', planId: 'plan_id', status: 'status' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

import { getDb } from '@/db';
import { isPilotTierAvailable, isPlanAvailable } from './plan-availability';

function mockDb(selectResults: unknown[][]) {
  let callIndex = 0;
  const db = {
    select: vi.fn(() => {
      const result = selectResults[callIndex] ?? [];
      callIndex++;
      // Some queries end with .limit(), some end with .where()
      // Make both terminal — where() resolves and also has .limit()
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            const p = Promise.resolve(result) as unknown as Record<string, unknown>;
            p.limit = vi.fn().mockResolvedValue(result);
            return p;
          }),
          limit: vi.fn().mockResolvedValue(result),
        }),
      };
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  return db;
}

describe('plan-availability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isPilotTierAvailable', () => {
    it('returns available when under cap', async () => {
      mockDb([
        [{ id: 'plan-1', maxActiveClients: 3 }], // pilot plan
        [{ count: 1 }], // 1 active subscription
      ]);

      const result = await isPilotTierAvailable();
      expect(result.available).toBe(true);
      expect(result.activeCount).toBe(1);
      expect(result.maxAllowed).toBe(3);
    });

    it('returns unavailable when at cap', async () => {
      mockDb([
        [{ id: 'plan-1', maxActiveClients: 3 }],
        [{ count: 3 }],
      ]);

      const result = await isPilotTierAvailable();
      expect(result.available).toBe(false);
      expect(result.activeCount).toBe(3);
    });

    it('returns unavailable when pilot plan not found', async () => {
      mockDb([
        [], // no pilot plan
      ]);

      const result = await isPilotTierAvailable();
      expect(result.available).toBe(false);
      expect(result.maxAllowed).toBe(0);
    });
  });

  describe('isPlanAvailable', () => {
    it('returns available for uncapped plans', async () => {
      mockDb([
        [{ maxActiveClients: null }], // standard plan — no cap
      ]);

      const result = await isPlanAvailable('plan-standard');
      expect(result.available).toBe(true);
      expect(result.maxAllowed).toBeNull();
    });

    it('enforces cap for capped plans', async () => {
      mockDb([
        [{ maxActiveClients: 3 }],
        [{ count: 3 }],
      ]);

      const result = await isPlanAvailable('plan-pilot');
      expect(result.available).toBe(false);
      expect(result.activeCount).toBe(3);
      expect(result.maxAllowed).toBe(3);
    });

    it('throws for unknown plan', async () => {
      mockDb([[]]);
      await expect(isPlanAvailable('nonexistent')).rejects.toThrow('Plan not found');
    });
  });
});
