/**
 * Tests for the autonomous readiness checklist service (FMA 4.2).
 *
 * Strategy: mock getDb so no real DB is touched. Each check helper calls
 * getDb() independently, so we configure getDb as a sequence of stubs —
 * one per helper invocation (in Promise.all order). checkEscalationRate
 * calls getDb() once but fires two sub-queries via its own Promise.all,
 * so its single stub handles two select() calls internally.
 *
 * getDb call order matches Promise.all([kb, pricing, reviewed, escalation,
 * exclusion, businessHours]):
 *   call 0 → kb_entries (1 query)
 *   call 1 → pricing_range (1 query)
 *   call 2 → reviewed_interactions (1 query)
 *   call 3 → escalation_rate (2 queries via its own Promise.all on same db)
 *   call 4 → exclusion_list (1 query with .limit())
 *   call 5 → business_hours (1 query)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));

vi.mock('@/db/schema', () => ({
  knowledgeBase: { clientId: 'client_id' },
  clientServices: {
    clientId: 'client_id',
    canDiscussPrice: 'can_discuss_price',
    isActive: 'is_active',
    priceRangeMinCents: 'price_range_min_cents',
    priceRangeMaxCents: 'price_range_max_cents',
  },
  auditLog: { clientId: 'client_id', action: 'action' },
  clients: { id: 'id', exclusionListReviewed: 'exclusion_list_reviewed' },
  businessHours: { clientId: 'client_id' },
  leads: { clientId: 'client_id', createdAt: 'created_at', status: 'status' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((_col: unknown, val: unknown) => val),
  gte: vi.fn((_col: unknown, val: unknown) => val),
  inArray: vi.fn((_col: unknown, vals: unknown) => vals),
  count: vi.fn(() => ({ as: vi.fn() })),
  sql: Object.assign(
    vi.fn((_strings: TemplateStringsArray, ..._values: unknown[]) => 'sql'),
    { raw: vi.fn((s: string) => s) }
  ),
}));

import { getDb } from '@/db';
import { getAutonomousReadiness } from './readiness-check';

// ─── Stub builders ────────────────────────────────────────────────────────────

/** Build a single-result stub: .select().from().where() → resolves to rows */
function singleQueryStub(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

/**
 * Build a single-result stub that ends with .limit() instead of resolving
 * directly after .where(). Used by checkExclusionListReviewed.
 */
function limitQueryStub(rows: unknown[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
  };
}

/**
 * Build an escalation stub that handles two select() calls on the same db
 * instance (checkEscalationRate uses its own Promise.all with two queries).
 */
function escalationStub(totalLeads: number, escalatedLeads: number) {
  let callCount = 0;
  const stub = {
    select: vi.fn().mockImplementation(() => {
      const idx = callCount++;
      const rows =
        idx === 0
          ? [{ value: totalLeads }]
          : [{ value: escalatedLeads }];
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      };
    }),
  };
  return stub;
}

/** Count row as returned by Drizzle count() select */
function countRow(n: number): Array<{ value: number }> {
  return [{ value: n }];
}

/** Client row for the exclusion list check */
function clientRow(reviewed: boolean): Array<{ exclusionListReviewed: boolean }> {
  return [{ exclusionListReviewed: reviewed }];
}

/**
 * Wire up getDb to return a sequence of stubs, one per call.
 * Order: kb(0), pricing(1), reviewed(2), escalation(3), exclusion(4), businessHours(5)
 */
function setupMocks(opts: {
  kb: number;
  pricing: number;
  reviewed: number;
  totalLeads: number;
  escalatedLeads: number;
  exclusionReviewed: boolean;
  businessHoursCount: number;
}) {
  const stubs = [
    singleQueryStub(countRow(opts.kb)),
    singleQueryStub(countRow(opts.pricing)),
    singleQueryStub(countRow(opts.reviewed)),
    escalationStub(opts.totalLeads, opts.escalatedLeads),
    limitQueryStub(clientRow(opts.exclusionReviewed)),
    singleQueryStub(countRow(opts.businessHoursCount)),
  ];

  let callIndex = 0;
  vi.mocked(getDb).mockImplementation(() => {
    const stub = stubs[callIndex++];
    return stub as unknown as ReturnType<typeof getDb>;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('getAutonomousReadiness', () => {
  it('returns 6 items with correct structure', async () => {
    setupMocks({ kb: 10, pricing: 1, reviewed: 30, totalLeads: 10, escalatedLeads: 0, exclusionReviewed: true, businessHoursCount: 1 });

    const result = await getAutonomousReadiness('client-1');

    expect(result.totalCount).toBe(6);
    expect(result.items).toHaveLength(6);
  });

  it('all checks pass → allCriticalPassed true, passedCount 6', async () => {
    setupMocks({ kb: 15, pricing: 2, reviewed: 50, totalLeads: 20, escalatedLeads: 2, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');

    expect(result.allCriticalPassed).toBe(true);
    expect(result.passedCount).toBe(6);
    expect(result.items.every((i) => i.passed)).toBe(true);
  });

  it('kb_entries below threshold (5 < 10) → critical fails', async () => {
    setupMocks({ kb: 5, pricing: 2, reviewed: 50, totalLeads: 20, escalatedLeads: 2, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'kb_entries')!;

    expect(item.passed).toBe(false);
    expect(item.severity).toBe('critical');
    expect(item.currentValue).toBe(5);
    expect(item.requiredValue).toBe(10);
    expect(result.allCriticalPassed).toBe(false);
  });

  it('kb_entries at threshold (exactly 10) → passes', async () => {
    setupMocks({ kb: 10, pricing: 1, reviewed: 30, totalLeads: 10, escalatedLeads: 0, exclusionReviewed: true, businessHoursCount: 1 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'kb_entries')!;

    expect(item.passed).toBe(true);
    expect(item.currentValue).toBe(10);
  });

  it('pricing_range = 0 → critical fails', async () => {
    setupMocks({ kb: 12, pricing: 0, reviewed: 50, totalLeads: 20, escalatedLeads: 2, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'pricing_range')!;

    expect(item.passed).toBe(false);
    expect(item.severity).toBe('critical');
    expect(item.currentValue).toBe(0);
    expect(result.allCriticalPassed).toBe(false);
  });

  it('reviewed_interactions below threshold (10 < 30) → critical fails', async () => {
    setupMocks({ kb: 12, pricing: 2, reviewed: 10, totalLeads: 20, escalatedLeads: 2, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'reviewed_interactions')!;

    expect(item.passed).toBe(false);
    expect(item.severity).toBe('critical');
    expect(item.currentValue).toBe(10);
    expect(item.requiredValue).toBe(30);
  });

  it('escalation rate at boundary (exactly 20%) → warning fails', async () => {
    // 20/100 = 20% — NOT < 20, so fails
    setupMocks({ kb: 12, pricing: 2, reviewed: 50, totalLeads: 100, escalatedLeads: 20, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'escalation_rate')!;

    expect(item.passed).toBe(false);
    expect(item.severity).toBe('warning');
    expect(item.currentValue).toBe(20);
    expect(item.requiredValue).toBe(20);
  });

  it('escalation rate just below threshold (19%) → warning passes', async () => {
    setupMocks({ kb: 12, pricing: 2, reviewed: 50, totalLeads: 100, escalatedLeads: 19, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'escalation_rate')!;

    expect(item.passed).toBe(true);
    expect(item.currentValue).toBe(19);
  });

  it('escalation rate with 0 total leads → rate is 0, passes', async () => {
    setupMocks({ kb: 12, pricing: 2, reviewed: 50, totalLeads: 0, escalatedLeads: 0, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'escalation_rate')!;

    expect(item.passed).toBe(true);
    expect(item.currentValue).toBe(0);
  });

  it('exclusion list not reviewed → critical fails', async () => {
    setupMocks({ kb: 12, pricing: 2, reviewed: 50, totalLeads: 20, escalatedLeads: 2, exclusionReviewed: false, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'exclusion_list')!;

    expect(item.passed).toBe(false);
    expect(item.severity).toBe('critical');
    expect(item.currentValue).toBe(false);
    expect(item.requiredValue).toBe(true);
    expect(result.allCriticalPassed).toBe(false);
  });

  it('business hours not configured → critical fails', async () => {
    setupMocks({ kb: 12, pricing: 2, reviewed: 50, totalLeads: 20, escalatedLeads: 2, exclusionReviewed: true, businessHoursCount: 0 });

    const result = await getAutonomousReadiness('client-1');
    const item = result.items.find((i) => i.key === 'business_hours')!;

    expect(item.passed).toBe(false);
    expect(item.severity).toBe('critical');
    expect(result.allCriticalPassed).toBe(false);
  });

  it('warning failure only → allCriticalPassed still true', async () => {
    // 30% escalation (warning), all criticals pass
    setupMocks({ kb: 12, pricing: 2, reviewed: 50, totalLeads: 10, escalatedLeads: 3, exclusionReviewed: true, businessHoursCount: 3 });

    const result = await getAutonomousReadiness('client-1');

    expect(result.allCriticalPassed).toBe(true);
    expect(result.passedCount).toBe(5);
    const item = result.items.find((i) => i.key === 'escalation_rate')!;
    expect(item.passed).toBe(false);
    expect(item.severity).toBe('warning');
  });

  it('all checks fail → allCriticalPassed false, passedCount 0', async () => {
    setupMocks({ kb: 0, pricing: 0, reviewed: 0, totalLeads: 10, escalatedLeads: 5, exclusionReviewed: false, businessHoursCount: 0 });

    const result = await getAutonomousReadiness('client-1');

    expect(result.allCriticalPassed).toBe(false);
    expect(result.passedCount).toBe(0);
  });

  it('each item has all required fields with correct types', async () => {
    setupMocks({ kb: 10, pricing: 1, reviewed: 30, totalLeads: 10, escalatedLeads: 0, exclusionReviewed: true, businessHoursCount: 1 });

    const result = await getAutonomousReadiness('client-1');

    for (const item of result.items) {
      expect(typeof item.key).toBe('string');
      expect(item.key.length).toBeGreaterThan(0);
      expect(typeof item.label).toBe('string');
      expect(item.label.length).toBeGreaterThan(0);
      expect(typeof item.description).toBe('string');
      expect(item.description.length).toBeGreaterThan(0);
      expect(typeof item.passed).toBe('boolean');
      expect(['critical', 'warning']).toContain(item.severity);
      expect(item.currentValue !== undefined).toBe(true);
      expect(item.requiredValue !== undefined).toBe(true);
    }
  });

  it('items appear in the 6 expected keys in order', async () => {
    setupMocks({ kb: 10, pricing: 1, reviewed: 30, totalLeads: 10, escalatedLeads: 0, exclusionReviewed: true, businessHoursCount: 1 });

    const result = await getAutonomousReadiness('client-1');
    const keys = result.items.map((i) => i.key);

    expect(keys).toEqual([
      'kb_entries',
      'pricing_range',
      'reviewed_interactions',
      'escalation_rate',
      'exclusion_list',
      'business_hours',
    ]);
  });

  it('escalation_rate is only warning-severity item', async () => {
    setupMocks({ kb: 10, pricing: 1, reviewed: 30, totalLeads: 10, escalatedLeads: 0, exclusionReviewed: true, businessHoursCount: 1 });

    const result = await getAutonomousReadiness('client-1');
    const warnings = result.items.filter((i) => i.severity === 'warning');
    const criticals = result.items.filter((i) => i.severity === 'critical');

    expect(warnings).toHaveLength(1);
    expect(warnings[0].key).toBe('escalation_rate');
    expect(criticals).toHaveLength(5);
  });
});
