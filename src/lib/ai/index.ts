import type { AIProvider, EmbeddingProvider } from './types';
import { OpenAIProvider, OpenAIEmbeddingProvider } from './providers/openai';

export type AIProviderName = 'openai' | 'anthropic';

function getProviderName(): AIProviderName {
  const name = (process.env.AI_PROVIDER || 'openai') as AIProviderName;
  if (name !== 'openai' && name !== 'anthropic') {
    throw new Error(`Unknown AI_PROVIDER: ${name}. Must be 'openai' or 'anthropic'.`);
  }
  return name;
}

/**
 * Returns the active AI chat provider based on AI_PROVIDER env var.
 * Creates a new instance per call — safe for serverless (no stale singletons).
 */
export function getAIProvider(): AIProvider {
  const name = getProviderName();

  switch (name) {
    case 'openai':
      return new OpenAIProvider();
    case 'anthropic':
      // Anthropic provider added in C4 — throw clear error until then
      throw new Error('Anthropic provider not yet installed. Set AI_PROVIDER=openai or install the anthropic provider.');
  }
}

/**
 * Returns the embedding provider. Always OpenAI — Anthropic has no embedding API.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  return new OpenAIEmbeddingProvider();
}

/** Returns the current provider name for usage tracking */
export function getActiveProviderName(): AIProviderName {
  return getProviderName();
}

// Re-exports
export type { AIProvider, EmbeddingProvider, ChatMessage, ChatResult, ChatOptions, ModelTier, ContentPart } from './types';
