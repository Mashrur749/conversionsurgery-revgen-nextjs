import { auth } from '@/lib/auth';
import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { eq } from 'drizzle-orm';

/** GET /api/admin/reports/[id] */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!(session as { user?: { isAdmin?: boolean } })?.user?.isAdmin) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

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
