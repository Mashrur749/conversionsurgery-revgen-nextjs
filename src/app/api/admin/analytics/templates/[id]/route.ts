import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getTemplatePerformance } from '@/lib/services/flow-metrics';
import { safeErrorResponse, permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/admin/analytics/templates/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const stats = await getTemplatePerformance(id, days);
    return NextResponse.json(stats);
  } catch (error) {
    return safeErrorResponse('[Analytics] Template Detail Error:', error, 'Failed to fetch template performance');
  }
}
