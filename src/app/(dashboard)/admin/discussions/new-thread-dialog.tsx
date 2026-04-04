'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Send } from 'lucide-react';

export function NewThreadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim() || !message.trim()) return;
    setSending(true);
    setError('');

    try {
      const res = await fetch('/api/support-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page: '/admin/discussions',
          message: message.trim(),
          targetEmail: email.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed to create thread');
      }

      const data = await res.json() as { threadId?: string };
      setOpen(false);
      setEmail('');
      setMessage('');

      if (data.threadId) {
        router.push(`/admin/discussions/${data.threadId}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create thread');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium h-9 px-4 py-2 bg-[#1B2F26] text-white hover:bg-[#1B2F26]/90 transition-colors cursor-pointer">
        <Plus className="h-4 w-4" />
        New Thread
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a Discussion</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label htmlFor="client-email" className="text-sm font-medium mb-1.5 block">
              Client Email
            </label>
            <Input
              id="client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
              disabled={sending}
            />
          </div>
          <div>
            <label htmlFor="thread-message" className="text-sm font-medium mb-1.5 block">
              Message
            </label>
            <Textarea
              id="thread-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message..."
              className="min-h-24 resize-none"
              disabled={sending}
            />
          </div>
          {error && (
            <p className="text-sm text-[#C15B2E]">{error}</p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!email.trim() || !message.trim() || sending}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send Message'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
