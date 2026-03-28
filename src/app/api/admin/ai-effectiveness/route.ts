import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getAiEffectivenessSnapshot } from '@/lib/services/ai-effectiveness-metrics';

/**
 * GET /api/admin/ai-effectiveness
 *
 * Query params:
 *   days     — lookback window (default 14, max 90)
 *   clientId — optional client scope
 */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const url = new URL(request.url);

    const daysParam = parseInt(url.searchParams.get('days') ?? '14', 10);
    const days = Math.min(Math.max(daysParam, 1), 90);
    const clientId = url.searchParams.get('clientId') ?? undefined;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const snapshot = await getAiEffectivenessSnapshot({
      startDate,
      endDate,
      clientId,
    });

    return NextResponse.json(snapshot);
  }
);
