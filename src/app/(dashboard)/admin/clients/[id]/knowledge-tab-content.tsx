'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bot, Send, Loader2 } from 'lucide-react';
import KnowledgeForm from './knowledge/knowledge-form';
import { KnowledgeList } from './knowledge/knowledge-list';
import KnowledgeGapQueue from './knowledge/knowledge-gap-queue';
import type { StructuredKnowledgeData } from '@/lib/services/structured-knowledge';
import Link from 'next/link';

interface KnowledgeEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string | null;
  priority: number | null;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface KnowledgeTabContentProps {
  clientId: string;
  entries: KnowledgeEntry[];
  structuredData: StructuredKnowledgeData | null;
}

function TestChat({ clientId }: { clientId: string }) {
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

      const data = await res.json() as { response?: string; error?: string };
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response || 'No response' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error || 'Error generating response' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error generating response' }]);
    }

    setLoading(false);
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bot className="h-4 w-4" />
          Test AI Responses
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Ask questions as a homeowner to verify the AI uses the knowledge base correctly.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="flex-1 min-h-[300px] max-h-[500px] overflow-auto space-y-3 mb-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                Try asking questions a homeowner might ask.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['How much does a kitchen reno cost?', 'Do you offer free estimates?', 'What areas do you serve?'].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="text-xs px-3 py-1.5 rounded-full border border-input bg-background hover:bg-muted transition-colors text-foreground cursor-pointer"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-forest text-white ml-8'
                  : 'bg-muted mr-8'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="bg-muted mr-8 p-3 rounded-lg text-sm">
              <span className="animate-pulse">Thinking...</span>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question as a homeowner..."
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            size="icon"
            className="shrink-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="text-xs text-muted-foreground hover:text-foreground mt-2 cursor-pointer"
          >
            Clear conversation
          </button>
        )}
      </CardContent>
    </Card>
  );
}

type SubTab = 'interview' | 'entries' | 'queue';

export function KnowledgeTabContent({ clientId, entries, structuredData }: KnowledgeTabContentProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('interview');

  const subTabs: { value: SubTab; label: string }[] = [
    { value: 'interview', label: 'Guided Interview' },
    { value: 'entries', label: `All Entries (${entries.length})` },
    { value: 'queue', label: 'Gap Queue' },
  ];

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-6 overflow-hidden">
      {/* Left: KB editing */}
      <div className="space-y-4 min-w-0">
        <div className="flex gap-1 border-b">
          {subTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveSubTab(tab.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px cursor-pointer ${
                activeSubTab === tab.value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSubTab === 'interview' && (
          <div>
            <div className="bg-sage-light border border-forest-light/30 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-forest">Structured Knowledge Interview</h3>
              <p className="text-sm text-forest mt-1">
                Answer these questions about the business. The AI will use this to respond
                accurately to leads. Start with an industry preset to save time.
              </p>
            </div>
            <KnowledgeForm clientId={clientId} initialData={structuredData} />
          </div>
        )}

        {activeSubTab === 'entries' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button asChild>
                <Link href={`/admin/clients/${clientId}/knowledge/new`}>+ Add Entry</Link>
              </Button>
            </div>
            <KnowledgeList clientId={clientId} entries={entries} />
          </div>
        )}

        {activeSubTab === 'queue' && (
          <KnowledgeGapQueue
            clientId={clientId}
            entries={entries.map((entry) => ({
              id: entry.id,
              title: entry.title,
              category: entry.category,
            }))}
          />
        )}
      </div>

      {/* Right: Test chat (always visible) */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <TestChat clientId={clientId} />
      </div>
    </div>
  );
}
