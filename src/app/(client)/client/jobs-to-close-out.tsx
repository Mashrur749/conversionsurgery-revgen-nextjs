'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface JobToCloseOut {
  id: string;
  name: string | null;
  projectType: string | null;
  wonAt: Date;
}

interface JobsToCloseOutProps {
  jobs: JobToCloseOut[];
}

export function JobsToCloseOut({ jobs }: JobsToCloseOutProps) {
  const [visibleIds, setVisibleIds] = useState<Set<string>>(() => new Set(jobs.map((j) => j.id)));
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  const visible = jobs.filter((j) => visibleIds.has(j.id));

  if (visible.length === 0) return null;

  async function markComplete(leadId: string) {
    setLoadingId(leadId);
    setErrorId(null);

    try {
      const res = await fetch(`/api/client/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      });

      if (!res.ok) {
        setErrorId(leadId);
        return;
      }

      // Optimistic remove
      setVisibleIds((prev) => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
    } catch {
      setErrorId(leadId);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <Card className="border-[#6B7E54]/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-[#1B2F26]">Jobs to Close Out</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          These jobs may be done &mdash; mark them complete to send a review request.
        </p>
      </CardHeader>
      <CardContent className="divide-y">
        {visible.map((job) => (
          <div key={job.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="font-medium text-sm text-[#1B2F26] truncate">{job.name || 'Unknown'}</p>
              <p className="text-xs text-muted-foreground">
                {job.projectType ? `${job.projectType} · ` : ''}
                Won {formatDistanceToNow(new Date(job.wonAt), { addSuffix: true })}
              </p>
              {errorId === job.id && (
                <p className="text-xs text-[#C15B2E] mt-0.5">Something went wrong &mdash; try again.</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 cursor-pointer border-[#6B7E54]/60 text-[#1B2F26] hover:bg-[#E3E9E1]"
              disabled={loadingId === job.id}
              onClick={() => markComplete(job.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              {loadingId === job.id ? 'Saving\u2026' : 'Mark Complete'}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
