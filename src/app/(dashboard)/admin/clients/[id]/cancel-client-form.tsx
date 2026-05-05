'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Ban, RotateCcw } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CANCEL_TYPES,
  CANCEL_REASON_CATEGORIES,
  type CancelType,
  type CancelReasonCategory,
} from '@/db/schema';

interface Props {
  clientId: string;
  clientName: string;
  status: string | null;
}

const CANCEL_TYPE_LABELS: Record<CancelType, string> = {
  day_14: 'Day-14 cancel right',
  mid_term_guarantee: 'Mid-term — guarantee invoked',
  mid_term_breach: 'Mid-term — breach',
  post_term_30day: 'Post-term (30-day notice)',
  other: 'Other',
};

const REASON_CATEGORY_LABELS: Record<CancelReasonCategory, string> = {
  cost: 'Cost / pricing',
  not_delivering_results: 'Not delivering results',
  scope_mismatch: 'Scope mismatch',
  personal_business_change: 'Personal or business change',
  competitor_chosen: 'Chose a competitor',
  tech_issues: 'Tech issues',
  other: 'Other',
};

export function CancelClientForm({ clientId, clientName, status }: Props) {
  const router = useRouter();
  const isCancelled = status === 'cancelled';

  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [cancelType, setCancelType] = useState<CancelType | ''>('');
  const [reasonCategory, setReasonCategory] = useState<CancelReasonCategory | ''>('');
  const [notes, setNotes] = useState('');

  function resetForm() {
    setCancelType('');
    setReasonCategory('');
    setNotes('');
    setError('');
  }

  async function handleReactivate() {
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Failed to reactivate client');
        setIsSubmitting(false);
        return;
      }
      router.refresh();
      setOpen(false);
      setIsSubmitting(false);
    } catch (err) {
      console.error('Reactivate error:', err);
      setError('Failed to reactivate client');
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!cancelType || !reasonCategory) {
      setError('Cancel type and reason category are required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancelType,
          reasonCategory,
          notes: notes.trim() ? notes.trim() : null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error || 'Failed to cancel client');
        setIsSubmitting(false);
        return;
      }
      router.refresh();
      setOpen(false);
      resetForm();
      setIsSubmitting(false);
    } catch (err) {
      console.error('Cancel error:', err);
      setError('Failed to cancel client');
      setIsSubmitting(false);
    }
  }

  if (isCancelled) {
    return (
      <>
        {error && (
          <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded mb-2">
            {error}
          </div>
        )}
        <Button
          variant="outline"
          className="w-full border-forest-light/30 text-forest hover:bg-sage-light"
          onClick={() => setOpen(true)}
          disabled={isSubmitting}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reactivate Client
        </Button>
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setError('');
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reactivate {clientName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will restore the client to active status. They will resume
                receiving calls and messages.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReactivate} disabled={isSubmitting}>
                {isSubmitting ? 'Reactivating...' : 'Reactivate Client'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </>
    );
  }

  return (
    <>
      {error && !open && (
        <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded mb-2">
          {error}
        </div>
      )}
      <Button
        variant="destructive"
        className="w-full"
        onClick={() => setOpen(true)}
        disabled={isSubmitting}
      >
        <Ban className="w-4 h-4 mr-2" />
        Cancel Client
      </Button>

      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            resetForm();
          }
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {clientName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Capture a structured reason. This data feeds churn analysis &amp;
              offer iteration. Day-14 cancels are the highest-signal feedback
              we collect &mdash; don&apos;t skip it.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="cancel-type">Cancel type</Label>
              {/* Native select per Learned Rule 3 — Radix Select breaks FormData */}
              <select
                id="cancel-type"
                value={cancelType}
                onChange={(e) => setCancelType(e.target.value as CancelType | '')}
                disabled={isSubmitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select cancel type...</option>
                {CANCEL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {CANCEL_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason-category">Reason category</Label>
              <select
                id="reason-category"
                value={reasonCategory}
                onChange={(e) =>
                  setReasonCategory(e.target.value as CancelReasonCategory | '')
                }
                disabled={isSubmitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select reason...</option>
                {CANCEL_REASON_CATEGORIES.map((r) => (
                  <option key={r} value={r}>
                    {REASON_CATEGORY_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cancel-notes">
                Notes <span className="text-muted-foreground">(optional, encouraged)</span>
              </Label>
              <Textarea
                id="cancel-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did they actually say? Quote them if you can."
                rows={4}
                maxLength={4000}
                disabled={isSubmitting}
              />
            </div>

            {error && (
              <div className="p-3 text-sm text-destructive bg-[#FDEAE4] rounded">
                {error}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Keep Active</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleCancel}
              disabled={isSubmitting || !cancelType || !reasonCategory}
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Cancel'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
