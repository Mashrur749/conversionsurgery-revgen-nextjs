import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Vitest config for AI criteria tests.
 *
 * These tests make real LLM calls and validate AI output quality.
 * They are excluded from `npm test` and run via `npm run test:ai`.
 *
 * Requirements:
 * - ANTHROPIC_API_KEY must be set
 * - Each test takes 3-15 seconds (real API calls)
 * - Expect ~$0.01-0.05 per full suite run (Haiku-tier)
 */
export default defineConfig({
  test: {
    include: ['src/**/*.ai-test.ts'],
    testTimeout: 30_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
