'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface PendingDraft {
  id: string;
  leadName: string | null;
  leadPhone: string;
  content: string;
  assistCategory: string | null;
  assistReferenceCode: string | null;
  assistRequiresManual: boolean;
  sendAt: string;
  createdAt: string;
}

interface ActionResult {
  success: boolean;
  status: string | null;
  reason: string;
}

interface CorrectionRate {
  total: number;
  corrected: number;
  rate: number;
}

interface Props {
  clientId: string;
  correctionRate?: CorrectionRate;
}

function formatTimeRemaining(sendAt: string): string {
  const diff = new Date(sendAt).getTime() - Date.now();
  if (diff <= 0) return 'Due now';
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `Auto-sends in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `Auto-sends in ${hours}h`;
}

function truncateContent(content: string, max = 100): string {
  if (content.length <= max) return content;
  return `${content.slice(0, max - 3)}...`;
}

function CorrectionRateIndicator({ rate }: { rate: CorrectionRate }) {
  const pct = Math.round(rate.rate * 100);

  let colorClass = 'text-foreground';
  let warningText: string | null = null;

  if (pct > 30) {
    colorClass = 'text-[#C15B2E]';
    warningText = 'High correction rate \u2014 review AI settings';
  } else if (pct < 10) {
    colorClass = 'text-[#3D7A50]';
  }

  return (
    <div className="space-y-0.5">
      <p className={`text-sm font-medium ${colorClass}`}>
        Correction Rate: {pct}% ({rate.corrected} of {rate.total} drafts edited)
      </p>
      {warningText && (
        <p className="text-xs text-[#C15B2E]">{warningText}</p>
      )}
    </div>
  );
}

function DraftRow({
  draft,
  onAction,
}: {
  draft: PendingDraft;
  onAction: (draftId: string, action: 'approve' | 'edit' | 'cancel', editedContent?: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(draft.content);
  const [isPending, setIsPending] = useState(false);

  const leadLabel = draft.leadName?.trim() ? draft.leadName.trim() : draft.leadPhone;

  async function handleApprove() {
    setIsPending(true);
    await onAction(draft.id, 'approve');
    setIsPending(false);
  }

  async function handleEditSend() {
    if (!editedContent.trim()) return;
    setIsPending(true);
    await onAction(draft.id, 'edit', editedContent);
    setIsPending(false);
  }

  async function handleCancel() {
    setIsPending(true);
    await onAction(draft.id, 'cancel');
    setIsPending(false);
  }

  return (
    <div className="rounded-lg border border-border bg-white p-4 space-y-3">
      {/* Top row: lead + category + ref */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-[#1B2F26]">{leadLabel}</p>
          {draft.assistReferenceCode && (
            <p className="text-xs text-muted-foreground font-mono">{draft.assistReferenceCode}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {draft.assistCategory && (
            <Badge variant="secondary" className="text-xs capitalize">
              {draft.assistCategory.replace(/_/g, ' ')}
            </Badge>
          )}
          {draft.assistRequiresManual ? (
            <Badge className="bg-[#FFF3E0] text-[#C15B2E] text-xs">Manual only</Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {formatTimeRemaining(draft.sendAt)}
            </Badge>
          )}
        </div>
      </div>

      {/* Message preview or edit textarea */}
      {isEditing ? (
        <Textarea
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={4}
          className="text-sm"
          disabled={isPending}
        />
      ) : (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {truncateContent(draft.content)}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        {isEditing ? (
          <>
            <Button
              size="sm"
              className="bg-[#3D7A50] hover:bg-[#3D7A50]/90 text-white"
              onClick={handleEditSend}
              disabled={isPending || !editedContent.trim()}
            >
              {isPending ? 'Sending...' : 'Send Edited'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                setEditedContent(draft.content);
              }}
              disabled={isPending}
            >
              Discard Edit
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              className="bg-[#3D7A50] hover:bg-[#3D7A50]/90 text-white"
              onClick={handleApprove}
              disabled={isPending}
            >
              {isPending ? 'Sending...' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={isPending}
            >
              Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[#C15B2E] border-[#C15B2E]/40 hover:bg-[#FDEAE4] cursor-pointer"
                  disabled={isPending}
                >
                  Cancel Draft
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The AI draft for {leadLabel} will be discarded and will not be sent.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Draft</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-[#C15B2E] hover:bg-[#C15B2E]/90 text-white"
                    onClick={handleCancel}
                  >
                    Cancel Draft
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>
    </div>
  );
}

export function SmartAssistCard({ clientId, correctionRate }: Props) {
  const [drafts, setDrafts] = useState<PendingDraft[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  const fetchDrafts = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/smart-assist`);
      if (!res.ok) {
        setLoadState('error');
        return;
      }
      const data = await res.json() as { drafts: PendingDraft[] };
      setDrafts(data.drafts);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [clientId]);

  useEffect(() => {
    void fetchDrafts();

    const interval = setInterval(() => {
      void fetchDrafts();
    }, 15_000);

    return () => clearInterval(interval);
  }, [fetchDrafts]);

  async function handleAction(
    draftId: string,
    action: 'approve' | 'edit' | 'cancel',
    editedContent?: string
  ) {
    // Optimistic: remove from list immediately
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/smart-assist/${draftId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...(editedContent !== undefined ? { editedContent } : {}) }),
      });

      if (!res.ok) {
        // Restore draft on failure by re-fetching
        await fetchDrafts();
      }
    } catch {
      // Restore on error
      await fetchDrafts();
    }
  }

  const count = drafts.length;

  // Collapsed state when no pending drafts and loaded
  if (loadState === 'ready' && count === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            Pending Smart Assist Drafts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">No pending drafts</p>
          {correctionRate && correctionRate.total > 0 && (
            <CorrectionRateIndicator rate={correctionRate} />
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[#1B2F26]">
          Pending Drafts
          {loadState === 'ready' && count > 0 && (
            <Badge className="bg-[#FFF3E0] text-[#C15B2E] text-xs font-semibold">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {correctionRate && correctionRate.total > 0 && (
          <div className="pb-1 border-b border-border">
            <CorrectionRateIndicator rate={correctionRate} />
          </div>
        )}
        {loadState === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading drafts...</p>
        )}
        {loadState === 'error' && (
          <p className="text-sm text-[#C15B2E]">Failed to load drafts. Will retry shortly.</p>
        )}
        {loadState === 'ready' && drafts.map((draft) => (
          <DraftRow
            key={draft.id}
            draft={draft}
            onAction={handleAction}
          />
        ))}
      </CardContent>
    </Card>
  );
}
