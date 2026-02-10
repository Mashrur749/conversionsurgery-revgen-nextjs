import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { ComplianceReportGenerator } from '@/lib/compliance/report-generator';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const months = parseInt(searchParams.get('months') || '1');

  const endDate = endOfMonth(new Date());
  const startDate = startOfMonth(subMonths(new Date(), months - 1));

  const report = await ComplianceReportGenerator.generateReport(
    session.clientId,
    startDate,
    endDate
  );

  return NextResponse.json(report);
}
