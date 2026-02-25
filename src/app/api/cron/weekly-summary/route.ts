import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processWeeklySummaries } from '@/lib/services/weekly-summary';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/weekly-summary - Process weekly summaries for all eligible clients. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processWeeklySummaries();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    return safeErrorResponse('[Cron][weekly-summary]', error, 'Failed');
  }
}
