import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { revokeApiKey } from '@/lib/services/api-key-management';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await revokeApiKey(id);
  return NextResponse.json({ success: true });
}
