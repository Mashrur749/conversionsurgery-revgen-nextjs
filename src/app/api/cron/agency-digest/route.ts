import { NextRequest, NextResponse } from 'next/server';
import { processAgencyWeeklyDigests } from '@/lib/services/agency-communication';

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * Weekly cron to send agency digests to all active clients.
 * Configured in deployment to run once per week.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sent = await processAgencyWeeklyDigests();
    return NextResponse.json({ success: true, sent });
  } catch (error) {
    console.error('[Cron] Agency digest error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
