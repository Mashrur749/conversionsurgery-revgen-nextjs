import { NextResponse } from 'next/server';
import { portalRoute, PORTAL_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reports, reportDeliveries } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

/** GET /api/client/reports - List all reports for the current client, newest first. */
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session }) => {
    const db = getDb();

    const rows = await db
      .select({
        id: reports.id,
        title: reports.title,
        reportType: reports.reportType,
        startDate: reports.startDate,
        endDate: reports.endDate,
        createdAt: reports.createdAt,
        deliveryState: reportDeliveries.state,
        sentAt: reportDeliveries.sentAt,
      })
      .from(reports)
      .leftJoin(
        reportDeliveries,
        eq(reportDeliveries.reportId, reports.id)
      )
      .where(eq(reports.clientId, session.clientId))
      .orderBy(desc(reports.startDate), desc(reports.createdAt));

    return NextResponse.json({ success: true, reports: rows });
  }
);
