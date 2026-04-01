'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle } from 'lucide-react';

const REASON_LABELS: Record<string, string> = {
  wrong_tone: 'Wrong Tone',
  inaccurate: 'Inaccurate',
  too_pushy: 'Too Pushy',
  hallucinated: 'Hallucinated',
  off_topic: 'Off Topic',
  other: 'Other',
};

const REASON_COLORS: Record<string, string> = {
  wrong_tone: 'bg-[#FFF3E0] text-sienna',
  inaccurate: 'bg-[#FDEAE4] text-sienna',
  too_pushy: 'bg-[#FFF3E0] text-terracotta-dark',
  hallucinated: 'bg-[#FDEAE4] text-sienna',
  off_topic: 'bg-muted text-muted-foreground',
  other: 'bg-muted text-muted-foreground',
};

export interface FlaggedMessage {
  id: string;
  clientId: string;
  leadId: string | null;
  content: string;
  flagReason: string | null;
  flagNote: string | null;
  flaggedAt: string | null;
  createdAt: string;
  clientName: string;
  leadName: string | null;
  leadPhone: string | null;
}

interface ResolvedMessage extends FlaggedMessage {
  resolvedAt: string;
}

interface AIQualityClientProps {
  initialMessages: FlaggedMessage[];
}

export function AIQualityClient({ initialMessages }: AIQualityClientProps) {
  const [tab, setTab] = useState<string>('open');
  const [openMessages, setOpenMessages] = useState<FlaggedMessage[]>(initialMessages);
  const [resolvedMessages, setResolvedMessages] = useState<ResolvedMessage[]>([]);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [resolvingAll, setResolvingAll] = useState(false);

  const unflagViaApi = useCallback(async (clientId: string, messageId: string): Promise<boolean> => {
    const res = await fetch(
      `/api/admin/clients/${clientId}/conversations/${messageId}/flag`,
      { method: 'DELETE' }
    );
    return res.ok;
  }, []);

  const resolveMessage = useCallback(async (messageId: string, clientId: string) => {
    setResolving((prev) => new Set(prev).add(messageId));
    try {
      const ok = await unflagViaApi(clientId, messageId);
      if (ok) {
        const msg = openMessages.find((m) => m.id === messageId);
        if (msg) {
          setOpenMessages((prev) => prev.filter((m) => m.id !== messageId));
          setResolvedMessages((prev) => [
            { ...msg, resolvedAt: new Date().toISOString() },
            ...prev,
          ]);
        }
      }
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  }, [openMessages, unflagViaApi]);

  const resolveAll = useCallback(async () => {
    setResolvingAll(true);
    try {
      const now = new Date().toISOString();
      const results = await Promise.allSettled(
        openMessages.map((m) => unflagViaApi(m.clientId, m.id))
      );

      const succeeded: ResolvedMessage[] = [];
      const failed: FlaggedMessage[] = [];

      results.forEach((result, idx) => {
        const msg = openMessages[idx];
        if (result.status === 'fulfilled' && result.value) {
          succeeded.push({ ...msg, resolvedAt: now });
        } else {
          failed.push(msg);
        }
      });

      setOpenMessages(failed);
      setResolvedMessages((prev) => [...succeeded, ...prev]);
    } finally {
      setResolvingAll(false);
    }
  }, [openMessages, unflagViaApi]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Quality Review</h1>
        <p className="text-muted-foreground">
          Flagged AI messages across all clients. Review and fix knowledge base or prompt issues.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="open">
              Open ({openMessages.length})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved ({resolvedMessages.length})
            </TabsTrigger>
          </TabsList>

          {tab === 'open' && openMessages.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={resolvingAll}
                >
                  {resolvingAll ? 'Resolving...' : 'Resolve All'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Resolve all flagged messages?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will unflag all {openMessages.length} messages. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resolveAll}>
                    Resolve All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        <TabsContent value="open" className="mt-4">
          {openMessages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No open flagged messages. AI quality looks good.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{openMessages.length} flagged messages</p>
              {openMessages.map((msg) => (
                <Card key={msg.id} className="hover:bg-gray-50 transition-colors">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={REASON_COLORS[msg.flagReason || 'other']}>
                            {REASON_LABELS[msg.flagReason || 'other']}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {msg.clientName}
                          </span>
                          {msg.flaggedAt && (
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.flaggedAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm line-clamp-2">{msg.content}</p>
                        {msg.flagNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {msg.flagNote}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resolveMessage(msg.id, msg.clientId)}
                          disabled={resolving.has(msg.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          {resolving.has(msg.id) ? 'Resolving...' : 'Resolve'}
                        </Button>
                        {msg.leadId && (
                          <Link
                            href={`/leads/${msg.leadId}`}
                            className="text-sm text-olive underline"
                          >
                            View lead
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resolved" className="mt-4">
          {resolvedMessages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No resolved messages yet. Resolve flagged messages from the Open tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{resolvedMessages.length} resolved this session</p>
              {resolvedMessages.map((msg) => (
                <Card key={msg.id} className="opacity-75">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-[#E8F5E9] text-[#3D7A50]">
                            Resolved
                          </Badge>
                          <Badge className={REASON_COLORS[msg.flagReason || 'other']}>
                            {REASON_LABELS[msg.flagReason || 'other']}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {msg.clientName}
                          </span>
                        </div>
                        <p className="text-sm line-clamp-2">{msg.content}</p>
                        {msg.flagNote && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Note: {msg.flagNote}
                          </p>
                        )}
                        <span className="text-xs text-muted-foreground mt-2 block">
                          Resolved {formatDistanceToNow(new Date(msg.resolvedAt), { addSuffix: true })}
                        </span>
                      </div>
                      {msg.leadId && (
                        <Link
                          href={`/leads/${msg.leadId}`}
                          className="text-sm text-olive underline shrink-0"
                        >
                          View lead
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
