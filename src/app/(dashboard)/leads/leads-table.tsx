'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDistanceToNow } from 'date-fns';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { LeadScoreBadge } from '@/components/leads/lead-score-badge';
import { LeadFilters } from './lead-filters';
import { ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react';
import { STATUS_COLORS, BULK_UPDATE_STATUSES } from '@/lib/constants/leads';
import type { Lead } from '@/db/schema/leads';

interface LeadsResponse {
  leads: Lead[];
  total: number;
  page: number;
  totalPages: number;
}

export function LeadsTable() {
  const router = useRouter();
  const [data, setData] = useState<LeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [temperature, setTemperature] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'updatedAt' | 'createdAt' | 'score'>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    if (source) params.set('source', source);
    if (temperature) params.set('temperature', temperature);
    params.set('page', String(page));
    params.set('limit', '25');
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    try {
      const res = await fetch(`/api/leads?${params.toString()}`);
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [search, status, source, temperature, page, sortBy, sortDir]);

  useEffect(() => {
    const timer = setTimeout(fetchLeads, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchLeads, search]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search, status, source, temperature]);

  const toggleSort = (col: 'updatedAt' | 'createdAt' | 'score') => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (!data) return;
    if (selected.size === data.leads.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.leads.map((l) => l.id)));
    }
  };

  const bulkUpdateStatus = async (newStatus: string) => {
    if (selected.size === 0) return;
    const promises = Array.from(selected).map((id) =>
      fetch(`/api/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    );
    await Promise.all(promises);
    setSelected(new Set());
    fetchLeads();
  };

  const leads = data?.leads || [];

  return (
    <div className="space-y-4">
      <LeadFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        source={source}
        onSourceChange={setSource}
        temperature={temperature}
        onTemperatureChange={setTemperature}
      />

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select onValueChange={bulkUpdateStatus}>
            <SelectTrigger className="w-[180px] h-8">
              <SelectValue placeholder="Change status to..." />
            </SelectTrigger>
            <SelectContent>
              {BULK_UPDATE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Cancel
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="p-8 text-center text-muted-foreground">Loading leads...</div>
          ) : leads.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search || status || source || temperature
                ? 'No leads match your filters.'
                : "No leads yet. They'll appear here when someone calls or submits a form."}
            </div>
          ) : (
            <>
              <div className="hidden md:grid grid-cols-[auto_1fr_120px_100px_100px_120px] gap-3 px-4 py-2 border-b text-xs font-medium text-muted-foreground uppercase">
                <div className="flex items-center">
                  <Checkbox
                    checked={selected.size === leads.length && leads.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </div>
                <div>Lead</div>
                <div>Status</div>
                <div>Score</div>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('createdAt')}>
                  Created <ArrowUpDown className="h-3 w-3" />
                </button>
                <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort('updatedAt')}>
                  Updated <ArrowUpDown className="h-3 w-3" />
                </button>
              </div>

              <div className="divide-y">
                {leads.map((lead) => (
                  <div
                    key={lead.id}
                    className="grid grid-cols-1 md:grid-cols-[auto_1fr_120px_100px_100px_120px] gap-2 md:gap-3 px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer items-center"
                    onClick={() => router.push(`/leads/${lead.id}`)}
                  >
                    <div className="hidden md:flex items-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={() => toggleSelect(lead.id)}
                      />
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      {lead.actionRequired && (
                        <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {lead.name || formatPhoneNumber(lead.phone)}
                        </p>
                        {lead.name && (
                          <p className="text-sm text-muted-foreground">{formatPhoneNumber(lead.phone)}</p>
                        )}
                        {lead.projectType && (
                          <p className="text-xs text-muted-foreground truncate">{lead.projectType}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Badge className={STATUS_COLORS[lead.status || 'new'] || STATUS_COLORS.new}>
                        {lead.status?.replace(/_/g, ' ') || 'new'}
                      </Badge>
                    </div>
                    <div>
                      <LeadScoreBadge
                        score={lead.score || 50}
                        temperature={(lead.temperature as 'hot' | 'warm' | 'cold') || 'warm'}
                        compact
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(lead.updatedAt!), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 25 + 1}–{Math.min(page * 25, data.total)} of {data.total} leads
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
