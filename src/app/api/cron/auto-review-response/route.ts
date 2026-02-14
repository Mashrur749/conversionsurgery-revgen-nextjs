import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import {
  autoGenerateReviewDrafts,
  autoPostApprovedResponses,
} from '@/lib/automations/auto-review-response';

export async function POST(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const drafts = await autoGenerateReviewDrafts();
    const posts = await autoPostApprovedResponses();

    return NextResponse.json({
      success: true,
      draftsCreated: drafts.draftsCreated,
      draftErrors: drafts.errors,
      posted: posts.posted,
      postErrors: posts.errors,
    });
  } catch (error) {
    console.error('[AutoReviewCron] Error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
