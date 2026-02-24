export const WITHOUT_US_MODEL_VERSION = 'without-us-v1';

export interface WithoutUsScenarioAssumptions {
  responseWinRate: number;
  followupRecoveryRate: number;
  averageProjectValue: number;
}

export interface WithoutUsModelAssumptions {
  industryBaselineResponseMinutes: number;
  scenarios: {
    low: WithoutUsScenarioAssumptions;
    base: WithoutUsScenarioAssumptions;
    high: WithoutUsScenarioAssumptions;
  };
  disclaimer: string;
}

export interface WithoutUsModelAssumptionOverrides {
  industryBaselineResponseMinutes?: number;
  disclaimer?: string;
  scenarios?: {
    low?: Partial<WithoutUsScenarioAssumptions>;
    base?: Partial<WithoutUsScenarioAssumptions>;
    high?: Partial<WithoutUsScenarioAssumptions>;
  };
}

export interface WithoutUsModelInput {
  afterHoursLeadCount: number;
  averageObservedResponseMinutes: number | null;
  responseSampleCount: number;
  delayedFollowupCount: number;
  periodLeadCount: number;
}

export interface WithoutUsScenarioOutput {
  atRiskLeads: number;
  estimatedRevenueRisk: number;
  afterHoursLeadRisk: number;
  delayedFollowupLeadRisk: number;
}

export interface WithoutUsModelReadyResult {
  status: 'ready';
  modelVersion: string;
  generatedAt: string;
  responseImprovementRatio: number;
  inputs: WithoutUsModelInput;
  assumptions: WithoutUsModelAssumptions;
  ranges: {
    low: WithoutUsScenarioOutput;
    base: WithoutUsScenarioOutput;
    high: WithoutUsScenarioOutput;
  };
}

export interface WithoutUsModelInsufficientDataResult {
  status: 'insufficient_data';
  modelVersion: string;
  generatedAt: string;
  missingInputs: string[];
  inputs: WithoutUsModelInput;
  assumptions: WithoutUsModelAssumptions;
  message: string;
}

export type WithoutUsModelResult =
  | WithoutUsModelReadyResult
  | WithoutUsModelInsufficientDataResult;

export const DEFAULT_WITHOUT_US_ASSUMPTIONS: WithoutUsModelAssumptions = {
  industryBaselineResponseMinutes: 42,
  scenarios: {
    low: {
      responseWinRate: 0.12,
      followupRecoveryRate: 0.08,
      averageProjectValue: 30000,
    },
    base: {
      responseWinRate: 0.2,
      followupRecoveryRate: 0.14,
      averageProjectValue: 45000,
    },
    high: {
      responseWinRate: 0.3,
      followupRecoveryRate: 0.22,
      averageProjectValue: 65000,
    },
  },
  disclaimer:
    'Directional model only. Based on observed response speed, after-hours lead volume, and delayed estimate follow-up counts. Actual outcomes vary by market, lead quality, and close process.',
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function roundLeads(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundMoney(value: number): number {
  return Math.max(0, Math.round(value));
}

function calculateScenario(
  inputs: WithoutUsModelInput,
  responseImprovementRatio: number,
  assumptions: WithoutUsScenarioAssumptions
): WithoutUsScenarioOutput {
  const afterHoursLeadRisk =
    inputs.afterHoursLeadCount *
    responseImprovementRatio *
    assumptions.responseWinRate;
  const delayedFollowupLeadRisk =
    inputs.delayedFollowupCount * assumptions.followupRecoveryRate;
  const atRiskLeads = afterHoursLeadRisk + delayedFollowupLeadRisk;

  return {
    atRiskLeads: roundLeads(atRiskLeads),
    estimatedRevenueRisk: roundMoney(atRiskLeads * assumptions.averageProjectValue),
    afterHoursLeadRisk: roundLeads(afterHoursLeadRisk),
    delayedFollowupLeadRisk: roundLeads(delayedFollowupLeadRisk),
  };
}

export function mergeWithoutUsAssumptions(
  overrides: WithoutUsModelAssumptionOverrides | null | undefined
): WithoutUsModelAssumptions {
  const fallback = DEFAULT_WITHOUT_US_ASSUMPTIONS;
  if (!overrides) {
    return fallback;
  }

  return {
    industryBaselineResponseMinutes:
      overrides.industryBaselineResponseMinutes ??
      fallback.industryBaselineResponseMinutes,
    disclaimer: overrides.disclaimer ?? fallback.disclaimer,
    scenarios: {
      low: {
        responseWinRate:
          overrides.scenarios?.low?.responseWinRate ??
          fallback.scenarios.low.responseWinRate,
        followupRecoveryRate:
          overrides.scenarios?.low?.followupRecoveryRate ??
          fallback.scenarios.low.followupRecoveryRate,
        averageProjectValue:
          overrides.scenarios?.low?.averageProjectValue ??
          fallback.scenarios.low.averageProjectValue,
      },
      base: {
        responseWinRate:
          overrides.scenarios?.base?.responseWinRate ??
          fallback.scenarios.base.responseWinRate,
        followupRecoveryRate:
          overrides.scenarios?.base?.followupRecoveryRate ??
          fallback.scenarios.base.followupRecoveryRate,
        averageProjectValue:
          overrides.scenarios?.base?.averageProjectValue ??
          fallback.scenarios.base.averageProjectValue,
      },
      high: {
        responseWinRate:
          overrides.scenarios?.high?.responseWinRate ??
          fallback.scenarios.high.responseWinRate,
        followupRecoveryRate:
          overrides.scenarios?.high?.followupRecoveryRate ??
          fallback.scenarios.high.followupRecoveryRate,
        averageProjectValue:
          overrides.scenarios?.high?.averageProjectValue ??
          fallback.scenarios.high.averageProjectValue,
      },
    },
  };
}

export function calculateWithoutUsModel(
  input: WithoutUsModelInput,
  assumptions: WithoutUsModelAssumptions = DEFAULT_WITHOUT_US_ASSUMPTIONS
): WithoutUsModelResult {
  const nowIso = new Date().toISOString();
  const missingInputs: string[] = [];

  if (!Number.isFinite(input.periodLeadCount) || input.periodLeadCount <= 0) {
    missingInputs.push('periodLeadCount');
  }
  if (
    input.averageObservedResponseMinutes === null ||
    !Number.isFinite(input.averageObservedResponseMinutes)
  ) {
    missingInputs.push('averageObservedResponseMinutes');
  }
  if (!Number.isFinite(input.responseSampleCount) || input.responseSampleCount <= 0) {
    missingInputs.push('responseSampleCount');
  }
  if (
    !Number.isFinite(assumptions.industryBaselineResponseMinutes) ||
    assumptions.industryBaselineResponseMinutes <= 0
  ) {
    missingInputs.push('industryBaselineResponseMinutes');
  }

  if (missingInputs.length > 0) {
    return {
      status: 'insufficient_data',
      modelVersion: WITHOUT_US_MODEL_VERSION,
      generatedAt: nowIso,
      missingInputs,
      inputs: input,
      assumptions,
      message:
        'Insufficient data to compute a directional "Without Us" model for this period.',
    };
  }

  const responseImprovementRatio = clamp(
    (assumptions.industryBaselineResponseMinutes -
      (input.averageObservedResponseMinutes || 0)) /
      assumptions.industryBaselineResponseMinutes,
    0,
    1
  );

  return {
    status: 'ready',
    modelVersion: WITHOUT_US_MODEL_VERSION,
    generatedAt: nowIso,
    responseImprovementRatio: roundLeads(responseImprovementRatio),
    inputs: input,
    assumptions,
    ranges: {
      low: calculateScenario(input, responseImprovementRatio, assumptions.scenarios.low),
      base: calculateScenario(input, responseImprovementRatio, assumptions.scenarios.base),
      high: calculateScenario(input, responseImprovementRatio, assumptions.scenarios.high),
    },
  };
}
