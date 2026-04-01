'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

type DateLike = string | Date | null;

interface DayOneMilestone {
  id: string;
  key: string;
  title: string;
  status: 'pending' | 'completed' | 'overdue';
  targetAt: DateLike;
  completedAt: DateLike;
  completedBy: string | null;
  evidence: {
    link?: string;
    note?: string;
    source?: string;
  } | null;
}

interface AuditFinding {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  estimatedImpactCentsLow?: number;
  estimatedImpactCentsHigh?: number;
}

interface DayOneSummary {
  milestones: DayOneMilestone[];
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  audit: {
    status: 'draft' | 'delivered';
    summary: string | null;
    findings: AuditFinding[] | null;
    estimatedImpactLowCents: number | null;
    estimatedImpactBaseCents: number | null;
    estimatedImpactHighCents: number | null;
    artifactUrl: string | null;
    deliveredAt: DateLike;
    deliveredBy: string | null;
    updatedAt: DateLike;
  } | null;
  openAlerts: Array<{
    id: string;
    milestoneKey: string;
    reason: string;
    detectedAt: DateLike;
  }>;
  activities: Array<{
    id: string;
    eventType: string;
    actorType: string;
    actorId: string | null;
    notes: string | null;
    metadata: unknown;
    createdAt: DateLike;
  }>;
}

interface Props {
  clientId: string;
  initialSummary: DayOneSummary;
}

interface FindingDraft {
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  impactLow: string;
  impactHigh: string;
}

function emptyFindingDraft(): FindingDraft {
  return {
    title: '',
    detail: '',
    priority: 'medium',
    impactLow: '',
    impactHigh: '',
  };
}

function toFindingDrafts(
  findings: AuditFinding[] | null
): FindingDraft[] {
  const source = findings ?? [];
  if (source.length === 0) {
    return [emptyFindingDraft()];
  }
  return source.map((finding) => ({
    title: finding.title,
    detail: finding.detail,
    priority: finding.priority,
    impactLow: finding.estimatedImpactCentsLow?.toString() ?? '',
    impactHigh: finding.estimatedImpactCentsHigh?.toString() ?? '',
  }));
}

function formatDate(value: DateLike): string {
  if (!value) return 'n/a';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? 'n/a' : date.toLocaleString();
}

function statusBadgeVariant(
  status: DayOneMilestone['status']
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'overdue') return 'destructive';
  return 'secondary';
}

export function DayOneActivationCard({ clientId, initialSummary }: Props) {
  const [summary, setSummary] = useState<DayOneSummary>(initialSummary);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditSummary, setAuditSummary] = useState(initialSummary.audit?.summary ?? '');
  const [findingDrafts, setFindingDrafts] = useState<FindingDraft[]>(
    toFindingDrafts(initialSummary.audit?.findings ?? null)
  );
  const [artifactUrl, setArtifactUrl] = useState(initialSummary.audit?.artifactUrl ?? '');
  const [impactLow, setImpactLow] = useState(
    initialSummary.audit?.estimatedImpactLowCents?.toString() ?? ''
  );
  const [impactBase, setImpactBase] = useState(
    initialSummary.audit?.estimatedImpactBaseCents?.toString() ?? ''
  );
  const [impactHigh, setImpactHigh] = useState(
    initialSummary.audit?.estimatedImpactHighCents?.toString() ?? ''
  );

  const completedMilestones = useMemo(
    () => summary.milestones.filter((milestone) => milestone.status === 'completed').length,
    [summary.milestones]
  );

  const auditSummaryLine = useMemo(() => {
    const findings = summary.audit?.findings;
    const status = summary.audit?.status;
    if (!findings || findings.length === 0) {
      return 'No audit yet';
    }
    return `${findings.length} finding${findings.length === 1 ? '' : 's'}, ${status === 'delivered' ? 'delivered' : 'draft'}`;
  }, [summary.audit]);

  function normalizeAuditFields(next: DayOneSummary) {
    setAuditSummary(next.audit?.summary ?? '');
    setFindingDrafts(toFindingDrafts(next.audit?.findings ?? null));
    setArtifactUrl(next.audit?.artifactUrl ?? '');
    setImpactLow(next.audit?.estimatedImpactLowCents?.toString() ?? '');
    setImpactBase(next.audit?.estimatedImpactBaseCents?.toString() ?? '');
    setImpactHigh(next.audit?.estimatedImpactHighCents?.toString() ?? '');
  }

  async function patch(payload: Record<string, unknown>, actionKey: string) {
    setLoadingAction(actionKey);
    setError('');
    try {
      const response = await fetch(
        `/api/admin/clients/${clientId}/onboarding/day-one`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = (await response.json()) as {
        success?: boolean;
        summary?: DayOneSummary;
        error?: string;
      };
      if (!response.ok || !data.summary) {
        throw new Error(data.error || 'Failed to update day-one activation');
      }
      setSummary(data.summary);
      normalizeAuditFields(data.summary);
    } catch (patchError) {
      setError(
        patchError instanceof Error
          ? patchError.message
          : 'Failed to update day-one activation'
      );
    } finally {
      setLoadingAction(null);
    }
  }

  function parseOptionalInt(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseInt(value.trim(), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  async function saveAudit(deliver: boolean) {
    const findings = findingDrafts
      .map((draft) => ({
        title: draft.title.trim(),
        detail: draft.detail.trim(),
        priority: draft.priority,
        estimatedImpactCentsLow: parseOptionalInt(draft.impactLow),
        estimatedImpactCentsHigh: parseOptionalInt(draft.impactHigh),
      }))
      .filter((draft) => draft.title && draft.detail);

    if (findingDrafts.some((draft) => draft.title.trim() || draft.detail.trim()) && findings.length === 0) {
      setError('Each audit finding needs both title and detail.');
      return;
    }

    await patch(
      {
        action: 'upsert_audit',
        summary: auditSummary,
        findings,
        estimatedImpactLowCents: parseOptionalInt(impactLow),
        estimatedImpactBaseCents: parseOptionalInt(impactBase),
        estimatedImpactHighCents: parseOptionalInt(impactHigh),
        artifactUrl: artifactUrl || undefined,
        deliver,
      },
      deliver ? 'deliver-audit' : 'save-audit'
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Day-One Activation</CardTitle>
        <CardDescription>
          Track onboarding SLA milestones and Revenue Leak Audit delivery proof.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-[#FDEAE4] px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="rounded-md border p-3 text-sm">
          <div className="flex items-center justify-between">
            <p className="font-medium">Progress</p>
            <p className="text-muted-foreground">
              {completedMilestones}/{summary.milestones.length} complete
            </p>
          </div>
          <p className="text-muted-foreground">
            {summary.progress.percent}% complete
          </p>
        </div>

        <div className="space-y-2">
          {summary.milestones.map((milestone) => (
            <div key={milestone.key} className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{milestone.title}</p>
                <Badge variant={statusBadgeVariant(milestone.status)}>
                  {milestone.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Target: {formatDate(milestone.targetAt)} | Completed:{' '}
                {formatDate(milestone.completedAt)}
              </p>
              {milestone.evidence?.note && (
                <p className="text-xs text-muted-foreground">
                  Evidence: {milestone.evidence.note}
                </p>
              )}
              {milestone.status !== 'completed' && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={loadingAction === `complete-${milestone.key}`}
                  onClick={() =>
                    patch(
                      {
                        action: 'complete_milestone',
                        milestoneKey: milestone.key,
                      },
                      `complete-${milestone.key}`
                    )
                  }
                >
                  {loadingAction === `complete-${milestone.key}`
                    ? 'Updating...'
                    : 'Mark Complete'}
                </Button>
              )}
            </div>
          ))}
        </div>

        <Collapsible open={auditOpen} onOpenChange={setAuditOpen}>
          <div className="rounded-md border p-3">
            <CollapsibleTrigger className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="font-medium">Revenue Leak Audit</p>
                <span className="text-xs text-muted-foreground">
                  {auditSummaryLine}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {auditOpen ? 'Collapse' : 'Expand'}
              </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 pt-3">
                <div className="space-y-2">
                  <Label htmlFor={`audit-summary-${clientId}`}>Summary</Label>
                  <Textarea
                    id={`audit-summary-${clientId}`}
                    rows={3}
                    value={auditSummary}
                    onChange={(event) => setAuditSummary(event.target.value)}
                    placeholder="3-5 findings summary and delivery notes..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Findings</Label>
                  <div className="space-y-2">
                    {findingDrafts.map((finding, index) => (
                      <div key={`${clientId}-finding-${index}`} className="rounded border p-2 space-y-2">
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                          <Input
                            value={finding.title}
                            onChange={(event) =>
                              setFindingDrafts((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, title: event.target.value }
                                    : row
                                )
                              )
                            }
                            placeholder="Finding title"
                          />
                          <select
                            className="h-10 rounded-md border bg-background px-3 text-sm"
                            value={finding.priority}
                            onChange={(event) =>
                              setFindingDrafts((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        priority: event.target.value as
                                          | 'high'
                                          | 'medium'
                                          | 'low',
                                      }
                                    : row
                                )
                              )
                            }
                          >
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <Textarea
                          rows={2}
                          value={finding.detail}
                          onChange={(event) =>
                            setFindingDrafts((current) =>
                              current.map((row, rowIndex) =>
                                rowIndex === index
                                  ? { ...row, detail: event.target.value }
                                  : row
                              )
                            )
                          }
                          placeholder="Finding detail"
                        />
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <Input
                            value={finding.impactLow}
                            onChange={(event) =>
                              setFindingDrafts((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, impactLow: event.target.value }
                                    : row
                                )
                              )
                            }
                            placeholder="Finding impact low (cents)"
                            inputMode="numeric"
                          />
                          <Input
                            value={finding.impactHigh}
                            onChange={(event) =>
                              setFindingDrafts((current) =>
                                current.map((row, rowIndex) =>
                                  rowIndex === index
                                    ? { ...row, impactHigh: event.target.value }
                                    : row
                                )
                              )
                            }
                            placeholder="Finding impact high (cents)"
                            inputMode="numeric"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setFindingDrafts((current) =>
                                current.length === 1
                                  ? [emptyFindingDraft()]
                                  : current.filter((_, rowIndex) => rowIndex !== index)
                              )
                            }
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setFindingDrafts((current) => [...current, emptyFindingDraft()])
                      }
                    >
                      Add Finding
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`audit-artifact-${clientId}`}>Artifact URL</Label>
                  <Input
                    id={`audit-artifact-${clientId}`}
                    value={artifactUrl}
                    onChange={(event) => setArtifactUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor={`impact-low-${clientId}`}>Impact Low (cents)</Label>
                    <Input
                      id={`impact-low-${clientId}`}
                      value={impactLow}
                      onChange={(event) => setImpactLow(event.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`impact-base-${clientId}`}>Impact Base (cents)</Label>
                    <Input
                      id={`impact-base-${clientId}`}
                      value={impactBase}
                      onChange={(event) => setImpactBase(event.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`impact-high-${clientId}`}>Impact High (cents)</Label>
                    <Input
                      id={`impact-high-${clientId}`}
                      value={impactHigh}
                      onChange={(event) => setImpactHigh(event.target.value)}
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => saveAudit(false)}
                    disabled={loadingAction === 'save-audit'}
                  >
                    {loadingAction === 'save-audit' ? 'Saving...' : 'Save Draft'}
                  </Button>
                  <Button
                    onClick={() => saveAudit(true)}
                    disabled={loadingAction === 'deliver-audit'}
                  >
                    {loadingAction === 'deliver-audit'
                      ? 'Delivering...'
                      : 'Save + Mark Delivered'}
                  </Button>
                </div>
                {summary.audit?.deliveredAt && (
                  <p className="text-xs text-muted-foreground">
                    Delivered: {formatDate(summary.audit.deliveredAt)} by{' '}
                    {summary.audit.deliveredBy || 'system'}
                  </p>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>

        <div className="space-y-2 rounded-md border p-3">
          <p className="font-medium">Open SLA Alerts ({summary.openAlerts.length})</p>
          {summary.openAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open onboarding SLA alerts.</p>
          ) : (
            <div className="space-y-2">
              {summary.openAlerts.map((alert) => (
                <div key={alert.id} className="rounded-md border p-2 text-sm space-y-2">
                  <p className="font-medium">{alert.reason}</p>
                  <p className="text-xs text-muted-foreground">
                    Detected: {formatDate(alert.detectedAt)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={loadingAction === `resolve-${alert.id}`}
                    onClick={() =>
                      patch(
                        { action: 'resolve_alert', alertId: alert.id },
                        `resolve-${alert.id}`
                      )
                    }
                  >
                    {loadingAction === `resolve-${alert.id}`
                      ? 'Resolving...'
                      : 'Resolve Alert'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2 rounded-md border p-3">
          <p className="font-medium">Activity Trail</p>
          {summary.activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity logged yet.</p>
          ) : (
            <div className="space-y-2">
              {summary.activities.slice(0, 10).map((activity) => (
                <div key={activity.id} className="rounded border px-2 py-1">
                  <p className="text-sm font-medium">{activity.eventType}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(activity.createdAt)} | {activity.actorType}
                    {activity.actorId ? ` (${activity.actorId})` : ''}
                  </p>
                  {activity.notes && (
                    <p className="text-xs text-muted-foreground">{activity.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
