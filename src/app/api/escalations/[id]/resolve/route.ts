import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveEscalation } from '@/lib/services/escalation';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
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
    console.error('[Escalation API] Error resolving:', error);
    return NextResponse.json({ error: 'Failed to resolve escalation' }, { status: 500 });
  }
}
