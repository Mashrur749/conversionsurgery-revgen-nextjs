import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!(session as any)?.user?.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { message, history } = testSchema.parse(body);

    const db = getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, id))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const knowledgeContext = await buildKnowledgeContext(id);
    const relevantEntries = await searchKnowledge(id, message);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    console.error('Knowledge test error:', error);
    return NextResponse.json(
      { error: 'Failed to generate test response' },
      { status: 500 }
    );
  }
}
