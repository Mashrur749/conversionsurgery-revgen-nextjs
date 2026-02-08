'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

interface Props {
  leadId: string;
  leadPhone: string;
}

export function ReplyForm({ leadId, leadPhone }: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (res.ok) {
        setMessage('');
        router.refresh();
      } else {
        alert('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Textarea
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={sending || !message.trim()}>
              {sending ? 'Sending...' : 'Send SMS'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
