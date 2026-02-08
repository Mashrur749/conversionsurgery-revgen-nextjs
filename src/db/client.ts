import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

/**
 * Factory function to create a Neon HTTP client
 * Uses fetch-based HTTP driver compatible with Cloudflare Workers
 */
export function createNeonClient(databaseUrl: string) {
  const sql = neon(databaseUrl);
  return drizzle(sql, { schema });
}

/**
 * Type definition for the database client
 */
export type Database = ReturnType<typeof createNeonClient>;
