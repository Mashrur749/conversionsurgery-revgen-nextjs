import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendQuarterlyCampaignAdminDigest } from '@/lib/services/campaign-service';

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
    console.error('[Cron] Quarterly campaign digest/alerts error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
