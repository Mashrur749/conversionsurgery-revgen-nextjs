import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-session';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';
import { z } from 'zod';

const schema = z.object({
  leadId: z.string().uuid(),
});

/**
 * POST /api/sequences/estimate - Start an estimate follow-up sequence
 * Requires authentication with clientId. Schedules follow-up messages for estimate.
 */
export async function POST(request: NextRequest) {
  const authSession = await getAuthSession();
  if (!authSession?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validation = schema.safeParse(body);

    if (!validation.success) {
      const errors = validation.error.flatten().fieldErrors;
      console.log('[Payments] Validation failed:', errors);
      return NextResponse.json({ error: 'Invalid input', details: errors }, { status: 400 });
    }

    const { leadId } = validation.data;
    const clientId = authSession.clientId;

    const result = await startEstimateFollowup({ leadId, clientId });
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Payments] Estimate followup error:', error);
    return NextResponse.json({ error: 'Failed to start sequence' }, { status: 500 });
  }
}
