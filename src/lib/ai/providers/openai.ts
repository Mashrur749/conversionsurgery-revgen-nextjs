import OpenAI from 'openai';
import { z, type ZodSchema } from 'zod';
import type {
  AIProvider,
  ChatMessage,
  ChatOptions,
  ChatResult,
  ContentPart,
  EmbeddingProvider,
  ModelTier,
} from '../types';
import { withRetry } from '../retry';

const MODEL_MAP: Record<ModelTier, string> = {
  fast: 'gpt-4o-mini',
  quality: 'gpt-4o',
};

function resolveModel(tier?: ModelTier): string {
  return MODEL_MAP[tier ?? 'fast'];
}

/** Convert our ChatMessage[] to OpenAI's format */
function toOpenAIMessages(
  messages: ChatMessage[],
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content } as OpenAI.ChatCompletionMessageParam;
    }

    // Multi-part content (e.g., vision)
    const parts: OpenAI.ChatCompletionContentPart[] = m.content.map((part: ContentPart) => {
      if (part.type === 'image_url' && part.image_url) {
        return { type: 'image_url' as const, image_url: { url: part.image_url.url } };
      }
      return { type: 'text' as const, text: part.text ?? '' };
    });

    return { role: m.role, content: parts } as OpenAI.ChatCompletionMessageParam;
  });
}

function extractResult(
  response: OpenAI.ChatCompletion,
  modelName: string,
): ChatResult {
  return {
    content: response.choices[0]?.message?.content ?? '',
    inputTokens: response.usage?.prompt_tokens,
    outputTokens: response.usage?.completion_tokens,
    model: modelName,
    finishReason: response.choices[0]?.finish_reason ?? undefined,
  };
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      timeout: 15_000,
      maxRetries: 0, // We handle retries via withRetry()
    });
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult> {
    const modelName = resolveModel(options?.model);
    const openaiMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages,
    );

    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
      });
      return extractResult(response, modelName);
    });
  }

  async chatJSON<T>(messages: ChatMessage[], options?: ChatOptions): Promise<{ data: T } & ChatResult> {
    const modelName = resolveModel(options?.model);
    const openaiMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages,
    );

    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        response_format: { type: 'json_object' },
      });

      const result = extractResult(response, modelName);
      const data = JSON.parse(result.content) as T;
      return { ...result, data };
    });
  }

  async chatStructured<T>(
    messages: ChatMessage[],
    schema: ZodSchema<T>,
    options?: ChatOptions,
  ): Promise<{ data: T } & ChatResult> {
    const modelName = resolveModel(options?.model);
    const jsonSchema = z.toJSONSchema(schema);
    const openaiMessages = toOpenAIMessages(
      options?.systemPrompt
        ? [{ role: 'system', content: options.systemPrompt }, ...messages]
        : messages,
    );

    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: modelName,
        messages: openaiMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens ?? 4096,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'structured_output',
            strict: true,
            schema: jsonSchema as Record<string, unknown>,
          },
        },
      });

      const result = extractResult(response, modelName);
      const raw = JSON.parse(result.content);
      const data = schema.parse(raw) as T;
      return { ...result, data };
    });
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      timeout: 15_000,
      maxRetries: 0,
    });
  }

  async embed(input: string | string[]): Promise<{ embeddings: number[][]; totalTokens?: number }> {
    return withRetry(async () => {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input,
      });

      return {
        embeddings: response.data.map((d) => d.embedding),
        totalTokens: response.usage?.total_tokens,
      };
    });
  }
}
