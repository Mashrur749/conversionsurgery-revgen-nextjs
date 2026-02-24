import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminClientRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';
import {
  addCampaignEvidence,
  applyCampaignAction,
  toggleCampaignAsset,
  updateCampaignNotes,
} from '@/lib/services/campaign-service';
import { toQuarterlyCampaignSummaryDto } from '@/lib/services/quarterly-campaign-summary';

const updateCampaignSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve_plan'),
  }),
  z.object({
    action: z.literal('launch_campaign'),
  }),
  z.object({
    action: z.literal('complete_campaign'),
    outcomeSummary: z.string().min(1).max(4000),
  }),
  z.object({
    action: z.literal('toggle_asset'),
    assetKey: z.string().min(1),
    completed: z.boolean(),
  }),
  z.object({
    action: z.literal('add_evidence'),
    evidence: z.string().min(1).max(2000),
  }),
  z.object({
    action: z.literal('update_notes'),
    planNotes: z.string().max(4000).nullable().optional(),
    outcomeSummary: z.string().max(4000).nullable().optional(),
  }),
]);

export const PATCH = adminClientRoute<{ id: string; campaignId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (params) => params.id },
  async ({ request, clientId, params }) => {
    const payload = updateCampaignSchema.parse(await request.json());

    let updated;
    if (payload.action === 'approve_plan') {
      updated = await applyCampaignAction({
        clientId,
        campaignId: params.campaignId,
        action: 'approve_plan',
      });
    } else if (payload.action === 'launch_campaign') {
      updated = await applyCampaignAction({
        clientId,
        campaignId: params.campaignId,
        action: 'launch_campaign',
      });
    } else if (payload.action === 'complete_campaign') {
      updated = await applyCampaignAction({
        clientId,
        campaignId: params.campaignId,
        action: 'complete_campaign',
        outcomeSummary: payload.outcomeSummary,
      });
    } else if (payload.action === 'toggle_asset') {
      updated = await toggleCampaignAsset({
        clientId,
        campaignId: params.campaignId,
        assetKey: payload.assetKey,
        completed: payload.completed,
      });
    } else if (payload.action === 'add_evidence') {
      updated = await addCampaignEvidence({
        clientId,
        campaignId: params.campaignId,
        evidence: payload.evidence,
      });
    } else {
      updated = await updateCampaignNotes({
        clientId,
        campaignId: params.campaignId,
        planNotes: payload.planNotes,
        outcomeSummary: payload.outcomeSummary,
      });
    }

    return NextResponse.json({ campaign: toQuarterlyCampaignSummaryDto(updated) });
  }
);
