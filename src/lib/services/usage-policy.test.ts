import { describe, expect, it } from 'vitest';

import {
  isMessageLimitReached,
  resolveClientUsagePolicy,
  type PlanFeatures,
} from './usage-policy';

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

describe('isMessageLimitReached', () => {
  it('does not block when usage policy is unlimited', () => {
    const policy = resolveClientUsagePolicy(
      buildFeatures({
        isUnlimitedMessaging: true,
        isUnlimitedLeads: true,
        chargesOverage: false,
      }),
      'professional'
    );

    const check = isMessageLimitReached(100000, policy, 500);
    expect(check.reached).toBe(false);
    expect(check.limit).toBeNull();
  });

  it('blocks when capped policy reaches limit', () => {
    const policy = resolveClientUsagePolicy(
      buildFeatures({
        isUnlimitedMessaging: false,
        maxMessagesPerMonth: 1000,
      }),
      'starter'
    );

    const check = isMessageLimitReached(1000, policy, 500);
    expect(check.reached).toBe(true);
    expect(check.limit).toBe(1000);
  });

  it('falls back to client-level limit when plan policy is unavailable', () => {
    const check = isMessageLimitReached(500, null, 500);
    expect(check.reached).toBe(true);
    expect(check.limit).toBe(500);
  });
});
