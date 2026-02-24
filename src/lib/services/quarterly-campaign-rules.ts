import type { QuarterlyCampaignType } from '@/lib/constants/quarterly-campaigns';

export interface CampaignRecommendationMetrics {
  inboundLeads30: number;
  reviewsRequested90: number;
  dormantLeadCount: number;
}

export function getQuarterNumber(date: Date): 1 | 2 | 3 | 4 {
  return (Math.floor(date.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
}

export function getQuarterKey(date: Date): string {
  return `${date.getUTCFullYear()}-Q${getQuarterNumber(date)}`;
}

export function parseQuarterKey(quarterKey: string): { year: number; quarter: 1 | 2 | 3 | 4 } {
  const match = quarterKey.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    throw new Error(`Invalid quarter key: ${quarterKey}`);
  }
  return {
    year: Number(match[1]),
    quarter: Number(match[2]) as 1 | 2 | 3 | 4,
  };
}

export function getQuarterStartDate(quarterKey: string): Date {
  const { year, quarter } = parseQuarterKey(quarterKey);
  const monthStart = (quarter - 1) * 3;
  return new Date(Date.UTC(year, monthStart, 1, 0, 0, 0));
}

export function addQuarters(date: Date, count: number): Date {
  const copy = new Date(date);
  copy.setUTCMonth(copy.getUTCMonth() + count * 3);
  return copy;
}

export function getPlanningQuarterKeys(now: Date): string[] {
  const current = getQuarterKey(now);
  const next = getQuarterKey(addQuarters(now, 1));
  return [current, next];
}

export function deriveMissingQuarterKeys(
  existingQuarterKeys: string[],
  targetQuarterKeys: string[]
): string[] {
  const existing = new Set(existingQuarterKeys);
  const missing: string[] = [];
  for (const key of targetQuarterKeys) {
    if (!existing.has(key)) {
      missing.push(key);
    }
  }
  return missing;
}

export function getDefaultCampaignTypeForQuarter(quarter: 1 | 2 | 3 | 4): QuarterlyCampaignType {
  if (quarter === 1) return 'dormant_reactivation';
  if (quarter === 2) return 'review_acceleration';
  if (quarter === 3) return 'pipeline_builder';
  return 'year_end_strategy';
}

export function recommendCampaignTypeForAccount(
  metrics: CampaignRecommendationMetrics,
  quarter: 1 | 2 | 3 | 4
): QuarterlyCampaignType {
  if (quarter === 4) {
    return 'year_end_strategy';
  }

  if (metrics.dormantLeadCount >= 20) {
    return 'dormant_reactivation';
  }

  if (metrics.reviewsRequested90 < 10) {
    return 'review_acceleration';
  }

  if (metrics.inboundLeads30 < 15) {
    return 'pipeline_builder';
  }

  return getDefaultCampaignTypeForQuarter(quarter);
}
