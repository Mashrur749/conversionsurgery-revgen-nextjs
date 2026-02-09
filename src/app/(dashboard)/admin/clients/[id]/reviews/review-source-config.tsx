'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface ReviewSource {
  id: string;
  source: string;
  isActive: boolean;
  googlePlaceId: string | null;
  totalReviews: number | null;
  averageRating: number | null;
  lastFetchedAt: string | null;
  lastError: string | null;
}

interface ReviewSourceConfigProps {
  clientId: string;
  businessName: string;
}

export function ReviewSourceConfig({ clientId, businessName }: ReviewSourceConfigProps) {
  const [sources, setSources] = useState<ReviewSource[]>([]);
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchSources = useCallback(async () => {
    const res = await fetch(`/api/admin/clients/${clientId}/reviews/sources`);
    const data = (await res.json()) as { sources?: ReviewSource[] };
    setSources(data.sources || []);

    const googleSource = (data.sources || []).find((s) => s.source === 'google');
    if (googleSource?.googlePlaceId) {
      setGooglePlaceId(googleSource.googlePlaceId);
    }
  }, [clientId]);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const linkGoogleBusiness = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/reviews/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'google',
          placeId: googlePlaceId || undefined,
          businessName: !googlePlaceId ? businessName : undefined,
        }),
      });

      const data = (await res.json()) as { error?: string; googlePlaceId?: string };

      if (!res.ok) {
        setError(data.error || 'Failed to link Google Business');
        return;
      }

      if (data.googlePlaceId) {
        setGooglePlaceId(data.googlePlaceId);
      }

      setSuccess(true);
      await fetchSources();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const googleSource = sources.find((s) => s.source === 'google');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Sources</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Google Business Profile</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder="Google Place ID (leave empty to auto-detect)"
              value={googlePlaceId}
              onChange={(e) => setGooglePlaceId(e.target.value)}
            />
            <Button onClick={linkGoogleBusiness} disabled={loading}>
              {loading
                ? 'Linking...'
                : googleSource
                ? 'Update'
                : 'Link'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Leave empty and we&apos;ll try to find your business automatically
            based on &quot;{businessName}&quot;.
          </p>

          {error && (
            <p className="text-xs text-red-600 mt-1">{error}</p>
          )}
          {success && (
            <p className="text-xs text-green-600 mt-1">
              Google Business linked successfully!
            </p>
          )}
        </div>

        {/* Show linked sources */}
        {sources.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Connected Sources</p>
            {sources.map((source) => (
              <div
                key={source.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge
                    variant={source.isActive ? 'default' : 'secondary'}
                  >
                    {source.source}
                  </Badge>
                  {source.averageRating && (
                    <span className="text-muted-foreground">
                      {source.averageRating.toFixed(1)} avg
                    </span>
                  )}
                  {source.totalReviews != null && (
                    <span className="text-muted-foreground">
                      ({source.totalReviews} reviews)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {source.lastError && (
                    <span className="text-xs text-red-500">Error</span>
                  )}
                  {source.lastFetchedAt && (
                    <span className="text-xs text-muted-foreground">
                      Last synced:{' '}
                      {new Date(source.lastFetchedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
