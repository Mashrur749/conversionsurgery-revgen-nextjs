import { NextRequest, NextResponse } from 'next/server';
import { runDailyDigest } from '@/lib/automations/daily-digest';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send daily contractor digest SMS.
 * Runs hourly — targets 10am local time per client.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDailyDigest();

    console.log(
      `[DailyDigest] scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}, empty=${result.empty}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][daily-digest]', error, 'Processing failed');
  }
}
