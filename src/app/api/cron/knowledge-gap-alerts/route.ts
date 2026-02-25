import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processStaleKnowledgeGapAlerts } from '@/lib/services/knowledge-gap-queue';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/knowledge-gap-alerts - Send stale high-priority knowledge gap alerts. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processStaleKnowledgeGapAlerts();
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return safeErrorResponse('[Cron][knowledge-gap-alerts]', error, 'Failed');
  }
}
