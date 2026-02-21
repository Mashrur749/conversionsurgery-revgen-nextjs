import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getTemplatePerformance } from '@/lib/services/flow-metrics';

/** GET /api/admin/analytics/templates/[id] */
export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request, params }) => {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const stats = await getTemplatePerformance(id, days);
    return NextResponse.json(stats);
  }
);
