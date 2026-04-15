import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { generateMonthlyDigest } from '@/lib/services/monthly-health-digest';
import { NextResponse } from 'next/server';

export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async () => {
    const digest = await generateMonthlyDigest();
    return NextResponse.json(digest);
  }
);
