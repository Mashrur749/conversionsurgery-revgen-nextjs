import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getMonthlyComparison } from '@/lib/services/analytics-queries';
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

  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '6');

  try {
    const data = await getMonthlyComparison(clientId, months);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Analytics] Error fetching monthly comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
