import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { safeErrorResponse, permissionErrorResponse } from '@/lib/utils/api-errors';

/** GET /api/admin/reports/[id] */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {

    const { id } = await params;
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
  } catch (error) {
    return safeErrorResponse('[Analytics] Reports Get Error:', error, 'Failed to fetch report');
  }
}
