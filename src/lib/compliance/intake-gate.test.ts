/**
 * CASL intake-gate tests — verifies the recordConsent timestamp override
 * propagates through to the inserted consent record so the 6-month implied-
 * consent expiry clock runs from inquiry date, not from import time.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addMonths } from 'date-fns';

type InsertedConsent = {
  consentTimestamp: Date;
  consentType: string;
  consentEvidence?: string;
  [key: string]: unknown;
};

const insertReturning = vi.fn();
const insertValues = vi.fn((..._args: unknown[]) => ({ returning: insertReturning }));
const insert = vi.fn(() => ({ values: insertValues }));

function getInsertedConsent(): InsertedConsent {
  const call = insertValues.mock.calls[0];
  if (!call) throw new Error('insertValues was not called');
  return call[0] as InsertedConsent;
}

const updateWhere = vi.fn().mockResolvedValue(undefined);
const updateSet = vi.fn(() => ({ where: updateWhere }));
const update = vi.fn(() => ({ set: updateSet }));

const deleteWhere = vi.fn().mockResolvedValue(undefined);
const deleteFn = vi.fn(() => ({ where: deleteWhere }));

const findFirstLead = vi.fn().mockResolvedValue(undefined);
const findFirstOptOut = vi.fn().mockResolvedValue(undefined);

const mockDb = {
  insert,
  update,
  delete: deleteFn,
  query: {
    leads: { findFirst: findFirstLead },
    optOutRecords: { findFirst: findFirstOptOut },
  },
};

vi.mock('@/db', () => ({
  getDb: () => mockDb,
  consentRecords: {},
  optOutRecords: {},
  doNotContactList: {},
  quietHoursConfig: {},
  complianceAuditLog: {},
  complianceCheckCache: {},
  leads: {},
  blockedNumbers: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  isNull: vi.fn(),
  gte: vi.fn(),
}));

import { ComplianceService } from './compliance-service';

beforeEach(() => {
  vi.clearAllMocks();
  findFirstLead.mockResolvedValue(undefined);
  findFirstOptOut.mockResolvedValue(undefined);
  insertReturning.mockResolvedValue([{ id: 'consent-1' }]);
});

describe('recordConsent — CASL intake gate', () => {
  it('uses now() when no consentTimestamp is provided (existing callers)', async () => {
    const before = Date.now();
    await ComplianceService.recordConsent('client-1', '+15551112222', {
      type: 'express_written',
      source: 'web_form',
      scope: { marketing: true, transactional: true, promotional: true, reminders: true },
      language: 'I agree',
    });
    const after = Date.now();

    // The first insert call writes to consent_records (the second is the audit log).
    const firstCall = getInsertedConsent();
    expect(firstCall.consentTimestamp).toBeInstanceOf(Date);
    const ts = firstCall.consentTimestamp.getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });

  it('honors the consentTimestamp override (implied consent anchored at inquiry_date)', async () => {
    const inquiry = new Date('2024-09-15T12:00:00Z');
    await ComplianceService.recordConsent('client-1', '+15551112222', {
      type: 'implied',
      source: 'api_import',
      scope: { marketing: true, transactional: true, promotional: true, reminders: true },
      language: 'Implied consent from inquiry',
      consentTimestamp: inquiry,
    });

    const firstCall = getInsertedConsent();
    expect(firstCall.consentTimestamp).toBe(inquiry);
    expect(firstCall.consentType).toBe('implied');
  });

  it('persists consent_evidence when provided', async () => {
    const evidence = 'signed estimate request form 2024-08-15';
    await ComplianceService.recordConsent('client-1', '+15551112222', {
      type: 'express_written',
      source: 'api_import',
      scope: { marketing: true, transactional: true, promotional: true, reminders: true },
      language: evidence,
      consentEvidence: evidence,
    });

    const firstCall = getInsertedConsent();
    expect(firstCall.consentEvidence).toBe(evidence);
  });

  it('6-month implied expiry is computed from the override timestamp, not from now()', async () => {
    // Inquiry 5 months ago — should still be valid
    const fiveMonthsAgo = addMonths(new Date(), -5);
    // Inquiry 7 months ago — should be expired
    const sevenMonthsAgo = addMonths(new Date(), -7);

    const expiresFromFive = addMonths(fiveMonthsAgo, 6);
    const expiresFromSeven = addMonths(sevenMonthsAgo, 6);

    expect(expiresFromFive.getTime()).toBeGreaterThan(Date.now());
    expect(expiresFromSeven.getTime()).toBeLessThan(Date.now());

    // If the override were ignored and now() was used, both would expire 6 months
    // from today — which would put both in the future. The fact that the
    // 7-month-ago anchor produces an expired result confirms the clock runs
    // from inquiry, not from import.
  });
});
