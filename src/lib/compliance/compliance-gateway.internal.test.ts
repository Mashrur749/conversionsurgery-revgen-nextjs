/**
 * sendInternalSMS sentinel tests — verifies the operator-alert path through
 * the compliance gateway respects kill switch, opt-out, and platform DNC,
 * writes the right audit categories, and never consults consent records.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock surface
// ---------------------------------------------------------------------------

const sendSmsToTwilioMock = vi.fn();
vi.mock('@/lib/services/twilio', () => ({
  _sendSmsToTwilio: (...args: unknown[]) => sendSmsToTwilioMock(...args),
}));

const isOpsKillSwitchEnabledMock = vi.fn();
vi.mock('@/lib/services/ops-kill-switches', () => ({
  isOpsKillSwitchEnabled: (...args: unknown[]) => isOpsKillSwitchEnabledMock(...args),
  OPS_KILL_SWITCH_KEYS: { OUTBOUND_AUTOMATIONS: 'outbound_automations' },
}));

vi.mock('@/lib/services/subscription', () => ({
  getClientUsagePolicy: vi.fn(),
  getSubscriptionWithPlan: vi.fn(),
}));

vi.mock('@/lib/services/usage-policy', () => ({
  isMessageLimitReached: vi.fn(() => ({ reached: false })),
}));

vi.mock('@/lib/services/feature-flags', () => ({
  resolveFeatureFlag: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/compliance/quiet-hours-policy', () => ({
  getQuietHoursPolicy: vi.fn().mockResolvedValue({ mode: 'STRICT_ALL_OUTBOUND_QUEUE' }),
  resolveQuietHoursDecision: vi.fn(() => ({ decision: 'send' })),
  QUIET_HOURS_MESSAGE_CLASSIFICATIONS: {
    INBOUND_REPLY: 'inbound_reply',
    PROACTIVE_OUTREACH: 'proactive_outreach',
  },
}));

const findFirstOptOut = vi.fn();
const findFirstDoNotContact = vi.fn();
const dncSelectLimit = vi.fn();
const recordConsentMock = vi.fn();
const logComplianceEventMock = vi.fn().mockResolvedValue(undefined);

const mockDb = {
  query: {
    optOutRecords: { findFirst: (...args: unknown[]) => findFirstOptOut(...args) },
    doNotContactList: { findFirst: (...args: unknown[]) => findFirstDoNotContact(...args) },
  },
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: dncSelectLimit,
      })),
    })),
  })),
};

vi.mock('@/db', () => ({
  getDb: () => mockDb,
  clients: {},
  leads: {},
  consentRecords: {},
  optOutRecords: {},
  doNotContactList: {},
  blockedNumbers: {},
  complianceAuditLog: {},
  complianceCheckCache: {},
  quietHoursConfig: {},
  scheduledMessages: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  sql: vi.fn(),
  isNull: vi.fn(),
  gte: vi.fn(),
}));

vi.mock('./compliance-service', () => ({
  ComplianceService: {
    normalizePhoneNumber: (raw: string) => {
      const digits = raw.replace(/\D/g, '');
      if (digits.length === 10) return `+1${digits}`;
      if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
      return raw.startsWith('+') ? raw : `+${digits}`;
    },
    hashPhoneNumber: (raw: string) => `hash:${raw}`,
    recordConsent: (...args: unknown[]) => recordConsentMock(...args),
    logComplianceEvent: (...args: unknown[]) => logComplianceEventMock(...args),
  },
}));

import { sendInternalSMS } from './compliance-gateway';

// ---------------------------------------------------------------------------
// Test setup helpers
// ---------------------------------------------------------------------------

function defaultParams() {
  return {
    to: '+14035551234',
    from: '+14035550000',
    body: 'Operator alert body',
    subject: 'OperatorAlert: missed-call cron failed',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  isOpsKillSwitchEnabledMock.mockResolvedValue(false);
  findFirstOptOut.mockResolvedValue(undefined);
  findFirstDoNotContact.mockResolvedValue(undefined);
  dncSelectLimit.mockResolvedValue([]);
  sendSmsToTwilioMock.mockResolvedValue('SM_test_sid');
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendInternalSMS — sentinel behavior', () => {
  it('happy path: clean send returns sent=true and writes internal_sms_sent audit', async () => {
    const result = await sendInternalSMS(defaultParams());

    expect(result.sent).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.messageSid).toBe('SM_test_sid');
    expect(sendSmsToTwilioMock).toHaveBeenCalledTimes(1);

    const auditCalls = logComplianceEventMock.mock.calls;
    expect(auditCalls.length).toBe(1);
    expect(auditCalls[0][1]).toBe('internal_sms_sent');
    expect(auditCalls[0][2]).toMatchObject({
      messageSid: 'SM_test_sid',
      subject: 'OperatorAlert: missed-call cron failed',
    });
  });

  it('blocks when kill switch is on and writes internal_sms_sentinel_block audit', async () => {
    isOpsKillSwitchEnabledMock.mockResolvedValue(true);

    const result = await sendInternalSMS(defaultParams());

    expect(result.sent).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('kill_switch');
    expect(sendSmsToTwilioMock).not.toHaveBeenCalled();

    expect(logComplianceEventMock).toHaveBeenCalledTimes(1);
    expect(logComplianceEventMock.mock.calls[0][1]).toBe('internal_sms_sentinel_block');
    expect(logComplianceEventMock.mock.calls[0][2]).toMatchObject({
      blockReason: 'kill_switch',
    });
  });

  it('blocks when recipient is opted out (operator phone misconfiguration sentinel)', async () => {
    findFirstOptOut.mockResolvedValue({ id: 'opt-1', clientId: null });

    const result = await sendInternalSMS(defaultParams());

    expect(result.sent).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('opted_out');
    expect(sendSmsToTwilioMock).not.toHaveBeenCalled();

    expect(logComplianceEventMock.mock.calls[0][1]).toBe('internal_sms_sentinel_block');
    expect(logComplianceEventMock.mock.calls[0][2]).toMatchObject({
      blockReason: 'opted_out',
      optOutId: 'opt-1',
    });
  });

  it('blocks when recipient is on platform DNC (blocked_numbers)', async () => {
    dncSelectLimit.mockResolvedValue([{ id: 'dnc-1', reason: 'platform_block' }]);

    const result = await sendInternalSMS(defaultParams());

    expect(result.sent).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('platform_dnc');
    expect(sendSmsToTwilioMock).not.toHaveBeenCalled();

    expect(logComplianceEventMock.mock.calls[0][1]).toBe('internal_sms_sentinel_block');
    expect(logComplianceEventMock.mock.calls[0][2]).toMatchObject({
      blockReason: 'platform_dnc',
      platformDncReason: 'platform_block',
    });
  });

  it('does NOT consult consent records — operator path is consent-agnostic', async () => {
    await sendInternalSMS(defaultParams());

    expect(recordConsentMock).not.toHaveBeenCalled();
  });

  it('writes phoneNumber, phoneHash, and subject into every audit entry', async () => {
    isOpsKillSwitchEnabledMock.mockResolvedValue(true);

    await sendInternalSMS(defaultParams());

    const meta = logComplianceEventMock.mock.calls[0][2];
    expect(meta).toMatchObject({
      phoneNumber: '+14035551234',
      phoneHash: 'hash:+14035551234',
      subject: 'OperatorAlert: missed-call cron failed',
      direction: 'internal_operator_alert',
    });
  });
});
