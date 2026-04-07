'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import type { IntegrationWebhook } from '@/db/schema';
import { formatDistanceToNow } from 'date-fns';

const NATIVE_SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring';

type Provider = 'jobber' | 'servicetitan' | 'housecall_pro' | 'zapier' | 'generic';
type Direction = 'outbound' | 'inbound';

const PROVIDER_LABELS: Record<Provider, string> = {
  jobber: 'Jobber',
  servicetitan: 'ServiceTitan',
  housecall_pro: 'Housecall Pro',
  zapier: 'Zapier',
  generic: 'Generic',
};

const PROVIDER_EVENTS: Record<Provider, Record<Direction, string[]>> = {
  jobber: {
    outbound: ['appointment_booked', 'lead_won'],
    inbound: ['job_completed'],
  },
  servicetitan: {
    outbound: ['appointment_booked', 'lead_won'],
    inbound: ['job_completed'],
  },
  housecall_pro: {
    outbound: ['appointment_booked', 'lead_won'],
    inbound: ['job_completed'],
  },
  zapier: {
    outbound: ['appointment_booked', 'lead_won', 'review_requested'],
    inbound: ['job_completed', 'payment_received'],
  },
  generic: {
    outbound: [],
    inbound: [],
  },
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider as Provider] ?? provider;
}

function relativeTime(date: Date | string | null): string {
  if (!date) return 'Never';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

interface CreateFormState {
  provider: Provider;
  direction: Direction;
  eventType: string;
  webhookUrl: string;
  secretKey: string;
  secretVisible: boolean;
}

const DEFAULT_FORM: CreateFormState = {
  provider: 'jobber',
  direction: 'outbound',
  eventType: '',
  webhookUrl: '',
  secretKey: '',
  secretVisible: false,
};

interface Props {
  clientId: string;
}

export function IntegrationsCard({ clientId }: Props) {
  const [webhooks, setWebhooks] = useState<IntegrationWebhook[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/integrations`);
      if (!res.ok) {
        setLoadState('error');
        return;
      }
      const data = await res.json() as { webhooks: IntegrationWebhook[] };
      setWebhooks(data.webhooks);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [clientId]);

  useEffect(() => {
    void fetchWebhooks();
  }, [fetchWebhooks]);

  async function handleToggle(webhook: IntegrationWebhook) {
    setTogglingId(webhook.id);
    try {
      await fetch(`/api/admin/clients/${clientId}/integrations/${webhook.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !webhook.enabled }),
      });
      await fetchWebhooks();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(webhookId: string) {
    await fetch(`/api/admin/clients/${clientId}/integrations/${webhookId}`, {
      method: 'DELETE',
    });
    await fetchWebhooks();
  }

  function getEventOptions(): string[] {
    const events = PROVIDER_EVENTS[form.provider]?.[form.direction] ?? [];
    return events;
  }

  function handleProviderChange(provider: Provider) {
    const events = PROVIDER_EVENTS[provider]?.[form.direction] ?? [];
    setForm((prev) => ({
      ...prev,
      provider,
      eventType: events[0] ?? '',
    }));
  }

  function handleDirectionChange(direction: Direction) {
    const events = PROVIDER_EVENTS[form.provider]?.[direction] ?? [];
    setForm((prev) => ({
      ...prev,
      direction,
      eventType: events[0] ?? '',
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    try {
      const payload: Record<string, string> = {
        provider: form.provider,
        direction: form.direction,
        eventType: form.eventType,
      };
      if (form.webhookUrl) payload.webhookUrl = form.webhookUrl;
      if (form.secretKey) payload.secretKey = form.secretKey;

      const res = await fetch(`/api/admin/clients/${clientId}/integrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to save');
      }

      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchWebhooks();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const eventOptions = getEventOptions();
  const isGeneric = form.provider === 'generic';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            Integrations
            {loadState === 'ready' && webhooks.length > 0 && (
              <Badge variant="secondary">{webhooks.length}</Badge>
            )}
          </span>
          {!showForm && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowForm(true)}
              className="cursor-pointer"
            >
              Add Integration
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Loading / error */}
        {loadState === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading integrations&hellip;</p>
        )}
        {loadState === 'error' && (
          <p className="text-sm text-[#C15B2E]">Failed to load integrations.</p>
        )}

        {/* Empty state */}
        {loadState === 'ready' && webhooks.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">
            No integrations configured. Add a Jobber webhook during onboarding if the contractor uses Jobber.
          </p>
        )}

        {/* Webhook list */}
        {loadState === 'ready' && webhooks.length > 0 && (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="rounded-lg border p-3 space-y-2"
              >
                {/* Top row: provider + direction + enabled toggle */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{providerLabel(wh.provider)}</span>
                    <Badge
                      className={
                        wh.direction === 'outbound'
                          ? 'bg-[#E8F5E9] text-[#3D7A50]'
                          : 'bg-[#EEF2FF] text-[#4F46E5]'
                      }
                    >
                      {wh.direction === 'outbound' ? 'Outbound' : 'Inbound'}
                    </Badge>
                    {wh.failureCount > 0 && (
                      <Badge className="bg-[#FDEAE4] text-[#C15B2E]">
                        {wh.failureCount} failure{wh.failureCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={wh.enabled}
                      onCheckedChange={() => void handleToggle(wh)}
                      disabled={togglingId === wh.id}
                      className="cursor-pointer"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#C15B2E] hover:bg-[#FDEAE4] cursor-pointer"
                        >
                          Remove
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove integration?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently remove the {providerLabel(wh.provider)} {wh.eventType} webhook. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="cursor-pointer">Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => void handleDelete(wh.id)}
                            className="bg-[#C15B2E] hover:bg-[#A04825] cursor-pointer"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {/* Event type */}
                <p className="text-sm text-muted-foreground">
                  Event: <span className="font-mono">{wh.eventType}</span>
                </p>

                {/* URL */}
                {wh.webhookUrl && (
                  <p
                    className="text-xs text-muted-foreground truncate max-w-xs"
                    title={wh.webhookUrl}
                  >
                    URL: {wh.webhookUrl}
                  </p>
                )}

                {/* Last triggered + failure */}
                <p className="text-xs text-muted-foreground">
                  Last triggered: {relativeTime(wh.lastTriggeredAt)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Add Integration form */}
        {showForm && (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <h4 className="text-sm font-semibold">New Integration</h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Provider */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Provider</label>
                <select
                  className={NATIVE_SELECT_CLASS}
                  value={form.provider}
                  onChange={(e) => handleProviderChange(e.target.value as Provider)}
                >
                  <option value="jobber">Jobber</option>
                  <option value="servicetitan">ServiceTitan</option>
                  <option value="housecall_pro">Housecall Pro</option>
                  <option value="zapier">Zapier</option>
                  <option value="generic">Generic</option>
                </select>
              </div>

              {/* Direction */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Direction</label>
                <select
                  className={NATIVE_SELECT_CLASS}
                  value={form.direction}
                  onChange={(e) => handleDirectionChange(e.target.value as Direction)}
                >
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </div>
            </div>

            {/* Event type */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Event Type</label>
              {isGeneric ? (
                <Input
                  placeholder="e.g. appointment_booked"
                  value={form.eventType}
                  onChange={(e) => setForm((prev) => ({ ...prev, eventType: e.target.value }))}
                />
              ) : (
                <select
                  className={NATIVE_SELECT_CLASS}
                  value={form.eventType}
                  onChange={(e) => setForm((prev) => ({ ...prev, eventType: e.target.value }))}
                >
                  {eventOptions.length === 0 ? (
                    <option value="" disabled>No events for this combination</option>
                  ) : (
                    eventOptions.map((evt) => (
                      <option key={evt} value={evt}>
                        {evt}
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>

            {/* Webhook URL */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Webhook URL {form.direction === 'outbound' && <span className="text-[#C15B2E]">*</span>}
              </label>
              <Input
                type="url"
                placeholder="https://example.com/webhook"
                value={form.webhookUrl}
                onChange={(e) => setForm((prev) => ({ ...prev, webhookUrl: e.target.value }))}
              />
            </div>

            {/* Secret key */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Secret Key (optional)</label>
              <div className="flex gap-2">
                <Input
                  type={form.secretVisible ? 'text' : 'password'}
                  placeholder="HMAC signing secret"
                  value={form.secretKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, secretKey: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((prev) => ({ ...prev, secretVisible: !prev.secretVisible }))}
                  className="cursor-pointer"
                >
                  {form.secretVisible ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>

            {saveError && (
              <p className="text-sm text-[#C15B2E]">{saveError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !form.eventType}
                className="cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  setForm(DEFAULT_FORM);
                  setSaveError('');
                }}
                className="cursor-pointer"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
