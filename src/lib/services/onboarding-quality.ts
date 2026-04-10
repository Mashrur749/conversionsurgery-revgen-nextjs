import { getDb } from '@/db';
import {
  auditLog,
  businessHours,
  clientMemberships,
  clientServices,
  clients,
  onboardingQualityOverrides,
  onboardingQualitySnapshots,
  people,
  type OnboardingQualityOverride,
} from '@/db/schema';
import { and, count, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { loadStructuredKnowledge } from '@/lib/services/structured-knowledge';
import {
  getOnboardingQualityPolicy,
  resolveOnboardingQualityPolicyMode,
  type OnboardingQualityGateKey,
  type OnboardingQualityPolicy,
  type OnboardingQualityPolicyMode,
} from '@/lib/services/onboarding-quality-policy';

export type OnboardingQualityImpact = 'high' | 'medium' | 'low';

export interface OnboardingQualityAction {
  gateKey: OnboardingQualityGateKey;
  action: string;
  impact: OnboardingQualityImpact;
}

export interface OnboardingQualityGateResult {
  key: OnboardingQualityGateKey;
  title: string;
  score: number;
  maxScore: number;
  passed: boolean;
  critical: boolean;
  reasons: string[];
  actions: OnboardingQualityAction[];
}

export interface OnboardingQualityEvaluation {
  mode: OnboardingQualityPolicyMode;
  totalScore: number;
  maxScore: number;
  passedCritical: boolean;
  passedAll: boolean;
  criticalFailures: OnboardingQualityGateKey[];
  gates: OnboardingQualityGateResult[];
  recommendedActions: OnboardingQualityAction[];
}

interface OnboardingQualityEvaluationInput {
  businessProfile: {
    businessName: string | null;
    ownerName: string | null;
    email: string | null;
    phone: string | null;
    timezone: string | null;
  };
  services: Array<{
    name: string;
    priceRangeMinCents: number | null;
    priceRangeMaxCents: number | null;
    canDiscussPrice: string;
  }>;
  structured: Awaited<ReturnType<typeof loadStructuredKnowledge>>;
  escalation: {
    activeOwners: number;
    activeEscalationRecipients: number;
    ownersWithContact: number;
  };
  businessHoursCount: number;
}

function hasValue(value: string | null | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function weightedScore(baseScore: number, weight: number): number {
  return Math.round((Math.max(0, Math.min(100, baseScore)) / 100) * weight);
}

function impactRank(impact: OnboardingQualityImpact): number {
  if (impact === 'high') return 3;
  if (impact === 'medium') return 2;
  return 1;
}

function sortActions(actions: OnboardingQualityAction[]): OnboardingQualityAction[] {
  return [...actions].sort((a, b) => impactRank(b.impact) - impactRank(a.impact));
}

export function evaluateOnboardingQualityFromInput(
  input: OnboardingQualityEvaluationInput,
  policy: OnboardingQualityPolicy = getOnboardingQualityPolicy()
): OnboardingQualityEvaluation {
  const gateResults: OnboardingQualityGateResult[] = [];

  // Gate 1: Business profile completeness
  const profileFields = [
    hasValue(input.businessProfile.businessName),
    hasValue(input.businessProfile.ownerName),
    hasValue(input.businessProfile.email),
    hasValue(input.businessProfile.phone),
    hasValue(input.businessProfile.timezone),
  ];
  const profileCompleteness = Math.round((profileFields.filter(Boolean).length / profileFields.length) * 100);
  const profileReasons: string[] = [];
  const profileActions: OnboardingQualityAction[] = [];
  if (profileCompleteness < 100) {
    profileReasons.push('Business profile is incomplete');
    profileActions.push({
      gateKey: 'business_profile',
      action: 'Fill missing business profile fields (owner, contact, timezone).',
      impact: 'high',
    });
  }
  gateResults.push({
    key: 'business_profile',
    title: 'Business Profile Completeness',
    score: profileCompleteness,
    maxScore: policy.gates.business_profile.weight,
    passed: profileCompleteness >= policy.gates.business_profile.minScore,
    critical: policy.gates.business_profile.critical,
    reasons: profileReasons,
    actions: profileActions,
  });

  // Gate 2: Services + pricing boundaries
  const serviceCount = input.services.length;
  const hasMinServices = serviceCount >= policy.thresholds.minServices;
  const invalidPricedServices = input.services.filter((service) => {
    if (service.canDiscussPrice !== 'yes_range') return false;
    const min = service.priceRangeMinCents ?? 0;
    const max = service.priceRangeMaxCents ?? 0;
    return min <= 0 || max <= 0 || min >= max;
  });
  const servicesScore = Math.round(
    Math.min(1, serviceCount / Math.max(1, policy.thresholds.minServices)) * 60 +
      (invalidPricedServices.length === 0 ? 40 : 0)
  );
  const servicesReasons: string[] = [];
  const servicesActions: OnboardingQualityAction[] = [];
  if (!hasMinServices) {
    servicesReasons.push(`Only ${serviceCount} active service(s); minimum is ${policy.thresholds.minServices}`);
    servicesActions.push({
      gateKey: 'services_pricing_boundaries',
      action: `Add at least ${policy.thresholds.minServices} services in structured knowledge.`,
      impact: 'high',
    });
  }
  if (invalidPricedServices.length > 0) {
    servicesReasons.push(`${invalidPricedServices.length} service pricing ranges are invalid`);
    servicesActions.push({
      gateKey: 'services_pricing_boundaries',
      action: 'Fix pricing ranges where AI can discuss price (min/max must be valid).',
      impact: 'high',
    });
  }
  gateResults.push({
    key: 'services_pricing_boundaries',
    title: 'Services & Pricing Boundaries',
    score: servicesScore,
    maxScore: policy.gates.services_pricing_boundaries.weight,
    passed:
      hasMinServices &&
      invalidPricedServices.length === 0 &&
      servicesScore >= policy.gates.services_pricing_boundaries.minScore,
    critical: policy.gates.services_pricing_boundaries.critical,
    reasons: servicesReasons,
    actions: servicesActions,
  });

  // Gate 3: FAQ + objection coverage
  const faqCount = input.structured?.faqs?.filter((faq) =>
    faq.question.trim().length > 0 && faq.answer.trim().length > 0
  ).length ?? 0;
  const neverSayCount = input.structured?.neverSay?.filter((item) => item.trim().length > 0).length ?? 0;
  const dontDoCount = input.structured?.dontDo?.filter((item) => item.trim().length > 0).length ?? 0;
  const faqScore = Math.round(
    Math.min(1, faqCount / Math.max(1, policy.thresholds.minFaqs)) * 60 +
      Math.min(1, neverSayCount / Math.max(1, policy.thresholds.minNeverSayRules)) * 25 +
      Math.min(1, dontDoCount / Math.max(1, policy.thresholds.minDontDoItems)) * 15
  );
  const faqReasons: string[] = [];
  const faqActions: OnboardingQualityAction[] = [];
  if (faqCount < policy.thresholds.minFaqs) {
    faqReasons.push(`FAQ coverage is low (${faqCount}/${policy.thresholds.minFaqs})`);
    faqActions.push({
      gateKey: 'faq_objection_coverage',
      action: `Add at least ${policy.thresholds.minFaqs} FAQ entries in structured knowledge.`,
      impact: 'high',
    });
  }
  if (neverSayCount < policy.thresholds.minNeverSayRules) {
    faqReasons.push(`AI boundary rules are insufficient (${neverSayCount}/${policy.thresholds.minNeverSayRules})`);
    faqActions.push({
      gateKey: 'faq_objection_coverage',
      action: 'Add explicit "AI must never say" guardrail rules.',
      impact: 'medium',
    });
  }
  if (dontDoCount < policy.thresholds.minDontDoItems) {
    faqReasons.push('Service exclusions are missing');
    faqActions.push({
      gateKey: 'faq_objection_coverage',
      action: 'Document at least one service boundary ("we do not do").',
      impact: 'medium',
    });
  }
  gateResults.push({
    key: 'faq_objection_coverage',
    title: 'FAQ & Objection Coverage',
    score: faqScore,
    maxScore: policy.gates.faq_objection_coverage.weight,
    passed:
      faqCount >= policy.thresholds.minFaqs &&
      neverSayCount >= policy.thresholds.minNeverSayRules &&
      dontDoCount >= policy.thresholds.minDontDoItems &&
      faqScore >= policy.gates.faq_objection_coverage.minScore,
    critical: policy.gates.faq_objection_coverage.critical,
    reasons: faqReasons,
    actions: faqActions,
  });

  // Gate 4: Escalation contact validation
  const escalationScore = input.escalation.activeEscalationRecipients > 0 && input.escalation.ownersWithContact > 0
    ? 100
    : input.escalation.activeOwners > 0
      ? 60
      : 0;
  const escalationReasons: string[] = [];
  const escalationActions: OnboardingQualityAction[] = [];
  if (input.escalation.activeEscalationRecipients === 0) {
    escalationReasons.push('No active escalation recipient configured');
    escalationActions.push({
      gateKey: 'escalation_contacts',
      action: 'Enable at least one active team member for escalations.',
      impact: 'high',
    });
  }
  if (input.escalation.ownersWithContact === 0) {
    escalationReasons.push('Owner contact method missing (phone/email)');
    escalationActions.push({
      gateKey: 'escalation_contacts',
      action: 'Add owner contact details so escalations have a fallback route.',
      impact: 'high',
    });
  }
  gateResults.push({
    key: 'escalation_contacts',
    title: 'Escalation Contact Validation',
    score: escalationScore,
    maxScore: policy.gates.escalation_contacts.weight,
    passed:
      input.escalation.activeEscalationRecipients > 0 &&
      input.escalation.ownersWithContact > 0 &&
      escalationScore >= policy.gates.escalation_contacts.minScore,
    critical: policy.gates.escalation_contacts.critical,
    reasons: escalationReasons,
    actions: escalationActions,
  });

  // Gate 5: Business hours configured
  const businessHoursScore = input.businessHoursCount > 0 ? 100 : 0;
  const businessHoursReasons: string[] = [];
  const businessHoursActions: OnboardingQualityAction[] = [];
  if (input.businessHoursCount === 0) {
    businessHoursReasons.push('No business hours configured');
    businessHoursActions.push({
      gateKey: 'business_hours_configured',
      action: 'Configure business hours so the AI knows when calls and ring groups are active.',
      impact: 'high',
    });
  }
  gateResults.push({
    key: 'business_hours_configured',
    title: 'Business Hours Configured',
    score: businessHoursScore,
    maxScore: policy.gates.business_hours_configured.weight,
    passed:
      input.businessHoursCount > 0 &&
      businessHoursScore >= policy.gates.business_hours_configured.minScore,
    critical: policy.gates.business_hours_configured.critical,
    reasons: businessHoursReasons,
    actions: businessHoursActions,
  });

  const maxScore = gateResults.reduce((sum, gate) => sum + gate.maxScore, 0);
  const totalScore = gateResults.reduce(
    (sum, gate) => sum + weightedScore(gate.score, gate.maxScore),
    0
  );
  const criticalFailures = gateResults
    .filter((gate) => gate.critical && !gate.passed)
    .map((gate) => gate.key);
  const passedCritical = criticalFailures.length === 0;
  const passedAll = gateResults.every((gate) => gate.passed);
  const recommendedActions = sortActions(
    gateResults.flatMap((gate) => gate.actions)
  );

  return {
    mode: policy.mode,
    totalScore,
    maxScore,
    passedCritical,
    passedAll,
    criticalFailures,
    gates: gateResults,
    recommendedActions,
  };
}

export async function getActiveOnboardingQualityOverride(
  clientId: string,
  now: Date = new Date()
): Promise<OnboardingQualityOverride | null> {
  const db = getDb();
  const [override] = await db
    .select()
    .from(onboardingQualityOverrides)
    .where(and(
      eq(onboardingQualityOverrides.clientId, clientId),
      eq(onboardingQualityOverrides.isActive, true),
      or(
        isNull(onboardingQualityOverrides.expiresAt),
        gt(onboardingQualityOverrides.expiresAt, now)
      )
    ))
    .limit(1);
  return override ?? null;
}

export async function evaluateOnboardingQualityForClient(input: {
  clientId: string;
  source?: string;
  evaluatedByPersonId?: string | null;
  persistSnapshot?: boolean;
}): Promise<OnboardingQualityEvaluation> {
  const db = getDb();
  const policy = getOnboardingQualityPolicy();
  const now = new Date();

  const [client] = await db
    .select({
      businessName: clients.businessName,
      ownerName: clients.ownerName,
      email: clients.email,
      phone: clients.phone,
      timezone: clients.timezone,
    })
    .from(clients)
    .where(eq(clients.id, input.clientId))
    .limit(1);

  if (!client) {
    throw new Error('Client not found');
  }

  const [services, memberships, structured, businessHoursRows] = await Promise.all([
    db
      .select({
        name: clientServices.name,
        priceRangeMinCents: clientServices.priceRangeMinCents,
        priceRangeMaxCents: clientServices.priceRangeMaxCents,
        canDiscussPrice: clientServices.canDiscussPrice,
      })
      .from(clientServices)
      .where(and(
        eq(clientServices.clientId, input.clientId),
        eq(clientServices.isActive, true)
      )),
    db
      .select({
        isOwner: clientMemberships.isOwner,
        receiveEscalations: clientMemberships.receiveEscalations,
        personEmail: people.email,
        personPhone: people.phone,
      })
      .from(clientMemberships)
      .innerJoin(people, eq(clientMemberships.personId, people.id))
      .where(and(
        eq(clientMemberships.clientId, input.clientId),
        eq(clientMemberships.isActive, true)
      )),
    loadStructuredKnowledge(input.clientId),
    db
      .select({ count: count() })
      .from(businessHours)
      .where(eq(businessHours.clientId, input.clientId)),
  ]);

  const evaluation = evaluateOnboardingQualityFromInput(
    {
      businessProfile: {
        businessName: client.businessName,
        ownerName: client.ownerName,
        email: client.email,
        phone: client.phone,
        timezone: client.timezone,
      },
      services,
      structured,
      escalation: {
        activeOwners: memberships.filter((membership) => membership.isOwner).length,
        activeEscalationRecipients: memberships.filter((membership) => membership.receiveEscalations).length,
        ownersWithContact: memberships.filter(
          (membership) =>
            membership.isOwner &&
            (hasValue(membership.personEmail) || hasValue(membership.personPhone))
        ).length,
      },
      businessHoursCount: businessHoursRows[0]?.count ?? 0,
    },
    policy
  );

  if (input.persistSnapshot !== false) {
    await db.insert(onboardingQualitySnapshots).values({
      clientId: input.clientId,
      source: input.source ?? 'system',
      policyMode: evaluation.mode,
      evaluatedByPersonId: input.evaluatedByPersonId ?? null,
      totalScore: evaluation.totalScore,
      maxScore: evaluation.maxScore,
      passedCritical: evaluation.passedCritical,
      passedAll: evaluation.passedAll,
      gateResults: evaluation.gates,
      criticalFailures: evaluation.criticalFailures,
      recommendedActions: evaluation.recommendedActions,
      createdAt: now,
    });
  }

  return evaluation;
}

export interface AutonomousModeTransitionDecision {
  mode: OnboardingQualityPolicyMode;
  allowed: boolean;
  reason: string;
  requiresOverride: boolean;
}

export function evaluateAutonomousModeTransitionDecision(input: {
  evaluation: OnboardingQualityEvaluation;
  override: OnboardingQualityOverride | null;
  policyMode: OnboardingQualityPolicyMode;
}): AutonomousModeTransitionDecision {
  if (input.policyMode === 'off') {
    return {
      mode: input.policyMode,
      allowed: true,
      reason: 'Onboarding quality policy mode is OFF',
      requiresOverride: false,
    };
  }

  if (input.evaluation.passedCritical) {
    return {
      mode: input.policyMode,
      allowed: true,
      reason: 'All critical onboarding quality gates passed',
      requiresOverride: false,
    };
  }

  if (input.override?.isActive && input.override.allowAutonomousMode) {
    return {
      mode: input.policyMode,
      allowed: true,
      reason: 'Client-level onboarding quality override approved',
      requiresOverride: false,
    };
  }

  if (input.policyMode === 'warn') {
    return {
      mode: input.policyMode,
      allowed: true,
      reason: 'Quality policy in WARN mode allows autonomous transition',
      requiresOverride: false,
    };
  }

  return {
    mode: input.policyMode,
    allowed: false,
    reason: 'Critical onboarding quality gates failed',
    requiresOverride: true,
  };
}

export async function getOnboardingQualityReadiness(input: {
  clientId: string;
  source?: string;
  evaluatedByPersonId?: string | null;
  persistSnapshot?: boolean;
}) {
  const policyMode = resolveOnboardingQualityPolicyMode();
  const [evaluation, override] = await Promise.all([
    evaluateOnboardingQualityForClient({
      ...input,
      source: input.source,
      evaluatedByPersonId: input.evaluatedByPersonId,
      persistSnapshot: input.persistSnapshot,
    }),
    getActiveOnboardingQualityOverride(input.clientId),
  ]);
  const decision = evaluateAutonomousModeTransitionDecision({
    evaluation,
    override,
    policyMode,
  });

  return {
    evaluation,
    override,
    decision,
  };
}

export async function setOnboardingQualityOverride(input: {
  clientId: string;
  approvedByPersonId: string;
  reason: string;
  allowAutonomousMode?: boolean;
  expiresAt?: Date | null;
}) {
  if (!input.reason || input.reason.trim().length < 10) {
    throw new Error('Override reason must be at least 10 characters');
  }

  const db = getDb();
  const now = new Date();
  const [override] = await db
    .insert(onboardingQualityOverrides)
    .values({
      clientId: input.clientId,
      allowAutonomousMode: input.allowAutonomousMode ?? true,
      reason: input.reason.trim(),
      approvedByPersonId: input.approvedByPersonId,
      approvedAt: now,
      expiresAt: input.expiresAt ?? null,
      isActive: true,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: onboardingQualityOverrides.clientId,
      set: {
        allowAutonomousMode: input.allowAutonomousMode ?? true,
        reason: input.reason.trim(),
        approvedByPersonId: input.approvedByPersonId,
        approvedAt: now,
        expiresAt: input.expiresAt ?? null,
        isActive: true,
        updatedAt: now,
      },
    })
    .returning();

  await db.insert(auditLog).values({
    personId: input.approvedByPersonId,
    clientId: input.clientId,
    action: 'onboarding_quality_override_set',
    resourceType: 'onboarding_quality_override',
    resourceId: override.id,
    metadata: {
      allowAutonomousMode: override.allowAutonomousMode,
      reason: override.reason,
      expiresAt: override.expiresAt?.toISOString() ?? null,
    },
    createdAt: now,
  });

  return override;
}

export async function clearOnboardingQualityOverride(input: {
  clientId: string;
  clearedByPersonId: string;
  reason?: string;
}) {
  const db = getDb();
  const now = new Date();
  const [existing] = await db
    .select()
    .from(onboardingQualityOverrides)
    .where(eq(onboardingQualityOverrides.clientId, input.clientId))
    .limit(1);

  if (!existing) return null;

  const [updated] = await db
    .update(onboardingQualityOverrides)
    .set({
      isActive: false,
      updatedAt: now,
    })
    .where(eq(onboardingQualityOverrides.id, existing.id))
    .returning();

  await db.insert(auditLog).values({
    personId: input.clearedByPersonId,
    clientId: input.clientId,
    action: 'onboarding_quality_override_cleared',
    resourceType: 'onboarding_quality_override',
    resourceId: existing.id,
    metadata: {
      reason: input.reason ?? null,
    },
    createdAt: now,
  });

  return updated;
}

export async function getLatestOnboardingQualitySnapshot(clientId: string) {
  const db = getDb();
  const [snapshot] = await db
    .select()
    .from(onboardingQualitySnapshots)
    .where(eq(onboardingQualitySnapshots.clientId, clientId))
    .orderBy(desc(onboardingQualitySnapshots.createdAt))
    .limit(1);
  return snapshot ?? null;
}
