import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/utils/cron';
import { sendActionPrompt } from '@/lib/services/agency-communication';
import {
  buildEstimateFallbackNudgeMessage,
  findEstimateNudgeEligibleLeads,
} from '@/lib/services/estimate-nudge';
import { safeErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/cron/estimate-fallback-nudges - Send fallback estimate nudges for stale contacted leads. */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const eligibleLeads = await findEstimateNudgeEligibleLeads();
    let nudged = 0;
    let skipped = 0;

    for (const lead of eligibleLeads) {
      const message = buildEstimateFallbackNudgeMessage(
        lead.clientName,
        lead.leadName,
        lead.leadPhone
      );

      const promptId = await sendActionPrompt({
        clientId: lead.clientId,
        promptType: 'start_sequences',
        message,
        actionPayload: {
          source: 'fallback_nudge',
          leadId: lead.leadId,
        },
        expiresInHours: 48,
      });

      if (promptId) {
        nudged++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      eligible: eligibleLeads.length,
      nudged,
      skipped,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return safeErrorResponse(
      '[Cron][estimate-fallback-nudges]',
      error,
      'Failed to process estimate fallback nudges'
    );
  }
}
