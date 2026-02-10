import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getMonthlyComparison } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { clientId } = await params;
  const { searchParams } = new URL(request.url);
  const months = parseInt(searchParams.get('months') || '6');

  try {
    const data = await getMonthlyComparison(clientId, months);
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Analytics] Error fetching monthly comparison:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
