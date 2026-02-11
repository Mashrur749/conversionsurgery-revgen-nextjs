'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Send, CheckCircle } from 'lucide-react';

interface Message {
  id: string;
  message: string;
  userEmail: string;
  status: string;
  page: string;
  createdAt: string | null;
}

interface Reply {
  id: string;
  content: string;
  isAdmin: boolean;
  authorEmail: string;
  calcomLink: string | null;
  createdAt: string | null;
}

export function AdminDiscussionThread({
  message,
  initialReplies,
}: {
  message: Message;
  initialReplies: Reply[];
}) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [status, setStatus] = useState(message.status);
  const [replyText, setReplyText] = useState('');
  const [includeCalcom, setIncludeCalcom] = useState(false);
  const [calcomLink, setCalcomLink] = useState('');
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  async function handleSubmit() {
    if (!replyText.trim()) return;
    setSending(true);

    try {
      const res = await fetch(`/api/support-messages/${message.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyText.trim(),
          calcomLink: includeCalcom && calcomLink ? calcomLink : undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json() as { reply: Reply };
      setReplies((prev) => [...prev, data.reply]);
      setReplyText('');
      setCalcomLink('');
      setIncludeCalcom(false);
    } catch {
      // Could add error toast
    } finally {
      setSending(false);
    }
  }

  async function handleResolve() {
    setResolving(true);
    try {
      const res = await fetch(`/api/support-messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (!res.ok) throw new Error('Failed to resolve');
      setStatus('resolved');
    } catch {
      // Could add error toast
    } finally {
      setResolving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/discussions"
          className="text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">Thread with {message.userEmail}</h1>
          <p className="text-xs text-gray-500">Page: {message.page}</p>
        </div>
        <Badge variant={status === 'open' ? 'default' : 'secondary'}>
          {status}
        </Badge>
        {status === 'open' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResolve}
            disabled={resolving}
            className="gap-1"
          >
            <CheckCircle className="h-4 w-4" />
            {resolving ? 'Resolving...' : 'Mark Resolved'}
          </Button>
        )}
      </div>

      {/* Original message */}
      <div className="border rounded-lg p-4 mb-4 bg-blue-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium">{message.userEmail}</span>
          <span className="text-xs text-gray-500">
            {message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}
          </span>
        </div>
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{message.message}</p>
      </div>

      {/* Replies */}
      <div className="space-y-3 mb-6">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className={`rounded-lg p-4 ${
              reply.isAdmin
                ? 'bg-amber-50 border border-amber-200 ml-4'
                : 'bg-gray-50 border mr-4'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">
                {reply.isAdmin ? `Admin (${reply.authorEmail})` : reply.authorEmail}
              </span>
              <span className="text-xs text-gray-500">
                {reply.createdAt ? new Date(reply.createdAt).toLocaleString() : ''}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{reply.content}</p>

            {reply.calcomLink && (
              <div className="mt-3 border rounded-lg overflow-hidden">
                <iframe
                  src={reply.calcomLink}
                  className="w-full h-[500px] border-0"
                  title="Book a call"
                />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply form */}
      {status === 'open' && (
        <div className="border-t pt-4">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Type your reply..."
            className="mb-3 min-h-20 resize-none"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
          />

          <div className="flex items-center gap-3 mb-3">
            <Switch
              checked={includeCalcom}
              onCheckedChange={setIncludeCalcom}
            />
            <span className="text-sm text-gray-700">Include Cal.com link</span>
          </div>

          {includeCalcom && (
            <Input
              value={calcomLink}
              onChange={(e) => setCalcomLink(e.target.value)}
              placeholder="https://cal.com/your-name/30min"
              className="mb-3"
              type="url"
            />
          )}

          <Button
            onClick={handleSubmit}
            disabled={!replyText.trim() || sending}
            className="gap-2"
          >
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Reply'}
          </Button>
        </div>
      )}
    </div>
  );
}
