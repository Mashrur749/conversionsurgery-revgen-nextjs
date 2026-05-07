/**
 * CASL intake gate — POST /api/leads (operator quick-add) tests.
 *
 * Verifies the three-mode discriminated-union contract:
 *   - inquiry:           recent inquiry (≤180d) → implied consent (manual_entry)
 *   - express_consent:   any age + evidence (≥10 chars) → express_written consent
 *   - existing_customer: paid customer (≤730d) → implied consent (existing_customer)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
const mockGetClientId = vi.fn();
const mockNormalizePhone = vi.fn((p: string) => {
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
});
const mockRecordConsent = vi.fn((..._args: unknown[]) => Promise.resolve('consent-id'));
const mockGetAgencySession = vi.fn();
const mockCanAccessClient = vi.fn((..._args: unknown[]) => true);
const mockCheckUsageLimit = vi.fn(
  async (..._args: unknown[]) => ({ allowed: true, current: 0, limit: 1000 })
);

const insertReturning = vi.fn();
const insertValues = vi.fn((..._args: unknown[]) => ({ returning: insertReturning }));
const dbInsert = vi.fn((..._args: unknown[]) => ({ values: insertValues }));

const selectFromWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
const mockGetDb = vi.fn(() => ({
  insert: dbInsert,
  select: () => ({ from: () => ({ where: selectFromWhere }) }),
}));

vi.mock('@/auth', () => ({ auth: () => mockAuth() }));
vi.mock('@/lib/get-client-id', () => ({ getClientId: () => mockGetClientId() }));
vi.mock('@/lib/permissions', () => ({
  getAgencySession: () => mockGetAgencySession(),
  canAccessClient: (a: unknown, b: unknown) => mockCanAccessClient(a, b),
}));
vi.mock('@/lib/utils/phone', () => ({
  normalizePhoneNumber: (p: string) => mockNormalizePhone(p),
}));
vi.mock('@/db', () => ({
  getDb: () => mockGetDb(),
}));
vi.mock('@/db/schema/leads', () => ({
  leads: {
    id: 'id',
    clientId: 'client_id',
    phone: 'phone',
    name: 'name',
    score: 'score',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    status: 'status',
    source: 'source',
    temperature: 'temperature',
    email: 'email',
  },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  ilike: vi.fn(),
  sql: Object.assign(vi.fn(() => 'sql-token'), {
    raw: vi.fn(),
  }),
  desc: vi.fn(),
  asc: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  count: vi.fn(),
}));
vi.mock('@/lib/services/subscription', () => ({
  checkUsageLimit: (a: unknown, b: unknown, c: unknown) => mockCheckUsageLimit(a, b, c),
}));
vi.mock('@/lib/compliance/compliance-service', () => ({
  ComplianceService: {
    recordConsent: (a: unknown, b: unknown, c: unknown) => mockRecordConsent(a, b, c),
  },
}));

// Import after mocks
import { POST } from './route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDateDaysAgo(days: number): string {
  // YYYY-MM-DD format (matches <input type="date"> emission).
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

interface CreateLeadResponse {
  lead?: { id: string };
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

async function readJson(res: Response): Promise<CreateLeadResponse> {
  return (await res.json()) as CreateLeadResponse;
}

interface RecordConsentArg {
  type: string;
  source: string;
  language: string;
  consentEvidence?: string;
  consentTimestamp?: Date;
}

function lastConsentCall(): RecordConsentArg {
  const calls = mockRecordConsent.mock.calls;
  if (calls.length === 0) throw new Error('recordConsent was not called');
  return calls[calls.length - 1][2] as RecordConsentArg;
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: portal user with a client session — bypasses agency-only branches.
  mockAuth.mockResolvedValue({
    user: { id: 'u1', isAgency: false },
    client: { id: 'client-1' },
  });
  mockGetClientId.mockResolvedValue('client-1');
  mockGetAgencySession.mockResolvedValue(null);
  insertReturning.mockResolvedValue([
    { id: 'lead-1', clientId: 'client-1', phone: '+15551112222', name: 'Test' },
  ]);
  insertValues.mockClear();
  dbInsert.mockClear();
  mockCheckUsageLimit.mockResolvedValue({ allowed: true, current: 0, limit: 1000 });
});

// ── inquiry mode ──────────────────────────────────────────────────────────────

describe('POST /api/leads — consentMode: inquiry', () => {
  it('accepts a recent inquiry and records implied consent (source=manual_entry, anchored at inquiryDate)', async () => {
    const inquiry = isoDateDaysAgo(30);
    const res = await POST(
      makeRequest({
        consentMode: 'inquiry',
        name: 'Alice',
        phone: '5551112222',
        inquiryDate: inquiry,
      })
    );

    expect(res.status).toBe(201);
    expect(mockRecordConsent).toHaveBeenCalledTimes(1);
    const consent = lastConsentCall();
    expect(consent.type).toBe('implied');
    expect(consent.source).toBe('manual_entry');
    expect(consent.consentTimestamp).toBeInstanceOf(Date);
    expect(consent.consentTimestamp?.toISOString().slice(0, 10)).toBe(inquiry);
    expect(consent.language).toBe('Implied consent from inquiry');
  });

  it('rejects an inquiry older than 180 days with a clear error', async () => {
    const res = await POST(
      makeRequest({
        consentMode: 'inquiry',
        name: 'Bob',
        phone: '5551112222',
        inquiryDate: isoDateDaysAgo(200),
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/express_consent/);
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });
});

// ── express_consent mode ──────────────────────────────────────────────────────

describe('POST /api/leads — consentMode: express_consent', () => {
  it('accepts old inquiries with valid evidence and records express_written consent', async () => {
    const evidence = 'signed estimate request form 2024-08-15';
    const res = await POST(
      makeRequest({
        consentMode: 'express_consent',
        name: 'Carol',
        phone: '5551112222',
        inquiryDate: isoDateDaysAgo(400),
        expressConsentEvidence: evidence,
      })
    );

    expect(res.status).toBe(201);
    expect(mockRecordConsent).toHaveBeenCalledTimes(1);
    const consent = lastConsentCall();
    expect(consent.type).toBe('express_written');
    expect(consent.source).toBe('manual_entry');
    expect(consent.language).toBe(evidence);
    expect(consent.consentEvidence).toBe(evidence);
  });

  it('rejects when evidence is shorter than 10 characters', async () => {
    const res = await POST(
      makeRequest({
        consentMode: 'express_consent',
        name: 'Dan',
        phone: '5551112222',
        inquiryDate: isoDateDaysAgo(400),
        expressConsentEvidence: 'short',
      })
    );

    expect(res.status).toBe(400);
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });
});

// ── existing_customer mode ────────────────────────────────────────────────────

describe('POST /api/leads — consentMode: existing_customer', () => {
  it('accepts a paid customer ≤ 730 days and records implied consent (source=existing_customer)', async () => {
    const txn = isoDateDaysAgo(300);
    const res = await POST(
      makeRequest({
        consentMode: 'existing_customer',
        name: 'Eve',
        phone: '5551112222',
        transactionDate: txn,
        customerNotes: 'Kitchen reno completed Jul 2024, $52K',
      })
    );

    expect(res.status).toBe(201);
    expect(mockRecordConsent).toHaveBeenCalledTimes(1);
    const consent = lastConsentCall();
    expect(consent.type).toBe('implied');
    expect(consent.source).toBe('existing_customer');
    expect(consent.consentTimestamp).toBeInstanceOf(Date);
    expect(consent.consentTimestamp?.toISOString().slice(0, 10)).toBe(txn);
    expect(consent.language).toMatch(/Existing customer \(paid relationship\)/);
    expect(consent.language).toMatch(/Kitchen reno completed Jul 2024, \$52K/);
  });

  it('rejects a transaction older than 730 days', async () => {
    const res = await POST(
      makeRequest({
        consentMode: 'existing_customer',
        name: 'Frank',
        phone: '5551112222',
        transactionDate: isoDateDaysAgo(800),
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/within last 24 months/);
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });

  it('writes inquiry_date = transaction_date so dormant re-engagement keeps working', async () => {
    const txn = isoDateDaysAgo(400);
    await POST(
      makeRequest({
        consentMode: 'existing_customer',
        name: 'Grace',
        phone: '5551112222',
        transactionDate: txn,
      })
    );

    const valuesArg = insertValues.mock.calls[0]?.[0] as unknown as { inquiryDate: Date };
    expect(valuesArg.inquiryDate).toBeInstanceOf(Date);
    expect(valuesArg.inquiryDate.toISOString().slice(0, 10)).toBe(txn);
  });

  it('omits the trailing colon when customerNotes is absent', async () => {
    await POST(
      makeRequest({
        consentMode: 'existing_customer',
        name: 'Heidi',
        phone: '5551112222',
        transactionDate: isoDateDaysAgo(100),
      })
    );

    const consent = lastConsentCall();
    expect(consent.language).toBe('Existing customer (paid relationship)');
  });
});

// ── Schema guards ─────────────────────────────────────────────────────────────

describe('POST /api/leads — strict discriminated union', () => {
  it('rejects when consentMode is missing', async () => {
    const res = await POST(
      makeRequest({
        name: 'NoMode',
        phone: '5551112222',
        inquiryDate: isoDateDaysAgo(30),
      })
    );

    expect(res.status).toBe(400);
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });

  it('rejects an unknown consentMode', async () => {
    const res = await POST(
      makeRequest({
        consentMode: 'made_up',
        name: 'Bad',
        phone: '5551112222',
        inquiryDate: isoDateDaysAgo(30),
      })
    );

    expect(res.status).toBe(400);
  });
});
