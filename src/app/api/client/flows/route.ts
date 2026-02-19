import { NextResponse } from 'next/server';
import { requirePortalPermission, PORTAL_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { flows } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/client/flows - List all flows assigned to the authenticated client. */
export async function GET() {
  let session;
  try {
    session = await requirePortalPermission(PORTAL_PERMISSIONS.SETTINGS_VIEW);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  const clientFlows = await db
    .select({
      id: flows.id,
      name: flows.name,
      description: flows.description,
      category: flows.category,
      trigger: flows.trigger,
      isActive: flows.isActive,
      priority: flows.priority,
      createdAt: flows.createdAt,
    })
    .from(flows)
    .where(eq(flows.clientId, session.clientId))
    .orderBy(flows.priority);

  return NextResponse.json({ flows: clientFlows });
}
