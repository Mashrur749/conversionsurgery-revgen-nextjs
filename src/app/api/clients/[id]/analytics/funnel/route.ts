import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getConversionFunnel } from '@/lib/services/analytics-queries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || getDefaultStartDate();
  const endDate = searchParams.get('endDate') || new Date().toISOString();

  try {
    const funnel = await getConversionFunnel(clientId, startDate, endDate);
    return NextResponse.json(funnel);
  } catch (error) {
    console.error('[Analytics] Error fetching funnel:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getDefaultStartDate(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString();
}
