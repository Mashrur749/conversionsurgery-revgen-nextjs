import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendWeeklyDigests } from '@/lib/services/weekly-digest';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/**
 * Weekly activity digest for contractors.
 * Sends Monday morning SMS with activity summary.
 * Cadence adapts: weekly (active), biweekly (quiet), monthly (slow period).
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendWeeklyDigests();
    return NextResponse.json(result);
  } catch (error) {
    return safeErrorResponse('[Cron][weekly-digest]', error, 'Weekly digest failed');
  }
}
