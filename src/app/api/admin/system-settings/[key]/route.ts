import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logDeleteAudit } from '@/lib/services/audit';

/** DELETE /api/admin/system-settings/[key] - Delete a system setting. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.SETTINGS_MANAGE);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return NextResponse.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
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

  await logDeleteAudit({ resourceType: 'system_setting', resourceId: deleted.id, metadata: { key: deleted.key } });

  return NextResponse.json({ ok: true });
}
