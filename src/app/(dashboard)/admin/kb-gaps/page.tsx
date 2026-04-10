'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BookOpen, CheckCircle, ExternalLink } from 'lucide-react';

type GapStatus = 'new' | 'in_progress' | 'blocked' | 'resolved' | 'verified';

interface CrossClientGapRow {
  id: string;
  clientId: string;
  clientName: string;
  question: string;
  category: string | null;
  occurrences: number;
  confidenceLevel: string;
  status: GapStatus;
  priorityScore: number;
  isStale: boolean;
  ageDays: number;
  firstSeenAt: string;
}

interface CrossClientGapGroup {
  clientId: string;
  clientName: string;
  gapCount: number;
  gaps: CrossClientGapRow[];
}

interface CrossClientGapResponse {
  groups: CrossClientGapGroup[];
  totalOpen: number;
  duplicateQuestions: string[];
}

function statusBadgeClass(status: GapStatus): string {
  if (status === 'verified') return 'bg-[#E8F5E9] text-[#3D7A50] border-[#3D7A50]/20';
  if (status === 'resolved') return 'bg-[#E3E9E1] text-[#1B2F26] border-[#1B2F26]/20';
  if (status === 'blocked') return 'bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20';
  if (status === 'in_progress') return 'bg-[#FFF3E0] text-[#C15B2E] border-[#C15B2E]/20';
  return 'bg-muted text-muted-foreground border-border';
}

function confidenceBadgeClass(level: string): string {
  return level === 'low'
    ? 'bg-[#FDEAE4] text-[#C15B2E]'
    : 'bg-[#FFF3E0] text-[#C15B2E]';
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ResolveDialog({
  gap,
  onClose,
  onResolved,
}: {
  gap: CrossClientGapRow;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleResolve() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${gap.clientId}/knowledge/gaps/${gap.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'resolved',
            resolutionNote: resolutionNote.trim() || null,
          }),
        }
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Update failed (${res.status})`);
      }
      onResolved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve gap');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Resolve Knowledge Gap</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted/30 border px-3 py-2 text-sm">
            <p className="font-medium">{gap.question}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {gap.clientName} &mdash; seen {gap.occurrences}x
            </p>
          </div>
          <div>
            <Label htmlFor="resolution-note">Resolution Note</Label>
            <Textarea
              id="resolution-note"
              className="mt-1"
              rows={4}
              placeholder="Describe what was added to the knowledge base to address this gap..."
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-md border border-[#C15B2E]/20 bg-[#FDEAE4] px-3 py-2 text-sm text-[#C15B2E]">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleResolve()} disabled={saving}>
              {saving ? 'Resolving...' : 'Mark Resolved'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GapCard({
  gap,
  isDuplicate,
  onResolve,
}: {
  gap: CrossClientGapRow;
  isDuplicate: boolean;
  onResolve: (gap: CrossClientGapRow) => void;
}) {
  return (
    <div
      className={`rounded-md border p-3 space-y-1.5 ${
        isDuplicate ? 'border-[#6B7E54]/40 bg-[#E3E9E1]/30' : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1">{gap.question}</p>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 h-7 px-2 text-xs"
          onClick={() => onResolve(gap)}
        >
          Resolve
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className={statusBadgeClass(gap.status)}>{gap.status}</Badge>
        <Badge className={confidenceBadgeClass(gap.confidenceLevel)}>
          {gap.confidenceLevel} confidence
        </Badge>
        {isDuplicate && (
          <Badge className="bg-[#E3E9E1] text-[#6B7E54] border-[#6B7E54]/20 text-xs">
            multi-client
          </Badge>
        )}
        {gap.isStale && (
          <Badge className="bg-[#FDEAE4] text-[#C15B2E] border-[#C15B2E]/20 text-xs">
            stale
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {gap.category ?? 'uncategorized'} &middot; seen {gap.occurrences}x &middot; age {gap.ageDays}d &middot; added {formatDate(gap.firstSeenAt)}
      </p>
    </div>
  );
}

function ClientGapGroup({
  group,
  duplicateSet,
  onResolve,
}: {
  group: CrossClientGapGroup;
  duplicateSet: Set<string>;
  onResolve: (gap: CrossClientGapRow) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
            {group.clientName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#FFF3E0] text-[#C15B2E]">
              {group.gapCount} open
            </Badge>
            <Link
              href={`/admin/clients/${group.clientId}/knowledge`}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#1B2F26] transition-colors"
            >
              View KB
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {group.gaps.map((gap) => (
          <GapCard
            key={gap.id}
            gap={gap}
            isDuplicate={duplicateSet.has(normalizeQ(gap.question))}
            onResolve={onResolve}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function normalizeQ(q: string): string {
  return q.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}

export default function KbGapsPage() {
  const [data, setData] = useState<CrossClientGapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<CrossClientGapRow | null>(null);
  const [, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/kb-gaps');
      if (!res.ok) {
        throw new Error(`Failed to load KB gaps (${res.status})`);
      }
      const payload = (await res.json()) as CrossClientGapResponse;
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load KB gaps');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, []);

  function handleResolved() {
    setResolving(null);
    void load();
  }

  const duplicateSet = new Set(data?.duplicateQuestions ?? []);
  const groups = data?.groups ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">KB Gap Queue</h1>
        <p className="text-muted-foreground">
          Open knowledge gaps across all clients &mdash; resolve by adding answers to each client&apos;s knowledge base.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#C15B2E' }}>
              {data?.totalOpen ?? (loading ? '—' : 0)}
            </div>
            <p className="text-xs text-muted-foreground">across all clients</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clients Affected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1B2F26]">
              {data ? groups.length : (loading ? '—' : 0)}
            </div>
            <p className="text-xs text-muted-foreground">with open gaps</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Duplicate Questions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#6B7E54]">
              {data ? duplicateSet.size : (loading ? '—' : 0)}
            </div>
            <p className="text-xs text-muted-foreground">same question, multiple clients</p>
          </CardContent>
        </Card>
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-10">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-[#C15B2E]">{error}</p>
            <Button variant="outline" className="mt-3" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-8 w-8 text-[#3D7A50] mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No open knowledge gaps across any client.</p>
            <p className="text-sm text-muted-foreground mt-1">
              New gaps will appear here when the AI encounters low-confidence questions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {duplicateSet.size > 0 && (
            <div className="rounded-md border border-[#6B7E54]/30 bg-[#E3E9E1]/40 px-4 py-3 text-sm">
              <span className="font-medium text-[#1B2F26]">Cross-client patterns detected:</span>{' '}
              <span className="text-muted-foreground">
                {duplicateSet.size} question{duplicateSet.size !== 1 ? 's' : ''} appear across multiple clients.
                Items marked <Badge className="bg-[#E3E9E1] text-[#6B7E54] border-[#6B7E54]/20 mx-1">multi-client</Badge>
                may warrant a shared response template.
              </span>
            </div>
          )}
          {groups.map((group) => (
            <ClientGapGroup
              key={group.clientId}
              group={group}
              duplicateSet={duplicateSet}
              onResolve={setResolving}
            />
          ))}
        </div>
      )}

      {resolving && (
        <ResolveDialog
          gap={resolving}
          onClose={() => setResolving(null)}
          onResolved={handleResolved}
        />
      )}
    </div>
  );
}
