'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw,
  Send,
  Copy,
  Check,
  Wand2,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

/** Minimal review data needed by the response editor. */
interface Review {
  id: string;
  rating: number;
  authorName: string | null;
  reviewText: string | null;
  source: string;
}

/** API response shape from the draft generation endpoint. */
interface GenerateResponseData {
  responseText: string;
  id: string;
}

/** API response shape from the regenerate endpoint. */
interface RegenerateResponseData {
  responseText: string;
}

/** API error response shape. */
interface ApiErrorResponse {
  error?: string;
}

interface ResponseEditorProps {
  review: Review;
  initialResponse?: string;
  onSave?: (text: string) => void;
  onPost?: () => void;
}

/** Editor component for generating, editing, and posting review responses. */
export function ResponseEditor({
  review,
  initialResponse,
  onSave,
  onPost,
}: ResponseEditorProps) {
  const [responseText, setResponseText] = useState(initialResponse || '');
  const [tone, setTone] = useState('professional');
  const [generating, setGenerating] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);

  const generateResponse = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tone }),
      });
      if (!res.ok) throw new Error('Failed to generate');
      const data = (await res.json()) as GenerateResponseData;
      setResponseText(data.responseText);
      setResponseId(data.id);
      toast.success('Response generated!');
    } catch {
      toast.error('Failed to generate response');
    } finally {
      setGenerating(false);
    }
  };

  const regenerate = async (options: { tone?: string; shorter?: boolean }) => {
    if (!responseId) {
      await generateResponse();
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/responses/${responseId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      if (!res.ok) throw new Error('Failed to regenerate');
      const data = (await res.json()) as RegenerateResponseData;
      setResponseText(data.responseText);
      toast.success('Response updated!');
    } catch {
      toast.error('Failed to regenerate');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard!');
  };

  const postResponse = async () => {
    if (!responseId) {
      toast.error('Generate a response first');
      return;
    }

    setPosting(true);
    try {
      const res = await fetch(`/api/admin/responses/${responseId}/post`, {
        method: 'POST',
      });

      if (!res.ok) {
        const data = (await res.json()) as ApiErrorResponse;
        throw new Error(data.error || 'Failed to post');
      }

      toast.success('Response posted to Google!');
      onPost?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const wordCount = responseText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Response Editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tone selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Tone:</span>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="friendly">Friendly</SelectItem>
              <SelectItem value="apologetic">Apologetic</SelectItem>
              <SelectItem value="thankful">Thankful</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={generateResponse}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            <span className="ml-1">Generate</span>
          </Button>
        </div>

        {/* Response textarea */}
        <div className="relative">
          <Textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Your response will appear here..."
            rows={6}
            className="resize-none pr-16"
          />
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {wordCount} words
          </div>
        </div>

        {/* Quick actions */}
        {responseText && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate({ shorter: true })}
              disabled={generating}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Make shorter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate({ tone: 'friendly' })}
              disabled={generating}
            >
              More friendly
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => regenerate({ tone: 'apologetic' })}
              disabled={generating}
            >
              More apologetic
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" onClick={copyToClipboard} disabled={!responseText}>
            {copied ? (
              <Check className="h-4 w-4 mr-1 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-1" />
            )}
            Copy
          </Button>

          {review.source === 'google' && (
            <Button
              onClick={postResponse}
              disabled={!responseText || posting}
              className="flex-1"
            >
              {posting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Post to Google
            </Button>
          )}

          {review.source !== 'google' && (
            <Button
              variant="secondary"
              onClick={copyToClipboard}
              disabled={!responseText}
              className="flex-1"
            >
              <ArrowRight className="h-4 w-4 mr-2" />
              Copy & Reply on {review.source}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
