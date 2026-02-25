import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import {
  autoGenerateReviewDrafts,
  autoPostApprovedResponses,
} from '@/lib/automations/auto-review-response';
import { safeErrorResponse } from '@/lib/utils/api-errors';

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
    return safeErrorResponse('[Cron][auto-review-response]', error, 'Cron failed');
  }
}
