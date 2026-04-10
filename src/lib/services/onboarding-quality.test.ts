import { describe, expect, it } from 'vitest';
import {
  evaluateAutonomousModeTransitionDecision,
  evaluateOnboardingQualityFromInput,
  setOnboardingQualityOverride,
} from './onboarding-quality';

const completeInput = {
  businessProfile: {
    businessName: 'ConversionSurgery Demo',
    ownerName: 'Alex Owner',
    email: 'owner@example.com',
    phone: '+14035551234',
    timezone: 'America/Edmonton',
  },
  services: [
    {
      name: 'Kitchen Renovation',
      priceRangeMinCents: 2500000,
      priceRangeMaxCents: 8000000,
      canDiscussPrice: 'yes_range',
    },
    {
      name: 'Basement Renovation',
      priceRangeMinCents: 3000000,
      priceRangeMaxCents: 9000000,
      canDiscussPrice: 'yes_range',
    },
  ],
  structured: {
    faqs: [
      { question: 'Do you service Calgary?', answer: 'Yes.' },
      { question: 'Do you offer financing?', answer: 'Yes.' },
      { question: 'How long does a kitchen take?', answer: '6-12 weeks.' },
      { question: 'Are estimates free?', answer: 'Yes.' },
      { question: 'Are permits included?', answer: 'Handled case-by-case.' },
    ],
    neverSay: ['Guaranteed timeline', 'Final fixed price over SMS'],
    dontDo: ['Emergency plumbing-only calls'],
  },
  escalation: {
    activeOwners: 1,
    activeEscalationRecipients: 1,
    ownersWithContact: 1,
  },
  businessHoursCount: 7,
};

describe('evaluateOnboardingQualityFromInput', () => {
  it('passes all gates when setup is production-ready', () => {
    const result = evaluateOnboardingQualityFromInput(completeInput as any);

    expect(result.passedCritical).toBe(true);
    expect(result.passedAll).toBe(true);
    expect(result.criticalFailures).toHaveLength(0);
    expect(result.totalScore).toBeGreaterThanOrEqual(90);
  });

  it('fails critical gates with actionable recommendations when setup is incomplete', () => {
    const result = evaluateOnboardingQualityFromInput(
      {
        ...completeInput,
        services: [
          {
            name: 'Kitchen Renovation',
            priceRangeMinCents: 0,
            priceRangeMaxCents: 5000000,
            canDiscussPrice: 'yes_range',
          },
        ],
        structured: {
          faqs: [{ question: 'Q', answer: 'A' }],
          neverSay: [],
          dontDo: [],
        },
        escalation: {
          activeOwners: 1,
          activeEscalationRecipients: 0,
          ownersWithContact: 0,
        },
      } as any
    );

    expect(result.passedCritical).toBe(false);
    expect(result.criticalFailures).toContain('services_pricing_boundaries');
    expect(result.criticalFailures).toContain('faq_objection_coverage');
    expect(result.criticalFailures).toContain('escalation_contacts');
    expect(result.recommendedActions.length).toBeGreaterThan(0);
    expect(result.recommendedActions[0]?.impact).toBe('high');
  });
});

describe('evaluateAutonomousModeTransitionDecision', () => {
  it('blocks autonomous transition in enforce mode when critical gates fail', () => {
    const failed = evaluateOnboardingQualityFromInput(
      {
        ...completeInput,
        escalation: {
          activeOwners: 1,
          activeEscalationRecipients: 0,
          ownersWithContact: 0,
        },
      } as any
    );

    const decision = evaluateAutonomousModeTransitionDecision({
      evaluation: failed,
      override: null,
      policyMode: 'enforce',
    });

    expect(decision.allowed).toBe(false);
    expect(decision.requiresOverride).toBe(true);
  });

  it('allows transition with active override in enforce mode', () => {
    const failed = evaluateOnboardingQualityFromInput(
      {
        ...completeInput,
        escalation: {
          activeOwners: 1,
          activeEscalationRecipients: 0,
          ownersWithContact: 0,
        },
      } as any
    );

    const decision = evaluateAutonomousModeTransitionDecision({
      evaluation: failed,
      override: {
        id: 'ovr_1',
        clientId: 'client_1',
        allowAutonomousMode: true,
        reason: 'Approved by operations after temporary staffing change.',
        approvedByPersonId: 'person_1',
        approvedAt: new Date(),
        expiresAt: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      policyMode: 'enforce',
    });

    expect(decision.allowed).toBe(true);
    expect(decision.requiresOverride).toBe(false);
  });
});

describe('setOnboardingQualityOverride', () => {
  it('requires at least 10 characters for override reason before DB writes', async () => {
    await expect(
      setOnboardingQualityOverride({
        clientId: 'client_1',
        approvedByPersonId: 'person_1',
        reason: 'too short',
      })
    ).rejects.toThrow('Override reason must be at least 10 characters');
  });
});
