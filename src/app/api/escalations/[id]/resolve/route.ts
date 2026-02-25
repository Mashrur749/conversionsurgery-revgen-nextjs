import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { resolveEscalation } from '@/lib/services/escalation';
import { safeErrorResponse } from '@/lib/utils/api-errors';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json() as {
      teamMemberId?: string;
      resolution?: string;
      notes?: string;
      returnToAi?: boolean;
    };
    const { teamMemberId, resolution, notes, returnToAi } = body;

    if (!teamMemberId || !resolution) {
      return NextResponse.json({ error: 'teamMemberId and resolution required' }, { status: 400 });
    }

    await resolveEscalation(id, teamMemberId, resolution, notes, returnToAi);

    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse('[Escalation API][resolve.post]', error, 'Failed to resolve escalation');
  }
}
