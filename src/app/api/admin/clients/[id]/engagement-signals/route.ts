import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getEngagementSignals } from '@/lib/services/engagement-signals';
import { NextResponse } from 'next/server';

export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ clientId }) => {
    const result = await getEngagementSignals(clientId);
    return NextResponse.json(result);
  }
);
