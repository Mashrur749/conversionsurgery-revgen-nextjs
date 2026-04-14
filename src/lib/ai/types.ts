import type { ZodSchema } from 'zod';

/** Model tier abstraction — maps to provider-specific models */
export type ModelTier = 'fast' | 'quality';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ContentPart {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: { url: string };
}

export interface SystemBlock {
  text: string;
  cacheControl?: 'ephemeral';
}

export interface ChatOptions {
  model?: ModelTier;
  temperature?: number;
  maxTokens?: number;
  /** Extracted as a top-level param for Anthropic compatibility */
  systemPrompt?: string;
  /** Split system prompt into cacheable blocks. When provided, takes precedence over systemPrompt. */
  systemBlocks?: SystemBlock[];
}

export interface ChatResult {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  model: string;
  finishReason?: string;
}

export interface AIProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  chatJSON<T>(messages: ChatMessage[], options?: ChatOptions): Promise<{ data: T } & ChatResult>;
  chatStructured<T>(messages: ChatMessage[], schema: ZodSchema<T>, options?: ChatOptions): Promise<{ data: T } & ChatResult>;
}
