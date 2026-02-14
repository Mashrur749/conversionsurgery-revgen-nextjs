'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Client</label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm"
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
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {type === 'prompt' && (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Prompt Type
                  </label>
                  <select
                    value={promptType}
                    onChange={(e) => setPromptType(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <option value="start_sequences">Start Sequences</option>
                    <option value="schedule_callback">Schedule Callback</option>
                    <option value="confirm_action">Confirm Action</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Expires In (hours)
                  </label>
                  <input
                    type="number"
                    value={expiresInHours}
                    onChange={(e) =>
                      setExpiresInHours(parseInt(e.target.value, 10) || 24)
                    }
                    min={1}
                    max={168}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </>
            )}

            {type === 'alert' && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Mark as urgent (bypasses quiet hours)
              </label>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="w-full rounded-md border px-3 py-2 text-sm"
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
