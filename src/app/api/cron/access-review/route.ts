import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processMonthlyAccessReview } from '@/lib/services/access-review';

/** GET /api/cron/access-review - Monthly access review automation. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processMonthlyAccessReview();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] Access review error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
