'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Send } from 'lucide-react';

type ClientOption = {
  id: string;
  businessName: string;
};

export function SendMessageDialog({
  open,
  onOpenChange,
  clients,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: ClientOption[];
  onSuccess: () => void;
}) {
  const [clientId, setClientId] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'custom' | 'prompt' | 'alert'>('custom');
  const [promptType, setPromptType] = useState('start_sequences');
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [isUrgent, setIsUrgent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !message.trim()) return;

    setSending(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        clientId,
        message: message.trim(),
        type,
      };

      if (type === 'prompt') {
        body.promptType = promptType;
        body.expiresInHours = expiresInHours;
        body.actionPayload = { source: 'admin_ui' };
      }
      if (type === 'alert') {
        body.isUrgent = isUrgent;
      }

      const res = await fetch('/api/admin/agency/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to send');
      }

      setClientId('');
      setMessage('');
      setType('custom');
      setError(null);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Send Message</DialogTitle>
            <DialogDescription>
              Send a message to a client via the agency number
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-4">
            {error && (
              <div className="rounded-md border border-destructive/30 bg-[#FDEAE4] p-3 text-sm text-sienna">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="msg-client">Client</Label>
              <select
                id="msg-client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                required
              >
                <option value="">Select a client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.businessName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <div className="flex gap-2">
                {(['custom', 'prompt', 'alert'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                      type === t
                        ? 'bg-forest text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {type === 'prompt' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="promptType">Prompt Type</Label>
                  <select
                    id="promptType"
                    value={promptType}
                    onChange={(e) => setPromptType(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="start_sequences">Start Sequences</option>
                    <option value="schedule_callback">Schedule Callback</option>
                    <option value="confirm_action">Confirm Action</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expiresIn">Expires In (hours)</Label>
                  <Input
                    id="expiresIn"
                    type="number"
                    value={expiresInHours}
                    onChange={(e) =>
                      setExpiresInHours(parseInt(e.target.value, 10) || 24)
                    }
                    min={1}
                    max={168}
                  />
                </div>
              </>
            )}

            {type === 'alert' && (
              <div className="flex items-center gap-2 text-sm">
                <Switch
                  id="isUrgent"
                  checked={isUrgent}
                  onCheckedChange={setIsUrgent}
                />
                <Label htmlFor="isUrgent" className="font-normal">Mark as urgent (bypasses quiet hours)</Label>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message..."
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={sending || !clientId || !message.trim()}>
              {sending ? (
                'Sending...'
              ) : (
                <>
                  <Send className="size-4" />
                  Send
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
