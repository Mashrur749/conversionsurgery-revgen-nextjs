import type { AssertFn } from './types';

/**
 * Asserts that the response includes at least one of the given patterns.
 * Matching is case-insensitive for string patterns.
 */
export function mentions(...patterns: Array<string | RegExp>): AssertFn {
  return (response: string): void => {
    const lower = response.toLowerCase();
    const found = patterns.some((p) => {
      if (p instanceof RegExp) {
        return p.test(response);
      }
      return lower.includes(p.toLowerCase());
    });
    if (!found) {
      const labels = patterns.map((p) => (p instanceof RegExp ? p.toString() : `"${p}"`)).join(', ');
      throw new Error(`Expected response to mention at least one of [${labels}], but none were found.\nResponse: ${response}`);
    }
  };
}

/**
 * Asserts that the response includes NONE of the given patterns.
 * Matching is case-insensitive for string patterns.
 */
export function doesNotMention(...patterns: Array<string | RegExp>): AssertFn {
  return (response: string): void => {
    const lower = response.toLowerCase();
    for (const p of patterns) {
      const found = p instanceof RegExp ? p.test(response) : lower.includes(p.toLowerCase());
      if (found) {
        const label = p instanceof RegExp ? p.toString() : `"${p}"`;
        throw new Error(`Expected response NOT to mention ${label}, but it was found.\nResponse: ${response}`);
      }
    }
  };
}

/**
 * Asserts that the response length does not exceed the given limit.
 */
export function maxLength(limit: number): AssertFn {
  return (response: string): void => {
    if (response.length > limit) {
      throw new Error(`Expected response length <= ${limit}, but got ${response.length}.\nResponse: ${response}`);
    }
  };
}

/**
 * Asserts that the number of question marks in the response does not exceed n.
 */
export function maxQuestions(n: number): AssertFn {
  return (response: string): void => {
    const count = (response.match(/\?/g) ?? []).length;
    if (count > n) {
      throw new Error(`Expected at most ${n} question(s) in response, but found ${count}.\nResponse: ${response}`);
    }
  };
}

/**
 * Asserts that no 4+ word phrase from the response appears in context.previousResponses.
 * Skips the check if context.previousResponses is not provided.
 */
export function noRepetition(minLength = 4): AssertFn {
  return (response: string, context?: Record<string, unknown>): void => {
    const previousResponses = context?.previousResponses;
    if (!Array.isArray(previousResponses) || previousResponses.length === 0) {
      return;
    }

    const words = response.trim().split(/\s+/);
    for (let i = 0; i <= words.length - minLength; i++) {
      const phrase = words.slice(i, i + minLength).join(' ').toLowerCase();
      for (const prev of previousResponses as string[]) {
        if (prev.toLowerCase().includes(phrase)) {
          throw new Error(
            `Response repeats a ${minLength}+ word phrase from a previous response: "${phrase}".\nResponse: ${response}`
          );
        }
      }
    }
  };
}

/**
 * Asserts that the response ends with a complete sentence (ends with . ! ? ) ' "),
 * and does not end with an ellipsis.
 */
export function endsWithCompleteSentence(): AssertFn {
  return (response: string): void => {
    const trimmed = response.trimEnd();
    if (trimmed.endsWith('...')) {
      throw new Error(`Expected response to end with a complete sentence, but it ends with "...".\nResponse: ${trimmed}`);
    }
    if (!/[.!?)'"]$/.test(trimmed)) {
      throw new Error(
        `Expected response to end with one of [. ! ? ) ' "], but it ends with "${trimmed.slice(-1)}".\nResponse: ${trimmed}`
      );
    }
  };
}

/**
 * Asserts that the response has no broken formatting:
 * - No "Agent:" prefix
 * - No markdown headings (# ## ###)
 * - No bold text (**text**)
 * - No code blocks (```)
 */
export function noBrokenFormatting(): AssertFn {
  return (response: string): void => {
    if (/^Agent:/i.test(response.trimStart())) {
      throw new Error(`Response must not start with "Agent:" prefix.\nResponse: ${response}`);
    }
    if (/^#{1,6}\s/m.test(response)) {
      throw new Error(`Response must not contain markdown headings.\nResponse: ${response}`);
    }
    if (/\*\*[^*]+\*\*/.test(response)) {
      throw new Error(`Response must not contain bold markdown (**text**).\nResponse: ${response}`);
    }
    if (/```/.test(response)) {
      throw new Error(`Response must not contain code blocks (\`\`\`).\nResponse: ${response}`);
    }
  };
}

/**
 * Asserts that the response length is within the given range (inclusive).
 */
export function lengthBetween(min: number, max: number): AssertFn {
  return (response: string): void => {
    if (response.length < min || response.length > max) {
      throw new Error(
        `Expected response length between ${min} and ${max}, but got ${response.length}.\nResponse: ${response}`
      );
    }
  };
}

/**
 * Asserts that the response contains at least minKeywords (default 2) words of 4+ characters
 * that also appear in the provided context string.
 */
export function referencesContext(context: string, minKeywords = 2): AssertFn {
  return (response: string): void => {
    const contextWords = new Set(
      context
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length >= 4)
    );

    const responseLower = response.toLowerCase();
    let matches = 0;
    for (const word of contextWords) {
      if (responseLower.includes(word)) {
        matches++;
        if (matches >= minKeywords) return;
      }
    }

    throw new Error(
      `Expected response to reference at least ${minKeywords} keyword(s) from context, but only found ${matches}.\nContext: ${context}\nResponse: ${response}`
    );
  };
}
