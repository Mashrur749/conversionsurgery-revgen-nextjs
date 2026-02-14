'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { LEAD_STATUSES, LEAD_TEMPERATURES, TEMPERATURE_COLORS } from '@/lib/constants/leads';
import type { Lead } from '@/db/schema/leads';

interface LeadHeaderProps {
  lead: Lead;
}

export function LeadHeader({ lead }: LeadHeaderProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function updateField(field: string, value: string | number | null) {
    setSaving(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {lead.name || formatPhoneNumber(lead.phone)}
          </h1>
          <p className="text-muted-foreground">{formatPhoneNumber(lead.phone)}</p>
          {lead.email && <p className="text-muted-foreground">{lead.email}</p>}
          {lead.source && (
            <Badge variant="outline" className="mt-1">{lead.source}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={lead.status || 'new'}
            onValueChange={(v) => updateField('status', v)}
          >
            <SelectTrigger className="w-[170px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={lead.temperature || 'warm'}
            onValueChange={(v) => updateField('temperature', v)}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_TEMPERATURES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TEMPERATURE_COLORS[t.value]}`}>{t.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {lead.actionRequired && (
            <Badge variant="destructive">Action Required</Badge>
          )}
          {saving && <span className="text-xs text-muted-foreground">Saving...</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div>
          <label className="text-muted-foreground text-xs">Project Type</label>
          <Input
            defaultValue={lead.projectType || ''}
            onBlur={(e) => {
              if (e.target.value !== (lead.projectType || '')) {
                updateField('projectType', e.target.value || null);
              }
            }}
            placeholder="e.g. Kitchen Renovation"
            className="h-8 mt-1"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-xs">Quote Value</label>
          <Input
            type="number"
            defaultValue={''}
            onBlur={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              updateField('quoteValue', val);
            }}
            placeholder="$0"
            className="h-8 mt-1"
          />
        </div>
        <div>
          <label className="text-muted-foreground text-xs">Created</label>
          <p className="text-sm font-medium mt-1">
            {lead.createdAt && format(new Date(lead.createdAt), 'MMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>

      <div>
        <label className="text-muted-foreground text-xs">Notes</label>
        <Textarea
          defaultValue={lead.notes || ''}
          onBlur={(e) => {
            if (e.target.value !== (lead.notes || '')) {
              updateField('notes', e.target.value || null);
            }
          }}
          placeholder="Add notes..."
          rows={2}
          className="mt-1"
        />
      </div>
    </div>
  );
}
