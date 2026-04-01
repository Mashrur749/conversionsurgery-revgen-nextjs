'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Code, Check, Copy } from 'lucide-react';

interface Props {
  clientId: string;
}

export function EmbedWidgetCard({ clientId }: Props) {
  const [snippet, setSnippet] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadSnippet() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/embed`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json() as { snippet: string };
      setSnippet(data.snippet);
    } catch {
      setSnippet(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    if (!snippet) return;
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Code className="h-4 w-4" />
          Website Widget
        </CardTitle>
        <CardDescription>
          Embed a lead capture form on the contractor&apos;s website
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!snippet ? (
          <Button
            variant="outline"
            className="w-full"
            onClick={loadSnippet}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Generate Embed Code'}
          </Button>
        ) : (
          <div className="space-y-3">
            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
              {snippet}
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={copyToClipboard}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-2" />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">
              Paste this code into the contractor&apos;s website. It creates a lead capture form that feeds directly into the system.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
