import type { QuarterlyCampaign } from '@/db/schema/quarterly-campaigns';
import {
  CAMPAIGN_ASSET_LABELS,
  QUARTERLY_CAMPAIGN_STATUS_LABELS,
  QUARTERLY_CAMPAIGN_TYPE_LABELS,
} from '@/lib/constants/quarterly-campaigns';

export interface QuarterlyCampaignSummaryDto {
  id: string;
  quarterKey: string;
  campaignType: string;
  campaignTypeLabel: string;
  status: string;
  statusLabel: string;
  scheduledAt: string | null;
  launchedAt: string | null;
  completedAt: string | null;
  requiredAssets: string[];
  completedAssets: string[];
  missingAssets: string[];
  missingAssetLabels: string[];
  evidenceCount: number;
  planNotes: string | null;
  outcomeSummary: string | null;
}

export function toQuarterlyCampaignSummaryDto(
  campaign: QuarterlyCampaign
): QuarterlyCampaignSummaryDto {
  const requiredAssets = campaign.requiredAssets || [];
  const completedAssets = campaign.completedAssets || [];
  const missingAssets = requiredAssets.filter((asset) => !completedAssets.includes(asset));

  return {
    id: campaign.id,
    quarterKey: campaign.quarterKey,
    campaignType: campaign.campaignType,
    campaignTypeLabel:
      QUARTERLY_CAMPAIGN_TYPE_LABELS[campaign.campaignType] || campaign.campaignType,
    status: campaign.status,
    statusLabel: QUARTERLY_CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status,
    scheduledAt: campaign.scheduledAt?.toISOString() || null,
    launchedAt: campaign.launchedAt?.toISOString() || null,
    completedAt: campaign.completedAt?.toISOString() || null,
    requiredAssets,
    completedAssets,
    missingAssets,
    missingAssetLabels: missingAssets.map((asset) => CAMPAIGN_ASSET_LABELS[asset] || asset),
    evidenceCount: Array.isArray(campaign.evidenceLinks) ? campaign.evidenceLinks.length : 0,
    planNotes: campaign.planNotes || null,
    outcomeSummary: campaign.outcomeSummary || null,
  };
}
