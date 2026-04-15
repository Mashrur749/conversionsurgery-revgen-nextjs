'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, BookOpen, CheckCircle2, Search } from 'lucide-react';

export interface EscalationActionsProps {
  escalationId: string;
  clientId: string;
  reason: string;
  reasonDetails: string | null;
}

interface KbMatch {
  id: string;
  title: string;
  content: string;
  category: string;
  similarity?: number;
}

interface SearchResult {
  found: boolean;
  reason?: string;
  entry?: KbMatch;
}

const SELECT_STYLE =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

const RESOLUTION_LABELS: Record<string, string> = {
  handled: 'Handled directly',
  returned_to_ai: 'Returned to AI',
  no_action: 'No action needed',
  converted: 'Lead converted',
  lost: 'Lead lost',
};

export function EscalationActions({
  escalationId,
  clientId,
  reason,
  reasonDetails,
}: EscalationActionsProps) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('handled');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resolved, setResolved] = useState(false);

  // KB suggestion state — only relevant for complex_technical
  const [kbMatch, setKbMatch] = useState<KbMatch | null>(null);
  const [kbLoading, setKbLoading] = useState(false);
  const [kbExpanded, setKbExpanded] = useState(false);

  const isComplexTechnical = reason === 'complex_technical';

  async function searchKb() {
    if (!reasonDetails) return;
    setKbLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/auto-resolve/search?q=${encodeURIComponent(reasonDetails)}`
      );
      const data = (await res.json()) as SearchResult;
      if (data.found && data.entry) {
        setKbMatch(data.entry);
        setKbExpanded(true);
      }
    } catch {
      // Silent fail — KB suggestion is best-effort
    } finally {
      setKbLoading(false);
    }
  }

  async function handleResolve(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/escalations/${escalationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'resolved',
          resolution,
          resolutionNotes: notes.trim() || undefined,
        }),
      });
      if (res.ok) {
        setResolved(true);
        setOpen(false);
      }
    } catch {
      // Leave open so operator can retry
    } finally {
      setSubmitting(false);
    }
  }

  if (resolved) {
    return (
      <div className="flex items-center gap-1 text-sm text-[#3D7A50]">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>Resolved</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* KB Suggestion — complex_technical only */}
      {isComplexTechnical && (
        <div>
          {!kbLoading && !kbMatch && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-full border-[#6B7E54]/40 text-[#6B7E54] hover:bg-[#E3E9E1]/60 hover:text-[#6B7E54]"
              onClick={searchKb}
            >
              <Search className="h-3.5 w-3.5 mr-1.5 shrink-0" />
              Search KB for suggestion
            </Button>
          )}
          {kbLoading && (
            <div className="h-9 rounded-md border border-[#6B7E54]/40 bg-transparent flex items-center px-3 py-1 animate-pulse">
              <div className="h-3 w-24 rounded bg-muted/50" />
            </div>
          )}
          {!kbLoading && kbMatch && (
            <div className="rounded-md border border-[#6B7E54]/30 bg-[#E3E9E1]/40 text-sm">
              <button
                type="button"
                onClick={() => setKbExpanded((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 font-medium text-[#6B7E54] hover:bg-[#E3E9E1]/60 rounded-t-md"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 shrink-0" />
                  KB suggestion found
                </span>
                {kbExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>
              {kbExpanded && (
                <div className="px-3 pb-3 space-y-1">
                  <p className="font-medium text-foreground">{kbMatch.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {kbMatch.content}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setNotes(`KB answer: ${kbMatch.title}`);
                      setResolution('returned_to_ai');
                      setOpen(true);
                    }}
                    className="mt-1 text-xs font-medium text-[#3D7A50] hover:underline"
                  >
                    Resolve with this answer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resolve toggle */}
      <div>
        {!open ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-[#6B7E54]/40 text-[#6B7E54] hover:bg-[#E3E9E1]/60 hover:text-[#6B7E54]"
            onClick={() => setOpen(true)}
          >
            Resolve
          </Button>
        ) : (
          <form
            onSubmit={handleResolve}
            className="rounded-md border border-border p-3 space-y-2 bg-background"
          >
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Resolution type
              </label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className={SELECT_STYLE}
                required
              >
                {Object.entries(RESOLUTION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Notes (optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add context&hellip;"
                maxLength={2000}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="bg-[#3D7A50] hover:bg-[#3D7A50]/90 text-white"
              >
                {submitting ? 'Saving&hellip;' : 'Resolve'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={submitting}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
