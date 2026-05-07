/**
 * Dormant re-engagement — verifies the dormancy window is anchored on
 * COALESCE(inquiry_date, created_at) rather than updatedAt, and that the
 * dormantReengagementSentAt dedup signal prevents weekly re-fires.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
const mockUpdate = vi.fn(() => ({ set: vi.fn(() => ({ where: mockUpdateWhere })) }));
const mockInsert = vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }));

const mockDb = {
  select: () => mockSelect(),
  update: mockUpdate,
  insert: mockInsert,
  query: {
    consentRecords: {
      findFirst: vi.fn().mockResolvedValue(undefined),
    },
  },
};

vi.mock('@/db', () => ({
  getDb: () => mockDb,
  consentRecords: {},
  leads: {},
  clients: {},
  conversations: {},
}));

vi.mock('@/db/schema', () => ({
  leads: {
    inquiryDate: { name: 'inquiry_date' },
    createdAt: { name: 'created_at' },
    dormantReengagementSentAt: { name: 'dormant_reengagement_sent_at' },
  },
  clients: {},
  conversations: {},
  consentRecords: {},
}));

// Capture drizzle-orm calls so we can assert the query shape.
const eqCalls: Array<[unknown, unknown]> = [];
const gteCalls: Array<[unknown, unknown]> = [];
const lteCalls: Array<[unknown, unknown]> = [];
const isNullCalls: unknown[] = [];
const sqlCalls: Array<{ raw: string }> = [];

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => {
    eqCalls.push([a, b]);
    return { _kind: 'eq', a, b };
  }),
  and: vi.fn((...args: unknown[]) => ({ _kind: 'and', args })),
  gte: vi.fn((a: unknown, b: unknown) => {
    gteCalls.push([a, b]);
    return { _kind: 'gte', a, b };
  }),
  lte: vi.fn((a: unknown, b: unknown) => {
    lteCalls.push([a, b]);
    return { _kind: 'lte', a, b };
  }),
  isNull: vi.fn((a: unknown) => {
    isNullCalls.push(a);
    return { _kind: 'isNull', a };
  }),
  inArray: vi.fn(),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      // Reconstruct a string representation for assertion
      let raw = '';
      strings.forEach((s, i) => {
        raw += s;
        if (i < values.length) raw += `<${(values[i] as { name?: string })?.name ?? '?'}>`;
      });
      sqlCalls.push({ raw });
      return { _kind: 'sql', raw };
    },
    { raw: vi.fn() }
  ),
}));

vi.mock('@/lib/compliance/compliance-gateway', () => ({
  sendCompliantMessage: vi.fn(),
}));
vi.mock('@/lib/services/internal-error-log', () => ({
  logSanitizedConsoleError: vi.fn(),
}));
vi.mock('@/lib/compliance/compliance-service', () => ({
  ComplianceService: {
    hashPhoneNumber: vi.fn(() => 'hash'),
  },
}));

// Force the send window to be open so the function actually runs the query.
vi.mock('@/lib/utils/send-window', () => ({
  isWithinLocalSendWindow: () => true,
}));

import { runDormantReengagement } from './dormant-reengagement';

beforeEach(() => {
  vi.clearAllMocks();
  eqCalls.length = 0;
  gteCalls.length = 0;
  lteCalls.length = 0;
  isNullCalls.length = 0;
  sqlCalls.length = 0;

  // Mock the .from(...).innerJoin(...).where(...) chain to return [].
  mockSelect.mockReturnValue({
    from: () => ({
      innerJoin: () => ({
        where: () => Promise.resolve([]),
      }),
    }),
  });
});

describe('runDormantReengagement — inquiry_date anchor', () => {
  it('builds the dormancy window using COALESCE(inquiry_date, created_at)', async () => {
    await runDormantReengagement();

    // The implementation calls sql`COALESCE(${leads.inquiryDate}, ${leads.createdAt})`.
    // We captured that call shape above.
    expect(sqlCalls.length).toBeGreaterThan(0);
    const coalesce = sqlCalls.find((c) => c.raw.includes('COALESCE'));
    expect(coalesce).toBeDefined();
    expect(coalesce?.raw).toContain('inquiry_date');
    expect(coalesce?.raw).toContain('created_at');
  });

  it('compares the inquiry_date anchor to the 180/210-day cutoffs (gte + lte)', async () => {
    await runDormantReengagement();

    // The window predicate is: gte(anchor, cutoffOld) AND lte(anchor, cutoffRecent).
    // The first arg of both should be the SAME sql expression (the COALESCE).
    expect(gteCalls.length).toBeGreaterThan(0);
    expect(lteCalls.length).toBeGreaterThan(0);

    const gteAnchor = gteCalls[0][0] as { _kind?: string; raw?: string };
    const lteAnchor = lteCalls[0][0] as { _kind?: string; raw?: string };
    expect(gteAnchor._kind).toBe('sql');
    expect(lteAnchor._kind).toBe('sql');
    expect(gteAnchor.raw).toContain('COALESCE');
    expect(lteAnchor.raw).toContain('COALESCE');
  });

  it('filters leads that have already been re-engaged (isNull dormantReengagementSentAt)', async () => {
    await runDormantReengagement();

    // The query must include isNull(leads.dormantReengagementSentAt) — without
    // it, leads can be re-messaged on every weekly run because updatedAt no
    // longer evicts them from the inquiry-anchored window.
    expect(isNullCalls.length).toBeGreaterThan(0);
    const targets = isNullCalls.map((c) => (c as { name?: string }).name);
    expect(targets).toContain('dormant_reengagement_sent_at');
  });
});
