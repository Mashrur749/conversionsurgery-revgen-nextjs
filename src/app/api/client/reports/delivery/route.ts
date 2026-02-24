import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getClientLatestReportDelivery } from '@/lib/services/client-report-delivery';

/** GET /api/client/reports/delivery - Latest bi-weekly delivery status for client portal. */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session }) => {
    const delivery = await getClientLatestReportDelivery(session.clientId);
    return NextResponse.json({
      success: true,
      delivery,
    });
  }
);

