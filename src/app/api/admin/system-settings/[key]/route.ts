import { NextResponse } from 'next/server';
import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { systemSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logDeleteAudit } from '@/lib/services/audit';

/** DELETE /api/admin/system-settings/[key] - Delete a system setting. */
export const DELETE = adminRoute<{ key: string }>(
  { permission: AGENCY_PERMISSIONS.SETTINGS_MANAGE },
  async ({ params }) => {
    const { key } = params;
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
);
