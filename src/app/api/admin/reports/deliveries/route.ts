import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { listReportDeliveryOpsRows } from '@/lib/services/report-delivery-retry';

/** GET /api/admin/reports/deliveries */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const viewParam = searchParams.get('view');
    const limitParam = searchParams.get('limit');

    const view =
      viewParam === 'failed' ||
      viewParam === 'pending_retry' ||
      viewParam === 'terminal' ||
      viewParam === 'sent'
        ? viewParam
        : 'all';

    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    const result = await listReportDeliveryOpsRows({ view, limit });

    return Response.json({
      success: true,
      ...result,
    });
  }
);

