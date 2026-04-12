import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { triggerEstimateFollowup } from '@/lib/services/estimate-triggers';
import { z } from 'zod';

const bodySchema = z
  .object({
    force: z.boolean().optional(),
  })
  .strict();

export const POST = adminClientRoute<{ id: string; leadId: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, params, clientId }) => {
    const { leadId } = params;

    const body = await request.json();
    const { force } = bodySchema.parse(body);

    const result = await triggerEstimateFollowup({
      clientId,
      leadId,
      source: 'manual',
      force,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.reason ?? 'Failed to start estimate follow-up' },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  }
);
