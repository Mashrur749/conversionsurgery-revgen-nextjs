import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processGoLiveGate } from '@/lib/automations/guarantee-gates';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/guarantee-21day — daily check for go-live gate */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const results = await processGoLiveGate();
    const extended = results.filter((r) => r.action === 'extended').length;
    const live = results.filter((r) => r.action === 'already_live').length;

    return NextResponse.json({
      success: true,
      checked: results.length,
      live,
      extended,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][guarantee-21day]', error, 'Failed');
  }
}
