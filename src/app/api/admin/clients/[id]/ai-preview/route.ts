import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getTrackedAI } from '@/lib/ai';
import { getDb, clients } from '@/db';
import { eq } from 'drizzle-orm';
import { buildKnowledgeContext } from '@/lib/services/knowledge-base';

const previewSchema = z.object({
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
}).strict();

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_EDIT, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json() as unknown;
    const { message } = previewSchema.parse(body);

    const db = getDb();
    const [client] = await db
      .select({
        businessName: clients.businessName,
        timezone: clients.timezone,
      })
      .from(clients)
      .where(eq(clients.id, clientId))
      .limit(1);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const knowledgeContext = await buildKnowledgeContext(clientId);

    const systemPrompt = [
      `You are a helpful assistant for ${client.businessName}, a home services contractor.`,
      `Your job is to respond to homeowner inquiries in a professional, friendly, and concise manner.`,
      `Always aim to schedule an estimate or consultation when appropriate.`,
      ...(client.timezone ? [`Timezone: ${client.timezone}.`] : []),
      '',
      knowledgeContext
        ? knowledgeContext
        : 'No specific knowledge base configured yet. Use general contractor best practices.',
      '',
      'Keep your response conversational and under 3 sentences when possible.',
      'Do not make up specific prices unless pricing information is provided above.',
      'If asked about availability, encourage the homeowner to call or schedule an estimate.',
    ].join('\n');

    const ai = getTrackedAI({ clientId, operation: 'ai_preview' });

    const result = await ai.chat(
      [{ role: 'user', content: message }],
      {
        model: 'quality',
        temperature: 0.3,
        maxTokens: 500,
        systemPrompt,
      }
    );

    return NextResponse.json({
      response: result.content,
      modelUsed: result.model,
    });
  }
);
