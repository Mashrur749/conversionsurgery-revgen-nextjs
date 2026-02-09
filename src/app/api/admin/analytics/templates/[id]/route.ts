import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getTemplatePerformance } from '@/lib/services/flow-metrics';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const stats = await getTemplatePerformance(id, days);
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Analytics Template Detail]', error);
    return NextResponse.json(
      { error: 'Failed to fetch template performance' },
      { status: 500 }
    );
  }
}
