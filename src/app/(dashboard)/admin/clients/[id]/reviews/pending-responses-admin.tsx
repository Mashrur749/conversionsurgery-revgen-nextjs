'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Star, CheckCircle, Forward, Edit2, X } from 'lucide-react';

interface PendingResponse {
  id: string;
  reviewId: string;
  responseText: string;
  status: string | null;
  authorName: string | null;
  rating: number | null;
  reviewText: string | null;
  createdAt: string;
}

interface Props {
  clientId: string;
  responses: PendingResponse[];
}

export function PendingResponsesAdmin({ clientId, responses: initial }: Props) {
  const [responses, setResponses] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  if (responses.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center">
          <CheckCircle className="h-5 w-5 text-[#3D7A50] mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No pending review responses</p>
        </CardContent>
      </Card>
    );
  }

  const positiveResponses = responses.filter(r => (r.rating ?? 0) >= 3);

  async function approveOne(responseId: string, updatedText?: string) {
    setLoading(responseId);
    try {
      if (updatedText) {
        await fetch(`/api/admin/clients/${clientId}/reviews/${responseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ responseText: updatedText }),
        });
      }
      const res = await fetch(`/api/admin/clients/${clientId}/reviews/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseIds: [responseId] }),
      });
      if (res.ok) {
        setResponses(prev => prev.filter(r => r.id !== responseId));
        setEditingId(null);
      }
    } finally {
      setLoading(null);
    }
  }

  async function approveAllPositive() {
    if (positiveResponses.length === 0) return;
    setBatchLoading(true);
    try {
      const ids = positiveResponses.map(r => r.id);
      const res = await fetch(`/api/admin/clients/${clientId}/reviews/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseIds: ids }),
      });
      if (res.ok) {
        setResponses(prev => prev.filter(r => !ids.includes(r.id)));
      }
    } finally {
      setBatchLoading(false);
    }
  }

  async function forwardToClient(responseId: string) {
    setLoading(responseId);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/reviews/forward`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseId }),
      });
      if (res.ok) {
        setResponses(prev => prev.filter(r => r.id !== responseId));
      }
    } finally {
      setLoading(null);
    }
  }

  function renderStars(rating: number | null) {
    const r = rating ?? 0;
    return (
      <span className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`h-3.5 w-3.5 ${i < r ? 'fill-[#D4754A] text-[#D4754A]' : 'text-muted-foreground/30'}`}
          />
        ))}
      </span>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Pending Responses
            <Badge variant="secondary" className="ml-2">{responses.length}</Badge>
          </CardTitle>
        </div>
        {positiveResponses.length > 0 && (
          <Button
            size="sm"
            onClick={approveAllPositive}
            disabled={batchLoading}
          >
            {batchLoading ? 'Approving...' : `Approve All Positive (${positiveResponses.length})`}
          </Button>
        )}
      </CardHeader>
      <CardContent className="divide-y">
        {responses.map((r) => (
          <div key={r.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
            {/* Review header */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.authorName || 'Anonymous'}</span>
                  {renderStars(r.rating)}
                  <Badge variant={(r.rating ?? 0) >= 3 ? 'default' : 'destructive'} className="text-xs">
                    {(r.rating ?? 0) >= 3 ? 'Positive' : 'Negative'}
                  </Badge>
                </div>
                {r.reviewText && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.reviewText}</p>
                )}
              </div>
            </div>

            {/* AI response (editable) */}
            {editingId === r.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveOne(r.id, editText)}
                    disabled={loading === r.id}
                  >
                    <CheckCircle className="h-3.5 w-3.5 mr-1" />
                    {loading === r.id ? 'Posting...' : 'Save & Post'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-sm text-muted-foreground italic">{r.responseText}</p>
              </div>
            )}

            {/* Actions */}
            {editingId !== r.id && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => approveOne(r.id)}
                  disabled={loading === r.id}
                >
                  <CheckCircle className="h-3.5 w-3.5 mr-1" />
                  {loading === r.id ? 'Posting...' : 'Approve & Post'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingId(r.id); setEditText(r.responseText); }}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                {(r.rating ?? 0) <= 2 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => forwardToClient(r.id)}
                    disabled={loading === r.id}
                  >
                    <Forward className="h-3.5 w-3.5 mr-1" /> Forward to Client
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
