import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getLeadSourceBreakdown } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  try {
    await requireAgencyClientPermission(clientId, AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || getDefaultStartDate();
  const endDate = searchParams.get('endDate') || new Date().toISOString();

  try {
    const sources = await getLeadSourceBreakdown(clientId, startDate, endDate);
    return NextResponse.json(sources);
  } catch (error) {
    console.error('[Analytics] Error fetching sources:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}
