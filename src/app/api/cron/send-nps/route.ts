import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendPendingNpsSurveys } from '@/lib/services/nps-survey';
import { safeErrorResponse } from '@/lib/utils/api-errors';

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendPendingNpsSurveys();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][send-nps]', error, 'Cron failed');
  }
}
