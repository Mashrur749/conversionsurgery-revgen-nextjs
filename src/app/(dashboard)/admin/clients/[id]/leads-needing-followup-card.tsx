'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPhoneNumber } from '@/lib/utils/phone';

interface LeadDto {
  id: string;
  name: string | null;
  phone: string;
  status: string | null;
  projectType: string | null;
  daysSinceCreated: number;
}

interface Props {
  clientId: string;
}

export function LeadsNeedingFollowupCard({ clientId }: Props) {
  const [leads, setLeads] = useState<LeadDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [triggeringIds, setTriggeringIds] = useState<Set<string>>(new Set());
  const [triggeredIds, setTriggeredIds] = useState<Set<string>>(new Set());

  const fetchLeads = useCallback(async () => {
    try {
      setError('');
      const res = await fetch(`/api/admin/clients/${clientId}/leads/needing-followup`);
      if (!res.ok) {
        throw new Error('Failed to load leads');
      }
      const data: { leads: LeadDto[] } = await res.json();
      setLeads(data.leads);
    } catch {
      setError('Unable to load leads needing follow-up.');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleTrigger = async (leadId: string) => {
    setTriggeringIds((prev) => new Set(prev).add(leadId));
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/leads/${leadId}/estimate-followup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      if (!res.ok) {
        let errorMessage = 'Failed to start follow-up';
        try {
          const data = await res.json() as { error?: string };
          if (data.error) errorMessage = data.error;
        } catch {
          // ignore parse error
        }
        throw new Error(errorMessage);
      }
      // Success — mark lead as triggered regardless of alreadyActive
      setTriggeredIds((prev) => new Set(prev).add(leadId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start follow-up');
    } finally {
      setTriggeringIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leads Needing Follow-up</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-8 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  // Filter out triggered leads from the visible list
  const visibleLeads = leads.filter((l) => !triggeredIds.has(l.id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leads Needing Follow-up</CardTitle>
        <CardDescription>
          {visibleLeads.length > 0
            ? `${visibleLeads.length} lead${visibleLeads.length === 1 ? '' : 's'} without an active estimate sequence`
            : 'All leads have active follow-up running'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md bg-[#FDEAE4] px-3 py-2 text-sm text-sienna">
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError('');
                setLoading(true);
                fetchLeads();
              }}
            >
              Retry
            </Button>
          </div>
        )}

        {visibleLeads.length === 0 && !error ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            All leads have active follow-up running. Nothing to do here.
          </p>
        ) : (
          <div className="divide-y">
            {visibleLeads.map((lead) => {
              const isTriggering = triggeringIds.has(lead.id);
              return (
                <div
                  key={lead.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {lead.name ?? formatPhoneNumber(lead.phone)}
                      </span>
                      <Badge
                        variant="secondary"
                        className={
                          lead.status === 'new'
                            ? 'bg-[#FFF3E0] text-sienna'
                            : 'bg-muted text-foreground'
                        }
                      >
                        {lead.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{lead.daysSinceCreated}d ago</span>
                      {lead.projectType && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate">{lead.projectType}</span>
                        </>
                      )}
                      {lead.name && (
                        <>
                          <span>&middot;</span>
                          <span>{formatPhoneNumber(lead.phone)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={isTriggering}
                    onClick={() => handleTrigger(lead.id)}
                  >
                    {isTriggering ? 'Starting\u2026' : 'Start Follow-up'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
