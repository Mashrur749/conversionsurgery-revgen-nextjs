import { requireAgencyPermission, AGENCY_PERMISSIONS } from '@/lib/permissions';
import { getDb } from '@/db';
import { reports, dailyStats, abTests } from '@/db/schema';
import { getTeamMembers } from '@/lib/services/team-bridge';
import { eq, and, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { safeErrorResponse, permissionErrorResponse } from '@/lib/utils/api-errors';

const generateReportSchema = z.object({
  clientId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reportType: z.enum(['bi-weekly', 'monthly', 'custom']).default('bi-weekly'),
  title: z.string().min(1).optional(),
});

/** GET /api/admin/reports */
export async function GET(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {

    const { searchParams } = new URL(req.url);
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
  } catch (error) {
    return safeErrorResponse('[Analytics] Reports List Error:', error, 'Failed to fetch reports');
  }
}

/** POST /api/admin/reports */
export async function POST(req: Request) {
  try {
    await requireAgencyPermission(AGENCY_PERMISSIONS.ANALYTICS_VIEW);
  } catch (error) {
    return permissionErrorResponse(error);
  }

  try {

    const body = await req.json();
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

    // Fetch all data for the period
    const periodStats = await db
      .select()
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, clientId),
          gte(dailyStats.date, startDate as any),
          lte(dailyStats.date, endDate as any)
        )
      );

    // Fetch A/B tests running during this period
    const activeTests = await db
      .select()
      .from(abTests)
      .where(
        and(
          eq(abTests.clientId, clientId),
          gte(abTests.startDate, new Date(startDate))
        )
      );

    // Get team members
    const teamMemsList = await getTeamMembers(clientId);

    // Aggregate metrics
    const aggregatedMetrics = {
      messagesSent: periodStats.reduce((sum, s) => sum + (s.messagesSent || 0), 0),
      conversationsStarted: periodStats.reduce(
        (sum, s) => sum + (s.conversationsStarted || 0),
        0
      ),
      appointmentsReminded: periodStats.reduce(
        (sum, s) => sum + (s.appointmentsReminded || 0),
        0
      ),
      formsResponded: periodStats.reduce(
        (sum, s) => sum + (s.formsResponded || 0),
        0
      ),
      estimatesFollowedUp: periodStats.reduce(
        (sum, s) => sum + (s.estimatesFollowedUp || 0),
        0
      ),
      reviewsRequested: periodStats.reduce(
        (sum, s) => sum + ((s as any).reviewsRequested || 0),
        0
      ),
      paymentsReminded: periodStats.reduce(
        (sum, s) => sum + ((s as any).paymentsReminded || 0),
        0
      ),
      missedCallsCaptured: periodStats.reduce(
        (sum, s) => sum + (s.missedCallsCaptured || 0),
        0
      ),
      days: periodStats.length,
    };

    // Calculate conversion rates
    const conversionRate =
      aggregatedMetrics.messagesSent > 0
        ? (
            (aggregatedMetrics.appointmentsReminded /
              aggregatedMetrics.messagesSent) *
            100
          ).toFixed(2)
        : '0';

    const engagementRate =
      aggregatedMetrics.messagesSent > 0
        ? (
            (aggregatedMetrics.conversationsStarted /
              aggregatedMetrics.messagesSent) *
            100
          ).toFixed(2)
        : '0';

    // ROI summary
    const roiSummary = {
      messagesSent: aggregatedMetrics.messagesSent,
      appointmentsReminded: aggregatedMetrics.appointmentsReminded,
      conversionRate: parseFloat(conversionRate),
      engagementRate: parseFloat(engagementRate),
      daysInPeriod: aggregatedMetrics.days,
      averagePerDay: (aggregatedMetrics.messagesSent / aggregatedMetrics.days).toFixed(1),
    };

    // Team performance
    const teamPerformance = {
      totalMembers: teamMemsList.length,
      activeMembers: teamMemsList.filter((t) => t.isActive).length,
    };

    // Create report
    const reportTitle =
      customTitle ||
      `Report ${startDate} to ${endDate} - ${reportType === 'bi-weekly' ? 'Bi-Weekly' : reportType === 'monthly' ? 'Monthly' : 'Custom'}`;

    const [newReport] = await db
      .insert(reports)
      .values({
        clientId,
        title: reportTitle,
        reportType,
        startDate: startDate as any,
        endDate: endDate as any,
        metrics: aggregatedMetrics as any,
        performanceData: periodStats as any,
        testResults: activeTests.length > 0 ? (activeTests as any) : null,
        teamPerformance: teamPerformance as any,
        roiSummary: roiSummary as any,
      })
      .returning();

    return Response.json({
      success: true,
      report: newReport,
      message: `Report generated for ${startDate} to ${endDate}`,
    });
  } catch (error) {
    return safeErrorResponse('[Analytics] Reports Generate Error:', error, 'Failed to generate report');
  }
}
