'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

export function SettingsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (agencyNumber: string) => void;
}) {
  const [agencyNumber, setAgencyNumber] = useState('');
  const [agencyNumberSid, setAgencyNumberSid] = useState('');
  const [configureWebhooks, setConfigureWebhooks] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/agency/settings');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json() as { agencyNumber?: string; agencyNumberSid?: string };
        setAgencyNumber(data.agencyNumber || '');
        setAgencyNumberSid(data.agencyNumberSid || '');
      } catch {
        // leave defaults
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyNumber.trim() || !agencyNumberSid.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/agency/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agencyNumber: agencyNumber.trim(),
          agencyNumberSid: agencyNumberSid.trim(),
          configureWebhooks,
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to save');
      }

      onSaved(agencyNumber.trim());
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Agency Settings</DialogTitle>
            <DialogDescription>
              Configure the Twilio number used for agency communication
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-[#FDEAE4] p-3 text-sm text-sienna">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-3">
                <div className="h-10 animate-pulse rounded bg-muted" />
                <div className="h-10 animate-pulse rounded bg-muted" />
              </div>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Agency Phone Number
                  </label>
                  <input
                    type="tel"
                    value={agencyNumber}
                    onChange={(e) => setAgencyNumber(e.target.value)}
                    placeholder="+1XXXXXXXXXX"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    E.164 format (e.g. +14031234567)
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Number SID
                  </label>
                  <input
                    type="text"
                    value={agencyNumberSid}
                    onChange={(e) => setAgencyNumberSid(e.target.value)}
                    placeholder="PNXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full rounded-md border px-3 py-2 text-sm font-mono"
                    required
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Twilio Phone Number SID (starts with PN)
                  </p>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={configureWebhooks}
                    onChange={(e) => setConfigureWebhooks(e.target.checked)}
                    className="rounded border-border"
                  />
                  Configure webhooks automatically
                </label>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                saving ||
                loading ||
                !agencyNumber.trim() ||
                !agencyNumberSid.trim()
              }
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
