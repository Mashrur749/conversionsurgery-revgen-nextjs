import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

/** GET /api/client/reports/[id]/download - Download a generated report artifact (JSON). */
export const GET = portalRoute<{ id: string }>(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session, params }) => {
    const db = getDb();
    const [report] = await db
      .select()
      .from(reports)
      .where(and(eq(reports.id, params.id), eq(reports.clientId, session.clientId)))
      .limit(1);

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const payload = {
      id: report.id,
      title: report.title,
      reportType: report.reportType,
      startDate: report.startDate,
      endDate: report.endDate,
      metrics: report.metrics,
      roiSummary: report.roiSummary,
      teamPerformance: report.teamPerformance,
      notes: report.notes,
      generatedAt: report.createdAt,
    };

    const filename = `report-${report.startDate}-to-${report.endDate}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  }
);

