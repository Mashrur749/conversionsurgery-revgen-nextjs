'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface CalendarIntegrationRecord {
  id: string;
  provider: string;
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

interface Props {
  clientId: string;
}

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export function CalendarIntegrationCard({ clientId }: Props) {
  const [integration, setIntegration] = useState<CalendarIntegrationRecord | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [connectLoading, setConnectLoading] = useState(false);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadIntegration = useCallback(async () => {
    try {
      const res = await fetch(`/api/calendar/integrations?clientId=${encodeURIComponent(clientId)}`);
      if (!res.ok) {
        setLoadState('error');
        return;
      }
      const data = await res.json() as CalendarIntegrationRecord[];
      const google = data.find((r) => r.provider === 'google') ?? null;
      setIntegration(google);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [clientId]);

  useEffect(() => {
    void loadIntegration();
  }, [loadIntegration]);

  async function handleConnect() {
    setConnectLoading(true);
    try {
      const res = await fetch('/api/calendar/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, provider: 'google' }),
      });
      if (!res.ok) {
        setConnectLoading(false);
        return;
      }
      const data = await res.json() as { authUrl: string };
      window.location.href = data.authUrl;
    } catch {
      setConnectLoading(false);
    }
  }

  async function handleDisconnect() {
    setDisconnectLoading(true);
    try {
      await fetch('/api/calendar/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, provider: 'google' }),
      });
      setIntegration(null);
    } finally {
      setDisconnectLoading(false);
    }
  }

  async function handleSync() {
    setSyncState('syncing');
    setSyncMessage(null);
    try {
      const res = await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      if (res.ok) {
        setSyncState('success');
        setSyncMessage('Sync completed successfully.');
        await loadIntegration();
      } else {
        const body = await res.json() as { error?: string };
        setSyncState('error');
        setSyncMessage(body.error ?? 'Sync failed. Please try again.');
      }
    } catch {
      setSyncState('error');
      setSyncMessage('Sync failed. Please try again.');
    }
  }

  const isConnected = integration !== null && integration.isActive;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          Google Calendar
        </CardTitle>
        <CardDescription>
          Connect Google Calendar to sync appointments automatically
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection status */}
        <div className="flex items-center gap-2">
          {loadState === 'loading' ? (
            <Badge variant="secondary">Checking status...</Badge>
          ) : loadState === 'error' ? (
            <Badge className="bg-[#FDEAE4] text-[#C15B2E]">Status unavailable</Badge>
          ) : isConnected ? (
            <Badge className="bg-[#E8F5E9] text-[#3D7A50]">Connected</Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>

        {/* Last synced */}
        {isConnected && integration.lastSyncAt && (
          <p className="text-sm text-muted-foreground">
            Last synced: {format(new Date(integration.lastSyncAt), 'MMM d, yyyy h:mm a')}
          </p>
        )}

        {/* Error indicator */}
        {isConnected && integration.lastError && (
          <div className="rounded-md bg-[#FDEAE4] px-3 py-2">
            <p className="text-sm font-medium text-[#C15B2E]">Sync Error</p>
            <p className="text-sm text-[#C15B2E] mt-0.5">{integration.lastError}</p>
          </div>
        )}

        {/* Sync feedback */}
        {syncState === 'success' && syncMessage && (
          <p className="text-sm text-[#3D7A50]">{syncMessage}</p>
        )}
        {syncState === 'error' && syncMessage && (
          <p className="text-sm text-[#C15B2E]">{syncMessage}</p>
        )}

        {/* Actions */}
        {loadState === 'ready' && (
          <div className="flex flex-wrap gap-2">
            {isConnected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncState === 'syncing'}
                >
                  {syncState === 'syncing' ? 'Syncing...' : 'Sync Now'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-[#C15B2E] border-[#C15B2E]/40 hover:bg-[#FDEAE4]"
                  onClick={handleDisconnect}
                  disabled={disconnectLoading}
                >
                  {disconnectLoading ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleConnect}
                disabled={connectLoading}
              >
                {connectLoading ? 'Redirecting...' : 'Connect Google Calendar'}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
