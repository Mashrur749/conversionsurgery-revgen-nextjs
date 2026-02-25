import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processReportDeliveryRetries } from '@/lib/services/report-delivery-retry';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/report-delivery-retries - Retries failed bi-weekly report deliveries with backoff. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processReportDeliveryRetries();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][report-delivery-retries]', error, 'Failed');
  }
}
