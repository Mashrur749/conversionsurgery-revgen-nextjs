'use client';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadMediaTab } from '@/components/leads/lead-media-tab';
import { MessageMedia } from './message-media';
import { format } from 'date-fns';
import { ImageIcon, MessageSquare } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  direction: string | null;
  messageType: string | null;
  createdAt: Date | null;
}

interface MediaItem {
  id: string;
  type: string;
  publicUrl: string | null;
  thumbnailUrl: string | null;
  aiDescription: string | null;
  messageId: string | null;
}

interface LeadTabsProps {
  leadId: string;
  messages: Message[];
  mediaByMessage: Record<string, MediaItem[]>;
  mediaCount: number;
  children?: React.ReactNode; // For reply form / opt-out card
}

export function LeadTabs({ leadId, messages, mediaByMessage, mediaCount, children }: LeadTabsProps) {
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
                return (
                  <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${msg.direction === 'outbound' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-900'}`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msgMedia.length > 0 && (
                        <MessageMedia items={msgMedia} />
                      )}
                      <p className={`text-xs mt-1 ${msg.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'}`}>
                        {msg.createdAt && format(new Date(msg.createdAt), 'MMM d, h:mm a')}
                        {msg.messageType === 'ai_response' && ' • AI'}
                        {msg.messageType === 'escalation' && ' • Escalation'}
                        {msg.messageType === 'mms' && ' • MMS'}
                      </p>
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
            <CardTitle>Photos & Files</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadMediaTab leadId={leadId} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
