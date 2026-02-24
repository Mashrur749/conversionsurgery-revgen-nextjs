import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { planQuarterlyCampaigns } from '@/lib/services/campaign-service';

/** GET /api/cron/quarterly-campaign-planner - Ensure quarterly campaign drafts exist for active clients. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await planQuarterlyCampaigns();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] Quarterly campaign planner error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
