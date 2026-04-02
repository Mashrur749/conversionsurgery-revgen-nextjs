'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Send, Loader2 } from 'lucide-react';

interface Props {
  clientId: string;
}

interface PreviewResult {
  response: string;
  modelUsed: string;
}

const SAMPLE_PROMPTS = [
  'How much does a kitchen renovation cost?',
  'Can you come look at my basement this week?',
  'I got a quote from another company for $40,000',
] as const;

export function AiPreviewPanel({ clientId }: Props) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTest() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/ai-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message.trim() }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to generate preview');
      }

      const data = await res.json() as PreviewResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function selectSample(prompt: string) {
    setMessage(prompt);
    setResult(null);
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4" />
          AI Response Preview
        </CardTitle>
        <CardDescription>
          Test how the AI would respond to a homeowner message before going live
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Sample prompt buttons */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Sample prompts
          </p>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => selectSample(prompt)}
                className="text-xs px-3 py-1.5 rounded-full border border-input bg-background hover:bg-muted transition-colors text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Message input */}
        <div className="space-y-2">
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setResult(null);
              setError(null);
            }}
            placeholder="Type a sample homeowner message..."
            rows={3}
            className="resize-none"
            disabled={loading}
          />
          <Button
            onClick={handleTest}
            disabled={loading || !message.trim()}
            className="w-full sm:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Test Response
              </>
            )}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-md bg-[#FDEAE4] border border-sienna/20 p-3">
            <p className="text-sm text-sienna">{error}</p>
          </div>
        )}

        {/* AI response */}
        {result && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              AI Response
            </p>
            <div className="rounded-md border border-input bg-muted/30 p-4">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.response}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Model: {result.modelUsed}
            </p>
          </div>
        )}

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground border-t border-input pt-3">
          This is a preview &mdash; actual responses may vary based on conversation history and lead context.
        </p>
      </CardContent>
    </Card>
  );
}
