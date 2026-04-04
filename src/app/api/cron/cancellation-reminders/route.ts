import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processCancellationReminders } from '@/lib/services/cancellation-reminders';

/** POST /api/cron/cancellation-reminders - Send grace-period and win-back emails. Run daily. */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processCancellationReminders();
  console.log('[Cron:CancellationReminders]', result);

  return NextResponse.json(result);
}
