import type { AIProvider } from './types';
import { AnthropicProvider } from './providers/anthropic';

/**
 * Returns the AI chat provider.
 * Creates a new instance per call — safe for serverless (no stale singletons).
 */
export function getAIProvider(): AIProvider {
  return new AnthropicProvider();
}

/** Returns the provider name for usage tracking */
export function getActiveProviderName(): 'anthropic' {
  return 'anthropic';
}

// Re-exports
export type { AIProvider, ChatMessage, ChatResult, ChatOptions, ModelTier, ContentPart } from './types';
