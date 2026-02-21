import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/admin/reports/[id] */
export const GET = adminRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ params }) => {
    const { id } = params;
    const db = getDb();

    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);

    if (!report) {
      return Response.json({ error: 'Report not found' }, { status: 404 });
    }

    return Response.json({ success: true, report });
  }
);
