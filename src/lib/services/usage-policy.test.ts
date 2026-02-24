import { describe, expect, it } from 'vitest';

import { resolveClientUsagePolicy, type PlanFeatures } from './usage-policy';

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

describe('resolveClientUsagePolicy', () => {
  it('respects explicit unlimited and overage flags', () => {
    const policy = resolveClientUsagePolicy(
      buildFeatures({
        maxLeadsPerMonth: 500,
        maxMessagesPerMonth: 5000,
        isUnlimitedMessaging: true,
        isUnlimitedLeads: true,
        chargesOverage: false,
      }),
      'billing-professional'
    );

    expect(policy.isUnlimitedMessaging).toBe(true);
    expect(policy.isUnlimitedLeads).toBe(true);
    expect(policy.chargesOverage).toBe(false);
    expect(policy.messageLimit).toBeNull();
    expect(policy.leadLimit).toBeNull();
  });

  it('applies professional fallback for legacy plans without policy flags', () => {
    const policy = resolveClientUsagePolicy(
      buildFeatures({
        maxLeadsPerMonth: 500,
        maxMessagesPerMonth: 5000,
      }),
      'professional'
    );

    expect(policy.isUnlimitedMessaging).toBe(true);
    expect(policy.isUnlimitedLeads).toBe(true);
    expect(policy.chargesOverage).toBe(false);
    expect(policy.messageLimit).toBeNull();
    expect(policy.leadLimit).toBeNull();
  });

  it('keeps starter limits and overages by default', () => {
    const policy = resolveClientUsagePolicy(
      buildFeatures({
        maxLeadsPerMonth: 100,
        maxMessagesPerMonth: 1000,
      }),
      'starter'
    );

    expect(policy.isUnlimitedMessaging).toBe(false);
    expect(policy.isUnlimitedLeads).toBe(false);
    expect(policy.chargesOverage).toBe(true);
    expect(policy.messageLimit).toBe(1000);
    expect(policy.leadLimit).toBe(100);
  });

  it('respects legacy allowOverages when chargesOverage is unset', () => {
    const policy = resolveClientUsagePolicy(
      buildFeatures({
        allowOverages: false,
      }),
      'starter'
    );

    expect(policy.chargesOverage).toBe(false);
  });
});
