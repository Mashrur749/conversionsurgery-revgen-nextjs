import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getClientDashboardSummary } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;

  try {
    const summary = await getClientDashboardSummary(clientId);
    return NextResponse.json(summary);
  } catch (error) {
    console.error('[Analytics] Error fetching dashboard summary:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
