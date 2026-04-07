import { pgEnum } from 'drizzle-orm/pg-core';

export const quarterlyCampaignTypeEnum = pgEnum('quarterly_campaign_type', [
  'dormant_reactivation',
  'review_acceleration',
  'pipeline_builder',
  'year_end_strategy',
]);
export type QuarterlyCampaignType = (typeof quarterlyCampaignTypeEnum.enumValues)[number];

export const quarterlyCampaignStatusEnum = pgEnum('quarterly_campaign_status', [
  'planned',
  'scheduled',
  'launched',
  'completed',
]);
export type QuarterlyCampaignStatus = (typeof quarterlyCampaignStatusEnum.enumValues)[number];
