'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type GapStatus = 'new' | 'in_progress' | 'blocked' | 'resolved' | 'verified';

interface QueueOwner {
  personId: string;
  name: string;
}

interface QueueMetrics {
  openedLast7Days: number;
  closedLast7Days: number;
  averageOpenAgeDays: number;
}

interface QueueSummary {
  total: number;
  open: number;
  highPriorityOpen: number;
  staleHighPriority: number;
  byStatus: Record<GapStatus, number>;
}

interface QueueRow {
  id: string;
  question: string;
  category: string | null;
  occurrences: number;
  confidenceLevel: string;
  status: GapStatus;
  ownerPersonId: string | null;
  ownerName: string | null;
  dueAt: string | null;
  priorityScore: number;
  reviewRequired: boolean;
  resolutionNote: string | null;
  kbEntryId: string | null;
  kbEntryTitle: string | null;
  resolvedAt: string | null;
  verifiedAt: string | null;
  isStale: boolean;
  ageDays: number;
}

interface QueueResponse {
  success: boolean;
  owners: QueueOwner[];
  rows: QueueRow[];
  summary: QueueSummary;
  metrics: QueueMetrics;
}

interface KnowledgeEntryOption {
  id: string;
  title: string;
  category: string;
}

interface Props {
  clientId: string;
  entries: KnowledgeEntryOption[];
}

const STATUS_OPTIONS: Array<{ value: GapStatus; label: string }> = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'verified', label: 'Verified' },
];

function toLocalDateTimeValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
    .toISOString()
    .slice(0, 16);
}

function statusBadgeClass(status: GapStatus): string {
  if (status === 'verified') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'resolved') return 'bg-blue-100 text-blue-800 border-blue-200';
  if (status === 'blocked') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'in_progress') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function formatDate(value: string | null): string {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function KnowledgeGapQueue({ clientId, entries }: Props) {
  const [data, setData] = useState<QueueResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOwnerPersonId, setBulkOwnerPersonId] = useState<string>('unassigned');
  const [bulkStatus, setBulkStatus] = useState<GapStatus>('in_progress');
  const [activeGap, setActiveGap] = useState<QueueRow | null>(null);
  const [isPending, startTransition] = useTransition();
  const [askingContractor, setAskingContractor] = useState<Set<string>>(new Set());

  const [editStatus, setEditStatus] = useState<GapStatus>('new');
  const [editOwnerPersonId, setEditOwnerPersonId] = useState<string>('unassigned');
  const [editDueAt, setEditDueAt] = useState<string>('');
  const [editKbEntryId, setEditKbEntryId] = useState<string>('none');
  const [editResolutionNote, setEditResolutionNote] = useState<string>('');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'open') params.set('status', 'new,in_progress,blocked');
      if (statusFilter === 'resolved') params.set('status', 'resolved');
      if (statusFilter === 'verified') params.set('status', 'verified');
      if (statusFilter === 'high_priority') params.set('highPriority', 'true');
      if (statusFilter === 'stale') params.set('staleOnly', 'true');
      if (ownerFilter !== 'all') params.set('ownerPersonId', ownerFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/admin/clients/${clientId}/knowledge/gaps?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load queue (${res.status})`);
      }
      const payload = (await res.json()) as QueueResponse;
      setData(payload);
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, [statusFilter, ownerFilter]);

  async function applyBulkPatch(payload: Record<string, unknown>) {
    if (selectedIds.length === 0) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/knowledge/gaps/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gapIds: selectedIds,
          ...payload,
        }),
      });
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Bulk update failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk update failed');
    }
  }

  function openEditor(row: QueueRow) {
    setActiveGap(row);
    setEditStatus(row.status);
    setEditOwnerPersonId(row.ownerPersonId ?? 'unassigned');
    setEditDueAt(toLocalDateTimeValue(row.dueAt));
    setEditKbEntryId(row.kbEntryId ?? 'none');
    setEditResolutionNote(row.resolutionNote ?? '');
  }

  async function saveEditor() {
    if (!activeGap) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/knowledge/gaps/${activeGap.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editStatus,
          ownerPersonId: editOwnerPersonId === 'unassigned' ? null : editOwnerPersonId,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : null,
          kbEntryId: editKbEntryId === 'none' ? null : editKbEntryId,
          resolutionNote: editResolutionNote.trim() ? editResolutionNote.trim() : null,
        }),
      });

      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Update failed (${res.status})`);
      }

      setActiveGap(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save gap');
    }
  }

  const ownerOptions = useMemo(() => data?.owners ?? [], [data]);
  const rows = data?.rows ?? [];
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? rows.map((row) => row.id) : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) =>
      checked
        ? (prev.includes(id) ? prev : [...prev, id])
        : prev.filter((existing) => existing !== id)
    );
  }

  async function askContractor(gapId: string) {
    setAskingContractor((prev) => new Set(prev).add(gapId));
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/knowledge/gaps/${gapId}/ask`,
        { method: 'POST' }
      );
      if (!res.ok) {
        const detail = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(detail?.error ?? `Request failed (${res.status})`);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send SMS to contractor');
    } finally {
      setAskingContractor((prev) => {
        const next = new Set(prev);
        next.delete(gapId);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Open</p><p className="text-xl font-semibold">{data?.summary.open ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Stale High Priority</p><p className="text-xl font-semibold">{data?.summary.staleHighPriority ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Opened (7d)</p><p className="text-xl font-semibold">{data?.metrics.openedLast7Days ?? 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Avg Open Age (days)</p><p className="text-xl font-semibold">{data?.metrics.averageOpenAgeDays ?? 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Knowledge Gap Queue</CardTitle>
          <div className="flex flex-wrap gap-2">
            <select className="h-9 rounded-md border px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="open">Open</option>
              <option value="all">All</option>
              <option value="resolved">Resolved</option>
              <option value="verified">Verified</option>
              <option value="high_priority">High Priority</option>
              <option value="stale">Stale</option>
            </select>
            <select className="h-9 rounded-md border px-3 text-sm" value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
              <option value="all">All Owners</option>
              {ownerOptions.map((owner) => (
                <option key={owner.personId} value={owner.personId}>{owner.name}</option>
              ))}
            </select>
            <Input
              placeholder="Search question/category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button variant="outline" onClick={() => void load()} disabled={isPending}>
              Apply
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedIds.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              <select className="h-9 rounded-md border px-3 text-sm" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as GapStatus)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <Button size="sm" variant="outline" onClick={() => void applyBulkPatch({ status: bulkStatus })}>
                Apply Status
              </Button>
              <select className="h-9 rounded-md border px-3 text-sm" value={bulkOwnerPersonId} onChange={(e) => setBulkOwnerPersonId(e.target.value)}>
                <option value="unassigned">Unassigned</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.personId} value={owner.personId}>{owner.name}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void applyBulkPatch({ ownerPersonId: bulkOwnerPersonId === 'unassigned' ? null : bulkOwnerPersonId })}
              >
                Assign Owner
              </Button>
            </div>
          )}

          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {loading ? (
            <p className="text-sm text-muted-foreground py-8">Loading knowledge gaps...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8">No knowledge gaps in this view.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-[#F8F9FA]">
                  <tr>
                    <th className="px-3 py-2 text-left"><Checkbox checked={allSelected} onCheckedChange={(value) => toggleAll(value === true)} /></th>
                    <th className="px-3 py-2 text-left font-medium">Question</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Owner</th>
                    <th className="px-3 py-2 text-left font-medium">Priority</th>
                    <th className="px-3 py-2 text-left font-medium">Due</th>
                    <th className="px-3 py-2 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b hover:bg-[#F8F9FA]">
                      <td className="px-3 py-3 align-top">
                        <Checkbox
                          checked={selectedIds.includes(row.id)}
                          onCheckedChange={(value) => toggleOne(row.id, value === true)}
                        />
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p className="font-medium">{row.question}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.category || 'uncategorized'} · seen {row.occurrences}x · age {row.ageDays}d
                        </p>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <Badge className={statusBadgeClass(row.status)}>{row.status}</Badge>
                        {row.reviewRequired && (
                          <p className="text-xs text-amber-700 mt-1">review required</p>
                        )}
                      </td>
                      <td className="px-3 py-3 align-top">{row.ownerName ?? 'Unassigned'}</td>
                      <td className="px-3 py-3 align-top">
                        <span className={row.priorityScore >= 8 ? 'font-semibold text-red-700' : ''}>
                          {row.priorityScore}/10
                        </span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <p>{formatDate(row.dueAt)}</p>
                        {row.isStale && <p className="text-xs text-red-700">stale</p>}
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <div className="flex justify-end gap-2">
                          {row.status === 'in_progress' ? (
                            <Button size="sm" variant="outline" disabled>
                              Sent &mdash; Waiting for reply
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={askingContractor.has(row.id)}
                              onClick={() => void askContractor(row.id)}
                            >
                              {askingContractor.has(row.id) ? 'Sending...' : 'Ask Contractor'}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openEditor(row)}>
                            Manage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!activeGap} onOpenChange={(open) => !open && setActiveGap(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Knowledge Gap</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Status</Label>
              <select className="mt-1 h-9 w-full rounded-md border px-3 text-sm" value={editStatus} onChange={(e) => setEditStatus(e.target.value as GapStatus)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Owner</Label>
              <select className="mt-1 h-9 w-full rounded-md border px-3 text-sm" value={editOwnerPersonId} onChange={(e) => setEditOwnerPersonId(e.target.value)}>
                <option value="unassigned">Unassigned</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.personId} value={owner.personId}>{owner.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Due At</Label>
              <Input type="datetime-local" value={editDueAt} onChange={(e) => setEditDueAt(e.target.value)} />
            </div>
            <div>
              <Label>KB Entry (required for resolve/verify)</Label>
              <select className="mt-1 h-9 w-full rounded-md border px-3 text-sm" value={editKbEntryId} onChange={(e) => setEditKbEntryId(e.target.value)}>
                <option value="none">None</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.category}: {entry.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Resolution Note (required for resolve/verify)</Label>
              <Textarea value={editResolutionNote} onChange={(e) => setEditResolutionNote(e.target.value)} rows={4} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActiveGap(null)}>Cancel</Button>
              <Button onClick={() => void saveEditor()}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
