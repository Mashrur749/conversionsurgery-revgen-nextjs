import type { AIProvider, ChatMessage, ChatOptions, ChatResult } from './types';
import type { ZodSchema } from 'zod';
import { trackUsage } from '@/lib/services/usage-tracking';
import { getActiveProviderName } from './index';

interface TrackingContext {
  clientId: string;
  operation: string;
  leadId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Wraps an AIProvider with automatic usage tracking.
 * Every chat/chatJSON/chatStructured call fires trackUsage() after completion.
 */
export class TrackedAIProvider implements AIProvider {
  readonly name: string;

  constructor(
    private provider: AIProvider,
    private ctx: TrackingContext,
  ) {
    this.name = provider.name;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const result = await this.provider.chat(messages, options);
    this.track(result);
    return result;
  }

  async chatJSON<T>(messages: ChatMessage[], options?: ChatOptions): Promise<{ data: T } & ChatResult> {
    const result = await this.provider.chatJSON<T>(messages, options);
    this.track(result);
    return result;
  }

  async chatStructured<T>(messages: ChatMessage[], schema: ZodSchema<T>, options?: ChatOptions): Promise<{ data: T } & ChatResult> {
    const result = await this.provider.chatStructured<T>(messages, schema, options);
    this.track(result);
    return result;
  }

  private track(result: ChatResult): void {
    trackUsage({
      clientId: this.ctx.clientId,
      service: getActiveProviderName(),
      operation: this.ctx.operation,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      leadId: this.ctx.leadId,
      metadata: { ...this.ctx.metadata, finishReason: result.finishReason },
    }).catch(() => {});
  }
}
