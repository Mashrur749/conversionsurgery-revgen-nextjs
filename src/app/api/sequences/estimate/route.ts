import { NextRequest, NextResponse } from 'next/server';
import { getAuthSession } from '@/lib/auth-session';
import { startEstimateFollowup } from '@/lib/automations/estimate-followup';
import { z } from 'zod';

const schema = z.object({
  leadId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const authSession = await getAuthSession();
  if (!authSession?.clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { leadId } = schema.parse(body);

    const clientId = authSession.clientId;

    const result = await startEstimateFollowup({ leadId, clientId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Estimate followup error:', error);
    return NextResponse.json({ error: 'Failed to start sequence' }, { status: 500 });
  }
}
