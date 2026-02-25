import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processDailySummaries } from '@/lib/services/daily-summary';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/daily-summary - Send daily email summaries to eligible clients. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processDailySummaries();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    return safeErrorResponse('[Cron][daily-summary]', error, 'Failed');
  }
}
