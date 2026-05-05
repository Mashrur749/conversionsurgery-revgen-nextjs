import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
  clients: { id: 'id', firstRecoveryReplaySentAt: 'first_recovery_replay_sent_at' },
  leads: { id: 'id', clientId: 'client_id' },
  conversations: { leadId: 'lead_id', direction: 'direction', createdAt: 'created_at' },
  subscriptions: { clientId: 'client_id', guaranteeStartAt: 'guarantee_start_at' },
}));
vi.mock('@/db/schema', () => ({
  // satisfies `import type { Lead, Client } from '@/db/schema'` at module load
}));
vi.mock('@/lib/compliance/compliance-gateway', () => ({
  sendCompliantMessage: vi.fn(),
}));
vi.mock('@/lib/services/internal-error-log', () => ({
  logSanitizedConsoleError: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
}));

import { getDb } from '@/db';
import { sendCompliantMessage } from '@/lib/compliance/compliance-gateway';
import {
  checkAndSendFirstRecoveryReplay,
  isWithinReplayWindow,
  qualifiesAsRecoveryEvent,
  buildReplayMessage,
} from './first-recovery-replay';

const MS_IN_DAY = 24 * 60 * 60 * 1000;
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_IN_DAY);
}

interface MockClient {
  id: string;
  phone: string | null;
  twilioNumber: string | null;
  createdAt: Date;
  firstRecoveryReplaySentAt: Date | null;
}

interface MockLead {
  id: string;
  clientId: string;
  name: string | null;
  status: string;
  createdAt: Date;
}

interface MockSub {
  guaranteeStartAt: Date | null;
}

interface MockInbound {
  createdAt: Date;
}

function makeDbMock(opts: {
  client: MockClient | null;
  subscription?: MockSub | null;
  lead?: MockLead | null;
  inboundMessages?: MockInbound[];
}) {
  const updateSetWhere = vi.fn().mockResolvedValue(undefined);
  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({ where: updateSetWhere }),
  });

  // Build the queue of select responses in the order checkAndSendFirstRecoveryReplay calls them:
  //   1. client lookup
  //   2. subscription lookup
  //   3. lead lookup
  //   4. inbound conversations lookup (no .limit())
  const selectQueue: unknown[] = [];

  // 1. client
  selectQueue.push({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(opts.client ? [opts.client] : []),
      }),
    }),
  });

  // 2. subscription (only called if client exists + not already sent)
  selectQueue.push({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(opts.subscription ? [opts.subscription] : []),
      }),
    }),
  });

  // 3. lead
  selectQueue.push({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(opts.lead ? [opts.lead] : []),
      }),
    }),
  });

  // 4. inbound conversations
  selectQueue.push({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(opts.inboundMessages ?? []),
    }),
  });

  const select = vi.fn();
  for (const response of selectQueue) {
    select.mockReturnValueOnce(response);
  }

  return {
    select,
    update,
    updateSetWhere,
  };
}

describe('isWithinReplayWindow', () => {
  it('returns true within 30 days post go-live', () => {
    expect(isWithinReplayWindow(daysAgo(5))).toBe(true);
    expect(isWithinReplayWindow(daysAgo(29))).toBe(true);
  });

  it('returns false after 30 days', () => {
    expect(isWithinReplayWindow(daysAgo(31))).toBe(false);
    expect(isWithinReplayWindow(daysAgo(60))).toBe(false);
  });

  it('returns false for null serviceStartDate', () => {
    expect(isWithinReplayWindow(null)).toBe(false);
  });

  it('returns false when serviceStartDate is in the future', () => {
    const future = new Date(Date.now() + 5 * MS_IN_DAY);
    expect(isWithinReplayWindow(future)).toBe(false);
  });
});

describe('qualifiesAsRecoveryEvent', () => {
  it('qualifies when status=new, gap is 24h+ but ≤ 7 days', () => {
    expect(
      qualifiesAsRecoveryEvent({
        leadStatus: 'new',
        leadCreatedAt: daysAgo(3),
        replyAt: new Date(),
      })
    ).toBe(true);
  });

  it('qualifies when status=contacted', () => {
    expect(
      qualifiesAsRecoveryEvent({
        leadStatus: 'contacted',
        leadCreatedAt: daysAgo(2),
        replyAt: new Date(),
      })
    ).toBe(true);
  });

  it('rejects when reply lands within 24h (not a recovery — contractor would have caught it)', () => {
    const created = daysAgo(0);
    const reply = new Date(created.getTime() + 6 * 60 * 60 * 1000); // 6h
    expect(
      qualifiesAsRecoveryEvent({
        leadStatus: 'new',
        leadCreatedAt: created,
        replyAt: reply,
      })
    ).toBe(false);
  });

  it('rejects when reply lands after 7 days (long-tail, not system recovery)', () => {
    expect(
      qualifiesAsRecoveryEvent({
        leadStatus: 'new',
        leadCreatedAt: daysAgo(10),
        replyAt: new Date(),
      })
    ).toBe(false);
  });

  it('rejects when status is not new/contacted', () => {
    expect(
      qualifiesAsRecoveryEvent({
        leadStatus: 'won',
        leadCreatedAt: daysAgo(2),
        replyAt: new Date(),
      })
    ).toBe(false);
    expect(
      qualifiesAsRecoveryEvent({
        leadStatus: 'estimate_sent',
        leadCreatedAt: daysAgo(2),
        replyAt: new Date(),
      })
    ).toBe(false);
  });
});

describe('buildReplayMessage', () => {
  it('renders the canonical template with first name and day count', () => {
    const body = buildReplayMessage({
      firstName: 'Mike',
      daysSinceOriginalContact: 3,
      portalLink: 'https://example.com/c/abc',
    });
    expect(body).toContain('Caught one. Mike, called 3 days ago');
    expect(body).toContain('https://example.com/c/abc');
  });

  it('uses singular day label when 1 day', () => {
    const body = buildReplayMessage({
      firstName: 'Sam',
      daysSinceOriginalContact: 1,
      portalLink: 'x',
    });
    expect(body).toContain('called 1 day ago');
  });

  it('falls back to a neutral subject when first name is null', () => {
    const body = buildReplayMessage({
      firstName: null,
      daysSinceOriginalContact: 2,
      portalLink: 'x',
    });
    expect(body).toContain('A lead, called 2 days ago');
  });
});

describe('checkAndSendFirstRecoveryReplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseClient: MockClient = {
    id: 'client-1',
    phone: '+15551234567',
    twilioNumber: '+15557654321',
    createdAt: daysAgo(5),
    firstRecoveryReplaySentAt: null,
  };

  it('returns already_sent when firstRecoveryReplaySentAt is set', async () => {
    const db = makeDbMock({
      client: { ...baseClient, firstRecoveryReplaySentAt: daysAgo(1) },
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await checkAndSendFirstRecoveryReplay('client-1', 'lead-1');
    expect(result).toEqual({ sent: false, reason: 'already_sent' });
    expect(sendCompliantMessage).not.toHaveBeenCalled();
  });

  it('returns outside_window when service started > 30 days ago', async () => {
    const db = makeDbMock({
      client: { ...baseClient, createdAt: daysAgo(45) },
      subscription: { guaranteeStartAt: daysAgo(45) },
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await checkAndSendFirstRecoveryReplay('client-1', 'lead-1');
    expect(result).toEqual({ sent: false, reason: 'outside_window' });
    expect(sendCompliantMessage).not.toHaveBeenCalled();
  });

  it('returns no_reply_yet when there are no inbound messages', async () => {
    const db = makeDbMock({
      client: baseClient,
      subscription: { guaranteeStartAt: daysAgo(5) },
      lead: {
        id: 'lead-1',
        clientId: 'client-1',
        name: 'Mike Jones',
        status: 'new',
        createdAt: daysAgo(3),
      },
      inboundMessages: [],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await checkAndSendFirstRecoveryReplay('client-1', 'lead-1');
    expect(result).toEqual({ sent: false, reason: 'no_reply_yet' });
    expect(sendCompliantMessage).not.toHaveBeenCalled();
  });

  it('returns not_recovery_event when reply landed within 24h', async () => {
    const created = daysAgo(0);
    const reply = new Date(created.getTime() + 6 * 60 * 60 * 1000);
    const db = makeDbMock({
      client: baseClient,
      subscription: { guaranteeStartAt: daysAgo(5) },
      lead: {
        id: 'lead-1',
        clientId: 'client-1',
        name: 'Mike',
        status: 'new',
        createdAt: created,
      },
      inboundMessages: [{ createdAt: reply }],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

    const result = await checkAndSendFirstRecoveryReplay('client-1', 'lead-1');
    expect(result).toEqual({ sent: false, reason: 'not_recovery_event' });
    expect(sendCompliantMessage).not.toHaveBeenCalled();
  });

  it('sends SMS and marks client when all gates pass', async () => {
    const db = makeDbMock({
      client: baseClient,
      subscription: { guaranteeStartAt: daysAgo(5) },
      lead: {
        id: 'lead-1',
        clientId: 'client-1',
        name: 'Mike Jones',
        status: 'new',
        createdAt: daysAgo(3),
      },
      inboundMessages: [{ createdAt: new Date() }],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    vi.mocked(sendCompliantMessage).mockResolvedValue({
      sent: true,
      queued: false,
      blocked: false,
      messageSid: 'SM_test',
      warnings: [],
    });

    const result = await checkAndSendFirstRecoveryReplay('client-1', 'lead-1');
    expect(result).toEqual({ sent: true });
    expect(sendCompliantMessage).toHaveBeenCalledTimes(1);

    const call = vi.mocked(sendCompliantMessage).mock.calls[0][0];
    expect(call.clientId).toBe('client-1');
    expect(call.to).toBe('+15551234567');
    expect(call.from).toBe('+15557654321');
    expect(call.messageClassification).toBe('proactive_outreach');
    expect(call.messageCategory).toBe('transactional');
    expect(call.body).toContain('Caught one. Mike');
    expect(db.updateSetWhere).toHaveBeenCalledTimes(1);
  });

  it('does NOT mark client as sent when compliance blocks the message', async () => {
    const db = makeDbMock({
      client: baseClient,
      subscription: { guaranteeStartAt: daysAgo(5) },
      lead: {
        id: 'lead-1',
        clientId: 'client-1',
        name: 'Mike',
        status: 'new',
        createdAt: daysAgo(3),
      },
      inboundMessages: [{ createdAt: new Date() }],
    });
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    vi.mocked(sendCompliantMessage).mockResolvedValue({
      sent: false,
      queued: false,
      blocked: true,
      blockReason: 'Recipient has opted out',
      warnings: [],
    });

    const result = await checkAndSendFirstRecoveryReplay('client-1', 'lead-1');
    expect(result.sent).toBe(false);
    expect(result.reason).toBe('compliance_blocked');
    expect(db.updateSetWhere).not.toHaveBeenCalled();
  });
});
