import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  adminClientRoute,
  AGENCY_PERMISSIONS,
} from '@/lib/utils/route-handler';
import {
  createQuarterlyCampaignDraft,
  listClientQuarterlyCampaigns,
} from '@/lib/services/campaign-service';
import { toQuarterlyCampaignSummaryDto } from '@/lib/services/quarterly-campaign-summary';
import {
  getDefaultCampaignTypeForQuarter,
  getQuarterKey,
  parseQuarterKey,
} from '@/lib/services/quarterly-campaign-rules';
import { quarterlyCampaignTypeEnum } from '@/db/schema';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (params) => params.id },
  async ({ clientId }) => {
    const campaigns = await listClientQuarterlyCampaigns(clientId);
    return NextResponse.json({
      campaigns: campaigns.map(toQuarterlyCampaignSummaryDto),
    });
  }
);

const createCampaignSchema = z.object({
  quarterKey: z.string().regex(/^\d{4}-Q[1-4]$/).optional(),
  campaignType: z.enum(quarterlyCampaignTypeEnum.enumValues).optional(),
  scheduledAt: z.string().datetime().optional(),
  planNotes: z.string().max(2000).optional(),
});

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (params) => params.id },
  async ({ request, clientId }) => {
    const payload = createCampaignSchema.parse(await request.json());
    const quarterKey = payload.quarterKey || getQuarterKey(new Date());
    const { quarter } = parseQuarterKey(quarterKey);
    const campaignType = payload.campaignType || getDefaultCampaignTypeForQuarter(quarter);

    const created = await createQuarterlyCampaignDraft({
      clientId,
      quarterKey,
      campaignType,
      scheduledAt: payload.scheduledAt ? new Date(payload.scheduledAt) : undefined,
      planNotes: payload.planNotes,
    });

    if (!created) {
      return NextResponse.json(
        { error: 'Campaign already exists for this quarter' },
        { status: 409 }
      );
    }

    return NextResponse.json({ campaign: toQuarterlyCampaignSummaryDto(created) });
  }
);
