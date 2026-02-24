import {
  resolveClientUsagePolicy,
  type ClientUsagePolicy,
  type PlanFeatures,
} from '@/lib/services/usage-policy';

export interface OverageBillingPolicy {
  chargesOverage: boolean;
  usagePolicy: ClientUsagePolicy;
}

export function resolveOverageBillingPolicy(
  features: PlanFeatures,
  planSlug?: string | null
): OverageBillingPolicy {
  const usagePolicy = resolveClientUsagePolicy(features, planSlug);
  return {
    chargesOverage: usagePolicy.chargesOverage,
    usagePolicy,
  };
}

