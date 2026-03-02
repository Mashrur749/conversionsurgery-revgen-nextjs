import type { AIProvider, EmbeddingProvider } from './types';
import { OpenAIProvider, OpenAIEmbeddingProvider } from './providers/openai';
import { AnthropicProvider } from './providers/anthropic';

export type AIProviderName = 'openai' | 'anthropic';

function getProviderName(): AIProviderName {
  const name = (process.env.AI_PROVIDER || 'anthropic') as AIProviderName;
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
      return new AnthropicProvider();
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
