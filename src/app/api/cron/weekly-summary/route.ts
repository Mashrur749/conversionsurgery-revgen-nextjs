import { NextRequest, NextResponse } from 'next/server';
import { processWeeklySummaries } from '@/lib/services/weekly-summary';

/**
 * Verifies cron secret to prevent unauthorized access.
 * @param request - The incoming Next.js request
 * @returns True if the request is authorized, false otherwise
 */
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * GET handler to process weekly summaries for all eligible clients.
 * Checks client schedules and sends summaries via SMS and email.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processWeeklySummaries();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error('[CronScheduling] Weekly summary error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
