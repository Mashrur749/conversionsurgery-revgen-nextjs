import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { reNotifyPendingEscalations } from '@/lib/services/team-escalation';
import { safeErrorResponse } from '@/lib/utils/api-errors';

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await reNotifyPendingEscalations();
    return NextResponse.json(result);
  } catch (error) {
    return safeErrorResponse('[Cron][escalation-renotify]', error, 'Re-notification failed');
  }
}
