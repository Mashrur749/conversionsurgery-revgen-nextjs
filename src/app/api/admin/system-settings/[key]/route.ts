import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** DELETE /api/admin/system-settings/[key] - Delete a system setting. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { key } = await params;
  const db = getDb();

  const [deleted] = await db
    .delete(systemSettings)
    .where(eq(systemSettings.key, key))
    .returning();

  if (!deleted) {
    return NextResponse.json({ error: 'Setting not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
