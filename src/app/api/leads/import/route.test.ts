/**
 * CASL intake gate — CSV import route tests.
 *
 * Verifies the two-mode contract:
 *   - standard:  rejects rows >180 days old; records implied consent at inquiry_date
 *   - express:   requires per-row evidence; records express_written consent
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockAuth = vi.fn();
const mockGetClientId = vi.fn();
const mockNormalizePhone = vi.fn((p: string) => {
  // Simple normalization for tests: strip non-digits, prefix +1
  const digits = p.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
});
const mockRecordConsent = vi.fn();
const mockTriggerEstimateFollowup = vi.fn(async (..._args: unknown[]) => ({ started: false, alreadyActive: false }));

const insertReturning = vi.fn();
const insertValues = vi.fn(() => ({ returning: insertReturning }));
const txInsert = vi.fn(() => ({ values: insertValues }));
const mockWithTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
  await cb({ insert: txInsert });
});

const selectFromWhere = vi.fn().mockResolvedValue([]); // existing leads lookup
const mockGetDb = vi.fn(() => ({
  select: () => ({ from: () => ({ where: selectFromWhere }) }),
}));

vi.mock('@/auth', () => ({ auth: () => mockAuth() }));
vi.mock('@/lib/get-client-id', () => ({ getClientId: () => mockGetClientId() }));
vi.mock('@/lib/utils/phone', () => ({
  normalizePhoneNumber: (p: string) => mockNormalizePhone(p),
}));
vi.mock('@/db', () => ({
  getDb: () => mockGetDb(),
  withTransaction: (cb: (tx: unknown) => Promise<void>) => mockWithTransaction(cb),
}));
vi.mock('@/db/schema/leads', () => ({
  leads: { id: 'id', clientId: 'client_id', phone: 'phone' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}));
vi.mock('@/lib/services/estimate-triggers', () => ({
  triggerEstimateFollowup: (...args: unknown[]) => mockTriggerEstimateFollowup(...args),
}));
vi.mock('@/lib/compliance/compliance-service', () => ({
  ComplianceService: {
    recordConsent: (...args: unknown[]) => mockRecordConsent(...args),
  },
}));
vi.mock('@/lib/utils/api-errors', () => ({
  safeErrorResponse: (prefix: string, error: unknown, message = 'Failed', status = 500) => {
    const msg = error instanceof Error ? error.message : message;
    return new Response(JSON.stringify({ error: msg }), { status });
  },
}));

// Import after mocks
import { POST } from './route';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDaysAgo(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/leads/import', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

interface ImportResponse {
  imported?: number;
  skipped?: number;
  errors?: Array<{ row: number; phone?: string; error: string }>;
  total?: number;
  error?: string;
  _audit?: { consentAttested: boolean; intakeMode: string };
}

async function readJson(res: Response): Promise<ImportResponse> {
  return (await res.json()) as ImportResponse;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: 'u1' } });
  mockGetClientId.mockResolvedValue('client-1');
  // Reset insert pipeline
  insertReturning.mockReset();
  insertValues.mockClear();
  txInsert.mockClear();
  selectFromWhere.mockResolvedValue([]); // no existing dupes
});

// ── Standard mode tests ───────────────────────────────────────────────────────

describe('CSV import — standard mode (implied consent, ≤180 days)', () => {
  it('rejects when any row is >= 180 days old', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'standard',
        rows: [
          { name: 'Recent', phone: '5551112222', inquiryDate: isoDaysAgo(30) },
          { name: 'TooOld', phone: '5553334444', inquiryDate: isoDaysAgo(200) },
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/all inquiries within last 180 days/);
    expect(body.error).toMatch(/1 rows older/);
    expect(insertReturning).not.toHaveBeenCalled();
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });

  it('accepts when all rows ≤ 180 days; records implied consent anchored at inquiry_date', async () => {
    const inquiry = isoDaysAgo(45);
    insertReturning.mockResolvedValueOnce([
      { id: 'lead-1', status: 'new', phone: '+15551112222' },
    ]);

    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'standard',
        rows: [{ name: 'Alice', phone: '5551112222', inquiryDate: inquiry }],
      })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.imported).toBe(1);
    expect(body._audit?.intakeMode).toBe('standard');

    expect(mockRecordConsent).toHaveBeenCalledTimes(1);
    const [, , consent] = mockRecordConsent.mock.calls[0];
    expect(consent.type).toBe('implied');
    expect(consent.source).toBe('api_import');
    // The override anchors the 6-month clock at the inquiry date, not now()
    expect(consent.consentTimestamp).toBeInstanceOf(Date);
    expect(consent.consentTimestamp.toISOString()).toBe(new Date(inquiry).toISOString());
    expect(consent.language).toMatch(/Implied consent from inquiry/);
  });

  it('rejects when intake mode is standard and a single row is older than 180 days', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'standard',
        rows: [{ name: 'Old', phone: '5559990000', inquiryDate: isoDaysAgo(365) }],
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/Use express-consent CSV format for older leads/);
  });
});

// ── Express-consent mode tests ────────────────────────────────────────────────

describe('CSV import — express-consent mode (>180 days allowed)', () => {
  it('rejects when any row is missing express_consent_evidence', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'express_consent',
        rows: [
          {
            name: 'OK',
            phone: '5551112222',
            inquiryDate: isoDaysAgo(400),
            expressConsentEvidence: 'signed estimate request 2024-08-15',
          },
          {
            name: 'Missing',
            phone: '5553334444',
            inquiryDate: isoDaysAgo(500),
          },
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/express_consent_evidence/);
    expect(insertReturning).not.toHaveBeenCalled();
  });

  it('rejects when evidence is shorter than the 10-char minimum', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'express_consent',
        rows: [
          {
            name: 'Short',
            phone: '5551112222',
            inquiryDate: isoDaysAgo(400),
            expressConsentEvidence: 'too short',
          },
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/>= 10 chars/);
  });

  it('accepts old leads with valid evidence; records express_written consent', async () => {
    insertReturning.mockResolvedValueOnce([
      { id: 'lead-old-1', status: 'new', phone: '+15551112222' },
    ]);

    const evidence = 'signed estimate request form on 2024-08-15';
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'express_consent',
        rows: [
          {
            name: 'OldLead',
            phone: '5551112222',
            inquiryDate: isoDaysAgo(400),
            expressConsentEvidence: evidence,
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.imported).toBe(1);
    expect(body._audit?.intakeMode).toBe('express_consent');

    expect(mockRecordConsent).toHaveBeenCalledTimes(1);
    const [, , consent] = mockRecordConsent.mock.calls[0];
    expect(consent.type).toBe('express_written');
    expect(consent.source).toBe('api_import');
    expect(consent.language).toBe(evidence);
    expect(consent.consentEvidence).toBe(evidence);
    // Express consent has no inquiry-anchored expiry — no consentTimestamp override
    expect(consent.consentTimestamp).toBeUndefined();
  });
});

// ── Existing-customer mode tests ──────────────────────────────────────────────

describe('CSV import — existing-customer mode (24-month implied consent)', () => {
  it('accepts rows with transaction_date within 24 months and records implied consent with source=existing_customer', async () => {
    const txnDate = isoDaysAgo(300);
    insertReturning.mockResolvedValueOnce([
      { id: 'lead-cust-1', status: 'new', phone: '+15551112222' },
    ]);

    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'existing_customer',
        rows: [
          {
            name: 'Jane Past Customer',
            phone: '5551112222',
            transactionDate: txnDate,
            notes: 'Kitchen renovation completed Jul 2024, $52K',
          },
        ],
      })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.imported).toBe(1);
    expect(body._audit?.intakeMode).toBe('existing_customer');

    expect(mockRecordConsent).toHaveBeenCalledTimes(1);
    const [, , consent] = mockRecordConsent.mock.calls[0];
    expect(consent.type).toBe('implied');
    expect(consent.source).toBe('existing_customer');
    expect(consent.consentTimestamp).toBeInstanceOf(Date);
    expect(consent.consentTimestamp.toISOString()).toBe(new Date(txnDate).toISOString());
    expect(consent.language).toMatch(/Implied consent from prior paid customer relationship/);
    expect(consent.language).toMatch(/Kitchen renovation completed Jul 2024/);
  });

  it('rejects when any row is older than 730 days', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'existing_customer',
        rows: [
          { name: 'Recent', phone: '5551112222', transactionDate: isoDaysAgo(300) },
          { name: 'TooOld', phone: '5553334444', transactionDate: isoDaysAgo(800) },
        ],
      })
    );

    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/within last 24 months/);
    expect(body.error).toMatch(/1 rows older than 24 months/);
    expect(insertReturning).not.toHaveBeenCalled();
    expect(mockRecordConsent).not.toHaveBeenCalled();
  });

  it('rejects when transaction_date is missing', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'existing_customer',
        rows: [{ name: 'Missing', phone: '5551112222' }],
      })
    );

    expect(res.status).toBe(200);
    const body = await readJson(res);
    expect(body.errors).toBeDefined();
    expect(body.errors?.[0]?.error).toMatch(/transaction_date/);
    expect(body.imported).toBe(0);
  });

  it('writes inquiry_date = transaction_date so dormant re-engagement keeps working', async () => {
    const txnDate = isoDaysAgo(400);
    insertReturning.mockResolvedValueOnce([
      { id: 'lead-cust-2', status: 'new', phone: '+15551112222' },
    ]);

    await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'existing_customer',
        rows: [
          {
            name: 'Past',
            phone: '5551112222',
            transactionDate: txnDate,
          },
        ],
      })
    );

    // The first arg to insert().values() captures inquiryDate — assert via the
    // values() mock seen by the insertion pipeline.
    const calls = insertValues.mock.calls as unknown as Array<Array<Array<{ inquiryDate: Date }>>>;
    const valuesArg = calls[0]?.[0];
    expect(valuesArg).toBeDefined();
    expect(valuesArg).toHaveLength(1);
    expect(valuesArg[0].inquiryDate.toISOString()).toBe(new Date(txnDate).toISOString());
  });
});

// ── Validation guard tests ────────────────────────────────────────────────────

describe('CSV import — validation guards', () => {
  it('requires consentAttested', async () => {
    const res = await POST(
      makeRequest({
        rows: [{ name: 'X', phone: '5551112222', inquiryDate: isoDaysAgo(30) }],
      })
    );
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error).toMatch(/CASL consent attestation/);
  });

  it('rejects rows missing inquiry_date', async () => {
    const res = await POST(
      makeRequest({
        consentAttested: true,
        intakeMode: 'standard',
        rows: [{ name: 'X', phone: '5551112222' }],
      })
    );
    expect(res.status).toBe(200);
    // The schema marks inquiry_date as required; missing rows surface as errors,
    // but the request itself succeeds (consistent with the existing per-row error pattern).
    const body = await readJson(res);
    expect(body.errors).toBeDefined();
    expect(body.errors?.[0]?.error).toMatch(/inquiry_date/i);
    expect(body.imported).toBe(0);
  });
});
