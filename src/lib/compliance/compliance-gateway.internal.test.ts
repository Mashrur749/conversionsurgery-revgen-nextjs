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
const clientSelectLimit = vi.fn();
const recordConsentMock = vi.fn();
const logComplianceEventMock = vi.fn().mockResolvedValue(undefined);
const isQuietHoursMock = vi.fn();

// `select()` is called multiple times per request: once for blockedNumbers
// (DNC sentinel) and once for clients (Decision F). We dispatch to the right
// resolver based on the table object passed to `from()`.
function makeSelectChain(target: 'dnc' | 'client') {
  const limit = target === 'dnc' ? dncSelectLimit : clientSelectLimit;
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit,
      })),
    })),
  };
}

const mockDb = {
  query: {
    optOutRecords: { findFirst: (...args: unknown[]) => findFirstOptOut(...args) },
    doNotContactList: { findFirst: (...args: unknown[]) => findFirstDoNotContact(...args) },
  },
  select: vi.fn((selection?: Record<string, unknown>) => {
    // Route by selected fields: DNC select picks `id` + `reason` (blockedNumbers),
    // Decision F select picks `contractorAlertQuietHoursEnabled` + `timezone`.
    const isClientSelect = selection
      ? Object.prototype.hasOwnProperty.call(selection, 'contractorAlertQuietHoursEnabled')
      : false;
    return makeSelectChain(isClientSelect ? 'client' : 'dnc');
  }),
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
    isQuietHours: (...args: unknown[]) => isQuietHoursMock(...args),
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
  // Default client lookup: contractor toggle OFF (exempt) — most tests
  // shouldn't pass clientId; this default is only consulted when clientId
  // is supplied.
  clientSelectLimit.mockResolvedValue([
    { contractorAlertQuietHoursEnabled: false, timezone: 'America/Edmonton' },
  ]);
  isQuietHoursMock.mockResolvedValue({ isQuietHours: false });
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

// ---------------------------------------------------------------------------
// Decision F — per-client quiet-hours preference for contractor-self alerts
// ---------------------------------------------------------------------------

describe('sendInternalSMS — Decision F per-client quiet-hours preference', () => {
  it('operator path (no clientId): does NOT consult per-client quiet-hours preference', async () => {
    const result = await sendInternalSMS(defaultParams());

    expect(result.sent).toBe(true);
    // No clientId → client SELECT must not be consulted; isQuietHours should
    // never be called for operator alerts.
    expect(isQuietHoursMock).not.toHaveBeenCalled();
    expect(clientSelectLimit).not.toHaveBeenCalled();
  });

  it('contractor path with toggle OFF (default exempt): sends immediately even during quiet hours', async () => {
    // Even if isQuietHours would say YES, we never reach the call because
    // the toggle is OFF.
    isQuietHoursMock.mockResolvedValue({ isQuietHours: true, reason: 'Quiet hours' });
    clientSelectLimit.mockResolvedValue([
      { contractorAlertQuietHoursEnabled: false, timezone: 'America/Edmonton' },
    ]);

    const result = await sendInternalSMS({
      ...defaultParams(),
      clientId: 'client-123',
    });

    expect(result.sent).toBe(true);
    expect(result.blocked).toBe(false);
    expect(sendSmsToTwilioMock).toHaveBeenCalledTimes(1);
    // Toggle was OFF — isQuietHours should NOT be consulted.
    expect(isQuietHoursMock).not.toHaveBeenCalled();
  });

  it('contractor path with toggle ON, outside quiet hours: sends immediately', async () => {
    clientSelectLimit.mockResolvedValue([
      { contractorAlertQuietHoursEnabled: true, timezone: 'America/Edmonton' },
    ]);
    isQuietHoursMock.mockResolvedValue({ isQuietHours: false });

    const result = await sendInternalSMS({
      ...defaultParams(),
      clientId: 'client-123',
    });

    expect(result.sent).toBe(true);
    expect(result.blocked).toBe(false);
    expect(sendSmsToTwilioMock).toHaveBeenCalledTimes(1);
    expect(isQuietHoursMock).toHaveBeenCalledWith('client-123', 'America/Edmonton');
  });

  it('contractor path with toggle ON, inside quiet hours: blocks with contractor_quiet_hours reason', async () => {
    clientSelectLimit.mockResolvedValue([
      { contractorAlertQuietHoursEnabled: true, timezone: 'America/Edmonton' },
    ]);
    isQuietHoursMock.mockResolvedValue({
      isQuietHours: true,
      reason: 'Quiet hours (21:00 - 10:00 recipient\'s local time)',
    });

    const result = await sendInternalSMS({
      ...defaultParams(),
      clientId: 'client-123',
    });

    expect(result.sent).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.blockReason).toBe('contractor_quiet_hours');
    expect(sendSmsToTwilioMock).not.toHaveBeenCalled();

    // Distinct audit category from sentinel blocks
    expect(logComplianceEventMock).toHaveBeenCalledWith(
      'client-123',
      'internal_sms_quiet_hours_block',
      expect.objectContaining({
        blockReason: 'contractor_quiet_hours',
        quietHoursReason: 'Quiet hours (21:00 - 10:00 recipient\'s local time)',
      }),
    );
  });

  it('audit log is scoped to clientId for contractor-path success', async () => {
    clientSelectLimit.mockResolvedValue([
      { contractorAlertQuietHoursEnabled: false, timezone: 'America/Edmonton' },
    ]);

    await sendInternalSMS({
      ...defaultParams(),
      clientId: 'client-456',
    });

    expect(logComplianceEventMock).toHaveBeenCalledWith(
      'client-456',
      'internal_sms_sent',
      expect.any(Object),
    );
  });
});
