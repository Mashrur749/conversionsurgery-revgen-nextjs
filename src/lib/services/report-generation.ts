import { getDb } from '@/db';
import {
  abTests,
  clients,
  conversations,
  dailyStats,
  leads,
  reports,
  scheduledMessages,
  systemSettings,
} from '@/db/schema';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { getTeamMembers } from '@/lib/services/team-bridge';
import { sendBiWeeklyReportEmail } from '@/lib/services/report-email';
import { getCurrentQuarterlyCampaignSummary } from '@/lib/services/campaign-service';
import { getClientAiSummary } from '@/lib/services/ai-effectiveness-metrics';
import {
  ensureReportDeliveryCycle,
  transitionReportDeliveryState,
} from '@/lib/services/report-delivery';
import { describeBiweeklyPeriod, getIsoWeek, getLatestBiweeklyPeriodEnd } from '@/lib/services/cron-catchup';
import {
  calculateWithoutUsModel,
  mergeWithoutUsAssumptions,
  type WithoutUsModelAssumptionOverrides,
  type WithoutUsModelAssumptions,
  type WithoutUsModelInput,
  type WithoutUsModelResult,
} from '@/lib/services/without-us-model';

type ReportType = 'bi-weekly' | 'monthly' | 'custom';

const WITHOUT_US_ASSUMPTIONS_KEY = 'without_us_model_assumptions';
const QUIET_HOURS_START_HOUR = 21;
const QUIET_HOURS_END_HOUR = 10;
const ESTIMATE_STALE_DAYS = 5;

function toPeriodStartUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toPeriodEndUtc(date: string): Date {
  return new Date(`${date}T23:59:59.999Z`);
}

function getHourInTimezone(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const hourPart = parts.find((part) => part.type === 'hour');
    if (!hourPart) return null;
    const hour = Number(hourPart.value);
    return Number.isFinite(hour) ? hour : null;
  } catch {
    return null;
  }
}

function isWithinQuietHours(date: Date, timeZone: string): boolean {
  const tzHour =
    getHourInTimezone(date, timeZone) ?? getHourInTimezone(date, 'UTC');
  if (tzHour === null) return false;
  return tzHour >= QUIET_HOURS_START_HOUR || tzHour < QUIET_HOURS_END_HOUR;
}

function roundMinutes(value: number): number {
  return Math.round(value * 100) / 100;
}

async function getWithoutUsAssumptions(): Promise<WithoutUsModelAssumptions> {
  const db = getDb();
  const [setting] = await db
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, WITHOUT_US_ASSUMPTIONS_KEY))
    .limit(1);

  if (!setting?.value) {
    return mergeWithoutUsAssumptions(undefined);
  }

  try {
    const parsed = JSON.parse(setting.value) as WithoutUsModelAssumptionOverrides;
    return mergeWithoutUsAssumptions(parsed);
  } catch {
    return mergeWithoutUsAssumptions(undefined);
  }
}

async function collectWithoutUsModelInput(
  clientId: string,
  startDate: string,
  endDate: string
): Promise<WithoutUsModelInput> {
  const db = getDb();
  const periodStart = toPeriodStartUtc(startDate);
  const periodEnd = toPeriodEndUtc(endDate);

  const [client] = await db
    .select({ timezone: clients.timezone })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  const timezone = client?.timezone || 'America/Edmonton';

  const periodLeads = await db
    .select({
      id: leads.id,
      status: leads.status,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, clientId),
        gte(leads.createdAt, periodStart),
        lte(leads.createdAt, periodEnd)
      )
    );

  const periodLeadCount = periodLeads.length;
  const leadIds = periodLeads.map((lead) => lead.id);

  const afterHoursLeadCount = periodLeads.filter((lead) =>
    isWithinQuietHours(lead.createdAt, timezone)
  ).length;

  const staleCutoff = new Date(
    periodEnd.getTime() - ESTIMATE_STALE_DAYS * 24 * 60 * 60 * 1000
  );
  const staleLeadIds = periodLeads
    .filter((lead) => lead.status === 'contacted' && lead.updatedAt <= staleCutoff)
    .map((lead) => lead.id);

  let delayedFollowupCount = staleLeadIds.length;
  if (staleLeadIds.length > 0) {
    const estimateSequences = await db
      .select({ leadId: scheduledMessages.leadId })
      .from(scheduledMessages)
      .where(
        and(
          inArray(scheduledMessages.leadId, staleLeadIds),
          eq(scheduledMessages.sequenceType, 'estimate_followup')
        )
      );

    const sequenceLeadIds = new Set(estimateSequences.map((row) => row.leadId));
    delayedFollowupCount = staleLeadIds.filter((leadId) => !sequenceLeadIds.has(leadId)).length;
  }

  let responseSampleCount = 0;
  let averageObservedResponseMinutes: number | null = null;

  if (leadIds.length > 0) {
    const periodConversations = await db
      .select({
        leadId: conversations.leadId,
        direction: conversations.direction,
        createdAt: conversations.createdAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.clientId, clientId),
          inArray(conversations.leadId, leadIds),
          gte(conversations.createdAt, periodStart),
          lte(conversations.createdAt, periodEnd)
        )
      )
      .orderBy(asc(conversations.leadId), asc(conversations.createdAt));

    const firstInboundByLead = new Map<string, Date>();
    const firstOutboundByLead = new Map<string, Date>();

    for (const row of periodConversations) {
      if (!firstInboundByLead.has(row.leadId) && row.direction === 'inbound') {
        firstInboundByLead.set(row.leadId, row.createdAt);
        continue;
      }

      if (row.direction !== 'outbound') continue;
      if (firstOutboundByLead.has(row.leadId)) continue;

      const inboundAt = firstInboundByLead.get(row.leadId);
      if (!inboundAt) continue;
      if (row.createdAt < inboundAt) continue;

      firstOutboundByLead.set(row.leadId, row.createdAt);
    }

    const responseMinutes: number[] = [];
    for (const leadId of leadIds) {
      const inboundAt = firstInboundByLead.get(leadId);
      const outboundAt = firstOutboundByLead.get(leadId);
      if (!inboundAt || !outboundAt) continue;
      const diffMinutes = (outboundAt.getTime() - inboundAt.getTime()) / (60 * 1000);
      if (diffMinutes < 0) continue;
      responseMinutes.push(diffMinutes);
    }

    responseSampleCount = responseMinutes.length;
    if (responseMinutes.length > 0) {
      const totalMinutes = responseMinutes.reduce((sum, value) => sum + value, 0);
      averageObservedResponseMinutes = roundMinutes(totalMinutes / responseMinutes.length);
    }
  }

  return {
    afterHoursLeadCount,
    averageObservedResponseMinutes,
    responseSampleCount,
    delayedFollowupCount,
    periodLeadCount,
  };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

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
  const quarterlyCampaignSummary = await getCurrentQuarterlyCampaignSummary(
    clientId,
    new Date(endDate)
  );
  const withoutUsInput = await collectWithoutUsModelInput(clientId, startDate, endDate);
  const withoutUsAssumptions = await getWithoutUsAssumptions();
  const withoutUsModel = calculateWithoutUsModel(withoutUsInput, withoutUsAssumptions);

  // AI effectiveness summary for the report period
  let aiSummary: Record<string, unknown> | null = null;
  try {
    const aiMetrics = await getClientAiSummary({
      clientId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });
    if (aiMetrics.totalDecisions > 0) {
      aiSummary = aiMetrics as unknown as Record<string, unknown>;
    }
  } catch (err) {
    console.error('[Report] AI summary generation failed:', stringifyError(err));
  }

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
    formsResponded: periodStats.reduce((sum, s) => sum + (s.formsResponded || 0), 0),
    estimatesFollowedUp: periodStats.reduce(
      (sum, s) => sum + (s.estimatesFollowedUp || 0),
      0
    ),
    reviewsRequested: periodStats.reduce((sum, s) => sum + (s.reviewsRequested || 0), 0),
    paymentsReminded: periodStats.reduce((sum, s) => sum + (s.paymentsReminded || 0), 0),
    missedCallsCaptured: periodStats.reduce(
      (sum, s) => sum + (s.missedCallsCaptured || 0),
      0
    ),
    days: periodStats.length,
  };

  const conversionRate =
    aggregatedMetrics.messagesSent > 0
      ? (
          (aggregatedMetrics.appointmentsReminded / aggregatedMetrics.messagesSent) *
          100
        ).toFixed(2)
      : '0';
  const engagementRate =
    aggregatedMetrics.messagesSent > 0
      ? (
          (aggregatedMetrics.conversationsStarted / aggregatedMetrics.messagesSent) *
          100
        ).toFixed(2)
      : '0';

  const roiSummary = {
    messagesSent: aggregatedMetrics.messagesSent,
    appointmentsReminded: aggregatedMetrics.appointmentsReminded,
    conversionRate: parseFloat(conversionRate),
    engagementRate: parseFloat(engagementRate),
    daysInPeriod: aggregatedMetrics.days,
    averagePerDay:
      aggregatedMetrics.days > 0
        ? (aggregatedMetrics.messagesSent / aggregatedMetrics.days).toFixed(1)
        : '0.0',
    quarterlyCampaign: quarterlyCampaignSummary,
    withoutUsModel,
    ...(aiSummary ? { aiEffectiveness: aiSummary } : {}),
  };

  const teamPerformance = {
    totalMembers: teamMemsList.length,
    activeMembers: teamMemsList.filter((teamMember) => teamMember.isActive).length,
  };

  const reportTitle =
    title ||
    `Report ${startDate} to ${endDate} - ${
      reportType === 'bi-weekly'
        ? 'Bi-Weekly'
        : reportType === 'monthly'
          ? 'Monthly'
          : 'Custom'
    }`;

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
      testResults:
        activeTests.length > 0
          ? (activeTests as unknown as Record<string, unknown>[])
          : null,
      teamPerformance: teamPerformance as Record<string, unknown>,
      roiSummary: roiSummary as Record<string, unknown>,
    })
    .returning();

  return newReport;
}

async function findExistingPeriodReport(
  clientId: string,
  periodStart: string,
  periodEnd: string
) {
  const db = getDb();
  const [report] = await db
    .select()
    .from(reports)
    .where(
      and(
        eq(reports.clientId, clientId),
        eq(reports.reportType, 'bi-weekly'),
        eq(reports.startDate, periodStart),
        eq(reports.endDate, periodEnd)
      )
    )
    .limit(1);

  return report ?? null;
}

export async function processBiWeeklyReportPeriod(periodEndDate: Date) {
  const db = getDb();
  const descriptor = describeBiweeklyPeriod(periodEndDate);
  const periodStartStr = descriptor.periodStart;
  const periodEndStr = descriptor.periodEnd;

  const activeClients = await db
    .select({ id: clients.id, businessName: clients.businessName, email: clients.email })
    .from(clients)
    .where(eq(clients.status, 'active'));

  let generated = 0;
  let emailed = 0;
  let failed = 0;

  for (const client of activeClients) {
    let delivery: Awaited<ReturnType<typeof ensureReportDeliveryCycle>> | null = null;

    try {
      delivery = await ensureReportDeliveryCycle({
        clientId: client.id,
        reportType: 'bi-weekly',
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        channel: 'email',
        recipient: client.email ?? null,
        channelMetadata: {
          recipient: client.email ?? null,
        },
      });

      if (delivery.state === 'sent') {
        continue;
      }

      let report = null as Awaited<ReturnType<typeof generateClientReport>> | null;

      if (delivery.reportId) {
        const [existingReport] = await db
          .select()
          .from(reports)
          .where(eq(reports.id, delivery.reportId))
          .limit(1);
        report = existingReport ?? null;
      }

      if (!report) {
        report = await findExistingPeriodReport(client.id, periodStartStr, periodEndStr);
      }

      if (!report) {
        report = await generateClientReport(
          client.id,
          periodStartStr,
          periodEndStr,
          'bi-weekly'
        );
        generated++;
      }

      await transitionReportDeliveryState(delivery.id, 'generated', {
        reportId: report.id,
        recipient: client.email ?? null,
        channelMetadata: {
          recipient: client.email ?? null,
          reportId: report.id,
        },
        metadata: {
          reportId: report.id,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
        },
      });

      if (client.email) {
        const summary = (report.roiSummary as { withoutUsModel?: WithoutUsModelResult } | null) || null;

        await transitionReportDeliveryState(delivery.id, 'queued', {
          reportId: report.id,
          recipient: client.email,
          channelMetadata: {
            recipient: client.email,
            reportId: report.id,
          },
          incrementAttempt: true,
          metadata: {
            queuedFor: client.email,
          },
        });

        const emailResult = await sendBiWeeklyReportEmail({
          to: client.email,
          businessName: client.businessName,
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
          reportId: report.id,
          withoutUsModel: summary?.withoutUsModel || null,
        });

        if (emailResult.success) {
          emailed++;
          await transitionReportDeliveryState(delivery.id, 'sent', {
            reportId: report.id,
            recipient: client.email,
            channelMetadata: {
              recipient: client.email,
              providerMessageId: emailResult.id,
            },
            metadata: {
              provider: 'resend',
              providerMessageId: emailResult.id,
            },
            errorCode: null,
            errorMessage: null,
          });
        } else {
          failed++;
          await transitionReportDeliveryState(delivery.id, 'failed', {
            reportId: report.id,
            recipient: client.email,
            errorCode: 'email_send_failed',
            errorMessage: stringifyError(emailResult.error),
            metadata: {
              provider: 'resend',
            },
          });
        }
      } else {
        failed++;
        await transitionReportDeliveryState(delivery.id, 'failed', {
          reportId: report.id,
          errorCode: 'missing_recipient',
          errorMessage: 'Client email is missing',
          metadata: {
            reason: 'Client email not configured',
          },
        });
      }
    } catch (error) {
      console.error('[BiWeeklyReports] Failed for client', client.id, error);
      failed++;
      if (!delivery?.id) {
        continue;
      }

      await transitionReportDeliveryState(delivery.id, 'failed', {
        recipient: client.email ?? null,
        errorCode: 'report_generation_failed',
        errorMessage: stringifyError(error),
        metadata: {
          periodStart: periodStartStr,
          periodEnd: periodEndStr,
        },
      }).catch((transitionError) => {
        console.error(
          '[BiWeeklyReports] Failed to transition report delivery state',
          transitionError
        );
      });
    }
  }

  return {
    skipped: false,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    generated,
    emailed,
    failed,
    lastRunUpdated: true,
    requiresManualRetry: failed > 0,
  };
}

export function isBiWeeklyRunWindow(now: Date = new Date()): boolean {
  return now.getUTCDay() === 1 && getIsoWeek(now) % 2 === 0;
}

/**
 * Generates and emails bi-weekly reports for the currently scheduled window.
 */
export async function processBiWeeklyReports(now: Date = new Date()) {
  if (!isBiWeeklyRunWindow(now)) {
    return {
      skipped: true,
      reason: 'Not scheduled bi-weekly run window',
      generated: 0,
      emailed: 0,
    };
  }

  const periodEnd = getLatestBiweeklyPeriodEnd(now);
  return processBiWeeklyReportPeriod(periodEnd);
}
