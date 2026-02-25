import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendQuarterlyCampaignAdminDigest } from '@/lib/services/campaign-service';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/quarterly-campaign-alerts - Send quarterly campaign progress digest/alerts for operators. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const mode = request.nextUrl.searchParams.get('mode');
  const alertsOnly = mode !== 'weekly';

  try {
    const result = await sendQuarterlyCampaignAdminDigest({ alertsOnly });
    return NextResponse.json({ success: true, mode: alertsOnly ? 'alerts' : 'weekly', ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][quarterly-campaign-alerts]', error, 'Failed');
  }
}
