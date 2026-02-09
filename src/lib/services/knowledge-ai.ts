import OpenAI from 'openai';
import { getDb, clients, leads, conversations } from '@/db';
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
  const db = getDb();

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
      content: m.content,
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
      max_tokens: 200,
    });

    return response.choices[0].message.content ||
      `Thanks for reaching out! Let me have someone get back to you shortly.`;
  } catch (error) {
    console.error('AI response error:', error);
    return `Thanks for your message! We'll get back to you shortly.`;
  }
}
