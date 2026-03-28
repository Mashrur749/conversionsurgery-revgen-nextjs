'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LeadMediaTab } from '@/components/leads/lead-media-tab';
import { MessageMedia } from './message-media';
import { format } from 'date-fns';
import { ImageIcon, MessageSquare, Flag, X } from 'lucide-react';
import type { Conversation } from '@/db/schema/conversations';
import type { MediaAttachment } from '@/db/schema/media-attachments';

const FLAG_REASON_LABELS: Record<string, string> = {
  wrong_tone: 'Wrong tone',
  inaccurate: 'Inaccurate info',
  too_pushy: 'Too pushy',
  hallucinated: 'Hallucinated',
  off_topic: 'Off topic',
  other: 'Other',
};

interface LeadTabsProps {
  leadId: string;
  clientId: string;
  messages: Conversation[];
  mediaByMessage: Record<string, MediaAttachment[]>;
  mediaCount: number;
  children?: React.ReactNode;
}

function MessageFlagButton({
  message,
  clientId,
}: {
  message: Conversation;
  clientId: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [isFlagged, setIsFlagged] = useState(message.flagged);
  const [flagReason, setFlagReason] = useState(message.flagReason ?? '');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFlag = async () => {
    if (!reason) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/conversations/${message.id}/flag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, note: note || undefined }),
        }
      );
      if (res.ok) {
        setIsFlagged(true);
        setFlagReason(reason);
        setShowForm(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnflag = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/clients/${clientId}/conversations/${message.id}/flag`,
        { method: 'DELETE' }
      );
      if (res.ok) {
        setIsFlagged(false);
        setFlagReason('');
        setNote('');
        setReason('');
      }
    } finally {
      setLoading(false);
    }
  };

  if (isFlagged) {
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs text-sienna flex items-center gap-0.5">
          <Flag className="h-3 w-3" />
          {FLAG_REASON_LABELS[flagReason ?? ''] ?? 'Flagged'}
        </span>
        <button
          onClick={handleUnflag}
          disabled={loading}
          className="text-xs text-white/40 hover:text-white/70 transition-colors"
          title="Remove flag"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="mt-2 space-y-2 bg-white/10 rounded p-2">
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger className="h-7 text-xs bg-transparent border-white/20 text-white">
            <SelectValue placeholder="Select reason" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FLAG_REASON_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional note..."
          className="h-14 text-xs bg-transparent border-white/20 text-white placeholder:text-white/40 resize-none"
          maxLength={500}
        />
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="destructive"
            onClick={handleFlag}
            disabled={!reason || loading}
            className="h-6 text-xs px-2"
          >
            Flag
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowForm(false)}
            className="h-6 text-xs px-2 text-white/60 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowForm(true)}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-white/30 hover:text-sienna ml-1"
      title="Flag this AI response"
    >
      <Flag className="h-3 w-3" />
    </button>
  );
}

export function LeadTabs({ leadId, clientId, messages, mediaByMessage, mediaCount, children }: LeadTabsProps) {
  return (
    <Tabs defaultValue="conversation">
      <TabsList>
        <TabsTrigger value="conversation">
          <MessageSquare className="h-4 w-4 mr-1" />
          Conversation
        </TabsTrigger>
        <TabsTrigger value="photos">
          <ImageIcon className="h-4 w-4 mr-1" />
          Photos {mediaCount > 0 && `(${mediaCount})`}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="conversation" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Conversation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-muted-foreground">No messages yet</p>
            ) : (
              messages.map((msg) => {
                const msgMedia = msg.id ? (mediaByMessage[msg.id] || []) : [];
                const isAi = msg.messageType === 'ai_response';
                return (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`group max-w-[80%] rounded-lg p-3 ${msg.direction === 'outbound' ? 'bg-forest text-white' : 'bg-muted text-foreground'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msgMedia.length > 0 && (
                        <MessageMedia items={msgMedia} />
                      )}
                      <div className="flex items-center gap-1">
                        <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-white/60' : 'text-muted-foreground'}`}>
                          {msg.createdAt && format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                          {isAi && ' \u2022 AI'}
                          {msg.messageType === 'escalation' && ' \u2022 Escalation'}
                          {msg.messageType === 'mms' && ' \u2022 MMS'}
                        </p>
                        {isAi && (
                          <MessageFlagButton
                            message={msg}
                            clientId={clientId}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
        {children}
      </TabsContent>

      <TabsContent value="photos">
        <Card>
          <CardHeader>
            <CardTitle>Photos &amp; Files</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadMediaTab leadId={leadId} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
