export type OnboardingQualityPolicyMode = 'enforce' | 'warn' | 'off';

export type OnboardingQualityGateKey =
  | 'business_profile'
  | 'services_pricing_boundaries'
  | 'faq_objection_coverage'
  | 'escalation_contacts'
  | 'business_hours_configured';

export interface OnboardingQualityGateThreshold {
  minScore: number;
  weight: number;
  critical: boolean;
}

export interface OnboardingQualityPolicy {
  mode: OnboardingQualityPolicyMode;
  gates: Record<OnboardingQualityGateKey, OnboardingQualityGateThreshold>;
  thresholds: {
    minServices: number;
    minFaqs: number;
    minNeverSayRules: number;
    minDontDoItems: number;
  };
}

export const DEFAULT_ONBOARDING_QUALITY_POLICY: Omit<OnboardingQualityPolicy, 'mode'> = {
  gates: {
    business_profile: { minScore: 100, weight: 25, critical: true },
    services_pricing_boundaries: { minScore: 80, weight: 30, critical: true },
    faq_objection_coverage: { minScore: 80, weight: 30, critical: true },
    escalation_contacts: { minScore: 100, weight: 15, critical: true },
    business_hours_configured: { minScore: 100, weight: 15, critical: true },
  },
  thresholds: {
    minServices: 2,
    minFaqs: 5,
    minNeverSayRules: 2,
    minDontDoItems: 1,
  },
};

function normalizeMode(value: string | undefined): OnboardingQualityPolicyMode {
  if (!value) return 'enforce';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'warn') return 'warn';
  if (normalized === 'off') return 'off';
  return 'enforce';
}

export function resolveOnboardingQualityPolicyMode(): OnboardingQualityPolicyMode {
  return normalizeMode(process.env.ONBOARDING_QUALITY_POLICY_MODE);
}

export function getOnboardingQualityPolicy(): OnboardingQualityPolicy {
  return {
    mode: resolveOnboardingQualityPolicyMode(),
    gates: DEFAULT_ONBOARDING_QUALITY_POLICY.gates,
    thresholds: DEFAULT_ONBOARDING_QUALITY_POLICY.thresholds,
  };
}
