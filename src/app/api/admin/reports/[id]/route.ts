import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/admin/reports/[id] */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    const msg = error instanceof Error ? error.message : '';
    return Response.json(
      { error: msg.includes('Unauthorized') ? 'Unauthorized' : 'Forbidden' },
      { status: msg.includes('Unauthorized') ? 401 : 403 }
    );
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch report';
    console.error('[Analytics] Reports Get Error:', errorMessage);
    return Response.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
