import type { AIProvider } from './types';
import { AnthropicProvider } from './providers/anthropic';
import { TrackedAIProvider } from './tracked';

/**
 * Returns the AI chat provider (untracked).
 * Use getTrackedAI() instead when a clientId is available.
 */
export function getAIProvider(): AIProvider {
  return new AnthropicProvider();
}

/**
 * Returns an AI provider that automatically tracks usage after every call.
 * Preferred over getAIProvider() for all client-scoped operations.
 */
export function getTrackedAI(ctx: {
  clientId: string;
  operation: string;
  leadId?: string;
  metadata?: Record<string, unknown>;
}): AIProvider {
  return new TrackedAIProvider(new AnthropicProvider(), ctx);
}

/** Returns the provider name for usage tracking */
export function getActiveProviderName(): 'anthropic' {
  return 'anthropic';
}

// Re-exports
export type { AIProvider, ChatMessage, ChatResult, ChatOptions, ModelTier, ContentPart } from './types';
