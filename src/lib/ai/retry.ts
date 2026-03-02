const DEFAULT_MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

/**
 * Determines if an error is retryable (rate limit, server error, network issue).
 */
function isRetryable(error: unknown): boolean {
  // HTTP-status errors (works for both OpenAI and Anthropic SDKs)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status;
    if (status === 429 || status >= 500) return true;
  }

  // Network / timeout errors
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('timeout') || msg.includes('econnreset') || msg.includes('fetch failed')) {
      return true;
    }
  }

  return false;
}

/**
 * Retry wrapper with exponential backoff.
 * - Retryable: 429, 5xx, ECONNRESET, timeout, fetch failed
 * - Non-retryable: 4xx (except 429) throw immediately
 * - Backoff: 1s, 2s, 4s ...
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULT_MAX_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error) || attempt >= maxRetries) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.warn(`[AI] Attempt ${attempt + 1} failed (retryable), retrying in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
