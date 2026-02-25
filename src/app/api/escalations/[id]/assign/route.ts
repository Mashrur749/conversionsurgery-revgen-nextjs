import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { assignEscalation } from '@/lib/services/escalation';
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
    const body = await request.json() as { teamMemberId?: string };
    const { teamMemberId } = body;

    if (!teamMemberId) {
      return NextResponse.json({ error: 'teamMemberId required' }, { status: 400 });
    }

    await assignEscalation(id, teamMemberId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return safeErrorResponse('[Escalation API][assign.post]', error, 'Failed to assign escalation');
  }
}
