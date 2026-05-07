import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Two projects so node-env tests stay fast while React component tests run in
 * jsdom. `environmentMatchGlobs` was removed in vitest v4 — `projects` is the
 * replacement. Both projects share the same alias + setup.
 */
export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.ai-test.ts', 'node_modules/**'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: { label: 'jsdom', color: 'cyan' },
          include: ['src/**/*.test.tsx'],
          exclude: ['node_modules/**'],
          environment: 'jsdom',
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
