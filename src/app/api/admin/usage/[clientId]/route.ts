import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getClientUsageSummary, getCurrentMonthUsage } from '@/lib/services/usage-tracking';
import { getUnacknowledgedAlerts } from '@/lib/services/usage-alerts';

// GET - Get detailed usage for a specific client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { clientId } = await params;

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate') || getMonthStart();
  const endDate = searchParams.get('endDate') || getToday();

  const [summary, currentMonth, alerts] = await Promise.all([
    getClientUsageSummary(clientId, startDate, endDate),
    getCurrentMonthUsage(clientId),
    getUnacknowledgedAlerts(clientId),
  ]);

  return NextResponse.json({
    ...summary,
    currentMonth,
    alerts,
  });
}

function getMonthStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}
