import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getDb } from '@/db';
import {
  leads,
  dailyStats,
  leadContext,
  agentDecisions,
  knowledgeGaps,
  conversations,
} from '@/db/schema';
import { eq, and, gte, isNull, ne, sql, not, inArray } from 'drizzle-orm';
import { getSmartAssistCorrectionRate } from '@/lib/services/smart-assist-learning';

export type CallPrepData = {
  generatedAt: string;
  performance: {
    messagesSent: number;
    leadsCreated: number;
    winsCount: number;
    revenueWonCents: number;
    avgResponseTimeSeconds: number | null;
  };
  activePipeline: Record<string, number>;
  whatsWorking: {
    avgAgentConfidence: number | null;
    positiveOutcomeCount: number;
  };
  attention: {
    correctionRate: number;
    correctionRateTotal: number;
    correctionRateCorrected: number;
    optOuts: Array<{ reason: string | null; count: number }>;
    unresolvedKbGaps: Array<{ question: string; occurrences: number }>;
  };
  attributionEvidence: {
    aiInteractedLeads: number;
    totalWonLeads: number;
    aiAttributionRate: number;
    examples: Array<{
      leadName: string;
      aiMessages: number;
      daysBetweenFirstAIAndWon: number;
    }>;
  };
  talkingPoints: string[];
};

export const GET = adminClientRoute<{ id: string }>(
  {
    permission: AGENCY_PERMISSIONS.CLIENTS_VIEW,
    clientIdFrom: (p) => p.id,
  },
  async ({ clientId }) => {
    const db = getDb();
    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      dailyStatsResult,
      winsResult,
      pipelineResult,
      agentDecisionsResult,
      avgResponseTimeResult,
      optOutsResult,
      kbGapsResult,
      correctionRateResult,
      attributionResult,
    ] = await Promise.allSettled([
      // 1a. Performance: messages sent + leads created (daily stats)
      db
        .select({
          messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
          leadsCreated: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
        })
        .from(dailyStats)
        .where(
          and(
            eq(dailyStats.clientId, clientId),
            gte(dailyStats.date, fourteenDaysAgo.toISOString().split('T')[0])
          )
        ),

      // 1b. Performance: wins count + revenue
      db
        .select({
          winsCount: sql<number>`count(*)`,
          revenueWonCents: sql<number>`COALESCE(SUM(${leads.confirmedRevenue}), 0)`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.clientId, clientId),
            eq(leads.status, 'won'),
            gte(leads.updatedAt, fourteenDaysAgo)
          )
        ),

      // 2. Active pipeline: counts by conversationStage (excluding lost)
      db
        .select({
          conversationStage: leadContext.conversationStage,
          count: sql<number>`count(*)`,
        })
        .from(leadContext)
        .innerJoin(leads, eq(leads.id, leadContext.leadId))
        .where(
          and(
            eq(leadContext.clientId, clientId),
            ne(leads.status, 'lost')
          )
        )
        .groupBy(leadContext.conversationStage),

      // 3a. What's working: agent decisions confidence + positive outcomes (last 14 days)
      db
        .select({
          avgConfidence: sql<number | null>`AVG(${agentDecisions.confidence})`,
          positiveCount: sql<number>`count(*) filter (where ${agentDecisions.outcome} = 'positive')`,
        })
        .from(agentDecisions)
        .where(
          and(
            eq(agentDecisions.clientId, clientId),
            gte(agentDecisions.createdAt, fourteenDaysAgo)
          )
        ),

      // 3b. Average response time from leadContext (all active leads)
      db
        .select({
          avgResponseTime: sql<number | null>`AVG(${leadContext.avgResponseTimeSeconds})`,
        })
        .from(leadContext)
        .where(eq(leadContext.clientId, clientId)),

      // 4a. Opt-outs in last 14 days with reasons
      db
        .select({
          reason: leads.optOutReason,
          count: sql<number>`count(*)`,
        })
        .from(leads)
        .where(
          and(
            eq(leads.clientId, clientId),
            eq(leads.optedOut, true),
            gte(leads.optedOutAt, fourteenDaysAgo)
          )
        )
        .groupBy(leads.optOutReason),

      // 4b. Unresolved KB gaps
      db
        .select({
          question: knowledgeGaps.question,
          occurrences: knowledgeGaps.occurrences,
        })
        .from(knowledgeGaps)
        .where(
          and(
            eq(knowledgeGaps.clientId, clientId),
            inArray(knowledgeGaps.status, ['new', 'in_review']),
            isNull(knowledgeGaps.resolvedAt)
          )
        )
        .orderBy(knowledgeGaps.priorityScore)
        .limit(5),

      // 4c. Correction rate
      getSmartAssistCorrectionRate(clientId, fourteenDaysAgo),

      // 5. Attribution evidence: won leads with 2+ AI interactions
      db
        .select({
          leadId: leads.id,
          leadName: leads.name,
          wonAt: leads.updatedAt,
          aiMessageCount: sql<number>`count(${conversations.id})`,
          firstAiMessageAt: sql<Date>`min(${conversations.createdAt})`,
        })
        .from(leads)
        .innerJoin(
          conversations,
          and(
            eq(conversations.leadId, leads.id),
            eq(conversations.direction, 'outbound'),
            eq(conversations.messageType, 'ai_response')
          )
        )
        .where(
          and(
            eq(leads.clientId, clientId),
            eq(leads.status, 'won'),
            gte(leads.updatedAt, fourteenDaysAgo)
          )
        )
        .groupBy(leads.id, leads.name, leads.updatedAt)
        .having(sql`count(${conversations.id}) >= 2`),
    ]);

    // Parse results safely
    const dailyS = dailyStatsResult.status === 'fulfilled' ? dailyStatsResult.value[0] : null;
    const wins = winsResult.status === 'fulfilled' ? winsResult.value[0] : null;
    const pipeline = pipelineResult.status === 'fulfilled' ? pipelineResult.value : [];
    const decisionStats = agentDecisionsResult.status === 'fulfilled' ? agentDecisionsResult.value[0] : null;
    const avgRtRow = avgResponseTimeResult.status === 'fulfilled' ? avgResponseTimeResult.value[0] : null;
    const optOuts = optOutsResult.status === 'fulfilled' ? optOutsResult.value : [];
    const kbGaps = kbGapsResult.status === 'fulfilled' ? kbGapsResult.value : [];
    const correctionRate = correctionRateResult.status === 'fulfilled'
      ? correctionRateResult.value
      : { rate: 0, total: 0, corrected: 0 };
    const attributionRows = attributionResult.status === 'fulfilled' ? attributionResult.value : [];

    // Build pipeline map
    const activePipeline: Record<string, number> = {};
    for (const row of pipeline) {
      const stage = row.conversationStage ?? 'unknown';
      activePipeline[stage] = (activePipeline[stage] ?? 0) + Number(row.count);
    }

    // Count probable wins needing outcome marking: leads with high intent / won status missing
    // Use leads in 'estimate_sent' status from leadContext with high intent
    const probableWinsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, clientId),
          inArray(leads.status, ['estimate_sent', 'contacted']),
          not(eq(leads.actionRequired, false))
        )
      );
    const probableWinsCount = Number(probableWinsResult[0]?.count ?? 0);

    // Auto-generate talking points
    const talkingPoints: string[] = [];
    const rate = correctionRate.rate ?? 0;
    if (rate > 20) {
      talkingPoints.push(
        `Review AI settings — correction rate is ${rate.toFixed(0)}% (drafts edited frequently). Consider adding KB entries.`
      );
    }
    if (optOuts.length > 0) {
      const reasons = optOuts
        .map((o) => (o.reason ? `"${o.reason}"` : 'no reason given'))
        .join(', ');
      const total = optOuts.reduce((s, o) => s + Number(o.count), 0);
      talkingPoints.push(`Discuss opt-out reasons: ${total} opt-out(s) — ${reasons}.`);
    }
    if (kbGaps.length > 0) {
      const topics = kbGaps.map((g) => `"${g.question}"`).join(', ');
      talkingPoints.push(`KB gaps to fill: ${topics}.`);
    }
    if (probableWinsCount > 0) {
      talkingPoints.push(
        `Review ${probableWinsCount} lead${probableWinsCount === 1 ? '' : 's'} needing WON/LOST marking.`
      );
    }

    // Attribution evidence
    const totalWonLeads = Number(wins?.winsCount ?? 0);
    const aiInteractedLeads = attributionRows.length;
    const aiAttributionRate = totalWonLeads > 0
      ? Math.round((aiInteractedLeads / totalWonLeads) * 100)
      : 0;

    const attributionExamples = attributionRows.slice(0, 3).map((row) => {
      const firstName = row.leadName ? row.leadName.split(' ')[0] : 'Unknown';
      const wonDate = row.wonAt ? new Date(row.wonAt).getTime() : now.getTime();
      const firstAiDate = row.firstAiMessageAt ? new Date(row.firstAiMessageAt).getTime() : wonDate;
      const daysBetween = Math.max(0, Math.floor((wonDate - firstAiDate) / (24 * 60 * 60 * 1000)));
      return {
        leadName: firstName,
        aiMessages: Number(row.aiMessageCount),
        daysBetweenFirstAIAndWon: daysBetween,
      };
    });

    if (totalWonLeads > 0 && aiAttributionRate < 50) {
      talkingPoints.push(
        `Attribution evidence: Only ${aiAttributionRate}% of won leads have documented AI interactions — review WON marking during the call to prevent guarantee disputes.`
      );
    } else if (totalWonLeads > 0 && aiAttributionRate >= 70) {
      talkingPoints.push(
        `Strong attribution evidence: ${aiAttributionRate}% of won leads show clear AI engagement trail — use this data if contractor questions service value.`
      );
    }

    const data: CallPrepData = {
      generatedAt: now.toISOString(),
      performance: {
        messagesSent: Number(dailyS?.messagesSent ?? 0),
        leadsCreated: Number(dailyS?.leadsCreated ?? 0),
        winsCount: Number(wins?.winsCount ?? 0),
        revenueWonCents: Number(wins?.revenueWonCents ?? 0),
        avgResponseTimeSeconds:
          avgRtRow?.avgResponseTime != null ? Number(avgRtRow.avgResponseTime) : null,
      },
      activePipeline,
      whatsWorking: {
        avgAgentConfidence:
          decisionStats?.avgConfidence != null ? Number(decisionStats.avgConfidence) : null,
        positiveOutcomeCount: Number(decisionStats?.positiveCount ?? 0),
      },
      attention: {
        correctionRate: correctionRate.rate,
        correctionRateTotal: correctionRate.total,
        correctionRateCorrected: correctionRate.corrected,
        optOuts: optOuts.map((o) => ({ reason: o.reason ?? null, count: Number(o.count) })),
        unresolvedKbGaps: kbGaps.map((g) => ({
          question: g.question,
          occurrences: g.occurrences,
        })),
      },
      attributionEvidence: {
        aiInteractedLeads,
        totalWonLeads,
        aiAttributionRate,
        examples: attributionExamples,
      },
      talkingPoints,
    };

    return NextResponse.json(data);
  }
);
