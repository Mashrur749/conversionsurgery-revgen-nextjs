import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { ZodSchema } from 'zod';
import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ContentPart,
  ModelTier,
} from '../types';
import { withRetry } from '../retry';

type SystemParam = string | Anthropic.TextBlockParam[];

const MODEL_MAP: Record<ModelTier, string> = {
  fast: 'claude-haiku-4-5-20251001',
  quality: 'claude-sonnet-4-6',
};

function resolveModel(tier?: ModelTier): string {
  return MODEL_MAP[tier ?? 'fast'];
}

/**
 * Separate system messages from the message array.
 * Anthropic requires system as a top-level param, not in the messages array.
 */
function extractSystem(
  messages: ChatMessage[],
  systemPrompt?: string,
): { system: string | undefined; messages: ChatMessage[] } {
  const systemMessages: string[] = [];
  const nonSystem: ChatMessage[] = [];

  if (systemPrompt) {
    systemMessages.push(systemPrompt);
  }

  for (const m of messages) {
    if (m.role === 'system') {
      systemMessages.push(typeof m.content === 'string' ? m.content : '');
    } else {
      nonSystem.push(m);
    }
  }

  return {
    system: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
    messages: nonSystem,
  };
}

/**
 * Build the system parameter for Anthropic's messages API.
 * When systemBlocks are provided they are used directly (supports cache_control).
 * Falls back to extractSystem() for callers that pass systemPrompt as a plain string.
 */
function buildSystemParam(
  messages: ChatMessage[],
  options?: ChatOptions,
): { system: SystemParam | undefined; messages: ChatMessage[] } {
  if (options?.systemBlocks && options.systemBlocks.length > 0) {
    const { messages: nonSystem } = extractSystem(messages, undefined);
    const blocks: Anthropic.TextBlockParam[] = options.systemBlocks.map((block) => ({
      type: 'text' as const,
      text: block.text,
      ...(block.cacheControl ? { cache_control: { type: block.cacheControl } } : {}),
    }));
    return { system: blocks, messages: nonSystem };
  }
  return extractSystem(messages, options?.systemPrompt);
}

/** Convert our ChatMessage to Anthropic's format */
function toAnthropicMessages(
  messages: ChatMessage[],
): Anthropic.MessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role as 'user' | 'assistant', content: m.content };
    }

    // Multi-part content (e.g., vision)
    const parts: Anthropic.ContentBlockParam[] = m.content.map((part: ContentPart) => {
      if (part.type === 'image_url' && part.image_url) {
        return {
          type: 'image' as const,
          source: {
            type: 'url' as const,
            url: part.image_url.url,
          },
        };
      }
      return { type: 'text' as const, text: part.text ?? '' };
    });

    return { role: m.role as 'user' | 'assistant', content: parts };
  });
}

function extractResult(
  response: Anthropic.Message,
  modelName: string,
): ChatResult {
  const textBlock = response.content.find((b) => b.type === 'text');
  return {
    content: textBlock && 'text' in textBlock ? textBlock.text : '',
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    model: modelName,
    finishReason: response.stop_reason ?? undefined,
  };
}

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      timeout: 15_000,
      maxRetries: 0, // We handle retries via withRetry()
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const modelName = resolveModel(options?.model);
    const { system, messages: nonSystemMessages } = buildSystemParam(messages, options);
    const anthropicMessages = toAnthropicMessages(nonSystemMessages);

    return withRetry(async () => {
      const response = await this.client.messages.create({
        model: modelName,
        max_tokens: options?.maxTokens ?? 1024,
        system,
        messages: anthropicMessages,
        temperature: options?.temperature,
      });
      return extractResult(response, modelName);
    });
  }

  async chatJSON<T>(messages: ChatMessage[], options?: ChatOptions): Promise<{ data: T } & ChatResult> {
    const modelName = resolveModel(options?.model);
    const { system, messages: nonSystemMessages } = buildSystemParam(messages, options);

    // Append JSON instruction to system prompt (or blocks)
    const JSON_INSTRUCTION = 'You MUST respond with valid JSON only. No markdown, no explanation.';
    let jsonSystem: SystemParam;
    if (Array.isArray(system)) {
      jsonSystem = [...system, { type: 'text' as const, text: JSON_INSTRUCTION }];
    } else {
      jsonSystem = system
        ? `${system}\n\n${JSON_INSTRUCTION}`
        : JSON_INSTRUCTION;
    }

    const anthropicMessages = toAnthropicMessages(nonSystemMessages);

    return withRetry(async () => {
      const response = await this.client.messages.create({
        model: modelName,
        max_tokens: options?.maxTokens ?? 1024,
        system: jsonSystem,
        messages: anthropicMessages,
        temperature: options?.temperature,
      });

      const result = extractResult(response, modelName);
      // Strip potential markdown code fences
      const cleaned = result.content.replace(/```json\n?|\n?```/g, '').trim();
      const data = JSON.parse(cleaned) as T;
      return { ...result, data };
    });
  }

  async chatStructured<T>(
    messages: ChatMessage[],
    schema: ZodSchema<T>,
    options?: ChatOptions,
  ): Promise<{ data: T } & ChatResult> {
    const modelName = resolveModel(options?.model);
    const { system, messages: nonSystemMessages } = buildSystemParam(messages, options);
    const anthropicMessages = toAnthropicMessages(nonSystemMessages);

    return withRetry(async () => {
      const response = await this.client.messages.parse({
        model: modelName,
        max_tokens: options?.maxTokens ?? 4096,
        system,
        messages: anthropicMessages,
        temperature: options?.temperature,
        output_config: {
          format: zodOutputFormat(schema),
        },
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      const result: ChatResult = {
        content: textBlock && 'text' in textBlock ? textBlock.text : '',
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        model: modelName,
        finishReason: response.stop_reason ?? undefined,
      };

      const data = (response.parsed_output ?? schema.parse(JSON.parse(result.content))) as T;
      return { ...result, data };
    });
  }
}
