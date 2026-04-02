'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

interface CalendarIntegration {
  id: string;
  provider: string;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Never synced';
  const date = new Date(lastSyncAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
}

export function CalendarConnection() {
  const [integration, setIntegration] = useState<CalendarIntegration | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Check URL params for OAuth callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === 'google_connected') {
      setSuccessMessage('Google Calendar connected successfully.');
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('success');
      window.history.replaceState({}, '', url.toString());
    }
    const oauthError = params.get('error');
    if (oauthError === 'google_denied') {
      setError('Google Calendar connection was cancelled.');
    } else if (oauthError === 'google_failed') {
      setError('Google Calendar connection failed. Please try again.');
    }
    if (oauthError) {
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const fetchIntegrations = useCallback(async () => {
    try {
      const res = await fetch('/api/client/calendar/integrations');
      if (!res.ok) throw new Error('Failed to load calendar status');
      const data = (await res.json()) as CalendarIntegration[];
      const google = data.find((i) => i.provider === 'google' && i.isActive) ?? null;
      setIntegration(google);
    } catch {
      setError('Unable to load calendar status. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchIntegrations();
  }, [fetchIntegrations]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/client/calendar/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      if (!res.ok) throw new Error('Failed to start connection');
      const data = (await res.json()) as { authUrl: string };
      window.location.href = data.authUrl;
    } catch {
      setError('Could not start Google Calendar connection. Please try again.');
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/client/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Sync failed');
      await fetchIntegrations();
    } catch {
      setError('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/client/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google' }),
      });
      if (!res.ok) throw new Error('Disconnect failed');
      setIntegration(null);
    } catch {
      setError('Could not disconnect. Please try again.');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">Google Calendar</CardTitle>
          {!loading && (
            integration ? (
              <Badge
                style={{
                  backgroundColor: '#E8F5E9',
                  color: '#3D7A50',
                  border: '1px solid #3D7A50',
                }}
              >
                Connected
              </Badge>
            ) : (
              <Badge
                variant="secondary"
                style={{ backgroundColor: '#F1F5F2', color: '#6B7E54' }}
              >
                Not connected
              </Badge>
            )
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading && (
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        )}

        {!loading && successMessage && (
          <div
            className="rounded-md p-3 text-sm"
            style={{ backgroundColor: '#E8F5E9', color: '#3D7A50' }}
          >
            {successMessage}
          </div>
        )}

        {!loading && error && (
          <div
            className="rounded-md p-3 text-sm"
            style={{ backgroundColor: '#FDEAE4', color: '#C15B2E' }}
          >
            {error}
          </div>
        )}

        {!loading && !integration && !error && (
          <p className="text-sm text-muted-foreground">
            Connect your Google Calendar to sync appointments automatically. Your availability will
            be checked before bookings are made.
          </p>
        )}

        {!loading && integration && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Last synced: {formatLastSync(integration.lastSyncAt)}
            </p>
            {integration.lastError && (
              <div
                className="rounded-md p-3 text-sm"
                style={{ backgroundColor: '#FDEAE4', color: '#C15B2E' }}
              >
                <span className="font-medium">Sync error: </span>
                {integration.lastError}
              </div>
            )}
          </div>
        )}

        {!loading && (
          <div className="flex flex-wrap gap-2">
            {!integration ? (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                style={{ backgroundColor: '#1B2F26', color: '#ffffff' }}
                className="hover:opacity-90"
              >
                {connecting ? 'Connecting...' : 'Connect Google Calendar'}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={handleSync}
                  disabled={syncing || disconnecting}
                >
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={syncing || disconnecting}
                      style={{ borderColor: '#C15B2E', color: '#C15B2E' }}
                      className="hover:opacity-80"
                    >
                      {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Disconnect Google Calendar?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will stop syncing your calendar. Existing appointments won&apos;t be
                        affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDisconnect}
                        style={{ backgroundColor: '#C15B2E', color: '#ffffff' }}
                      >
                        Disconnect
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
