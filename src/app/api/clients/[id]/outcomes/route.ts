import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyClientPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getClientOutcomes } from '@/lib/services/flow-metrics';

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
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
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
