import { NextRequest, NextResponse } from 'next/server';
import { runHeartbeatCheck } from '@/lib/automations/heartbeat-check';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: daily meta-cron that verifies all expected cron jobs
 * fired in the last 24 hours (26h window for timing drift).
 * Runs daily at midnight UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runHeartbeatCheck();

    console.log(
      `[HeartbeatCheck] healthy=${result.healthy}, issues=${result.issues.length}`
    );

    if (!result.healthy) {
      console.warn('[HeartbeatCheck] Issues detected:', result.issues);
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][heartbeat-check]', error, 'Processing failed');
  }
}
