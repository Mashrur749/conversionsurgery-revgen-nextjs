import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { compareTemplates } from '@/lib/services/flow-metrics';

/** GET /api/admin/analytics/templates */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const days = parseInt(searchParams.get('days') || '30');

    if (!category) {
      return NextResponse.json({ error: 'Category required' }, { status: 400 });
    }

    const comparison = await compareTemplates(category, days);
    return NextResponse.json(comparison);
  }
);
