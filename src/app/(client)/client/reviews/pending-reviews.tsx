'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from '@/components/ui/alert-dialog';
import { CheckCircle2, Star, Pencil, X, AlertCircle } from 'lucide-react';

interface PendingResponse {
  id: string;
  reviewId: string;
  responseText: string;
  responseType: string | null;
  status: string | null;
  submittedAt: string | null;
  createdAt: string;
  authorName: string | null;
  rating: number;
  reviewText: string | null;
  source: string;
  reviewDate: string | null;
  aiSuggestedResponse: string | null;
}

interface PendingReviewsProps {
  initialResponses: PendingResponse[];
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? 'fill-[#D4754A] text-[#D4754A]' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function sourceLabel(source: string): string {
  const labels: Record<string, string> = {
    google: 'Google',
    yelp: 'Yelp',
    facebook: 'Facebook',
    bbb: 'BBB',
    angi: 'Angi',
    homeadvisor: 'HomeAdvisor',
    other: 'Other',
  };
  return labels[source] ?? source;
}

export function PendingReviews({ initialResponses }: PendingReviewsProps) {
  const router = useRouter();
  const [responses, setResponses] = useState(initialResponses);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(responseId: string) {
    setApprovingId(responseId);
    setError(null);
    try {
      const res = await fetch(`/api/client/reviews/${responseId}/approve`, { method: 'POST' });
      if (!res.ok) {
        const data: { error?: string } = await res.json();
        setError(data.error ?? 'Failed to approve response.');
        return;
      }
      setResponses((prev) => prev.filter((r) => r.id !== responseId));
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setApprovingId(null);
      setConfirmId(null);
    }
  }

  function startEdit(r: PendingResponse) {
    setEditingId(r.id);
    setEditText(r.responseText);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText('');
  }

  function saveEdit(responseId: string) {
    setResponses((prev) =>
      prev.map((r) => (r.id === responseId ? { ...r, responseText: editText } : r))
    );
    setEditingId(null);
    setEditText('');
  }

  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-[#3D7A50] mb-3" />
          <h3 className="text-lg font-semibold">All caught up</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            No review responses are waiting for approval right now. Check back after the AI drafts new responses.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-[#FDEAE4] rounded p-3 flex gap-2 items-start text-sm">
          <AlertCircle className="h-4 w-4 text-terracotta shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {responses.map((r) => (
        <Card key={r.id}>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{r.authorName || 'Anonymous'}</span>
                  <Badge className="bg-muted text-muted-foreground text-xs">{sourceLabel(r.source)}</Badge>
                  {r.status === 'pending_approval' && (
                    <Badge className="bg-[#FFF3E0] text-terracotta text-xs">Pending approval</Badge>
                  )}
                </div>
                <StarRating rating={r.rating} />
                {r.reviewDate && (
                  <p className="text-xs text-muted-foreground">{formatDate(r.reviewDate)}</p>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Review text */}
            {r.reviewText && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Customer review
                </p>
                <p className="text-sm bg-muted/40 rounded p-3 whitespace-pre-wrap">{r.reviewText}</p>
              </div>
            )}

            {/* AI draft response */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                AI draft response
              </p>
              {editingId === r.id ? (
                <div className="space-y-2">
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={4}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={cancelEdit}>
                      <X className="h-3 w-3 mr-1" />
                      Discard
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(r.id)}
                      className="bg-[#1B2F26] hover:bg-[#1B2F26]/90 text-white"
                    >
                      Save edit
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm bg-[#E3E9E1] rounded p-3 whitespace-pre-wrap">{r.responseText}</p>
              )}
            </div>

            {/* Actions */}
            {editingId !== r.id && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => startEdit(r)}
                  disabled={approvingId === r.id}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  onClick={() => setConfirmId(r.id)}
                  disabled={approvingId === r.id}
                  className="bg-[#1B2F26] hover:bg-[#1B2F26]/90 text-white"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {approvingId === r.id ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={!!confirmId} onOpenChange={(open) => { if (!open) setConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve this response?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the response as approved and queue it for posting to the review platform.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmId && handleApprove(confirmId)}
            >
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
