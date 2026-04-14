'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { formatPhoneNumber } from '@/lib/utils/phone';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { LEAD_STATUSES, LEAD_TEMPERATURES, TEMPERATURE_COLORS } from '@/lib/constants/leads';
import { LeadNavigation } from './lead-navigation';
import { LeadScoreBadge } from '@/components/leads/lead-score-badge';
import type { Lead } from '@/db/schema/leads';

const CONVERSATION_MODE_STYLES: Record<string, string> = {
  ai: 'bg-[#6B7E54]/15 text-[#6B7E54]',
  human: 'bg-[#1B2F26]/15 text-[#1B2F26]',
  paused: 'bg-muted text-muted-foreground',
};

const CONVERSATION_MODE_LABELS: Record<string, string> = {
  ai: 'AI',
  human: 'Human',
  paused: 'Paused',
};

const STAGE_STYLES: Record<string, string> = {
  proposing: 'bg-[#6B7E54]/15 text-[#6B7E54]',
  educating: 'bg-[#6B7E54]/15 text-[#6B7E54]',
  objection_handling: 'bg-[#FFF3E0] text-[#C15B2E]',
  booked: 'bg-[#E8F5E9] text-[#3D7A50]',
  closing: 'bg-[#E8F5E9] text-[#3D7A50]',
  lost: 'bg-[#FDEAE4] text-[#C15B2E]',
};

export interface LeadHeaderProps {
  lead: Lead;
  conversationStage?: string | null;
  scores?: {
    urgency: number;
    budget: number;
    intent: number;
    composite: number;
  } | null;
  decisionMakers?: {
    primary?: string;
    secondary?: string;
    secondaryConsulted: boolean;
    partnerApprovalNeeded: boolean;
  } | null;
}

export function LeadHeader({ lead, conversationStage, scores, decisionMakers }: LeadHeaderProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const currentMode = (lead.conversationMode as string) || 'ai';

  async function toggleConversationMode() {
    const newMode = currentMode === 'human' ? 'ai' : 'human';
    setModeLoading(true);
    try {
      await fetch(`/api/admin/leads/${lead.id}/conversation-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      router.refresh();
    } finally {
      setModeLoading(false);
    }
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {lead.name || formatPhoneNumber(lead.phone)}
            </h1>
            <LeadNavigation currentLeadId={lead.id} />
          </div>
          <p className="text-muted-foreground">{formatPhoneNumber(lead.phone)}</p>
          {lead.email && <p className="text-muted-foreground">{lead.email}</p>}
          {lead.source && (
            <Badge variant="outline" className="mt-1">{lead.source}</Badge>
          )}
          {conversationStage && conversationStage !== 'greeting' && (
            <Badge
              variant="outline"
              className={`mt-1 capitalize ${STAGE_STYLES[conversationStage] ?? ''}`}
            >
              Stage: {conversationStage.replace(/_/g, ' ')}
            </Badge>
          )}
          {scores && (
            <div className="mt-2">
              <LeadScoreBadge
                score={scores.composite}
                temperature={(lead.temperature as 'hot' | 'warm' | 'cold') ?? 'cold'}
                factors={{
                  urgency: scores.urgency,
                  budget: scores.budget,
                  intent: scores.intent,
                  engagement: 0,
                  signals: [],
                }}
                compact
              />
            </div>
          )}
          {decisionMakers?.partnerApprovalNeeded && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
              <span>
                Partner involved{decisionMakers.secondary ? `: ${decisionMakers.secondary}` : ''}
              </span>
              {decisionMakers.secondaryConsulted ? (
                <Badge variant="outline" className="bg-[#E8F5E9] text-[#3D7A50] text-xs">Consulted</Badge>
              ) : (
                <Badge variant="outline" className="bg-[#FFF3E0] text-[#C15B2E] text-xs">Not yet consulted</Badge>
              )}
            </div>
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

          <Badge className={CONVERSATION_MODE_STYLES[currentMode] || CONVERSATION_MODE_STYLES.ai}>
            {CONVERSATION_MODE_LABELS[currentMode] || 'AI'}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            disabled={modeLoading}
            onClick={toggleConversationMode}
          >
            {modeLoading ? 'Switching...' : currentMode === 'human' ? 'Hand Back to AI' : 'Take Over'}
          </Button>

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
          <label className="text-muted-foreground text-xs">
            {lead.status === 'won' ? 'Confirmed Revenue' : 'Confirmed Revenue'}
          </label>
          <Input
            type="number"
            defaultValue={
              typeof lead.confirmedRevenue === 'number'
                ? Math.round(lead.confirmedRevenue / 100)
                : ''
            }
            onBlur={(e) => {
              const val = e.target.value ? Number(e.target.value) : null;
              updateField('confirmedRevenue', val);
            }}
            placeholder="$0"
            className={`h-8 mt-1${lead.status === 'won' || lead.status === 'completed' ? ' border-[#3D7A50] ring-1 ring-[#3D7A50]/30' : ''}`}
          />
          {(lead.status === 'won' || lead.status === 'completed') && (
            <p className="text-xs text-[#3D7A50] mt-0.5">Actual job value (dollars)</p>
          )}
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
