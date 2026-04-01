'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationListItem {
  id: string;
  name: string | null;
  phone: string;
  source: string | null;
  conversationMode: string | null;
  actionRequired: boolean | null;
  createdAt: string;
  lastMessageAt: string | null;
  lastMessage: string | null;
  lastMessageDirection: string | null;
  messageCount: number;
}

interface Message {
  id: string;
  direction: string | null;
  content: string;
  messageType: string | null;
  createdAt: string | null;
}

interface Suggestion {
  id: string;
  flowName: string;
  reason: string | null;
  confidence: number | null;
  status: string | null;
  createdAt: string | null;
}

interface ConversationsShellProps {
  initialConversations: ConversationListItem[];
  initialLeadId?: string;
  initialMessages?: Message[];
  initialLead?: {
    id: string;
    name: string | null;
    phone: string;
    conversationMode: string | null;
    actionRequired: boolean | null;
  };
}

// ---------------------------------------------------------------------------
// Unread tracking (localStorage)
// ---------------------------------------------------------------------------

function getLastRead(leadId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const data = localStorage.getItem('cs_last_read');
    if (!data) return null;
    const parsed = JSON.parse(data) as Record<string, string>;
    return parsed[leadId] ?? null;
  } catch {
    return null;
  }
}

function setLastRead(leadId: string, timestamp: string): void {
  if (typeof window === 'undefined') return;
  try {
    const data = localStorage.getItem('cs_last_read');
    const parsed: Record<string, string> = data ? (JSON.parse(data) as Record<string, string>) : {};
    parsed[leadId] = timestamp;
    localStorage.setItem('cs_last_read', JSON.stringify(parsed));
  } catch {
    // Ignore storage errors
  }
}

function getUnreadCount(
  leadId: string,
  lastMessageAt: string | null,
  messageCount: number
): number {
  if (!lastMessageAt || messageCount === 0) return 0;
  const lastRead = getLastRead(leadId);
  if (!lastRead) return messageCount;
  if (new Date(lastMessageAt) <= new Date(lastRead)) return 0;
  // We don't know exact count of unread - show a generic indicator
  return 1;
}

// ---------------------------------------------------------------------------
// Mode colors
// ---------------------------------------------------------------------------

const modeColors: Record<string, string> = {
  ai: 'bg-sage-light text-forest',
  human: 'bg-[#E8F5E9] text-[#3D7A50]',
  paused: 'bg-muted text-foreground',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ConversationsShell({
  initialConversations,
  initialLeadId,
  initialMessages,
  initialLead,
}: ConversationsShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ----- State -----
  const [conversations, setConversations] = useState(initialConversations);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    initialLeadId ?? null
  );
  const [messages, setMessages] = useState<Message[]>(initialMessages ?? []);
  const [lead, setLead] = useState(initialLead ?? null);
  const [mode, setMode] = useState(initialLead?.conversationMode ?? 'ai');
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showMobileDetail, setShowMobileDetail] = useState(!!initialLeadId);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [conversationError, setConversationError] = useState(false);
  const [pollingFailures, setPollingFailures] = useState(0);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // ----- Derived values -----
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase();
        return (
          (c.name?.toLowerCase().includes(q) ?? false) ||
          c.phone.includes(q)
        );
      })
    : conversations;

  // ----- Scroll tracking -----
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 60;
    isAtBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    if (isAtBottomRef.current) {
      setHasNewMessages(false);
    }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'instant',
    });
  }, []);

  // ----- Mark as read -----
  useEffect(() => {
    if (selectedLeadId && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.createdAt) {
        setLastRead(selectedLeadId, lastMsg.createdAt);
      }
    }
  }, [selectedLeadId, messages]);

  // ----- Scroll on new messages -----
  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom(false);
    } else if (messages.length > 0) {
      setHasNewMessages(true);
    }
  }, [messages, scrollToBottom]);

  // ----- Load messages for a lead -----
  const selectConversation = useCallback(
    async (leadId: string) => {
      if (leadId === selectedLeadId) return;

      // EC-04: Abort any in-flight fetch for the previous conversation
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setSelectedLeadId(leadId);
      setShowMobileDetail(true);
      setLoadingMessages(true);
      setConversationError(false);
      setMessages([]);
      setSuggestions([]);
      setHasNewMessages(false);
      setSendError(false);
      setNewMessage('');
      setPollingFailures(0);

      // Update URL without navigation
      const url = new URL(window.location.href);
      url.searchParams.set('lead', leadId);
      router.replace(url.pathname + url.search, { scroll: false });

      // Find lead info from conversations list
      const conv = conversations.find((c) => c.id === leadId);
      if (conv) {
        setLead({
          id: conv.id,
          name: conv.name,
          phone: conv.phone,
          conversationMode: conv.conversationMode,
          actionRequired: conv.actionRequired,
        });
        setMode(conv.conversationMode ?? 'ai');
      }

      // EC-05: Race the fetch against a 5-second timeout
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000);

      try {
        const res = await fetch(
          `/api/client/conversations/${leadId}/messages`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);

        if (controller.signal.aborted) return;

        if (res.ok) {
          const data = (await res.json()) as { messages: Message[] };
          setMessages(data.messages);
          setLoadingMessages(false);
          // Mark as read
          if (data.messages.length > 0) {
            const last = data.messages[data.messages.length - 1];
            if (last.createdAt) setLastRead(leadId, last.createdAt);
          }
          // Scroll to bottom after render
          setTimeout(() => scrollToBottom(false), 50);
        } else {
          // EC-05: 404 or other error — show error state
          setLoadingMessages(false);
          setConversationError(true);
        }
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        // EC-04: Ignore aborted fetches from rapid switching
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // EC-05: Network error or timeout — show error state
        setLoadingMessages(false);
        setConversationError(true);
      }

      // Load suggestions (non-critical — don't block on abort)
      if (controller.signal.aborted) return;
      try {
        const res = await fetch(`/api/client/leads/${leadId}/suggestions`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (res.ok) {
          const data = (await res.json()) as { suggestions?: Suggestion[] };
          setSuggestions(
            data.suggestions?.filter((s) => s.status === 'pending') ?? []
          );
        }
      } catch {
        // Ignore suggestion load failures
      }
    },
    [selectedLeadId, conversations, router, scrollToBottom]
  );

  // ----- Handle initial lead from URL -----
  useEffect(() => {
    const leadParam = searchParams.get('lead');
    if (leadParam && !selectedLeadId) {
      selectConversation(leadParam);
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- Poll conversation list every 15s -----
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/client/conversations');
        if (res.ok) {
          const data = (await res.json()) as {
            conversations: ConversationListItem[];
          };
          setConversations(data.conversations);
        }
      } catch {
        // Ignore polling errors
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // ----- Poll messages every 5s when a conversation is open -----
  useEffect(() => {
    if (!selectedLeadId) return;

    const interval = setInterval(async () => {
      const lastMsg = messages[messages.length - 1];
      const after = lastMsg?.createdAt ?? '';
      const url = after
        ? `/api/client/conversations/${selectedLeadId}/messages?after=${encodeURIComponent(after)}`
        : `/api/client/conversations/${selectedLeadId}/messages`;

      try {
        const res = await fetch(url);
        if (res.ok) {
          // EC-06: Reset consecutive failure counter on success
          setPollingFailures(0);
          const data = (await res.json()) as { messages: Message[] };
          if (data.messages.length > 0) {
            setMessages((prev) => {
              const existingIds = new Set(prev.map((m) => m.id));
              const newMsgs = data.messages.filter(
                (m) => !existingIds.has(m.id)
              );
              if (newMsgs.length === 0) return prev;
              return [...prev, ...newMsgs];
            });
          }
        } else {
          // EC-06: Track non-ok responses as failures
          setPollingFailures((prev) => prev + 1);
        }
      } catch {
        // EC-06: Track consecutive polling failures
        setPollingFailures((prev) => prev + 1);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedLeadId, messages]);

  // ----- Actions -----
  async function handleTakeover() {
    if (!selectedLeadId) return;
    const res = await fetch(
      `/api/client/conversations/${selectedLeadId}/takeover`,
      { method: 'POST' }
    );
    if (res.ok) {
      setMode('human');
    }
  }

  async function handleHandback() {
    if (!selectedLeadId) return;
    const res = await fetch(
      `/api/client/conversations/${selectedLeadId}/handback`,
      { method: 'POST' }
    );
    if (res.ok) {
      setMode('ai');
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || sending || !selectedLeadId) return;

    setSending(true);
    setSendError(false);
    try {
      const res = await fetch(
        `/api/client/conversations/${selectedLeadId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: newMessage }),
        }
      );

      if (res.ok) {
        const data = (await res.json()) as { message: Message };
        setMessages((prev) => [...prev, data.message]);
        setNewMessage('');
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        setSendError(true);
      }
    } catch {
      setSendError(true);
    }
    setSending(false);
  }

  async function handleSuggestion(
    suggestionId: string,
    action: 'approve' | 'reject'
  ) {
    if (!selectedLeadId) return;
    await fetch(`/api/client/leads/${selectedLeadId}/suggestions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suggestionId, action }),
    });
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
  }

  function handleBack() {
    setShowMobileDetail(false);
    setSelectedLeadId(null);
    setMessages([]);
    setLead(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('lead');
    router.replace(url.pathname + url.search, { scroll: false });
  }

  // ----- Debounced search -----
  function handleSearchChange(value: string) {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(value);
    }, 300);
  }

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 4.5rem)' }}>
      <div className="flex flex-1 min-h-0 rounded-lg border bg-white overflow-hidden">
        {/* ---------------------------------------------------------------- */}
        {/* LEFT PANE: Conversation List                                      */}
        {/* ---------------------------------------------------------------- */}
        <div
          className={cn(
            'flex flex-col border-r min-h-0',
            // Mobile: full width or hidden
            showMobileDetail ? 'hidden md:flex' : 'flex w-full md:w-[280px]',
            // Desktop: fixed width
            'md:w-[280px] md:flex-shrink-0'
          )}
        >
          {/* Search */}
          <div className="p-3 border-b flex-shrink-0">
            <Input
              placeholder="Search name or phone..."
              onChange={(e) => handleSearchChange(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {filteredConversations.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
              </div>
            )}

            {filteredConversations.map((conv) => {
              const isSelected = conv.id === selectedLeadId;
              const unread = getUnreadCount(
                conv.id,
                conv.lastMessageAt,
                conv.messageCount
              );
              const hasUnread = unread > 0 && !isSelected;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => selectConversation(conv.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 border-b transition-colors',
                    'hover:bg-[#F8F9FA]',
                    isSelected && 'bg-sage-light',
                    conv.actionRequired && !isSelected && 'border-l-3 border-l-sienna'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'text-sm truncate',
                            hasUnread ? 'font-semibold' : 'font-medium'
                          )}
                        >
                          {conv.name || conv.phone}
                        </span>
                        {conv.actionRequired && (
                          <Badge
                            className="bg-[#FFF3E0] text-sienna border-sienna/30 text-[10px] px-1 py-0"
                          >
                            !
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {conv.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {conv.lastMessageAt
                          ? formatDistanceToNow(new Date(conv.lastMessageAt), {
                              addSuffix: false,
                            })
                          : ''}
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn(
                            modeColors[conv.conversationMode ?? 'ai'],
                            'text-[9px] px-1 py-0 h-4'
                          )}
                        >
                          {conv.conversationMode === 'human'
                            ? 'Human'
                            : conv.conversationMode === 'paused'
                              ? 'Paused'
                              : 'AI'}
                        </Badge>
                        {hasUnread && (
                          <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 text-[10px] font-semibold text-white bg-sienna rounded-full">
                            {unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT PANE: Message Thread                                        */}
        {/* ---------------------------------------------------------------- */}
        <div
          className={cn(
            'flex flex-col flex-1 min-h-0 min-w-0',
            // Mobile: full width or hidden
            !showMobileDetail ? 'hidden md:flex' : 'flex'
          )}
        >
          {!selectedLeadId ? (
            // Empty state
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="text-sm">Select a conversation to view messages</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex justify-between items-center px-3 py-2.5 border-b flex-shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Mobile back button */}
                  <button
                    type="button"
                    onClick={handleBack}
                    className="md:hidden text-muted-foreground hover:text-foreground p-1"
                  >
                    &larr;
                  </button>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {lead?.name || lead?.phone}
                    </p>
                    <p className="text-xs text-muted-foreground">{lead?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Badge
                    className={modeColors[mode]}
                    variant="outline"
                  >
                    {mode === 'ai' ? 'AI' : mode === 'human' ? 'Human' : 'Paused'}
                  </Badge>
                  {mode === 'ai' ? (
                    <Button size="sm" className="h-7 text-xs" onClick={handleTakeover}>
                      Take Over
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={handleHandback}
                    >
                      Hand Back to AI
                    </Button>
                  )}
                </div>
              </div>

              {/* EC-06: Polling failure banner */}
              {pollingFailures >= 3 && (
                <div className="flex items-center justify-between px-3 py-2 bg-[#FFF3E0] border-b text-sm text-sienna flex-shrink-0">
                  <span>Connection lost. Retrying&hellip;</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs"
                    onClick={() => {
                      setPollingFailures(0);
                      window.location.reload();
                    }}
                  >
                    Refresh
                  </Button>
                </div>
              )}

              {/* Messages */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto min-h-0 px-3 py-3 space-y-2"
              >
                {conversationError ? (
                  <div className="flex-1 flex items-center justify-center h-full">
                    <div className="text-center space-y-3">
                      <p className="text-sm text-muted-foreground">
                        This conversation is no longer available.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleBack}
                      >
                        Back to list
                      </Button>
                    </div>
                  </div>
                ) : loadingMessages ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex',
                          i % 2 === 0 ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div className="h-10 rounded-lg bg-muted animate-pulse w-3/5" />
                      </div>
                    ))}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAI = msg.messageType === 'ai_response';
                    const isOutbound = msg.direction === 'outbound';
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex',
                          isOutbound ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[85%] rounded-lg px-3 py-1.5',
                            isOutbound && isAI &&
                              'bg-olive/20 text-forest border border-olive/30',
                            isOutbound && !isAI && 'bg-forest text-white',
                            !isOutbound && 'bg-muted text-foreground'
                          )}
                        >
                          {isAI && (
                            <p className="text-[10px] font-medium mb-0.5 text-olive">
                              AI Response
                            </p>
                          )}
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p
                            className={cn(
                              'text-[10px] mt-0.5',
                              isOutbound && !isAI
                                ? 'text-white/70'
                                : 'text-muted-foreground'
                            )}
                          >
                            {msg.createdAt &&
                              formatDistanceToNow(new Date(msg.createdAt), {
                                addSuffix: true,
                              })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* New messages indicator */}
              {hasNewMessages && (
                <div className="flex justify-center px-3 pb-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      scrollToBottom(true);
                      setHasNewMessages(false);
                    }}
                    className="text-xs bg-forest text-white px-3 py-1 rounded-full shadow-sm hover:bg-forest/90 transition-colors"
                  >
                    New messages
                  </button>
                </div>
              )}

              {/* AI Suggestions */}
              {suggestions.length > 0 && (
                <div className="border-t px-3 py-2 space-y-1.5 flex-shrink-0">
                  {suggestions.map((suggestion) => (
                    <Card
                      key={suggestion.id}
                      className="bg-sage-light border-forest-light/30 p-2"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-xs text-forest">
                            AI Suggests: {suggestion.flowName}
                          </p>
                          <p className="text-xs text-forest truncate">
                            {suggestion.reason}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            className="h-6 text-xs px-2"
                            onClick={() =>
                              handleSuggestion(suggestion.id, 'approve')
                            }
                          >
                            Send
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() =>
                              handleSuggestion(suggestion.id, 'reject')
                            }
                          >
                            Dismiss
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Input area */}
              {mode === 'human' ? (
                <div className="border-t px-3 py-2 flex-shrink-0 pb-safe">
                  <div className="flex gap-2">
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      rows={1}
                      className="min-h-[36px] max-h-[100px] resize-none text-sm"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={sending || !newMessage.trim()}
                      className="h-9 px-4 flex-shrink-0"
                    >
                      {sending ? '...' : 'Send'}
                    </Button>
                  </div>
                  {sendError && (
                    <p className="text-xs mt-1 text-sienna">
                      Failed to send. Please try again.
                    </p>
                  )}
                </div>
              ) : (
                <div className="border-t px-3 py-2 flex-shrink-0 pb-safe">
                  <div className="bg-sage-light rounded-md px-3 py-2 text-xs text-forest text-center">
                    AI is handling this conversation. Click &quot;Take Over&quot; to
                    respond manually.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
