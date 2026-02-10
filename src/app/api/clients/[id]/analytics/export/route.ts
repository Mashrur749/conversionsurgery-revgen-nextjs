import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDb, analyticsMonthly, clients } from '@/db';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'csv';
  const months = parseInt(searchParams.get('months') || '12');

  const db = getDb();

  try {
    // Get client info
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    // Get monthly data
    const data = await db
      .select()
      .from(analyticsMonthly)
      .where(eq(analyticsMonthly.clientId, clientId))
      .orderBy(desc(analyticsMonthly.month))
      .limit(months);

    if (format === 'csv') {
      const headers = [
        'Month',
        'New Leads',
        'Appointments',
        'Jobs Won',
        'Jobs Lost',
        'Revenue',
        'Payments Collected',
        'Conversion Rate',
        'AI Handled %',
        'Platform Cost',
        'ROI Multiple',
      ];

      const rows = data.map((d) => [
        d.month,
        d.newLeads,
        d.appointmentsBooked,
        d.jobsWon,
        d.jobsLost,
        (d.revenueAttributedCents / 100).toFixed(2),
        (d.paymentsCollectedCents / 100).toFixed(2),
        d.leadToJobRate ? (d.leadToJobRate / 100).toFixed(2) : '',
        d.aiHandledPercent ?? '',
        ((d.platformCostCents || 0) / 100).toFixed(2),
        d.roiMultiple?.toFixed(2) ?? '',
      ]);

      const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join(
        '\n'
      );

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${client?.businessName || 'analytics'}-report.csv"`,
        },
      });
    }

    // JSON format
    return NextResponse.json({
      client: client?.businessName,
      generatedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error('[Analytics Export] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
