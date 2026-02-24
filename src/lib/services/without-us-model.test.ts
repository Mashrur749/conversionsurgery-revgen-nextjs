import { describe, expect, it } from 'vitest';
import {
  calculateWithoutUsModel,
  mergeWithoutUsAssumptions,
  type WithoutUsModelAssumptions,
} from '@/lib/services/without-us-model';

const TEST_ASSUMPTIONS: WithoutUsModelAssumptions = {
  industryBaselineResponseMinutes: 40,
  disclaimer: 'Test disclaimer',
  scenarios: {
    low: {
      responseWinRate: 0.1,
      followupRecoveryRate: 0.05,
      averageProjectValue: 30000,
    },
    base: {
      responseWinRate: 0.2,
      followupRecoveryRate: 0.1,
      averageProjectValue: 45000,
    },
    high: {
      responseWinRate: 0.3,
      followupRecoveryRate: 0.2,
      averageProjectValue: 60000,
    },
  },
};

describe('without-us-model', () => {
  it('returns low/base/high modeled ranges when inputs are valid', () => {
    const result = calculateWithoutUsModel(
      {
        periodLeadCount: 12,
        afterHoursLeadCount: 6,
        averageObservedResponseMinutes: 2,
        responseSampleCount: 8,
        delayedFollowupCount: 4,
      },
      TEST_ASSUMPTIONS
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    expect(result.responseImprovementRatio).toBe(1);
    expect(result.ranges.low.atRiskLeads).toBe(0.8);
    expect(result.ranges.base.atRiskLeads).toBe(1.5);
    expect(result.ranges.high.atRiskLeads).toBe(2.5);
    expect(result.ranges.base.estimatedRevenueRisk).toBe(69300);
  });

  it('returns insufficient_data when required response inputs are missing', () => {
    const result = calculateWithoutUsModel(
      {
        periodLeadCount: 10,
        afterHoursLeadCount: 4,
        averageObservedResponseMinutes: null,
        responseSampleCount: 0,
        delayedFollowupCount: 2,
      },
      TEST_ASSUMPTIONS
    );

    expect(result.status).toBe('insufficient_data');
    if (result.status !== 'insufficient_data') return;

    expect(result.missingInputs).toContain('averageObservedResponseMinutes');
    expect(result.missingInputs).toContain('responseSampleCount');
  });

  it('merges partial assumptions over defaults', () => {
    const merged = mergeWithoutUsAssumptions({
      industryBaselineResponseMinutes: 35,
      scenarios: {
        base: {
          averageProjectValue: 50000,
        },
      },
    });

    expect(merged.industryBaselineResponseMinutes).toBe(35);
    expect(merged.scenarios.base.averageProjectValue).toBe(50000);
    expect(merged.scenarios.low.averageProjectValue).toBeGreaterThan(0);
  });
});
