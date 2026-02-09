import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { compareTemplates } from '@/lib/services/flow-metrics';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!(session as any)?.user?.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const days = parseInt(searchParams.get('days') || '30');

    if (!category) {
      return NextResponse.json({ error: 'Category required' }, { status: 400 });
    }

    const comparison = await compareTemplates(category, days);
    return NextResponse.json(comparison);
  } catch (error) {
    console.error('[Analytics Templates]', error);
    return NextResponse.json(
      { error: 'Failed to fetch template analytics' },
      { status: 500 }
    );
  }
}
