import { NextRequest, NextResponse } from 'next/server';
import { runDailyAnalyticsJob } from '@/lib/services/analytics-aggregation';

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('Authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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
    console.error('[Cron] Daily analytics job failed:', error);
    return NextResponse.json(
      { error: 'Daily analytics job failed' },
      { status: 500 }
    );
  }
}
