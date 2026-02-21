import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processBiWeeklyReports } from '@/lib/services/report-generation';

/** GET /api/cron/biweekly-reports - Deterministic bi-weekly report generation and delivery. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processBiWeeklyReports();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] Bi-weekly reports error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
