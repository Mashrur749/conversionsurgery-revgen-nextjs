import { getAIProvider, getEmbeddingProvider, getActiveProviderName } from '@/lib/ai';
import type { ChatMessage, ChatOptions } from '@/lib/ai';
import { trackUsage } from '@/lib/services/usage-tracking';

interface TrackedCompletionParams {
  clientId: string;
  operation: string;
  messages: ChatMessage[];
  model?: 'fast' | 'quality';
  temperature?: number;
  maxTokens?: number;
  leadId?: string;
  responseFormat?: 'json' | 'text';
}

/**
 * Create chat completion with usage tracking.
 * Returns content string and token counts.
 */
export async function chatCompletion(params: TrackedCompletionParams) {
  const ai = getAIProvider();

  const options: ChatOptions = {
    model: params.model ?? 'fast',
    temperature: params.temperature ?? 0.7,
    maxTokens: params.maxTokens,
  };

  const result = params.responseFormat === 'json'
    ? await ai.chatJSON(params.messages, options)
    : await ai.chat(params.messages, options);

  // Track usage asynchronously (don't block response)
  trackUsage({
    clientId: params.clientId,
    service: getActiveProviderName(),
    operation: params.operation,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    leadId: params.leadId,
    metadata: {
      finishReason: result.finishReason,
    },
  }).catch(err => console.error('Usage tracking error:', err));

  return result;
}

/**
 * Create embedding with usage tracking.
 * Always uses OpenAI (Anthropic has no embedding API).
 */
export async function createEmbedding(params: {
  clientId: string;
  operation: string;
  input: string | string[];
}) {
  const embedder = getEmbeddingProvider();
  const result = await embedder.embed(params.input);

  trackUsage({
    clientId: params.clientId,
    service: 'openai',
    operation: params.operation,
    model: 'text-embedding-3-small',
    inputTokens: result.totalTokens,
  }).catch(err => console.error('Usage tracking error:', err));

  return result;
}
