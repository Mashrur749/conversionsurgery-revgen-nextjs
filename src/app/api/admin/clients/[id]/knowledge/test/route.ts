import { NextResponse } from 'next/server';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import OpenAI from 'openai';
import { buildKnowledgeContext, searchKnowledge } from '@/lib/services/knowledge-base';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const testSchema = z.object({
  message: z.string().min(1, 'Message is required'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional().default([]),
});

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.KNOWLEDGE_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json();
    const { message, history } = testSchema.parse(body);

    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const knowledgeContext = await buildKnowledgeContext(clientId);
    const relevantEntries = await searchKnowledge(clientId, message);

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

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: message },
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
);
