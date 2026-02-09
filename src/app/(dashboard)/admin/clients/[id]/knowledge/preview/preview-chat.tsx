'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  clientId: string;
}

export function KnowledgePreviewChat({ clientId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/knowledge/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Error generating response' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error generating response' }]);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex-1 overflow-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Test how the AI responds using the knowledge base. Try asking about services, pricing, etc.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-gray-100 mr-8'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="bg-gray-100 mr-8 p-3 rounded-lg text-sm">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question as a customer..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
