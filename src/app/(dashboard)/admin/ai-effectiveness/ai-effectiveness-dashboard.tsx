'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { AiEffectivenessSnapshot } from '@/lib/services/ai-effectiveness-metrics';
import type { AgentDecision } from '@/db/schema/agent-decisions';

const OUTCOME_COLORS: Record<string, string> = {
  positive: '#3D7A50',
  neutral: '#6B7E54',
  negative: '#C15B2E',
  pending: '#A0AEC0',
};

const MODEL_TIER_COLORS: Record<string, string> = {
  fast: '#6B7E54',
  quality: '#1B2F26',
  unknown: '#A0AEC0',
};

const CONFIDENCE_BAND_COLORS: Record<string, string> = {
  high: '#3D7A50',
  'medium-high': '#6B7E54',
  'medium-low': '#D4754A',
  low: '#C15B2E',
};

type DaysOption = 7 | 14 | 30 | 60 | 90;

export function AiEffectivenessDashboard() {
  const [data, setData] = useState<AiEffectivenessSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<DaysOption>(14);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-effectiveness?days=${days}`);
      if (res.ok) {
        const json = await res.json() as AiEffectivenessSnapshot;
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch AI effectiveness data:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading && !data) {
    return <div className="text-center py-12 text-muted-foreground">Loading AI metrics&hellip;</div>;
  }

  if (!data || data.totalDecisions === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">No AI decisions recorded in the selected period.</p>
        <p className="text-xs text-muted-foreground mt-2">
          Decisions are logged when the conversation agent processes incoming messages.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {([7, 14, 30, 60, 90] as DaysOption[]).map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(d)}
            disabled={loading}
          >
            {d}d
          </Button>
        ))}
        {loading && <span className="text-xs text-muted-foreground ml-2">Refreshing&hellip;</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Decisions"
          value={data.totalDecisions.toLocaleString()}
          context={`${data.period.start} &ndash; ${data.period.end}`}
        />
        <SummaryCard
          label="Positive Outcome Rate"
          value={`${data.positiveRate}%`}
          context="Decisions leading to booking / engagement"
          color={data.positiveRate >= 30 ? 'green' : data.positiveRate >= 15 ? 'yellow' : 'red'}
        />
        <SummaryCard
          label="Avg Confidence"
          value={`${data.avgConfidence}`}
          context="Mean AI confidence (0-100)"
          color={data.avgConfidence >= 70 ? 'green' : data.avgConfidence >= 50 ? 'yellow' : 'red'}
        />
        <SummaryCard
          label="Avg Response Time"
          value={`${data.avgProcessingMs}ms`}
          context="End-to-end processing"
          color={data.avgProcessingMs <= 3000 ? 'green' : data.avgProcessingMs <= 5000 ? 'yellow' : 'red'}
        />
      </div>

      {/* Charts row 1: Outcome distribution + Daily trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Outcome Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.outcomeDistribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="count"
                nameKey="outcome"
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} (${((percent ?? 0) * 100).toFixed(1)}%)`
                }
              >
                {data.outcomeDistribution.map((entry) => (
                  <Cell
                    key={entry.outcome}
                    fill={OUTCOME_COLORS[entry.outcome] ?? '#A0AEC0'}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily Trend">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total"
                stroke="#1B2F26"
                name="Decisions"
                strokeWidth={2}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="positiveRate"
                stroke="#3D7A50"
                name="Positive %"
                strokeWidth={2}
                strokeDasharray="5 5"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="avgConfidence"
                stroke="#D4754A"
                name="Avg Confidence"
                strokeWidth={1}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2: Action effectiveness + Model tier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Action Effectiveness">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.actionEffectiveness} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="action" type="category" width={120} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="positive" stackId="a" fill="#3D7A50" name="Positive" />
              <Bar dataKey="neutral" stackId="a" fill="#6B7E54" name="Neutral" />
              <Bar dataKey="negative" stackId="a" fill="#C15B2E" name="Negative" />
              <Bar dataKey="pending" stackId="a" fill="#A0AEC0" name="Pending" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Model Tier Distribution">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.modelTierMetrics}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="left" dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                {data.modelTierMetrics.map((entry) => (
                  <Cell
                    key={entry.tier}
                    fill={MODEL_TIER_COLORS[entry.tier] ?? '#A0AEC0'}
                  />
                ))}
              </Bar>
              <Bar yAxisId="right" dataKey="positiveRate" name="Positive %" fill="#D4754A" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 3: Confidence bands + Escalation reasons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Confidence Bands">
          <div className="space-y-3">
            {data.confidenceBands
              .sort((a, b) => b.min - a.min)
              .map((band) => (
                <div key={band.band} className="flex items-center gap-3">
                  <div className="w-28 text-sm font-medium capitalize">{band.band}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.max(band.positiveRate, 2)}%`,
                            backgroundColor: CONFIDENCE_BAND_COLORS[band.band] ?? '#A0AEC0',
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-24 text-right">
                        {band.positiveRate}% of {band.total}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground w-16 text-right">
                    {band.avgProcessingMs}ms
                  </div>
                </div>
              ))}
          </div>
        </ChartCard>

        <ChartCard title="Top Escalation Reasons">
          {data.topEscalationReasons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No escalations in this period
            </p>
          ) : (
            <div className="space-y-2">
              {data.topEscalationReasons.map((r) => (
                <div key={r.reason} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <span className="text-sm">{formatEscalationReason(r.reason)}</span>
                  <span className="text-sm font-medium tabular-nums">{r.count}</span>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Recent decisions with analysis snapshot viewer */}
      <RecentDecisions days={days} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  context,
  color,
}: {
  label: string;
  value: string;
  context: string;
  color?: 'green' | 'yellow' | 'red';
}) {
  const bgMap = {
    green: 'bg-[#E8F5E9]',
    yellow: 'bg-[#FFF3E0]',
    red: 'bg-[#FDEAE4]',
  };

  return (
    <div className={`rounded-lg border p-4 ${color ? bgMap[color] : 'bg-white'}`}>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold mt-2">{value}</p>
      <p
        className="text-xs text-muted-foreground mt-1"
        dangerouslySetInnerHTML={{ __html: context }}
      />
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-lg border p-6">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function formatEscalationReason(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Analysis snapshot viewer types
// ---------------------------------------------------------------------------

interface AnalysisSnapshot {
  sentiment: string;
  sentimentConfidence: number;
  urgencyScore: number;
  budgetScore: number;
  intentScore: number;
  detectedObjections: string[];
  suggestedStage: string;
  keyInsights: string[];
  extractedInfo: Record<string, unknown>;
}

interface PromptVersion {
  methodology?: string;
  locale?: string;
  playbook?: string;
  channel?: string;
}

interface ActionDetailsWithVersion {
  modelTier?: string;
  promptVersion?: PromptVersion;
  [key: string]: unknown;
}

interface DecisionRow {
  id: string;
  createdAt: Date;
  action: AgentDecision['action'];
  confidence: number | null;
  outcome: string | null;
  processingTimeMs: number | null;
  analysisSnapshot: AgentDecision['analysisSnapshot'];
  actionDetails: AgentDecision['actionDetails'];
  reasoning: string | null;
  clientName: string | null;
  leadName: string | null;
  leadPhone: string | null;
}

interface DecisionRowItemProps {
  decision: DecisionRow;
}

const OUTCOME_BADGE: Record<string, string> = {
  positive: 'bg-[#E8F5E9] text-[#3D7A50]',
  neutral: 'bg-muted text-muted-foreground',
  negative: 'bg-[#FDEAE4] text-[#C15B2E]',
  pending: 'bg-[#FFF3E0] text-[#C15B2E]',
};

function DecisionRowItem({ decision }: DecisionRowItemProps) {
  const [open, setOpen] = useState(false);

  const snapshot = decision.analysisSnapshot as AnalysisSnapshot | null;
  const actionDetails = decision.actionDetails as ActionDetailsWithVersion | null;
  const modelTier = actionDetails?.modelTier ?? null;
  const promptVersion = actionDetails?.promptVersion ?? null;

  const outcomeBadgeClass = OUTCOME_BADGE[decision.outcome ?? 'pending'] ?? OUTCOME_BADGE.pending;
  const shortId = decision.id.slice(0, 8);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-white">
        {/* Summary row */}
        <CollapsibleTrigger className="w-full text-left px-4 py-3 flex items-center justify-between gap-4 hover:bg-muted/30 transition-colors rounded-lg">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span className="text-xs text-muted-foreground font-mono shrink-0">
              #{shortId}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">
              {format(new Date(decision.createdAt), 'MMM d, yyyy h:mm a')}
            </span>
            <Badge className="bg-[#1B2F26]/10 text-[#1B2F26] text-xs capitalize shrink-0">
              {decision.action.replace(/_/g, ' ')}
            </Badge>
            {decision.confidence !== null && (
              <span className="text-xs text-muted-foreground shrink-0">
                Confidence: {decision.confidence}
              </span>
            )}
            {modelTier && (
              <span className="text-xs text-muted-foreground shrink-0">
                Model: {modelTier}
              </span>
            )}
            <Badge className={`${outcomeBadgeClass} text-xs capitalize shrink-0`}>
              {decision.outcome ?? 'pending'}
            </Badge>
            {(decision.clientName ?? decision.leadName) && (
              <span className="text-xs text-muted-foreground truncate">
                {decision.clientName}
                {decision.leadName ? ` — ${decision.leadName}` : ''}
              </span>
            )}
          </div>
          <span className="shrink-0 text-muted-foreground">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </CollapsibleTrigger>

        {/* Expanded analysis details */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
            {snapshot ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1B2F26] uppercase tracking-wide">
                  Analysis Details
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-sm">
                  <SnapshotField
                    label="Sentiment"
                    value={`${snapshot.sentiment} (confidence: ${snapshot.sentimentConfidence})`}
                  />
                  <SnapshotField label="Urgency" value={String(snapshot.urgencyScore)} />
                  <SnapshotField label="Budget" value={String(snapshot.budgetScore)} />
                  <SnapshotField label="Intent" value={String(snapshot.intentScore)} />
                  <SnapshotField label="Stage" value={snapshot.suggestedStage} />
                  <SnapshotField
                    label="Objections"
                    value={
                      snapshot.detectedObjections.length > 0
                        ? snapshot.detectedObjections.join(', ')
                        : '(none)'
                    }
                  />
                  <SnapshotField
                    label="Key Insights"
                    value={
                      snapshot.keyInsights.length > 0
                        ? snapshot.keyInsights.join('; ')
                        : '(none)'
                    }
                    wide
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No analysis snapshot recorded for this decision.</p>
            )}
            {decision.reasoning && (
              <div>
                <p className="text-xs font-semibold text-[#1B2F26] uppercase tracking-wide mb-1">
                  Reasoning
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{decision.reasoning}</p>
              </div>
            )}
            {decision.processingTimeMs !== null && (
              <p className="text-xs text-muted-foreground">
                Processing time: {decision.processingTimeMs}ms
              </p>
            )}
            {promptVersion && (
              <p className="text-xs text-muted-foreground mt-2">
                Prompt: methodology {promptVersion.methodology ?? 'n/a'} | locale {promptVersion.locale ?? 'n/a'} | playbook {promptVersion.playbook ?? 'n/a'}
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function SnapshotField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentDecisions — loads on demand
// ---------------------------------------------------------------------------

function RecentDecisions({ days }: { days: DaysOption }) {
  const [expanded, setExpanded] = useState(false);
  const [decisions, setDecisions] = useState<DecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchDecisions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/ai-effectiveness/decisions?days=${days}&limit=50`);
      if (res.ok) {
        const json = await res.json() as { decisions: DecisionRow[] };
        setDecisions(json.decisions);
        setLoaded(true);
      }
    } catch (err) {
      console.error('Failed to fetch recent decisions:', err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  function handleToggle() {
    if (!expanded && !loaded) {
      void fetchDecisions();
    }
    setExpanded((prev) => !prev);
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Recent Decisions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Click any row to see the AI&apos;s analysis snapshot for that decision
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggle}
          disabled={loading}
        >
          {loading ? 'Loading...' : expanded ? 'Hide' : 'Show decisions'}
        </Button>
      </div>

      {expanded && (
        <div className="space-y-2">
          {decisions.length === 0 && loaded && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No decisions recorded in this period.
            </p>
          )}
          {decisions.map((d) => (
            <DecisionRowItem key={d.id} decision={d} />
          ))}
          {decisions.length === 50 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Showing 50 most recent decisions
            </p>
          )}
        </div>
      )}
    </div>
  );
}
