import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { retryReportDeliveryById } from '@/lib/services/report-delivery-retry';
import { z } from 'zod';

const retrySchema = z.object({
  force: z.boolean().optional(),
});

/** POST /api/admin/reports/deliveries/[deliveryId]/retry */
export const POST = adminRoute<{ deliveryId: string }>(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request, params }) => {
    const body = await request.json().catch(() => ({}));
    const parsed = retrySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await retryReportDeliveryById(params.deliveryId, {
      force: parsed.data.force ?? true,
    });

    if (!result.ok) {
      if (result.reason === 'not_found') {
        return Response.json({ error: 'Delivery not found' }, { status: 404 });
      }
      if (result.reason === 'not_failed') {
        return Response.json({ error: 'Delivery is not in failed state' }, { status: 409 });
      }
      if (result.reason === 'backoff_pending') {
        return Response.json({ error: 'Delivery is still in retry backoff window' }, { status: 409 });
      }
      if (result.reason === 'retry_exhausted') {
        return Response.json({ error: 'Delivery is marked terminal and requires force retry' }, { status: 409 });
      }
      if (result.reason === 'concurrent_claim') {
        return Response.json({ error: 'Delivery retry is already being processed' }, { status: 409 });
      }
      return Response.json({ error: 'Retry failed to start' }, { status: 409 });
    }

    return Response.json({
      success: true,
      result,
    });
  }
);
