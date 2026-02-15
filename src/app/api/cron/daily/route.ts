import { NextRequest, NextResponse } from 'next/server';
import { runDailyAnalyticsJob } from '@/lib/services/analytics-aggregation';
import { verifyCronSecret } from '@/lib/utils/cron';

/**
 * GET handler to run daily analytics aggregation job.
 * Aggregates analytics data for all active clients.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await runDailyAnalyticsJob();

    return NextResponse.json({
      success: true,
      message: 'Daily analytics job completed',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CronScheduling] Daily analytics job failed:', error);
    return NextResponse.json(
      { error: 'Daily analytics job failed' },
      { status: 500 }
    );
  }
}
