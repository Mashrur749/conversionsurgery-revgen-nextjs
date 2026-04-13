import type { AIProvider } from '@/lib/ai/types';
import type { AsyncAssertFn } from './types';

export interface JudgeResult {
  score: number;   // 1-5
  passed: boolean; // true if score >= 3
  reason: string;  // one sentence
}

/**
 * Generic LLM-as-judge helper. Sends a cheap (Haiku) call asking the model to
 * rate the response on a criterion and returns a structured JudgeResult.
 */
export async function llmJudge(
  ai: AIProvider,
  response: string,
  criterion: string,
  context?: string,
): Promise<JudgeResult> {
  const contextLine = context ? `\nContext: ${context}` : '';
  const prompt = `Rate this SMS message on the criterion: "${criterion}"

Message: "${response}"${contextLine}

Respond with ONLY a JSON object: {"score": <1-5>, "passed": <true if score >= 3>, "reason": "<one sentence>"}`;

  try {
    const result = await ai.chat(
      [{ role: 'user', content: prompt }],
      { model: 'fast', temperature: 0, maxTokens: 100 },
    );

    const parsed = JSON.parse(result.content) as { score: unknown; passed: unknown; reason: unknown };

    const score = typeof parsed.score === 'number' ? parsed.score : 0;
    const passed = typeof parsed.passed === 'boolean' ? parsed.passed : score >= 3;
    const reason = typeof parsed.reason === 'string' ? parsed.reason : 'No reason provided';

    return { score, passed, reason };
  } catch {
    return { score: 0, passed: false, reason: 'Failed to parse' };
  }
}

/**
 * Asserts that the response matches the expected tone.
 * Professional = formal and courteous. Friendly = warm and conversational. Casual = relaxed like texting a friend.
 */
export function matchesTone(ai: AIProvider, expectedTone: string): AsyncAssertFn {
  return async (response: string, context?: Record<string, unknown>): Promise<void> => {
    const criterion = `Is the tone "${expectedTone}"? Professional means formal and courteous. Friendly means warm and conversational. Casual means relaxed like texting a friend.`;
    const ctxStr = context ? JSON.stringify(context) : undefined;
    const result = await llmJudge(ai, response, criterion, ctxStr);
    if (!result.passed) {
      throw new Error(`Tone mismatch: expected ${expectedTone} — ${result.reason} (score: ${result.score})`);
    }
  };
}

/**
 * Asserts that the response conveys the expected sentiment.
 */
export function sentimentIs(ai: AIProvider, expected: string): AsyncAssertFn {
  return async (response: string, context?: Record<string, unknown>): Promise<void> => {
    const criterion = `Does this message convey a "${expected}" sentiment?`;
    const ctxStr = context ? JSON.stringify(context) : undefined;
    const result = await llmJudge(ai, response, criterion, ctxStr);
    if (!result.passed) {
      throw new Error(`Sentiment mismatch: expected ${expected} — ${result.reason} (score: ${result.score})`);
    }
  };
}

/**
 * Asserts that the response sounds like a real human texting, not a chatbot.
 */
export function soundsHuman(ai: AIProvider): AsyncAssertFn {
  return async (response: string, context?: Record<string, unknown>): Promise<void> => {
    const criterion = 'Does this message sound like a real human texting naturally, rather than a chatbot or automated system? It should feel personal, conversational, and not overly formal or robotic.';
    const ctxStr = context ? JSON.stringify(context) : undefined;
    const result = await llmJudge(ai, response, criterion, ctxStr);
    if (!result.passed) {
      throw new Error(`Human-sounding check failed — ${result.reason} (score: ${result.score})`);
    }
  };
}

/**
 * Asserts that the response does not hallucinate facts outside the provided KB context.
 */
export function doesNotHallucinate(ai: AIProvider, kbContext: string): AsyncAssertFn {
  return async (response: string): Promise<void> => {
    const criterion = 'Does this message only use facts, figures, or claims that are explicitly present in the provided context? It must not invent details, pricing, services, or promises not found in the context.';
    const result = await llmJudge(ai, response, criterion, kbContext);
    if (!result.passed) {
      throw new Error(`Hallucination detected — ${result.reason} (score: ${result.score})`);
    }
  };
}
