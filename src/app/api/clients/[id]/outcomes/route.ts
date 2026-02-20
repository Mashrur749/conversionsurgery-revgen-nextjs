import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getClientOutcomes } from '@/lib/services/flow-metrics';
import { permissionErrorResponse } from '@/lib/utils/api-errors';

/**
 * GET /api/clients/[id]/outcomes
 * Get client flow outcomes for a period
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await requireAgencyClientPermission(id, AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || undefined;

    const outcomes = await getClientOutcomes(id, period);
    return NextResponse.json(outcomes);
  } catch (error) {
    console.error('[FlowEngine] Failed to fetch client outcomes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch client outcomes' },
      { status: 500 }
    );
  }
}
