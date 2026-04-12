/**
 * Reconcile migrations after db:push
 *
 * Creates the drizzle.__drizzle_migrations table and marks all migrations
 * as applied, so that db:migrate works correctly going forward.
 *
 * Run AFTER db:push: npx tsx scripts/reconcile-migrations.ts
 */
import 'dotenv/config';
import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Load .env.local (Next.js convention)
config({ path: path.join(process.cwd(), '.env.local') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found in .env.local or environment');
  process.exit(1);
}
const sql = neon(dbUrl);

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

async function reconcile() {
  console.log('');
  console.log('========================================');
  console.log('  Migration Reconciliation');
  console.log('========================================');
  console.log('');

  // 1. Create the schema and table if they don't exist
  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;
  console.log('  ✓ drizzle.__drizzle_migrations table ready');

  // 2. Read the journal to get all migration entries
  const journalPath = path.join(process.cwd(), 'drizzle', 'meta', '_journal.json');
  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
  const entries: JournalEntry[] = journal.entries;

  // 3. Check which migrations are already tracked
  const existing = await sql`
    SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at
  `;
  const existingTimestamps = new Set(existing.map((r: Record<string, unknown>) => String(r.created_at)));

  console.log(`  Found ${existing.length} already-tracked migrations`);
  console.log(`  Journal has ${entries.length} total migrations`);

  // 4. Insert any missing migrations
  let inserted = 0;
  for (const entry of entries) {
    if (existingTimestamps.has(String(entry.when))) {
      continue; // Already tracked
    }

    // Read the SQL file to compute the hash (Drizzle uses the SQL content hash)
    const sqlPath = path.join(process.cwd(), 'drizzle', `${entry.tag}.sql`);
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    const hash = crypto.createHash('sha256').update(sqlContent).digest('hex');

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    inserted++;
    console.log(`  ✓ Marked as applied: ${entry.tag}`);
  }

  console.log('');
  if (inserted === 0) {
    console.log('  All migrations already tracked. Nothing to do.');
  } else {
    console.log(`  ✓ Reconciled ${inserted} migrations`);
  }
  console.log('');
  console.log('  db:migrate will now work correctly going forward.');
  console.log('');
}

reconcile()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('  ✗ Reconciliation failed:', err);
    process.exit(1);
  });
