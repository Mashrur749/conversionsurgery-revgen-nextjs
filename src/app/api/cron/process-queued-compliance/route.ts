import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processQueuedComplianceMessages } from '@/lib/services/compliance-queue';

/** GET /api/cron/process-queued-compliance - Replays non-lead quiet-hours queued messages. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processQueuedComplianceMessages();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] Process queued compliance error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
