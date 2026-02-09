import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { acknowledgeAlert } from '@/lib/services/usage-alerts';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  await acknowledgeAlert(id, (session as any).user.id);

  return NextResponse.json({ success: true });
}
