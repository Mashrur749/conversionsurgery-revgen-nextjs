import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { takeOverConversation } from '@/lib/services/escalation';
import { safeErrorResponse } from '@/lib/utils/api-errors';
import { ClientOwnershipError } from '@/lib/utils/client-ownership';

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
    const body = await request.json() as { teamMemberId?: string };
    const { teamMemberId } = body;

    if (!teamMemberId) {
      return NextResponse.json({ error: 'teamMemberId required' }, { status: 400 });
    }

    await takeOverConversation(id, teamMemberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ClientOwnershipError) {
      return NextResponse.json({ error: 'Team member does not belong to this client' }, { status: 403 });
    }
    return safeErrorResponse('[Escalation API][takeover.post]', error, 'Failed to take over conversation');
  }
}
