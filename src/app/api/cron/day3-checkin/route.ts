import { NextRequest, NextResponse } from 'next/server';
import { runDay3Checkin } from '@/lib/automations/day3-checkin';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send day-3 check-in SMS to new contractors with live activity data.
 * Runs daily at 7am UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runDay3Checkin();

    console.log(
      `[Day3Checkin] scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][day3-checkin]', error, 'Processing failed');
  }
}
