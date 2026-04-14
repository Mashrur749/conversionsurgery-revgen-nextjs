import { NextRequest, NextResponse } from 'next/server';
import { runBillingReminder } from '@/lib/automations/billing-reminder';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: send Day 25 billing reminder SMS to contractors whose trial
 * ends in 5 days (4–6 day tolerance window).
 * Runs daily at midnight UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runBillingReminder();

    console.log(
      `[BillingReminder] scanned=${result.scanned}, sent=${result.sent}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][billing-reminder]', error, 'Processing failed');
  }
}
