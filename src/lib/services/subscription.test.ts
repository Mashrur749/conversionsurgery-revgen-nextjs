import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies
vi.mock('@/db', () => ({
  getDb: vi.fn(),
  withTransaction: vi.fn(),
}));
vi.mock('@/db/schema', () => ({
  plans: { id: 'id', slug: 'slug', isActive: 'is_active', stripePriceIdMonthly: 'stripe_price_id_monthly', stripePriceIdSetup: 'stripe_price_id_setup', priceSetupCents: 'price_setup_cents' },
  clients: { id: 'id', email: 'email', businessName: 'business_name', stripeCustomerId: 'stripe_customer_id' },
  subscriptions: { id: 'id', stripeSubscriptionId: 'stripe_subscription_id' },
  billingEvents: { id: 'id', stripeEventId: 'stripe_event_id' },
}));
vi.mock('@/lib/clients/stripe', () => ({
  getStripeClient: vi.fn(),
}));
vi.mock('@/lib/services/coupon-validation', () => ({
  validateAndRedeemCoupon: vi.fn(),
}));
vi.mock('@/lib/services/usage-policy', () => ({
  resolveClientUsagePolicy: vi.fn(() => ({ messageLimit: null })),
}));
vi.mock('@/lib/services/guarantee-v2/state-machine', () => ({
  buildInitialGuaranteeWindowState: vi.fn(() => ({
    proofStartAt: new Date(),
    proofEndsAt: new Date(),
    recoveryStartAt: new Date(),
    recoveryEndsAt: new Date(),
    adjustedProofEndsAt: new Date(),
    adjustedRecoveryEndsAt: new Date(),
    extensionFactorBasisPoints: 10000,
  })),
}));
vi.mock('@/lib/services/internal-error-log', () => ({
  logSanitizedConsoleError: vi.fn(),
}));
vi.mock('@/lib/services/resend', () => ({
  sendEmail: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => val),
}));

import { getDb } from '@/db';
import { getStripeClient } from '@/lib/clients/stripe';
import { createCheckoutSession } from './subscription';

const MOCK_CLIENT = {
  id: 'client-1',
  email: 'test@example.com',
  businessName: 'Test Renos',
  stripeCustomerId: 'cus_existing',
};

const MOCK_PLAN = {
  id: 'plan-1',
  slug: 'standard',
  name: 'Standard',
  isActive: true,
  stripePriceIdMonthly: 'price_monthly_123',
  stripePriceIdSetup: 'price_setup_456',
  priceSetupCents: 550000,
  features: {},
};

function mockDb() {
  let callIndex = 0;
  const selectResults = [
    [MOCK_CLIENT], // client lookup
    [MOCK_PLAN],   // plan lookup
  ];
  const db = {
    select: vi.fn(() => {
      const result = selectResults[callIndex] ?? [];
      callIndex++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(result),
          }),
        }),
      };
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
  vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
  return db;
}

function mockStripe(sessionUrl: string | null = 'https://checkout.stripe.com/test') {
  const stripe = {
    customers: {
      create: vi.fn().mockResolvedValue({ id: 'cus_new' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'cs_test_123',
          url: sessionUrl,
        }),
      },
    },
  };
  vi.mocked(getStripeClient).mockReturnValue(stripe as unknown as ReturnType<typeof getStripeClient>);
  return stripe;
}

describe('createCheckoutSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test.com';
  });

  it('creates checkout with setup + recurring line items', async () => {
    mockDb();
    const stripe = mockStripe();

    const result = await createCheckoutSession('client-1', 'plan-1');

    expect(result.url).toBe('https://checkout.stripe.com/test');
    expect(result.sessionId).toBe('cs_test_123');

    const createCall = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.mode).toBe('subscription');
    expect(createCall.line_items).toHaveLength(2);
    expect(createCall.line_items[0].price).toBe('price_monthly_123');
    expect(createCall.line_items[1].price).toBe('price_setup_456');
    expect(createCall.customer).toBe('cus_existing');
  });

  it('skips setup line item when priceSetupCents is 0', async () => {
    // Override plan to have no setup fee
    let callIndex = 0;
    const db = {
      select: vi.fn(() => {
        const results = [
          [MOCK_CLIENT],
          [{ ...MOCK_PLAN, priceSetupCents: 0, stripePriceIdSetup: null }],
        ];
        const result = results[callIndex] ?? [];
        callIndex++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(result),
            }),
          }),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    const stripe = mockStripe();

    await createCheckoutSession('client-1', 'plan-1');

    const createCall = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.line_items).toHaveLength(1);
    expect(createCall.line_items[0].price).toBe('price_monthly_123');
  });

  it('creates Stripe customer when client has none', async () => {
    let callIndex = 0;
    const db = {
      select: vi.fn(() => {
        const results = [
          [{ ...MOCK_CLIENT, stripeCustomerId: null }],
          [MOCK_PLAN],
        ];
        const result = results[callIndex] ?? [];
        callIndex++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(result),
            }),
          }),
        };
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    const stripe = mockStripe();

    await createCheckoutSession('client-1', 'plan-1');

    expect(stripe.customers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' }),
      expect.any(Object)
    );
  });

  it('throws when client not found', async () => {
    let callIndex = 0;
    const db = {
      select: vi.fn(() => {
        const results: unknown[][] = [[], [MOCK_PLAN]];
        const result = results[callIndex] ?? [];
        callIndex++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(result),
            }),
          }),
        };
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    mockStripe();

    await expect(createCheckoutSession('bad-id', 'plan-1')).rejects.toThrow('Client not found');
  });

  it('throws when plan inactive', async () => {
    let callIndex = 0;
    const db = {
      select: vi.fn(() => {
        const results = [
          [MOCK_CLIENT],
          [{ ...MOCK_PLAN, isActive: false }],
        ];
        const result = results[callIndex] ?? [];
        callIndex++;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(result),
            }),
          }),
        };
      }),
    };
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>);
    mockStripe();

    await expect(createCheckoutSession('client-1', 'plan-1')).rejects.toThrow('Plan is not active');
  });

  it('throws when Stripe returns no URL', async () => {
    mockDb();
    mockStripe(null);

    await expect(createCheckoutSession('client-1', 'plan-1')).rejects.toThrow('Stripe did not return a checkout URL');
  });

  it('sets trial_period_days to 0', async () => {
    mockDb();
    const stripe = mockStripe();

    await createCheckoutSession('client-1', 'plan-1');

    const createCall = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.subscription_data.trial_period_days).toBe(0);
  });

  it('includes metadata with clientId, planId, planSlug', async () => {
    mockDb();
    const stripe = mockStripe();

    await createCheckoutSession('client-1', 'plan-1');

    const createCall = stripe.checkout.sessions.create.mock.calls[0][0];
    expect(createCall.metadata).toEqual({
      clientId: 'client-1',
      planId: 'plan-1',
      planSlug: 'standard',
    });
  });
});
