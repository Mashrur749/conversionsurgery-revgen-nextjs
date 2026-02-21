import { adminRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import { reports } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateClientReport } from '@/lib/services/report-generation';

const generateReportSchema = z.object({
  clientId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportType: z.enum(['bi-weekly', 'monthly', 'custom']).default('bi-weekly'),
  title: z.string().min(1).optional(),
});

/** GET /api/admin/reports */
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50')), 100);
    const offset = (page - 1) * limit;

    const db = getDb();

    let query = db.select().from(reports);

    if (clientId) {
      query = query.where(eq(reports.clientId, clientId)) as typeof query;
    }

    const allReports = await (query as typeof query)
      .orderBy(reports.createdAt)
      .limit(limit)
      .offset(offset);

    return Response.json({
      success: true,
      reports: allReports,
      count: allReports.length,
      page,
      limit,
    });
  }
);

/** POST /api/admin/reports */
export const POST = adminRoute(
  { permission: AGENCY_PERMISSIONS.ANALYTICS_VIEW },
  async ({ request }) => {
    const body = await request.json();
    const validation = generateReportSchema.safeParse(body);

    if (!validation.success) {
      return Response.json(
        { error: 'Invalid request', details: validation.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      clientId,
      startDate,
      endDate,
      reportType,
      title: customTitle,
    } = validation.data;

    const db = getDb();

    const newReport = await generateClientReport(
      clientId,
      startDate,
      endDate,
      reportType,
      customTitle
    );

    return Response.json({
      success: true,
      report: newReport,
      message: `Report generated for ${startDate} to ${endDate}`,
    });
  }
);
