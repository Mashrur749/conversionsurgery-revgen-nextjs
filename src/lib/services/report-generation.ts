import { getDb } from '@/db';
import { abTests, clients, dailyStats, reports, systemSettings } from '@/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';
import { getTeamMembers } from '@/lib/services/team-bridge';
import { sendEmail } from '@/lib/services/resend';

type ReportType = 'bi-weekly' | 'monthly' | 'custom';

export async function generateClientReport(
  clientId: string,
  startDate: string,
  endDate: string,
  reportType: ReportType,
  title?: string
) {
  const db = getDb();

  const periodStats = await db
    .select()
    .from(dailyStats)
    .where(
      and(
        eq(dailyStats.clientId, clientId),
        gte(dailyStats.date, startDate),
        lte(dailyStats.date, endDate)
      )
    );

  const activeTests = await db
    .select()
    .from(abTests)
    .where(
      and(
        eq(abTests.clientId, clientId),
        gte(abTests.startDate, new Date(startDate))
      )
    );

  const teamMemsList = await getTeamMembers(clientId);

  const aggregatedMetrics = {
    messagesSent: periodStats.reduce((sum, s) => sum + (s.messagesSent || 0), 0),
    conversationsStarted: periodStats.reduce((sum, s) => sum + (s.conversationsStarted || 0), 0),
    appointmentsReminded: periodStats.reduce((sum, s) => sum + (s.appointmentsReminded || 0), 0),
    formsResponded: periodStats.reduce((sum, s) => sum + (s.formsResponded || 0), 0),
    estimatesFollowedUp: periodStats.reduce((sum, s) => sum + (s.estimatesFollowedUp || 0), 0),
    reviewsRequested: periodStats.reduce((sum, s) => sum + (s.reviewsRequested || 0), 0),
    paymentsReminded: periodStats.reduce((sum, s) => sum + (s.paymentsReminded || 0), 0),
    missedCallsCaptured: periodStats.reduce((sum, s) => sum + (s.missedCallsCaptured || 0), 0),
    days: periodStats.length,
  };

  const conversionRate =
    aggregatedMetrics.messagesSent > 0
      ? ((aggregatedMetrics.appointmentsReminded / aggregatedMetrics.messagesSent) * 100).toFixed(2)
      : '0';
  const engagementRate =
    aggregatedMetrics.messagesSent > 0
      ? ((aggregatedMetrics.conversationsStarted / aggregatedMetrics.messagesSent) * 100).toFixed(2)
      : '0';

  const roiSummary = {
    messagesSent: aggregatedMetrics.messagesSent,
    appointmentsReminded: aggregatedMetrics.appointmentsReminded,
    conversionRate: parseFloat(conversionRate),
    engagementRate: parseFloat(engagementRate),
    daysInPeriod: aggregatedMetrics.days,
    averagePerDay: aggregatedMetrics.days > 0
      ? (aggregatedMetrics.messagesSent / aggregatedMetrics.days).toFixed(1)
      : '0.0',
  };

  const teamPerformance = {
    totalMembers: teamMemsList.length,
    activeMembers: teamMemsList.filter((t) => t.isActive).length,
  };

  const reportTitle =
    title ||
    `Report ${startDate} to ${endDate} - ${reportType === 'bi-weekly' ? 'Bi-Weekly' : reportType === 'monthly' ? 'Monthly' : 'Custom'}`;

  const [newReport] = await db
    .insert(reports)
    .values({
      clientId,
      title: reportTitle,
      reportType,
      startDate,
      endDate,
      metrics: aggregatedMetrics as Record<string, unknown>,
      performanceData: periodStats as unknown as Record<string, unknown>[],
      testResults: activeTests.length > 0 ? (activeTests as unknown as Record<string, unknown>[]) : null,
      teamPerformance: teamPerformance as Record<string, unknown>,
      roiSummary: roiSummary as Record<string, unknown>,
    })
    .returning();

  return newReport;
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Generates and emails bi-weekly reports with idempotency.
 * Runs on even ISO weeks only.
 */
export async function processBiWeeklyReports(now: Date = new Date()) {
  const db = getDb();
  const weekday = now.getUTCDay(); // 1 = Monday
  const week = isoWeek(now);

  if (weekday !== 1 || week % 2 !== 0) {
    return { skipped: true, reason: 'Not scheduled bi-weekly run window', generated: 0, emailed: 0 };
  }

  const periodEnd = new Date(now);
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);
  const periodEndStr = periodEnd.toISOString().slice(0, 10);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 13);
  const periodStartStr = periodStart.toISOString().slice(0, 10);

  const [lastRun] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, 'last_biweekly_report_period_end'))
    .limit(1);

  if (lastRun?.value === periodEndStr) {
    return { skipped: true, reason: 'Already processed this period', generated: 0, emailed: 0 };
  }

  const activeClients = await db
    .select({ id: clients.id, businessName: clients.businessName, email: clients.email })
    .from(clients)
    .where(eq(clients.status, 'active'));

  let generated = 0;
  let emailed = 0;

  for (const client of activeClients) {
    try {
      const report = await generateClientReport(client.id, periodStartStr, periodEndStr, 'bi-weekly');
      generated++;

      if (client.email) {
        await sendEmail({
          to: client.email,
          subject: `${client.businessName} — Bi-weekly Performance Report`,
          html: `
            <div style="font-family: Arial, sans-serif;">
              <p>Your bi-weekly report is ready for ${periodStartStr} to ${periodEndStr}.</p>
              <p>Report ID: <strong>${report.id}</strong></p>
              <p>Your account manager can walk through details and optimization actions.</p>
            </div>
          `,
        });
        emailed++;
      }
    } catch (error) {
      console.error('[BiWeeklyReports] Failed for client', client.id, error);
    }
  }

  await db
    .insert(systemSettings)
    .values({
      key: 'last_biweekly_report_period_end',
      value: periodEndStr,
      description: 'Last bi-weekly report period end date processed',
    })
    .onConflictDoUpdate({
      target: systemSettings.key,
      set: { value: periodEndStr, updatedAt: new Date() },
    });

  return { skipped: false, periodStart: periodStartStr, periodEnd: periodEndStr, generated, emailed };
}
