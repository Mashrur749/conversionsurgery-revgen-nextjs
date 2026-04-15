import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getOperatorActions } from '@/lib/services/operator-actions';
import { NextResponse } from 'next/server';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const result = await getOperatorActions();
    return NextResponse.json(result);
  }
);
