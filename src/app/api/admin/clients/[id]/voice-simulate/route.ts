import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminClientRoute, AGENCY_PERMISSIONS } from '@/lib/utils/route-handler';
import { getTrackedAI } from '@/lib/ai';
import { getDb, clients, clientAgentSettings } from '@/db';
import { eq } from 'drizzle-orm';
import { buildKnowledgeContext } from '@/lib/services/knowledge-base';
import { buildVoiceSystemPrompt } from '@/lib/services/voice-prompt-builder';

const simulateSchema = z.object({
  message: z.string().min(1).max(1000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).default([]),
}).strict();

export const POST = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ request, clientId }) => {
    const body = await request.json() as unknown;
    const { message, history } = simulateSchema.parse(body);

    const db = getDb();

    // Load client + agent settings in parallel
    const [[client], [agentSettings]] = await Promise.all([
      db.select({
        businessName: clients.businessName,
        ownerName: clients.ownerName,
      }).from(clients).where(eq(clients.id, clientId)).limit(1),
      db.select({
        agentTone: clientAgentSettings.agentTone,
        canDiscussPricing: clientAgentSettings.canDiscussPricing,
      }).from(clientAgentSettings).where(eq(clientAgentSettings.clientId, clientId)).limit(1),
    ]);

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    const knowledgeContext = await buildKnowledgeContext(clientId);

    const systemPrompt = buildVoiceSystemPrompt({
      businessName: client.businessName,
      ownerName: client.ownerName || 'the owner',
      agentTone: (agentSettings?.agentTone || 'professional') as 'professional' | 'friendly' | 'casual',
      canDiscussPricing: agentSettings?.canDiscussPricing || false,
      knowledgeContext,
    });

    const ai = getTrackedAI({ clientId, operation: 'voice_simulate' });

    const messages = [
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user' as const, content: message },
    ];

    const result = await ai.chat(messages, {
      model: 'fast', // Haiku for speed — playground should feel instant
      temperature: 0.7,
      maxTokens: 200,
      systemPrompt,
    });

    return NextResponse.json({
      response: result.content,
      modelUsed: result.model,
    });
  }
);
