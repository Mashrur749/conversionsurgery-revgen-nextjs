export interface PlanFeatures {
  maxLeadsPerMonth: number | null;
  maxMessagesPerMonth?: number | null;
  maxTeamMembers: number | null;
  maxPhoneNumbers: number;
  includesVoiceAi: boolean;
  includesCalendarSync: boolean;
  includesAdvancedAnalytics: boolean;
  includesWhiteLabel: boolean;
  supportLevel: 'email' | 'priority' | 'dedicated';
  apiAccess: boolean;
  // Legacy overage config
  overagePerLeadCents?: number;
  overagePerSmsCents?: number;
  allowOverages?: boolean;
  // Offer-parity usage policy flags
  isUnlimitedMessaging?: boolean;
  isUnlimitedLeads?: boolean;
  chargesOverage?: boolean;
}

export interface ClientUsagePolicy {
  isUnlimitedMessaging: boolean;
  isUnlimitedLeads: boolean;
  chargesOverage: boolean;
  messageLimit: number | null;
  leadLimit: number | null;
}

function fallbackMessageLimitFromSlug(planSlug: string | null | undefined): number {
  const slug = (planSlug || '').toLowerCase();
  if (slug.includes('enterprise')) return 20000;
  if (slug.includes('starter')) return 1000;
  return 5000; // historical professional/default fallback
}

function isProfessionalSlug(planSlug: string | null | undefined): boolean {
  return (planSlug || '').toLowerCase().includes('professional');
}

export function resolveClientUsagePolicy(
  features: PlanFeatures,
  planSlug?: string | null
): ClientUsagePolicy {
  const professionalFallback = isProfessionalSlug(planSlug);

  const isUnlimitedMessaging =
    features.isUnlimitedMessaging ?? (features.maxMessagesPerMonth === null || professionalFallback);
  const isUnlimitedLeads =
    features.isUnlimitedLeads ?? (features.maxLeadsPerMonth === null || professionalFallback);

  const chargesOverage =
    features.chargesOverage ?? features.allowOverages ?? !professionalFallback;

  const messageLimit = isUnlimitedMessaging
    ? null
    : (features.maxMessagesPerMonth ?? fallbackMessageLimitFromSlug(planSlug));
  const leadLimit = isUnlimitedLeads ? null : (features.maxLeadsPerMonth ?? null);

  return {
    isUnlimitedMessaging,
    isUnlimitedLeads,
    chargesOverage,
    messageLimit,
    leadLimit,
  };
}

