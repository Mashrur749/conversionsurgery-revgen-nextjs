import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { runAppointmentFollowupTrigger } from '@/lib/automations/appointment-followup-trigger';
import { logSanitizedConsoleError } from '@/lib/services/internal-error-log';

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runAppointmentFollowupTrigger();
    return NextResponse.json(result);
  } catch (error) {
    logSanitizedConsoleError('[Cron] Appointment followup trigger failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
