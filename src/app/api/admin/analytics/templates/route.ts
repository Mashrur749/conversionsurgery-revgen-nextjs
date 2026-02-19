import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { compareTemplates } from '@/lib/services/flow-metrics';

/** GET /api/admin/analytics/templates */
export async function GET(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
  }

  try {

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const days = parseInt(searchParams.get('days') || '30');

    if (!category) {
      return NextResponse.json({ error: 'Category required' }, { status: 400 });
    }

    const comparison = await compareTemplates(category, days);
    return NextResponse.json(comparison);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch template analytics';
    console.error('[Analytics] Templates Error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
