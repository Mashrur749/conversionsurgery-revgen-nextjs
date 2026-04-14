import { NextRequest, NextResponse } from 'next/server';
import { runGuaranteeAlert } from '@/lib/automations/guarantee-alert';
import { verifyCronSecret } from '@/lib/utils/cron';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Cron endpoint: alert the operator when a client is 8–12 days from their
 * 90-day guarantee deadline with insufficient pipeline.
 * Runs daily at midnight UTC.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runGuaranteeAlert();

    console.log(
      `[GuaranteeAlert] scanned=${result.scanned}, alerted=${result.alerted}, skipped=${result.skipped}, errors=${result.errors.length}`
    );

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][guarantee-alert]', error, 'Processing failed');
  }
}
