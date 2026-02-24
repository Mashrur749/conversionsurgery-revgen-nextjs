import { describe, expect, it } from 'vitest';

import { resolveOverageBillingPolicy } from './billing-policy';
import type { PlanFeatures } from './usage-policy';

function buildFeatures(overrides: Partial<PlanFeatures> = {}): PlanFeatures {
  return {
    maxLeadsPerMonth: 100,
    maxMessagesPerMonth: 1000,
    maxTeamMembers: 2,
    maxPhoneNumbers: 1,
    includesVoiceAi: false,
    includesCalendarSync: false,
    includesAdvancedAnalytics: false,
    includesWhiteLabel: false,
    supportLevel: 'email',
    apiAccess: false,
    ...overrides,
  };
}

describe('resolveOverageBillingPolicy', () => {
  it('disables overage for professional fallback without explicit flags', () => {
    const policy = resolveOverageBillingPolicy(
      buildFeatures({
        maxLeadsPerMonth: 500,
        maxMessagesPerMonth: 5000,
      }),
      'billing-professional'
    );

    expect(policy.chargesOverage).toBe(false);
    expect(policy.usagePolicy.isUnlimitedMessaging).toBe(true);
  });

  it('enables overage for starter defaults', () => {
    const policy = resolveOverageBillingPolicy(buildFeatures(), 'starter');
    expect(policy.chargesOverage).toBe(true);
  });

  it('respects explicit chargesOverage false', () => {
    const policy = resolveOverageBillingPolicy(
      buildFeatures({
        chargesOverage: false,
      }),
      'enterprise'
    );

    expect(policy.chargesOverage).toBe(false);
  });
});
