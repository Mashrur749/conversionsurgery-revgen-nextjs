import { NextRequest, NextResponse } from 'next/server';
import { claimEscalation } from '@/lib/services/team-escalation';
import { z } from 'zod';
import { safeErrorResponse } from '@/lib/utils/api-errors';

const schema = z.object({
  token: z.string().min(1),
  teamMemberId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, teamMemberId } = schema.parse(body);

    const result = await claimEscalation(token, teamMemberId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    return safeErrorResponse('Claim', error, 'Failed to claim');
  }
}
