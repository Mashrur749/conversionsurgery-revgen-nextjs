'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Job {
  job: {
    id: string;
    status: string | null;
    quoteAmount: number | null;
    finalAmount: number | null;
    paidAmount: number | null;
    createdAt: Date | null;
  };
  leadName: string | null;
  leadPhone: string | null;
}

interface Props {
  clientId: string;
  jobs: Job[];
}

const statusColors: Record<string, string> = {
  lead: 'bg-muted text-foreground',
  quoted: 'bg-sage-light text-forest',
  won: 'bg-[#E8F5E9] text-[#3D7A50]',
  lost: 'bg-[#FDEAE4] text-sienna',
  completed: 'bg-moss-light text-olive',
};

export function JobsList({ clientId, jobs }: Props) {
  const router = useRouter();
  const [updating, setUpdating] = useState<string | null>(null);

  async function updateStatus(jobId: string, status: string) {
    setUpdating(jobId);

    await fetch(`/api/admin/clients/${clientId}/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_status',
        status,
        quoteAmount: status === 'quoted' ? undefined : undefined,
        finalAmount: status === 'won' ? undefined : undefined,
      }),
    });

    setUpdating(null);
    router.refresh();
  }

  function formatMoney(cents: number | null): string {
    if (!cents) return '-';
    return `$${(cents / 100).toLocaleString()}`;
  }

  return (
    <div className="space-y-2">
      {jobs.map(({ job, leadName, leadPhone }) => (
        <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex-1">
            <p className="font-medium">{leadName || leadPhone || 'Unknown'}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={statusColors[job.status || 'lead']}>
                {job.status || 'lead'}
              </Badge>
              {job.quoteAmount && (
                <span className="text-sm text-muted-foreground">
                  Quote: {formatMoney(job.quoteAmount)}
                </span>
              )}
              {job.finalAmount && (
                <span className="text-sm text-[#3D7A50]">
                  Won: {formatMoney(job.finalAmount)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={job.status || 'lead'}
              onValueChange={(v) => updateStatus(job.id, v)}
              disabled={updating === job.id}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead">Lead</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      ))}

      {jobs.length === 0 && (
        <p className="text-center text-muted-foreground py-8">
          No jobs tracked yet. Jobs are created when leads progress through the pipeline.
        </p>
      )}
    </div>
  );
}
