import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { processStaleKnowledgeGapAlerts } from '@/lib/services/knowledge-gap-queue';

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
    console.error('[CronScheduling] Knowledge gap stale alert error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
