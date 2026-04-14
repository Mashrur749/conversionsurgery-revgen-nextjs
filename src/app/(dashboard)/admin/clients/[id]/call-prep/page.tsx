import { auth } from '@/auth';
import { redirect, notFound } from 'next/navigation';
import { getDb } from '@/db';
import {
  clients,
  leads,
  dailyStats,
  leadContext,
  agentDecisions,
  knowledgeGaps,
} from '@/db/schema';
import { eq, and, gte, isNull, ne, sql, not, inArray } from 'drizzle-orm';
import Link from 'next/link';
import { format } from 'date-fns';
import { getSmartAssistCorrectionRate } from '@/lib/services/smart-assist-learning';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { PrintButton } from './print-button';

interface Props {
  params: Promise<{ id: string }>;
}

function formatMoney(cents: number): string {
  if (cents === 0) return '$0';
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}K`;
  }
  return `$${dollars.toLocaleString()}`;
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null || seconds === 0) return 'N/A';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)}m`;
}

const STAGE_LABELS: Record<string, string> = {
  greeting: 'Greeting',
  qualifying: 'Qualifying',
  proposing: 'Proposing',
  objection_handling: 'Objection Handling',
  closing: 'Closing',
  nurturing: 'Nurturing',
  booked: 'Booked',
  unknown: 'Unknown',
};

export default async function CallPrepPage({ params }: Props) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.isAgency) {
    redirect('/dashboard');
  }

  const db = getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!client) {
    notFound();
  }

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    dailyStatsResult,
    winsResult,
    pipelineResult,
    agentDecisionsResult,
    avgResponseTimeResult,
    optOutsResult,
    kbGapsResult,
    correctionRateResult,
  ] = await Promise.allSettled([
    db
      .select({
        messagesSent: sql<number>`COALESCE(SUM(${dailyStats.messagesSent}), 0)`,
        leadsCreated: sql<number>`COALESCE(SUM(${dailyStats.missedCallsCaptured}) + SUM(${dailyStats.formsResponded}), 0)`,
      })
      .from(dailyStats)
      .where(
        and(
          eq(dailyStats.clientId, id),
          gte(dailyStats.date, fourteenDaysAgo.toISOString().split('T')[0])
        )
      ),

    db
      .select({
        winsCount: sql<number>`count(*)`,
        revenueWonCents: sql<number>`COALESCE(SUM(${leads.confirmedRevenue}), 0)`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, id),
          eq(leads.status, 'won'),
          gte(leads.updatedAt, fourteenDaysAgo)
        )
      ),

    db
      .select({
        conversationStage: leadContext.conversationStage,
        count: sql<number>`count(*)`,
      })
      .from(leadContext)
      .innerJoin(leads, eq(leads.id, leadContext.leadId))
      .where(
        and(
          eq(leadContext.clientId, id),
          ne(leads.status, 'lost')
        )
      )
      .groupBy(leadContext.conversationStage),

    db
      .select({
        avgConfidence: sql<number | null>`AVG(${agentDecisions.confidence})`,
        positiveCount: sql<number>`count(*) filter (where ${agentDecisions.outcome} = 'positive')`,
      })
      .from(agentDecisions)
      .where(
        and(
          eq(agentDecisions.clientId, id),
          gte(agentDecisions.createdAt, fourteenDaysAgo)
        )
      ),

    db
      .select({
        avgResponseTime: sql<number | null>`AVG(${leadContext.avgResponseTimeSeconds})`,
      })
      .from(leadContext)
      .where(eq(leadContext.clientId, id)),

    db
      .select({
        reason: leads.optOutReason,
        count: sql<number>`count(*)`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.clientId, id),
          eq(leads.optedOut, true),
          gte(leads.optedOutAt, fourteenDaysAgo)
        )
      )
      .groupBy(leads.optOutReason),

    db
      .select({
        question: knowledgeGaps.question,
        occurrences: knowledgeGaps.occurrences,
      })
      .from(knowledgeGaps)
      .where(
        and(
          eq(knowledgeGaps.clientId, id),
          inArray(knowledgeGaps.status, ['new', 'in_review']),
          isNull(knowledgeGaps.resolvedAt)
        )
      )
      .orderBy(knowledgeGaps.priorityScore)
      .limit(5),

    getSmartAssistCorrectionRate(id, fourteenDaysAgo),
  ]);

  const dailyS = dailyStatsResult.status === 'fulfilled' ? dailyStatsResult.value[0] : null;
  const wins = winsResult.status === 'fulfilled' ? winsResult.value[0] : null;
  const pipeline = pipelineResult.status === 'fulfilled' ? pipelineResult.value : [];
  const decisionStats =
    agentDecisionsResult.status === 'fulfilled' ? agentDecisionsResult.value[0] : null;
  const avgRtRow =
    avgResponseTimeResult.status === 'fulfilled' ? avgResponseTimeResult.value[0] : null;
  const optOuts = optOutsResult.status === 'fulfilled' ? optOutsResult.value : [];
  const kbGaps = kbGapsResult.status === 'fulfilled' ? kbGapsResult.value : [];
  const correctionRate =
    correctionRateResult.status === 'fulfilled'
      ? correctionRateResult.value
      : { rate: 0, total: 0, corrected: 0 };

  // Build pipeline map (exclude lost)
  const activePipeline: Record<string, number> = {};
  for (const row of pipeline) {
    const stage = row.conversationStage ?? 'unknown';
    if (stage === 'lost') continue;
    activePipeline[stage] = (activePipeline[stage] ?? 0) + Number(row.count);
  }

  // Probable wins needing marking
  const probableWinsResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(leads)
    .where(
      and(
        eq(leads.clientId, id),
        inArray(leads.status, ['estimate_sent', 'contacted']),
        not(eq(leads.actionRequired, false))
      )
    );
  const probableWinsCount = Number(probableWinsResult[0]?.count ?? 0);

  // Talking points
  const talkingPoints: string[] = [];
  const rate = correctionRate.rate ?? 0;
  if (rate > 20) {
    talkingPoints.push(
      `Review AI settings \u2014 correction rate is ${rate.toFixed(0)}% (drafts edited frequently). Consider adding KB entries.`
    );
  }
  if (optOuts.length > 0) {
    const reasons = optOuts
      .map((o) => (o.reason ? `"${o.reason}"` : 'no reason given'))
      .join(', ');
    const total = optOuts.reduce((s, o) => s + Number(o.count), 0);
    talkingPoints.push(`Discuss opt-out reasons: ${total} opt-out(s) \u2014 ${reasons}.`);
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

  const totalOptOuts = optOuts.reduce((s, o) => s + Number(o.count), 0);
  const hasAttentionItems = rate > 20 || totalOptOuts > 0 || kbGaps.length > 0;

  const pipelineEntries = Object.entries(activePipeline).filter(([, count]) => count > 0);

  const avgResponseSecs =
    avgRtRow?.avgResponseTime != null ? Number(avgRtRow.avgResponseTime) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: 'Clients', href: '/admin/clients' },
          { label: client.businessName, href: `/admin/clients/${id}` },
          { label: 'Call Prep' },
        ]}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 print:flex-row print:items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#1B2F26]">
            Call Prep: {client.businessName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(now, 'MMMM d, yyyy')} &mdash; Last 14 days
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <PrintButton />
          <Link
            href={`/admin/clients/${id}`}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium shadow-xs hover:bg-accent hover:text-accent-foreground"
          >
            &larr; Back to Client
          </Link>
        </div>
      </div>

      {/* Performance */}
      <section className="rounded-lg border border-border bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Performance (Last 14 Days)
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Leads Responded</p>
            <p className="text-2xl font-bold text-[#1B2F26]">
              {Number(dailyS?.leadsCreated ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Messages Sent</p>
            <p className="text-2xl font-bold text-[#1B2F26]">
              {Number(dailyS?.messagesSent ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Jobs Won</p>
            <p className="text-2xl font-bold text-[#3D7A50]">
              {Number(wins?.winsCount ?? 0)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revenue Won</p>
            <p className="text-2xl font-bold text-[#3D7A50]">
              {formatMoney(Number(wins?.revenueWonCents ?? 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Response Time</p>
            <p className="text-2xl font-bold text-[#1B2F26]">
              {formatSeconds(avgResponseSecs)}
            </p>
          </div>
          {decisionStats?.avgConfidence != null && (
            <div>
              <p className="text-xs text-muted-foreground">AI Confidence</p>
              <p className="text-2xl font-bold text-[#1B2F26]">
                {Math.round(Number(decisionStats.avgConfidence))}%
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Active Pipeline */}
      <section className="rounded-lg border border-border bg-white p-5 shadow-xs">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Active Pipeline
        </h2>
        {pipelineEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active leads in pipeline.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {pipelineEntries.map(([stage, count]) => (
              <div
                key={stage}
                className="rounded-md border border-border px-3 py-2 text-center"
              >
                <p className="text-xs text-muted-foreground">
                  {STAGE_LABELS[stage] ?? stage}
                </p>
                <p className="text-xl font-bold text-[#1B2F26]">{count}</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* What Needs Attention */}
      {hasAttentionItems && (
        <section className="rounded-lg border border-[#D4754A]/30 bg-[#FDEAE4]/40 p-5 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#C15B2E] mb-4">
            What Needs Attention
          </h2>
          <ul className="space-y-3">
            {rate > 20 && (
              <li className="text-sm text-[#1B2F26]">
                <span className="font-medium">Correction rate: {rate.toFixed(0)}%</span>
                {' '}&mdash; AI drafts edited frequently. Consider adding KB entries to reduce manual edits.
              </li>
            )}
            {totalOptOuts > 0 && (
              <li className="text-sm text-[#1B2F26]">
                <span className="font-medium">
                  {totalOptOuts} opt-out{totalOptOuts === 1 ? '' : 's'}
                </span>
                {optOuts.length > 0 && (
                  <>
                    {' '}&mdash; reasons:{' '}
                    {optOuts
                      .map((o) => `${o.reason ?? 'unspecified'} (${o.count})`)
                      .join(', ')}
                  </>
                )}
              </li>
            )}
            {kbGaps.map((gap, i) => (
              <li key={i} className="text-sm text-[#1B2F26]">
                <span className="font-medium">Unresolved KB gap:</span>{' '}
                &ldquo;{gap.question}&rdquo;
                {gap.occurrences > 1 && (
                  <span className="text-muted-foreground"> ({gap.occurrences}x asked)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Talking Points */}
      {talkingPoints.length > 0 && (
        <section className="rounded-lg border border-border bg-white p-5 shadow-xs">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Talking Points
          </h2>
          <ol className="space-y-2 list-decimal list-inside">
            {talkingPoints.map((point, i) => (
              <li key={i} className="text-sm text-[#1B2F26]">
                {point}
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* All-clear state */}
      {talkingPoints.length === 0 && !hasAttentionItems && (
        <section className="rounded-lg border border-[#6B7E54]/30 bg-[#E8F5E9] p-5 shadow-xs">
          <p className="text-sm text-[#3D7A50] font-medium">
            All systems healthy. No critical items to discuss.
          </p>
        </section>
      )}

      {/* Print footer */}
      <div className="hidden print:block text-xs text-muted-foreground border-t pt-4 mt-8">
        Generated {format(now, 'PPpp')} &bull; ConversionSurgery
      </div>
    </div>
  );
}
