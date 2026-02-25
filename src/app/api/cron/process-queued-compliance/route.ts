import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processQueuedComplianceMessages } from '@/lib/services/compliance-queue';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/process-queued-compliance - Replays non-lead quiet-hours queued messages. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processQueuedComplianceMessages();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return safeErrorResponse('[Cron][process-queued-compliance]', error, 'Failed');
  }
}
