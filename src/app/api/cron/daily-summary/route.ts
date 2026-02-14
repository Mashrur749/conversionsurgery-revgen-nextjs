import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processDailySummaries } from '@/lib/services/daily-summary';

/** GET /api/cron/daily-summary - Send daily email summaries to eligible clients. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processDailySummaries();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error('[Cron] Daily summary error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
