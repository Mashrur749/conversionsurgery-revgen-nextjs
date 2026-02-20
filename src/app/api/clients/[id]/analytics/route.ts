import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getClientDashboardSummary } from '@/lib/services/analytics-queries';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const summary = await getClientDashboardSummary(clientId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Analytics] Error fetching dashboard summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
