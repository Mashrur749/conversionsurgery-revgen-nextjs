'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, RefreshCw, AlertTriangle, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

/** Client-side representation of a review from the API. */
interface Review {
  id: string;
  source: string;
  authorName: string | null;
  rating: number;
  reviewText: string | null;
  reviewDate: string | null;
  hasResponse: boolean | null;
  aiSuggestedResponse: string | null;
}

/** Aggregated review summary returned by the reviews API. */
interface ReviewSummary {
  totalReviews: number;
  averageRating: number;
  recentReviews: number;
  needsResponse: number;
}

/** API response shape for the reviews endpoint. */
interface ReviewsApiResponse {
  reviews?: Review[];
  summary?: ReviewSummary;
}

interface ReviewDashboardProps {
  clientId: string;
}

/** Dashboard component for viewing and managing client reviews. */
export function ReviewDashboard({ clientId }: ReviewDashboardProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/reviews`);
      const data = (await res.json()) as ReviewsApiResponse;
      setReviews(data.reviews || []);
      setSummary(data.summary || null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const syncReviews = async () => {
    setSyncing(true);
    try {
      await fetch(`/api/admin/clients/${clientId}/reviews`, { method: 'POST' });
      await fetchReviews();
    } finally {
      setSyncing(false);
    }
  };

  const copyResponse = async (reviewId: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(reviewId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const markResponded = async (reviewId: string) => {
    // Optimistic update
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, hasResponse: true } : r
      )
    );
  };

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const renderStars = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-terracotta text-terracotta'
                : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.averageRating}</div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                {renderStars(Math.round(summary.averageRating))}
                <span>avg rating</span>
              </div>
              <p className="text-xs text-muted-foreground">Across all sources</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{summary.totalReviews}</div>
              <div className="text-sm text-muted-foreground">total reviews</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-[#3D7A50]">
                {summary.recentReviews}
              </div>
              <div className="text-sm text-muted-foreground">last 30 days</div>
              <p className="text-xs text-muted-foreground">New reviews this month</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-terracotta">
                {summary.needsResponse}
              </div>
              <div className="text-sm text-muted-foreground">needs response</div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reviews List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Reviews</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={syncReviews}
            disabled={syncing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Reviews
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading reviews...
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reviews found. Click &quot;Sync Reviews&quot; to fetch.
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className={`p-4 rounded-lg border ${
                    review.rating <= 2
                      ? 'border-destructive/30 bg-[#FDEAE4] dark:bg-red-950/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {renderStars(review.rating)}
                      <Badge variant="outline" className="text-xs">
                        {review.source}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {review.reviewDate
                        ? formatDistanceToNow(new Date(review.reviewDate), {
                            addSuffix: true,
                          })
                        : 'Unknown date'}
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-medium">
                    {review.authorName || 'Anonymous'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {review.reviewText || 'No review text'}
                  </p>

                  {/* Actions for negative reviews */}
                  {review.rating <= 3 && !review.hasResponse && (
                    <div className="mt-3 p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <AlertTriangle className="h-4 w-4 text-terracotta" />
                        Suggested Response
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {review.aiSuggestedResponse || 'Generating...'}
                      </p>
                      {review.aiSuggestedResponse && (
                        <div className="flex gap-2 mt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyResponse(review.id, review.aiSuggestedResponse!)
                            }
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            {copiedId === review.id ? 'Copied!' : 'Copy Response'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => markResponded(review.id)}
                          >
                            Mark Responded
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {review.hasResponse && (
                    <Badge variant="secondary" className="mt-2">
                      Responded
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
