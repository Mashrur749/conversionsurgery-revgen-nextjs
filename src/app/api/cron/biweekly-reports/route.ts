import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { runBiweeklyReportsCatchup } from '@/lib/services/biweekly-report-job';

/** GET /api/cron/biweekly-reports - Deterministic bi-weekly report generation and delivery. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const catchup = await runBiweeklyReportsCatchup();
    return NextResponse.json({ success: true, catchup });
  } catch (error) {
    console.error('[Cron] Bi-weekly reports error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
