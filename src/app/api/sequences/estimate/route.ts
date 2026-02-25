import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { triggerEstimateFollowup } from '@/lib/services/estimate-triggers';
import { z } from 'zod';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const schema = z.object({
  leadId: z.string().uuid(),
});

/**
 * POST /api/sequences/estimate - Start an estimate follow-up sequence
 * Requires authentication with clientId. Schedules follow-up messages for estimate.
 */
export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
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
    const clientId = session.clientId;

    const result = await triggerEstimateFollowup({
      leadId,
      clientId,
      source: 'dashboard_api',
    });
    return NextResponse.json(result);
  } catch (error) {
    return safeErrorResponse('[Sequences][estimate.post]', error, 'Failed to start sequence');
  }
}
