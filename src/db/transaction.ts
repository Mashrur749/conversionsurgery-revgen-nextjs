import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from './schema';

// Node.js polyfill — CF Workers have native WebSocket
if (typeof WebSocket === 'undefined') {
  import('ws').then((ws) => {
    neonConfig.webSocketConstructor = ws.default;
  });
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not found');
  return url;
}

type WsDb = ReturnType<typeof drizzle<typeof schema>>;

/** The transaction object passed to `withTransaction()` callbacks. */
export type Transaction = Parameters<Parameters<WsDb['transaction']>[0]>[0];

/**
 * Run a callback inside a real Postgres transaction using the Neon WebSocket driver.
 * A Pool is created and torn down per call — safe for serverless / CF Workers.
 *
 * Usage:
 *   const result = await withTransaction(async (tx) => {
 *     await tx.insert(foos).values({ ... });
 *     await tx.update(bars).set({ ... }).where(...);
 *     return someValue;
 *   });
 */
export async function withTransaction<T>(
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const pool = new Pool({ connectionString: getDatabaseUrl() });
  const db = drizzle(pool, { schema });
  try {
    return await db.transaction(fn);
  } finally {
    await pool.end();
  }
}
