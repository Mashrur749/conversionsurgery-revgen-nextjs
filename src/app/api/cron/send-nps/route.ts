import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendPendingNpsSurveys } from '@/lib/services/nps-survey';

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendPendingNpsSurveys();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[NPS Cron] Error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
