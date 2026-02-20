import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { compareTemplates } from '@/lib/services/flow-metrics';
import { safeErrorResponse, permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/admin/analytics/templates */
export async function GET(request: NextRequest) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
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
    return safeErrorResponse('[Analytics] Templates Error:', error, 'Failed to fetch template analytics');
  }
}
