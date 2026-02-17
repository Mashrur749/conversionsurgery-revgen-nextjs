'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send } from 'lucide-react';

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

export function DiscussionThread({
  message,
  initialReplies,
}: {
  message: Message;
  initialReplies: Reply[];
}) {
  const [replies, setReplies] = useState<Reply[]>(initialReplies);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
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
        body: JSON.stringify({ content: replyText.trim() }),
      });

      if (!res.ok) throw new Error('Failed to send');

      const data = await res.json() as { reply: Reply };
      setReplies((prev) => [...prev, data.reply]);
      setReplyText('');
    } catch {
      // Could add error toast here
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/client/discussions"
          className="text-gray-500 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold flex-1">Discussion</h1>
        <Badge className={message.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
          {message.status}
        </Badge>
      </div>

      {/* Original message */}
      <div className="border rounded-lg p-4 mb-4 bg-blue-50">
        <p className="text-sm text-gray-900 whitespace-pre-wrap">{message.message}</p>
        <p className="text-xs text-gray-500 mt-2">
          {message.createdAt ? new Date(message.createdAt).toLocaleString() : ''} — {message.page}
        </p>
      </div>

      {/* Replies */}
      <div className="space-y-3 mb-6">
        {replies.map((reply) => (
          <div
            key={reply.id}
            className={`rounded-lg p-4 ${
              reply.isAdmin
                ? 'bg-amber-50 border border-amber-200 mr-4'
                : 'bg-blue-50 border border-blue-200 ml-4'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium">
                {reply.isAdmin ? 'Support Team' : 'You'}
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
      {message.status === 'open' && (
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
