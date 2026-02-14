import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { removeNumber, setPrimary } from '@/lib/services/client-phone-management';
import { z } from 'zod';

const patchSchema = z.object({
  isPrimary: z.boolean().optional(),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { phoneId } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.isPrimary) {
    await setPrimary(phoneId);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phoneId: string }> }
) {
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { phoneId } = await params;
  await removeNumber(phoneId);
  return NextResponse.json({ success: true });
}
