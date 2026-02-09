import OpenAI from 'openai';
import { trackUsage } from '@/lib/services/usage-tracking';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TrackedCompletionParams {
  clientId: string;
  operation: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  leadId?: string;
  response_format?: { type: 'json_object' } | { type: 'text' };
}

/**
 * Create chat completion with usage tracking
 */
export async function chatCompletion(params: TrackedCompletionParams) {
  const model = params.model || 'gpt-4o-mini';

  const response = await openai.chat.completions.create({
    model,
    messages: params.messages,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens,
    response_format: params.response_format,
  });

  // Track usage asynchronously (don't block response)
  trackUsage({
    clientId: params.clientId,
    service: 'openai',
    operation: params.operation,
    model,
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    leadId: params.leadId,
    externalId: response.id,
    metadata: {
      finishReason: response.choices[0]?.finish_reason,
    },
  }).catch(err => console.error('Usage tracking error:', err));

  return response;
}

/**
 * Create embedding with usage tracking
 */
export async function createEmbedding(params: {
  clientId: string;
  operation: string;
  input: string | string[];
}) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: params.input,
  });

  trackUsage({
    clientId: params.clientId,
    service: 'openai',
    operation: params.operation,
    model: 'text-embedding-3-small',
    inputTokens: response.usage?.total_tokens,
  }).catch(err => console.error('Usage tracking error:', err));

  return response;
}

// Re-export for convenience
export { openai };
