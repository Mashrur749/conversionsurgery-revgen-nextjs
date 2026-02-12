import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getTemplatePerformance } from '@/lib/services/flow-metrics';

/** GET /api/admin/analytics/templates/[id] */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const stats = await getTemplatePerformance(id, days);
    return NextResponse.json(stats);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch template performance';
    console.error('[Analytics] Template Detail Error:', errorMessage);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
