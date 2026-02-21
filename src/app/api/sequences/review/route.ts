import { NextRequest, NextResponse } from 'next/server';
import { getClientSession } from '@/lib/client-auth';
import { startReviewRequest } from '@/lib/automations/review-request';
import { z } from 'zod';

const schema = z.object({
  leadId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const session = await getClientSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { leadId } = schema.parse(body);

    const clientId = session.clientId;

    const result = await startReviewRequest({ leadId, clientId });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', details: error.issues }, { status: 400 });
    }
    console.error('Review request error:', error);
    return NextResponse.json({ error: 'Failed to start sequence' }, { status: 500 });
  }
}
