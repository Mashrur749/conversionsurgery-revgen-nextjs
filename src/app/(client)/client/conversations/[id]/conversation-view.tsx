'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  conversationMode: string | null;
  actionRequired: boolean | null;
}

interface Message {
  id: string;
  direction: string | null;
  content: string;
  messageType: string | null;
  createdAt: Date | null;
}

interface Props {
  lead: Lead;
  messages: Message[];
}

export function ConversationView({ lead, messages }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState(lead.conversationMode || 'ai');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState(messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  async function handleTakeover() {
    const res = await fetch(`/api/client/conversations/${lead.id}/takeover`, {
      method: 'POST',
    });
    if (res.ok) {
      setMode('human');
      router.refresh();
    }
  }

  async function handleHandback() {
    const res = await fetch(`/api/client/conversations/${lead.id}/handback`, {
      method: 'POST',
    });
    if (res.ok) {
      setMode('ai');
      router.refresh();
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const res = await fetch(`/api/client/conversations/${lead.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage }),
    });

    if (res.ok) {
      const data: { message: Message } = await res.json();
      setLocalMessages([...localMessages, data.message]);
      setNewMessage('');
    }
    setSending(false);
  }

  const modeColors: Record<string, string> = {
    ai: 'bg-blue-100 text-blue-800',
    human: 'bg-green-100 text-green-800',
    paused: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b">
        <div className="flex items-center gap-3">
          <Link href="/client/conversations" className="text-muted-foreground hover:text-foreground">
            &larr;
          </Link>
          <div>
            <p className="font-medium">{lead.name || lead.phone}</p>
            <p className="text-sm text-muted-foreground">{lead.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={modeColors[mode]} variant="outline">
            {mode === 'ai' ? 'AI' : 'Human'}
          </Badge>
          {mode === 'ai' ? (
            <Button size="sm" onClick={handleTakeover}>
              Take Over
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleHandback}>
              Hand Back to AI
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.direction === 'outbound'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <p className={`text-xs mt-1 ${
                msg.direction === 'outbound' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {msg.messageType === 'ai_response' && 'AI '}
                {msg.createdAt && formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {mode === 'human' ? (
        <div className="border-t pt-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
              {sending ? '...' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t pt-4">
          <Card className="bg-blue-50 border-blue-200">
            <div className="p-3 text-sm text-blue-700 text-center">
              AI is handling this conversation. Click &quot;Take Over&quot; to respond manually.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
