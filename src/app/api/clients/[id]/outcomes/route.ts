import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getClientOutcomes } from '@/lib/services/flow-metrics';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || undefined;

    const outcomes = await getClientOutcomes(id, period);
    return NextResponse.json(outcomes);
  } catch (error) {
    console.error('[Client Outcomes]', error);
    return NextResponse.json(
      { error: 'Failed to fetch client outcomes' },
      { status: 500 }
    );
  }
}
