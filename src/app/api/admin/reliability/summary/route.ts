import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getSoloReliabilitySummary } from '@/lib/services/solo-reliability-summary';

/** GET /api/admin/reliability/summary - Solo operator reliability snapshot. */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async () => {
    const summary = await getSoloReliabilitySummary();
    return NextResponse.json({ success: true, summary });
  }
);
