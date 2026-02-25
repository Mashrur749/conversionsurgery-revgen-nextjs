import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processMonthlyAccessReview } from '@/lib/services/access-review';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/access-review - Monthly access review automation. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processMonthlyAccessReview();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][access-review]', error, 'Failed');
  }
}
