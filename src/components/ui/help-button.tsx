'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, X, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type Status = 'idle' | 'open' | 'sending' | 'sent';

export function HelpButton() {
  const pathname = usePathname();
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === 'open' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [status]);

  useEffect(() => {
    if (status === 'sent') {
      const timer = setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  async function handleSubmit() {
    if (!message.trim()) return;
    setStatus('sending');

    try {
      const res = await fetch('/api/support-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: pathname, message: message.trim() }),
      });

      if (!res.ok) throw new Error('Failed to send');
      setStatus('sent');
    } catch {
      setStatus('open');
    }
  }

  if (status === 'idle') {
    return (
      <Button
        onClick={() => setStatus('open')}
        className="fixed bottom-4 right-4 shadow-lg z-50 gap-2"
        size="lg"
      >
        <MessageSquare className="h-5 w-5" />
        Stuck? Text me
      </Button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-xl">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-medium">Send a message</span>
        <button
          onClick={() => {
            setStatus('idle');
            setMessage('');
          }}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close help"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {status === 'sent' ? (
        <div className="flex flex-col items-center gap-2 p-6">
          <Check className="h-8 w-8 text-green-500" />
          <p className="text-sm text-muted-foreground">Message sent!</p>
        </div>
      ) : (
        <div className="p-4">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="What do you need help with?"
            className="mb-3 min-h-24 resize-none"
            disabled={status === 'sending'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || status === 'sending'}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {status === 'sending' ? 'Sending...' : 'Send'}
          </Button>
        </div>
      )}
    </div>
  );
}
