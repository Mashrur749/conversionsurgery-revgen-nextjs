# Phase 12b: CRM Conversations View

## Current State (after Phase 12a)
- Client dashboard with basic stats
- No way for clients to see conversation details
- No way to take over from AI

## Goal
CRM view showing all conversations with takeover capability.

---

## Step 1: Add Conversation Mode to Schema

**APPEND** to `src/lib/db/schema.ts`:

```typescript
export const conversationModeEnum = pgEnum('conversation_mode', ['ai', 'human', 'paused']);
```

**UPDATE** the `leads` table, add column:

```typescript
conversationMode: conversationModeEnum('conversation_mode').default('ai'),
humanTakeoverAt: timestamp('human_takeover_at'),
humanTakeoverBy: varchar('human_takeover_by', { length: 255 }),
```

Run: `npx drizzle-kit push`

---

## Step 2: Create Conversations List Page

**CREATE** `src/app/(client)/client/conversations/page.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { leads, conversations } from '@/lib/db/schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

export default async function ConversationsPage() {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const allLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
      phone: leads.phone,
      source: leads.source,
      conversationMode: leads.conversationMode,
      actionRequired: leads.actionRequired,
      createdAt: leads.createdAt,
      lastMessageAt: sql<string>`(
        SELECT created_at FROM conversations 
        WHERE lead_id = ${leads.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
      lastMessage: sql<string>`(
        SELECT message FROM conversations 
        WHERE lead_id = ${leads.id} 
        ORDER BY created_at DESC LIMIT 1
      )`,
      messageCount: sql<number>`(
        SELECT COUNT(*) FROM conversations WHERE lead_id = ${leads.id}
      )`,
    })
    .from(leads)
    .where(eq(leads.clientId, session.clientId))
    .orderBy(desc(leads.createdAt))
    .limit(50);

  const modeColors: Record<string, string> = {
    ai: 'bg-blue-100 text-blue-800',
    human: 'bg-green-100 text-green-800',
    paused: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Conversations</h1>
        <div className="flex gap-2 text-sm">
          <Badge variant="outline" className={modeColors.ai}>AI</Badge>
          <Badge variant="outline" className={modeColors.human}>Human</Badge>
        </div>
      </div>

      <div className="space-y-2">
        {allLeads.map((lead) => (
          <Link key={lead.id} href={`/client/conversations/${lead.id}`}>
            <Card className={`hover:bg-gray-50 transition-colors ${
              lead.actionRequired ? 'border-l-4 border-l-red-500' : ''
            }`}>
              <CardContent className="py-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {lead.name || lead.phone}
                      </p>
                      <Badge className={modeColors[lead.conversationMode || 'ai']} variant="outline">
                        {lead.conversationMode || 'ai'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {lead.lastMessage || 'No messages yet'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{lead.messageCount} msgs</p>
                    <p>
                      {lead.lastMessageAt 
                        ? formatDistanceToNow(new Date(lead.lastMessageAt), { addSuffix: true })
                        : formatDistanceToNow(new Date(lead.createdAt!), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {allLeads.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No conversations yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
```

---

## Step 3: Create Conversation Detail Page

**CREATE** `src/app/(client)/client/conversations/[id]/page.tsx`:

```typescript
import { getClientSession } from '@/lib/client-auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { leads, conversations } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { ConversationView } from './conversation-view';

interface Props {
  params: { id: string };
}

export default async function ConversationDetailPage({ params }: Props) {
  const session = await getClientSession();
  if (!session) redirect('/link-expired');

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.id, params.id),
      eq(leads.clientId, session.clientId)
    ))
    .limit(1);

  if (!lead) notFound();

  const messages = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, lead.id))
    .orderBy(asc(conversations.createdAt));

  return (
    <ConversationView
      lead={lead}
      messages={messages}
      clientPhone={session.client.twilioNumber!}
    />
  );
}
```

---

## Step 4: Create Conversation View Component

**CREATE** `src/app/(client)/client/conversations/[id]/conversation-view.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface Lead {
  id: string;
  name: string | null;
  phone: string;
  conversationMode: string | null;
  actionRequired: boolean | null;
}

interface Message {
  id: string;
  direction: string;
  message: string;
  sender: string | null;
  createdAt: Date | null;
}

interface Props {
  lead: Lead;
  messages: Message[];
  clientPhone: string;
}

export function ConversationView({ lead, messages, clientPhone }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState(lead.conversationMode || 'ai');
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [localMessages, setLocalMessages] = useState(messages);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [localMessages]);

  async function handleTakeover() {
    const res = await fetch(`/api/client/conversations/${lead.id}/takeover`, {
      method: 'POST',
    });
    if (res.ok) {
      setMode('human');
      router.refresh();
    }
  }

  async function handleHandback() {
    const res = await fetch(`/api/client/conversations/${lead.id}/handback`, {
      method: 'POST',
    });
    if (res.ok) {
      setMode('ai');
      router.refresh();
    }
  }

  async function handleSend() {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const res = await fetch(`/api/client/conversations/${lead.id}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: newMessage }),
    });

    if (res.ok) {
      const data = await res.json();
      setLocalMessages([...localMessages, data.message]);
      setNewMessage('');
    }
    setSending(false);
  }

  const modeColors: Record<string, string> = {
    ai: 'bg-blue-100 text-blue-800',
    human: 'bg-green-100 text-green-800',
    paused: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex justify-between items-center pb-4 border-b">
        <div className="flex items-center gap-3">
          <Link href="/client/conversations" className="text-muted-foreground hover:text-foreground">
            ←
          </Link>
          <div>
            <p className="font-medium">{lead.name || lead.phone}</p>
            <p className="text-sm text-muted-foreground">{lead.phone}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={modeColors[mode]} variant="outline">
            {mode === 'ai' ? '🤖 AI' : '👤 Human'}
          </Badge>
          {mode === 'ai' ? (
            <Button size="sm" onClick={handleTakeover}>
              Take Over
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleHandback}>
              Hand Back to AI
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {localMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                msg.direction === 'outbound'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              <p className={`text-xs mt-1 ${
                msg.direction === 'outbound' ? 'text-blue-200' : 'text-gray-500'
              }`}>
                {msg.sender === 'ai' && '🤖 '}
                {msg.createdAt && formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {mode === 'human' ? (
        <div className="border-t pt-4">
          <div className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            />
            <Button onClick={handleSend} disabled={sending || !newMessage.trim()}>
              {sending ? '...' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="border-t pt-4">
          <Card className="bg-blue-50 border-blue-200">
            <div className="p-3 text-sm text-blue-700 text-center">
              🤖 AI is handling this conversation. Click "Take Over" to respond manually.
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
```

---

## Step 5: Create Conversation API Routes

**CREATE** `src/app/api/client/conversations/[id]/takeover/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db
    .update(leads)
    .set({
      conversationMode: 'human',
      humanTakeoverAt: new Date(),
      humanTakeoverBy: 'client',
      actionRequired: false,
    })
    .where(and(
      eq(leads.id, params.id),
      eq(leads.clientId, clientId)
    ));

  return NextResponse.json({ success: true });
}
```

**CREATE** `src/app/api/client/conversations/[id]/handback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { leads } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db
    .update(leads)
    .set({
      conversationMode: 'ai',
      humanTakeoverAt: null,
      humanTakeoverBy: null,
    })
    .where(and(
      eq(leads.id, params.id),
      eq(leads.clientId, clientId)
    ));

  return NextResponse.json({ success: true });
}
```

**CREATE** `src/app/api/client/conversations/[id]/send/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { leads, conversations, clients } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendSMS } from '@/lib/services/twilio';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies();
  const clientId = cookieStore.get('clientSessionId')?.value;

  if (!clientId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { message } = await request.json();

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message required' }, { status: 400 });
  }

  const [lead] = await db
    .select()
    .from(leads)
    .where(and(
      eq(leads.id, params.id),
      eq(leads.clientId, clientId)
    ))
    .limit(1);

  if (!lead) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  // Send SMS
  await sendSMS(lead.phone, client.twilioNumber!, message);

  // Save to database
  const [saved] = await db
    .insert(conversations)
    .values({
      leadId: lead.id,
      clientId,
      direction: 'outbound',
      message,
      sender: 'human',
    })
    .returning();

  return NextResponse.json({ message: saved });
}
```

---

## Step 6: Update Incoming SMS Handler

**UPDATE** `src/lib/automations/incoming-sms.ts`:

Add check before AI processing:

```typescript
// Check conversation mode
if (lead.conversationMode === 'human') {
  // Just save the message, don't auto-respond
  await db.insert(conversations).values({
    leadId: lead.id,
    clientId: client.id,
    direction: 'inbound',
    message: messageBody,
    sender: 'lead',
  });
  
  // Notify client of new message (optional)
  // await sendSMS(client.phone, client.twilioNumber!, `New message from ${lead.name || lead.phone}: "${messageBody.slice(0, 50)}..."`);
  
  return { processed: true, action: 'human_mode_saved' };
}

// Continue with AI processing...
```

---

## Verify

1. `npm run dev`
2. Access client dashboard via magic link
3. Go to Conversations
4. Click into a conversation
5. Click "Take Over" → mode changes to Human
6. Type and send a message
7. Click "Hand Back to AI" → mode changes back

---

## Next
Proceed to **Phase 12c** for weekly SMS summary.
