import { getDb } from '@/db';
import {
  templateMetricsDaily,
  templateStepMetrics,
  clientFlowOutcomes,
  flows,
  flowTemplates,
} from '@/db/schema';
import { eq, and, gte, sql, desc } from 'drizzle-orm';
import { format, subDays } from 'date-fns';

/**
 * Record a flow execution start
 */
export async function recordExecutionStart(
  templateId: string | null
): Promise<void> {
  if (!templateId) return;

  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');

  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      executionsStarted: 1,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        executionsStarted: sql`${templateMetricsDaily.executionsStarted} + 1`,
      },
    });
}

/**
 * Record a flow execution completion
 */
export async function recordExecutionComplete(
  templateId: string | null,
  converted: boolean,
  conversionValue?: number
): Promise<void> {
  if (!templateId) return;

  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');

  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      executionsCompleted: 1,
      conversions: converted ? 1 : 0,
      conversionValue: conversionValue?.toString() || '0',
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        executionsCompleted: sql`${templateMetricsDaily.executionsCompleted} + 1`,
        conversions: converted
          ? sql`${templateMetricsDaily.conversions} + 1`
          : templateMetricsDaily.conversions,
        conversionValue: conversionValue
          ? sql`${templateMetricsDaily.conversionValue} + ${conversionValue}`
          : templateMetricsDaily.conversionValue,
      },
    });
}

/**
 * Record a message sent from a flow step
 */
export async function recordStepMessageSent(
  templateId: string | null,
  stepNumber: number
): Promise<void> {
  if (!templateId) return;

  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Template daily
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      messagesSent: 1,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        messagesSent: sql`${templateMetricsDaily.messagesSent} + 1`,
      },
    });

  // Step level
  await db
    .insert(templateStepMetrics)
    .values({
      templateId,
      stepNumber,
      date: today,
      messagesSent: 1,
    })
    .onConflictDoUpdate({
      target: [templateStepMetrics.templateId, templateStepMetrics.stepNumber, templateStepMetrics.date],
      set: {
        messagesSent: sql`${templateStepMetrics.messagesSent} + 1`,
      },
    });
}

/**
 * Record a lead response (call after inbound message during active flow)
 */
export async function recordLeadResponse(
  templateId: string | null,
  stepNumber: number,
  responseTimeMinutes: number
): Promise<void> {
  if (!templateId) return;

  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');

  // Template daily
  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      leadsResponded: 1,
      totalResponses: 1,
      avgResponseTimeMinutes: responseTimeMinutes,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        leadsResponded: sql`${templateMetricsDaily.leadsResponded} + 1`,
        totalResponses: sql`${templateMetricsDaily.totalResponses} + 1`,
        // Running average (simplified)
        avgResponseTimeMinutes: sql`(
          COALESCE(${templateMetricsDaily.avgResponseTimeMinutes}, 0) * ${templateMetricsDaily.totalResponses} + ${responseTimeMinutes}
        ) / (${templateMetricsDaily.totalResponses} + 1)`,
      },
    });

  // Step level
  await db
    .insert(templateStepMetrics)
    .values({
      templateId,
      stepNumber,
      date: today,
      responsesReceived: 1,
    })
    .onConflictDoUpdate({
      target: [templateStepMetrics.templateId, templateStepMetrics.stepNumber, templateStepMetrics.date],
      set: {
        responsesReceived: sql`${templateStepMetrics.responsesReceived} + 1`,
      },
    });
}

/**
 * Record opt-out (STOP message)
 */
export async function recordOptOut(templateId: string | null): Promise<void> {
  if (!templateId) return;

  const db = getDb();
  const today = format(new Date(), 'yyyy-MM-dd');

  await db
    .insert(templateMetricsDaily)
    .values({
      templateId,
      date: today,
      optOuts: 1,
    })
    .onConflictDoUpdate({
      target: [templateMetricsDaily.templateId, templateMetricsDaily.date],
      set: {
        optOuts: sql`${templateMetricsDaily.optOuts} + 1`,
      },
    });
}

/**
 * Get aggregate template performance for admin dashboard
 */
export async function getTemplatePerformance(
  templateId: string,
  days: number = 30
): Promise<{
  executions: number;
  completionRate: number;
  responseRate: number;
  conversionRate: number;
  avgResponseTimeMinutes: number;
  optOutRate: number;
  totalRevenue: number;
  stepPerformance: Array<{
    stepNumber: number;
    sent: number;
    responseRate: number;
  }>;
}> {
  const db = getDb();
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

  // Aggregate template metrics
  const metrics = await db
    .select({
      executions: sql<number>`COALESCE(SUM(${templateMetricsDaily.executionsStarted}), 0)`,
      completed: sql<number>`COALESCE(SUM(${templateMetricsDaily.executionsCompleted}), 0)`,
      messagesSent: sql<number>`COALESCE(SUM(${templateMetricsDaily.messagesSent}), 0)`,
      responded: sql<number>`COALESCE(SUM(${templateMetricsDaily.leadsResponded}), 0)`,
      conversions: sql<number>`COALESCE(SUM(${templateMetricsDaily.conversions}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${templateMetricsDaily.conversionValue}), 0)`,
      avgResponseTime: sql<number>`AVG(${templateMetricsDaily.avgResponseTimeMinutes})`,
      optOuts: sql<number>`COALESCE(SUM(${templateMetricsDaily.optOuts}), 0)`,
    })
    .from(templateMetricsDaily)
    .where(
      and(
        eq(templateMetricsDaily.templateId, templateId),
        gte(templateMetricsDaily.date, startDate)
      )
    )
    .then((r) => r[0]);

  // Step-level performance
  const stepMetrics = await db
    .select({
      stepNumber: templateStepMetrics.stepNumber,
      sent: sql<number>`COALESCE(SUM(${templateStepMetrics.messagesSent}), 0)`,
      responses: sql<number>`COALESCE(SUM(${templateStepMetrics.responsesReceived}), 0)`,
    })
    .from(templateStepMetrics)
    .where(
      and(
        eq(templateStepMetrics.templateId, templateId),
        gte(templateStepMetrics.date, startDate)
      )
    )
    .groupBy(templateStepMetrics.stepNumber)
    .orderBy(templateStepMetrics.stepNumber);

  const executions = Number(metrics?.executions) || 0;
  const completed = Number(metrics?.completed) || 0;
  const responded = Number(metrics?.responded) || 0;
  const conversions = Number(metrics?.conversions) || 0;
  const optOuts = Number(metrics?.optOuts) || 0;

  return {
    executions,
    completionRate: executions > 0 ? (completed / executions) * 100 : 0,
    responseRate: executions > 0 ? (responded / executions) * 100 : 0,
    conversionRate: executions > 0 ? (conversions / executions) * 100 : 0,
    avgResponseTimeMinutes: Number(metrics?.avgResponseTime) || 0,
    optOutRate: executions > 0 ? (optOuts / executions) * 100 : 0,
    totalRevenue: Number(metrics?.revenue) || 0,
    stepPerformance: stepMetrics.map((s) => ({
      stepNumber: s.stepNumber,
      sent: Number(s.sent) || 0,
      responseRate: Number(s.sent) > 0 ? ((Number(s.responses) || 0) / Number(s.sent)) * 100 : 0,
    })),
  };
}

/**
 * Compare templates in same category
 */
export async function compareTemplates(
  category: string,
  days: number = 30
): Promise<
  Array<{
    templateId: string;
    templateName: string;
    executions: number;
    responseRate: number;
    conversionRate: number;
    optOutRate: number;
  }>
> {
  const db = getDb();
  const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');

  const results = await db
    .select({
      templateId: flowTemplates.id,
      templateName: flowTemplates.name,
      executions: sql<number>`COALESCE(SUM(${templateMetricsDaily.executionsStarted}), 0)`,
      responded: sql<number>`COALESCE(SUM(${templateMetricsDaily.leadsResponded}), 0)`,
      conversions: sql<number>`COALESCE(SUM(${templateMetricsDaily.conversions}), 0)`,
      optOuts: sql<number>`COALESCE(SUM(${templateMetricsDaily.optOuts}), 0)`,
    })
    .from(flowTemplates)
    .leftJoin(
      templateMetricsDaily,
      and(
        eq(templateMetricsDaily.templateId, flowTemplates.id),
        gte(templateMetricsDaily.date, startDate)
      )
    )
    .where(eq(flowTemplates.category, category as any))
    .groupBy(flowTemplates.id, flowTemplates.name)
    .orderBy(desc(sql`SUM(${templateMetricsDaily.executionsStarted})`));

  return results.map((r) => {
    const executions = Number(r.executions) || 0;
    const responded = Number(r.responded) || 0;
    const conversions = Number(r.conversions) || 0;
    const optOuts = Number(r.optOuts) || 0;

    return {
      templateId: r.templateId,
      templateName: r.templateName,
      executions,
      responseRate: executions > 0 ? (responded / executions) * 100 : 0,
      conversionRate: executions > 0 ? (conversions / executions) * 100 : 0,
      optOutRate: executions > 0 ? (optOuts / executions) * 100 : 0,
    };
  });
}

/**
 * Get simple outcomes for a client (what they see)
 */
export async function getClientOutcomes(
  clientId: string,
  period?: string
): Promise<{
  period: string;
  missedCallsRecovered: { contacted: number; responded: number; rate: number };
  estimateFollowUps: { sent: number; converted: number; rate: number };
  paymentReminders: { sent: number; collected: number; amount: number };
  reviewRequests: { sent: number; received: number; rate: number };
}> {
  const db = getDb();
  const targetPeriod = period || format(new Date(), 'yyyy-MM');

  // Get outcomes grouped by flow category
  const outcomes = await db
    .select({
      category: flows.category,
      contacted: sql<number>`COALESCE(SUM(${clientFlowOutcomes.leadsContacted}), 0)`,
      responded: sql<number>`COALESCE(SUM(${clientFlowOutcomes.leadsResponded}), 0)`,
      conversions: sql<number>`COALESCE(SUM(${clientFlowOutcomes.conversions}), 0)`,
      revenue: sql<number>`COALESCE(SUM(${clientFlowOutcomes.revenue}), 0)`,
    })
    .from(clientFlowOutcomes)
    .innerJoin(flows, eq(clientFlowOutcomes.flowId, flows.id))
    .where(
      and(
        eq(clientFlowOutcomes.clientId, clientId),
        eq(clientFlowOutcomes.period, targetPeriod)
      )
    )
    .groupBy(flows.category);

  const byCategory = Object.fromEntries(outcomes.map((o) => [o.category, o]));

  const missedCall = byCategory['missed_call'] || { contacted: 0, responded: 0 };
  const estimate = byCategory['estimate'] || { contacted: 0, conversions: 0 };
  const payment = byCategory['payment'] || { contacted: 0, conversions: 0, revenue: 0 };
  const review = byCategory['review'] || { contacted: 0, conversions: 0 };

  return {
    period: targetPeriod,
    missedCallsRecovered: {
      contacted: Number(missedCall.contacted) || 0,
      responded: Number(missedCall.responded) || 0,
      rate:
        Number(missedCall.contacted) > 0
          ? ((Number(missedCall.responded) || 0) / Number(missedCall.contacted)) * 100
          : 0,
    },
    estimateFollowUps: {
      sent: Number(estimate.contacted) || 0,
      converted: Number(estimate.conversions) || 0,
      rate:
        Number(estimate.contacted) > 0
          ? ((Number(estimate.conversions) || 0) / Number(estimate.contacted)) * 100
          : 0,
    },
    paymentReminders: {
      sent: Number(payment.contacted) || 0,
      collected: Number(payment.conversions) || 0,
      amount: Number(payment.revenue) || 0,
    },
    reviewRequests: {
      sent: Number(review.contacted) || 0,
      received: Number(review.conversions) || 0,
      rate:
        Number(review.contacted) > 0
          ? ((Number(review.conversions) || 0) / Number(review.contacted)) * 100
          : 0,
    },
  };
}

/**
 * Update client outcomes (called by cron or on conversion)
 */
export async function updateClientOutcomes(
  clientId: string,
  flowId: string,
  period: string,
  updates: {
    leadsContacted?: number;
    leadsResponded?: number;
    conversions?: number;
    revenue?: number;
  }
): Promise<void> {
  const db = getDb();

  await db
    .insert(clientFlowOutcomes)
    .values({
      clientId,
      flowId,
      period,
      leadsContacted: updates.leadsContacted,
      leadsResponded: updates.leadsResponded,
      conversions: updates.conversions,
      revenue: updates.revenue?.toString(),
    })
    .onConflictDoUpdate({
      target: [clientFlowOutcomes.clientId, clientFlowOutcomes.flowId, clientFlowOutcomes.period],
      set: {
        leadsContacted: updates.leadsContacted
          ? sql`${clientFlowOutcomes.leadsContacted} + ${updates.leadsContacted}`
          : clientFlowOutcomes.leadsContacted,
        leadsResponded: updates.leadsResponded
          ? sql`${clientFlowOutcomes.leadsResponded} + ${updates.leadsResponded}`
          : clientFlowOutcomes.leadsResponded,
        conversions: updates.conversions
          ? sql`${clientFlowOutcomes.conversions} + ${updates.conversions}`
          : clientFlowOutcomes.conversions,
        revenue: updates.revenue
          ? sql`${clientFlowOutcomes.revenue} + ${updates.revenue}`
          : clientFlowOutcomes.revenue,
      },
    });
}
