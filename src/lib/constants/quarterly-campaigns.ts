import type { quarterlyCampaignStatusEnum, quarterlyCampaignTypeEnum } from '@/db/schema';

export type QuarterlyCampaignType = (typeof quarterlyCampaignTypeEnum.enumValues)[number];
export type QuarterlyCampaignStatus = (typeof quarterlyCampaignStatusEnum.enumValues)[number];

export const QUARTERLY_CAMPAIGN_TYPE_LABELS: Record<QuarterlyCampaignType, string> = {
  dormant_reactivation: 'Dormant Client Reactivation Blitz',
  review_acceleration: 'Review Acceleration Sprint',
  pipeline_builder: 'Slow Season Pipeline Builder',
  year_end_strategy: 'Year-End Strategy Session',
};

export const QUARTERLY_CAMPAIGN_STATUS_LABELS: Record<QuarterlyCampaignStatus, string> = {
  planned: 'Planned',
  scheduled: 'Scheduled',
  launched: 'Launched',
  completed: 'Completed',
};

export const CAMPAIGN_REQUIRED_ASSETS: Record<QuarterlyCampaignType, string[]> = {
  dormant_reactivation: ['customer_list_extracted'],
  review_acceleration: ['completed_jobs_list_compiled'],
  pipeline_builder: ['stale_inquiries_segmented'],
  year_end_strategy: ['annual_performance_snapshot'],
};

export const CAMPAIGN_ASSET_LABELS: Record<string, string> = {
  customer_list_extracted: 'Customer list extracted (20+ contacts)',
  completed_jobs_list_compiled: 'Completed jobs list compiled',
  stale_inquiries_segmented: 'Stale inquiries segmented for outreach',
  annual_performance_snapshot: 'Annual performance snapshot prepared',
};
