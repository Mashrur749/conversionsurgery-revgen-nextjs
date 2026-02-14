---
name: neon-postgres
description: Guides and best practices for working with Neon Serverless Postgres in this project
---

# Neon Serverless Postgres — Project Patterns

This skill documents how this project uses Neon Postgres via Drizzle ORM.

## Architecture

- **Driver**: `@neondatabase/serverless` (HTTP mode via `neon()`)
- **ORM**: `drizzle-orm/neon-http` — HTTP-based, stateless, Cloudflare Workers compatible
- **Schema management**: `drizzle-kit` with migrations in `./drizzle/`
- **Config**: `drizzle.config.ts` points to `./src/db/schema/index.ts`

## Database Access Pattern

```typescript
import { getDb, tableName } from '@/db';

// ALWAYS create a new instance per request — never cache
const db = getDb();

// Query with Drizzle
const results = await db.select().from(tableName).where(eq(tableName.col, value));
```

**Critical rule**: `getDb()` creates a fresh Neon HTTP client each time. This is intentional — the HTTP driver is stateless and designed for serverless/edge. Never store `db` in a module-level variable, singleton, or cache.

## Common Query Patterns

### Select with filters
```typescript
import { eq, and, gt, desc, isNull } from 'drizzle-orm';

const rows = await db
  .select()
  .from(leads)
  .where(and(eq(leads.clientId, clientId), eq(leads.status, 'active')))
  .orderBy(desc(leads.createdAt))
  .limit(20);
```

### Select specific columns
```typescript
const [client] = await db
  .select({ id: clients.id, name: clients.businessName })
  .from(clients)
  .where(eq(clients.id, clientId))
  .limit(1);
```

### Insert
```typescript
const [newRow] = await db
  .insert(leads)
  .values({ clientId, name, phone, status: 'new' })
  .returning();
```

### Update
```typescript
await db
  .update(leads)
  .set({ status: 'contacted', updatedAt: new Date() })
  .where(eq(leads.id, leadId));
```

### Delete (prefer soft deletes)
```typescript
// Soft delete — set status or deletedAt
await db.update(leads).set({ status: 'archived' }).where(eq(leads.id, leadId));

// Hard delete — only when appropriate (e.g., OTP codes, temp records)
await db.delete(otpCodes).where(eq(otpCodes.id, id));
```

### Joins
```typescript
const rows = await db
  .select({
    lead: leads,
    conversation: conversations,
  })
  .from(leads)
  .leftJoin(conversations, eq(conversations.leadId, leads.id))
  .where(eq(leads.clientId, clientId));
```

### Count / aggregation
```typescript
import { count, sql } from 'drizzle-orm';

const [{ total }] = await db
  .select({ total: count() })
  .from(leads)
  .where(eq(leads.clientId, clientId));
```

## Schema Conventions

- One table per file: `src/db/schema/<table-name>.ts`
- Re-export from `src/db/schema/index.ts`
- Use `pgTable` with these standard columns:
  ```typescript
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  ```
- Foreign keys reference parent with `onDelete: 'cascade'` or `'set null'` as appropriate
- Add indexes for columns used in WHERE clauses and JOINs
- Export inferred types: `export type Foo = typeof foos.$inferSelect;`

## Neon-Specific Considerations

### HTTP driver limitations
- No transactions (HTTP mode is stateless) — use `db.batch()` for multi-statement atomicity if needed
- No persistent connections, no connection pooling needed
- Each query is an independent HTTP request to Neon
- Cold starts are fast (~50ms) — Neon's serverless architecture handles this

### Performance
- Use `.limit()` on all queries — never fetch unbounded result sets
- Use `select({ col1, col2 })` instead of `select()` to reduce data transfer
- Add indexes via the schema definition, not raw SQL
- For paginated lists, use offset/limit or cursor-based pagination

### Branching (for safe migrations)
- Create a test branch before destructive migrations: `neonctl branches create --name migration-test`
- Test the migration on the branch first
- Delete the branch after verification: `neonctl branches delete migration-test`

## Type Safety

```typescript
import type { Lead, NewLead } from '@/db/schema';

// Use inferred types — never inline interfaces for DB rows
async function createLead(data: NewLead): Promise<Lead> {
  const db = getDb();
  const [lead] = await db.insert(leads).values(data).returning();
  return lead;
}
```

## Error Handling

```typescript
try {
  const db = getDb();
  const [result] = await db.select().from(table).where(condition);
  if (!result) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(result);
} catch (error) {
  console.error('Database error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
```

Never expose raw database errors to the client. Log them server-side and return a generic message.
