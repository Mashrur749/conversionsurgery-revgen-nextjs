import { createNeonClient, type Database } from './client';

declare const getCloudflareContext: any;

/**
 * Get the database instance
 * Handles both Cloudflare Workers and Next.js environments
 */
export function getDb(env?: Record<string, string>): Database {
  let databaseUrl: string | undefined;

  // For Cloudflare Workers: Use context env
  if (typeof globalThis !== 'undefined' && 'getCloudflareContext' in globalThis) {
    try {
      const context = (globalThis as any).getCloudflareContext?.();
      databaseUrl = context?.env?.DATABASE_URL;
    } catch {
      // Fall back to environment variables
    }
  }

  // For Next.js or explicit env: Use environment variable
  if (!databaseUrl) {
    databaseUrl = env?.DATABASE_URL || process.env.DATABASE_URL;
  }

  if (!databaseUrl) {
    throw new Error('DATABASE_URL not found in environment variables or Cloudflare context');
  }

  return createNeonClient(databaseUrl);
}

// Re-export all schemas and types
export * from './schema';
export * from './types';
export type { Database } from './client';
