import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processTrialReminders } from '@/lib/services/trial-reminders';

/** POST /api/cron/trial-reminders - Send trial reminder emails. Run daily. */
export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await processTrialReminders();
  console.log('[Cron:TrialReminders]', result);

  return NextResponse.json(result);
}
