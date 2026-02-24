import { describe, expect, it } from 'vitest';

import {
  deriveMissingQuarterKeys,
  getPlanningQuarterKeys,
  getQuarterKey,
  parseQuarterKey,
  recommendCampaignTypeForAccount,
} from './quarterly-campaign-rules';

describe('quarterly-campaign-rules', () => {
  it('returns deterministic planning quarter keys (current + next)', () => {
    const keys = getPlanningQuarterKeys(new Date('2026-02-24T00:00:00.000Z'));
    expect(keys).toEqual(['2026-Q1', '2026-Q2']);
  });

  it('derives missing quarter keys for planner idempotency', () => {
    const missing = deriveMissingQuarterKeys(['2026-Q1'], ['2026-Q1', '2026-Q2']);
    expect(missing).toEqual(['2026-Q2']);

    const noneMissing = deriveMissingQuarterKeys(['2026-Q1', '2026-Q2'], ['2026-Q1', '2026-Q2']);
    expect(noneMissing).toEqual([]);
  });

  it('parses and rebuilds quarter keys', () => {
    const parsed = parseQuarterKey('2026-Q3');
    expect(parsed).toEqual({ year: 2026, quarter: 3 });
    expect(getQuarterKey(new Date('2026-08-10T00:00:00.000Z'))).toBe('2026-Q3');
  });

  it('recommends dormant reactivation when dormant pool is high', () => {
    const recommendation = recommendCampaignTypeForAccount(
      { inboundLeads30: 40, reviewsRequested90: 25, dormantLeadCount: 30 },
      2
    );
    expect(recommendation).toBe('dormant_reactivation');
  });

  it('recommends review acceleration when review volume is low', () => {
    const recommendation = recommendCampaignTypeForAccount(
      { inboundLeads30: 25, reviewsRequested90: 2, dormantLeadCount: 3 },
      2
    );
    expect(recommendation).toBe('review_acceleration');
  });

  it('recommends pipeline builder when inbound leads are low', () => {
    const recommendation = recommendCampaignTypeForAccount(
      { inboundLeads30: 8, reviewsRequested90: 20, dormantLeadCount: 2 },
      3
    );
    expect(recommendation).toBe('pipeline_builder');
  });
});
