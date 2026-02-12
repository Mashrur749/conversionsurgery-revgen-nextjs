import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientOutcomes } from '@/lib/services/flow-metrics';

/**
 * GET /api/clients/[id]/outcomes
 * Get client flow outcomes for a period
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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
