import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/db', () => ({
  getDb: vi.fn(),
}));
vi.mock('@/db/schema', () => ({
  subscriptions: { id: 'id', clientId: 'client_id', status: 'status', guaranteeStartAt: 'guarantee_start_at', guaranteeStatus: 'guarantee_status', stripeSubscriptionId: 'stripe_subscription_id', guaranteeNotes: 'guarantee_notes' },
  clients: { id: 'id', businessName: 'business_name', aiAgentMode: 'ai_agent_mode' },
  leads: { clientId: 'client_id', createdAt: 'created_at', source: 'source', status: 'status' },
  plans: {},
}));
vi.mock('@/db/schema/onboarding-day-one', () => ({
  onboardingMilestones: { clientId: 'client_id', status: 'status' },
}));
vi.mock('@/lib/clients/stripe', () => ({
  getStripeClient: vi.fn(),
}));
vi.mock('@/lib/services/operator-alerts', () => ({
  alertOperator: vi.fn(),
}));
vi.mock('@/lib/services/internal-error-log', () => ({
  logSanitizedConsoleError: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
  and: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
  gte: vi.fn(),
}));

import { getDb } from '@/db';
import { getStripeClient } from '@/lib/clients/stripe';
import { alertOperator } from '@/lib/services/operator-alerts';
import { processGoLiveGate, processLoggingGate } from './guarantee-gates';

const MS_IN_DAY = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * MS_IN_DAY);
}

describe('guarantee-gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('processGoLiveGate', () => {
    it('skips subscriptions before day 21', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { subscriptionId: 'sub-1', clientId: 'c-1', guaranteeStartAt: daysAgo(10), guaranteeStatus: 'proof_pending' },
            ]),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processGoLiveGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('not_yet_due');
    });

    it('marks autonomous clients as live', async () => {
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { subscriptionId: 'sub-1', clientId: 'c-1', guaranteeStartAt: daysAgo(25), guaranteeStatus: 'proof_pending' },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { businessName: 'Test Renos', aiAgentMode: 'autonomous' },
                ]),
              }),
            }),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processGoLiveGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('already_live');
      expect(results[0].isLive).toBe(true);
    });

    it('extends non-live clients and alerts operator', async () => {
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { subscriptionId: 'sub-1', clientId: 'c-1', guaranteeStartAt: daysAgo(25), guaranteeStatus: 'proof_pending' },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([
                  { businessName: 'Slow Start Renos', aiAgentMode: 'off' },
                ]),
              }),
            }),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processGoLiveGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('extended');
      expect(results[0].isLive).toBe(false);
      expect(alertOperator).toHaveBeenCalledWith(
        expect.stringContaining('Go-live extension'),
        expect.stringContaining('Slow Start Renos')
      );
    });
  });

  describe('processLoggingGate', () => {
    it('skips subscriptions before day 30', async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { subscriptionId: 'sub-1', clientId: 'c-1', stripeSubscriptionId: 'stripe_sub_1', guaranteeStartAt: daysAgo(15), status: 'active' },
            ]),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processLoggingGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('not_yet_due');
    });

    it('defers evaluation for low volume (<7 inquiries)', async () => {
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { subscriptionId: 'sub-1', clientId: 'c-1', stripeSubscriptionId: 'stripe_sub_1', guaranteeStartAt: daysAgo(35), status: 'active' },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ businessName: 'Quiet Renos' }]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 3 }]),
            }),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processLoggingGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('deferred_low_volume');
      expect(results[0].totalInquiries).toBe(3);
    });

    it('pauses billing when logging rate below 80%', async () => {
      const stripeMock = {
        subscriptions: {
          update: vi.fn().mockResolvedValue({}),
        },
      };
      vi.mocked(getStripeClient).mockReturnValue(stripeMock as unknown as ReturnType<typeof getStripeClient>);

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { subscriptionId: 'sub-1', clientId: 'c-1', stripeSubscriptionId: 'stripe_sub_1', guaranteeStartAt: daysAgo(35), status: 'active' },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ businessName: 'Bad Logger Renos' }]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 20 }]), // total inquiries
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 10 }]), // only 10/20 logged = 50%
            }),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processLoggingGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('paused');
      expect(results[0].loggingRate).toBe(0.5);
      expect(stripeMock.subscriptions.update).toHaveBeenCalledWith(
        'stripe_sub_1',
        expect.objectContaining({
          pause_collection: { behavior: 'mark_uncollectible' },
        })
      );
      expect(alertOperator).toHaveBeenCalled();
    });

    it('marks as met when logging rate >= 80%', async () => {
      const stripeMock = {
        subscriptions: { update: vi.fn() },
      };
      vi.mocked(getStripeClient).mockReturnValue(stripeMock as unknown as ReturnType<typeof getStripeClient>);

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([
                { subscriptionId: 'sub-1', clientId: 'c-1', stripeSubscriptionId: 'stripe_sub_1', guaranteeStartAt: daysAgo(35), status: 'active' },
              ]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{ businessName: 'Good Logger Renos' }]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 10 }]),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([{ count: 9 }]), // 9/10 = 90%
            }),
          }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      };
      vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);

      const results = await processLoggingGate();
      expect(results).toHaveLength(1);
      expect(results[0].action).toBe('met');
      expect(results[0].loggingRate).toBe(0.9);
    });
  });
});
