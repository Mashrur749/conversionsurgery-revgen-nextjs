import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getCapacityEstimate } from '@/lib/services/capacity-tracking';
import { NextResponse } from 'next/server';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const result = await getCapacityEstimate();
    return NextResponse.json(result);
  }
);
