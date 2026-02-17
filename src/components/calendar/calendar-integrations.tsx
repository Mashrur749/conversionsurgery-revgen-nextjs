'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, CheckCircle, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

/** Shape of a calendar integration returned by the API */
interface Integration {
  id: string;
  provider: 'google' | 'jobber' | 'servicetitan' | 'housecall_pro' | 'outlook';
  isActive: boolean;
  syncEnabled: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** Provider metadata for the UI display list */
interface ProviderInfo {
  id: string;
  name: string;
  icon: string;
  comingSoon?: boolean;
}

/** API response shape for the connect (OAuth) endpoint */
interface ConnectResponse {
  authUrl?: string;
  error?: string;
}

const PROVIDERS: ProviderInfo[] = [
  { id: 'google', name: 'Google Calendar', icon: '📅' },
  { id: 'jobber', name: 'Jobber', icon: '🔧', comingSoon: true },
  { id: 'servicetitan', name: 'ServiceTitan', icon: '⚙️', comingSoon: true },
  { id: 'housecall_pro', name: 'Housecall Pro', icon: '🏠', comingSoon: true },
];

interface CalendarIntegrationsProps {
  clientId: string;
}

/**
 * Calendar integrations management card.
 * Displays connected and available calendar providers with connect/disconnect/sync controls.
 */
export function CalendarIntegrations({ clientId }: CalendarIntegrationsProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  /** Fetch the list of calendar integrations for this client */
  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/calendar/integrations?clientId=${clientId}`
      );
      if (!res.ok) {
        console.error('[CalendarIntegrations] Failed to fetch integrations:', res.status);
        return;
      }
      const data: Integration[] = await res.json();
      setIntegrations(data);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  /** Initiate OAuth connection for a given provider */
  const connect = async (provider: string) => {
    try {
      const res = await fetch('/api/calendar/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, provider }),
      });
      const data: ConnectResponse = await res.json();

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch {
      toast.error('Failed to start connection');
    }
  };

  /** Disconnect (soft-delete) a calendar integration */
  const disconnect = async (integrationId: string) => {
    if (!confirm('Disconnect this calendar? Events will stop syncing.'))
      return;

    try {
      await fetch(`/api/calendar/integrations/${integrationId}`, {
        method: 'DELETE',
      });
      await fetchIntegrations();
      toast.success('Calendar disconnected');
    } catch {
      toast.error('Failed to disconnect');
    }
  };

  /** Trigger a full sync for the client */
  const sync = async (provider: string) => {
    setSyncing(provider);
    try {
      await fetch('/api/calendar/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      await fetchIntegrations();
      toast.success('Calendar synced!');
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(null);
    }
  };

  /** Find an existing integration by provider id */
  const getIntegration = (provider: string): Integration | undefined =>
    integrations.find((i) => i.provider === provider);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Calendar Integrations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading integrations...
          </div>
        ) : (
          PROVIDERS.map((provider) => {
            const integration = getIntegration(provider.id);
            const isConnected = integration?.isActive;

            return (
              <div
                key={provider.id}
                className="flex items-center justify-between p-4 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <p className="font-medium">{provider.name}</p>
                    {isConnected ? (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-3 w-3 text-[#3D7A50]" />
                        <span className="text-[#3D7A50]">Connected</span>
                        {integration.lastSyncAt && (
                          <span className="text-muted-foreground">
                            · Synced{' '}
                            {formatDistanceToNow(
                              new Date(integration.lastSyncAt),
                              { addSuffix: true }
                            )}
                          </span>
                        )}
                      </div>
                    ) : provider.comingSoon ? (
                      <Badge variant="secondary">Coming Soon</Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        Not connected
                      </span>
                    )}
                    {integration?.lastError && (
                      <p className="text-xs text-destructive mt-1">
                        Error: {integration.lastError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sync(provider.id)}
                        disabled={syncing === provider.id}
                      >
                        {syncing === provider.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => disconnect(integration.id)}
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : !provider.comingSoon ? (
                    <Button onClick={() => connect(provider.id)}>
                      Connect
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
