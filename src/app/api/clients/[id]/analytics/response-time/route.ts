import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getResponseTimeDistribution } from '@/lib/services/analytics-queries';
import { permissionErrorResponse, safeErrorResponse } from '@/lib/utils/api-errors';

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
  const startDate = searchParams.get('startDate') || getDefaultStartDate();
  const endDate = searchParams.get('endDate') || new Date().toISOString();

  try {
    const data = await getResponseTimeDistribution(clientId, startDate, endDate);
    return NextResponse.json(data);
  } catch (error) {
    return safeErrorResponse('[Analytics][response-time]', error, 'Internal server error');
  }
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}
