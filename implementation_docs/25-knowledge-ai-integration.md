# Phase 15c: AI Integration with Knowledge Base

## Current State (after Phase 15b)
- Knowledge base exists with entries
- UI allows adding/editing entries
- AI doesn't use knowledge in responses

## Goal
AI uses knowledge base to give accurate, business-specific answers.

---

## Step 1: Update AI Response Service

**UPDATE** `src/lib/services/ai-response.ts`:

Add knowledge base context to AI prompts:

```typescript
import { buildKnowledgeContext, searchKnowledge } from './knowledge-base';

export async function generateAIResponse(
  clientId: string,
  leadId: string,
  conversationHistory: { role: string; content: string }[],
  incomingMessage: string
): Promise<string> {
  // Get client info
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) throw new Error('Client not found');

  // Build knowledge context
  const knowledgeContext = await buildKnowledgeContext(clientId);

  // Search for relevant knowledge based on incoming message
  const relevantKnowledge = await searchKnowledge(clientId, incomingMessage);
  
  const relevantContext = relevantKnowledge.length > 0
    ? `\nMOST RELEVANT TO THIS QUESTION:\n${relevantKnowledge.map(k => `- ${k.title}: ${k.content}`).join('\n')}`
    : '';

  const systemPrompt = `You are a helpful assistant for ${client.businessName}, a contractor business.

${knowledgeContext}
${relevantContext}

GUIDELINES:
- Be friendly, professional, and helpful
- Answer questions using the business information provided above
- If you don't have specific information, offer to have someone follow up
- Keep responses concise (2-3 sentences for simple questions)
- For complex questions, provide helpful information and offer to schedule a call
- Never make up information not provided above
- If asked about pricing, refer to the pricing information or offer a free estimate
- Always represent the business positively

CURRENT CONVERSATION:`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: incomingMessage },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 300,
  });

  return response.choices[0].message.content || "I'm sorry, I couldn't process that. Let me have someone get back to you.";
}
```

---

## Step 2: Create Knowledge-Aware Response Handler

**CREATE** `src/lib/services/knowledge-ai.ts`:

```typescript
import OpenAI from 'openai';
import { db } from '@/lib/db';
import { clients, leads, conversations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { buildKnowledgeContext, searchKnowledge } from './knowledge-base';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function generateKnowledgeAwareResponse(
  clientId: string,
  leadId: string,
  incomingMessage: string
): Promise<string> {
  // Get client
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) throw new Error('Client not found');

  // Get lead
  const [lead] = await db
    .select()
    .from(leads)
    .where(eq(leads.id, leadId))
    .limit(1);

  // Get conversation history
  const history = await db
    .select()
    .from(conversations)
    .where(eq(conversations.leadId, leadId))
    .orderBy(desc(conversations.createdAt))
    .limit(10);

  const conversationHistory: ConversationMessage[] = history
    .reverse()
    .map(m => ({
      role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: m.message,
    }));

  // Build full knowledge context
  const knowledgeContext = await buildKnowledgeContext(clientId);

  // Search for specifically relevant knowledge
  const relevantEntries = await searchKnowledge(clientId, incomingMessage);
  
  let relevantSection = '';
  if (relevantEntries.length > 0) {
    relevantSection = `\n--- MOST RELEVANT TO CURRENT QUESTION ---\n`;
    for (const entry of relevantEntries.slice(0, 3)) {
      relevantSection += `${entry.title}:\n${entry.content}\n\n`;
    }
  }

  const systemPrompt = `You are a helpful SMS assistant for ${client.businessName}.

${knowledgeContext}
${relevantSection}

RESPONSE GUIDELINES:
1. Keep responses SHORT - this is SMS, aim for 1-3 sentences
2. Be warm and professional
3. Use the knowledge above to answer questions accurately
4. If information isn't available, say "Let me have ${client.ownerName || 'someone'} get back to you on that"
5. Never invent pricing, services, or policies not listed above
6. For scheduling requests, be helpful and ask about their availability
7. Represent ${client.businessName} positively

Lead name: ${lead?.name || 'Customer'}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory,
    { role: 'user' as const, content: incomingMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 200, // Keep SMS-appropriate
    });

    return response.choices[0].message.content || 
      `Thanks for reaching out! Let me have someone get back to you shortly.`;
  } catch (error) {
    console.error('AI response error:', error);
    return `Thanks for your message! We'll get back to you shortly.`;
  }
}
```

---

## Step 3: Update Incoming SMS Handler

**UPDATE** `src/lib/automations/incoming-sms.ts`:

Replace the AI response generation with knowledge-aware version:

```typescript
import { generateKnowledgeAwareResponse } from '@/lib/services/knowledge-ai';

// In the handleIncomingSMS function, replace the AI response section:

// Generate AI response using knowledge base
const aiResponse = await generateKnowledgeAwareResponse(
  client.id,
  lead.id,
  messageBody
);

// Send response
await sendSMS(senderPhone, client.twilioNumber!, aiResponse);

// Save outbound message
await db.insert(conversations).values({
  leadId: lead.id,
  clientId: client.id,
  direction: 'outbound',
  message: aiResponse,
  sender: 'ai',
});
```

---

## Step 4: Add Knowledge Preview to Admin

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/preview/page.tsx`:

```typescript
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildKnowledgeContext } from '@/lib/services/knowledge-base';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { KnowledgePreviewChat } from './preview-chat';

interface Props {
  params: { id: string };
}

export default async function KnowledgePreviewPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) notFound();

  const knowledgeContext = await buildKnowledgeContext(params.id);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Test AI Knowledge</h1>
          <p className="text-muted-foreground">{client.businessName}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/admin/clients/${params.id}/knowledge`}>← Back</Link>
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Knowledge Context (What AI Sees)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-gray-50 p-4 rounded max-h-[500px] overflow-auto">
              {knowledgeContext}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Test Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <KnowledgePreviewChat clientId={params.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

## Step 5: Create Preview Chat Component

**CREATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/preview/preview-chat.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  clientId: string;
}

export function KnowledgePreviewChat({ clientId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch(`/api/admin/clients/${clientId}/knowledge/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMessage,
          history: messages,
        }),
      });

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error generating response' }]);
    }

    setLoading(false);
  }

  return (
    <div className="flex flex-col h-[400px]">
      <div className="flex-1 overflow-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Test how the AI responds using the knowledge base. Try asking about services, pricing, etc.
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white ml-8'
                : 'bg-gray-100 mr-8'
            }`}
          >
            {msg.content}
          </div>
        ))}
        {loading && (
          <div className="bg-gray-100 mr-8 p-3 rounded-lg text-sm">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question as a customer..."
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          disabled={loading}
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
```

---

## Step 6: Create Test API Endpoint

**CREATE** `src/app/api/admin/clients/[id]/knowledge/test/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import OpenAI from 'openai';
import { buildKnowledgeContext, searchKnowledge } from '@/lib/services/knowledge-base';
import { db } from '@/lib/db';
import { clients } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { message, history } = await request.json();

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, params.id))
    .limit(1);

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const knowledgeContext = await buildKnowledgeContext(params.id);
  const relevantEntries = await searchKnowledge(params.id, message);

  let relevantSection = '';
  if (relevantEntries.length > 0) {
    relevantSection = `\n--- MOST RELEVANT ---\n`;
    for (const entry of relevantEntries.slice(0, 3)) {
      relevantSection += `${entry.title}: ${entry.content}\n`;
    }
  }

  const systemPrompt = `You are a helpful SMS assistant for ${client.businessName}.

${knowledgeContext}
${relevantSection}

Keep responses SHORT (1-3 sentences). Be helpful and professional.`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m: any) => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: message },
  ];

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.7,
    max_tokens: 200,
  });

  return NextResponse.json({
    response: response.choices[0].message.content,
  });
}
```

---

## Step 7: Add Preview Link to Knowledge Page

**UPDATE** `src/app/(dashboard)/admin/clients/[id]/knowledge/page.tsx`:

Add in the header buttons:

```typescript
<Button asChild variant="outline">
  <Link href={`/admin/clients/${params.id}/knowledge/preview`}>
    🧪 Test AI
  </Link>
</Button>
```

---

## Verify

1. `npm run dev`
2. Add knowledge entries for a client
3. Go to Knowledge Base → Test AI
4. Ask questions like:
   - "What services do you offer?"
   - "How much does a roof repair cost?"
   - "What areas do you serve?"
5. Verify AI uses knowledge base in responses
6. Test with real SMS conversation

---

## Next
Proceed to **Phase 16a** for notification preferences.
