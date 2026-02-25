import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processGuaranteeStatus } from '@/lib/services/guarantee-monitor';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/guarantee-check - Evaluate guarantee lifecycle status for subscriptions. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processGuaranteeStatus();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][guarantee-check]', error, 'Failed');
  }
}
