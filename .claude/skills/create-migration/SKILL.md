---
name: create-migration
description: Guide through Drizzle schema changes and safe migration workflow for Neon Postgres
---

# Create Migration

Walks through the full Drizzle migration workflow for this project.

## Workflow

1. **Identify the schema change** — determine which table(s) in `src/db/schema/` need modification
2. **Edit the schema file** — modify the relevant file in `src/db/schema/` (one table per file)
3. **Re-export if needed** — ensure `src/db/schema/index.ts` exports any new tables
4. **Generate migration** — run `npm run db:generate` to create SQL migration files in `./drizzle/`
5. **Review the SQL** — read the generated migration file and verify:
   - No accidental `DROP TABLE` or `DROP COLUMN` statements
   - Column types and defaults are correct
   - Indexes are appropriate
6. **Ask user to confirm** — show the migration SQL and ask for approval before applying
7. **Apply migration** — only after user confirms, run `npm run db:push` or `npm run db:migrate`
8. **Verify** — run `npm run build` to confirm TypeScript types are consistent

## Safety Rules
- NEVER run `db:push` or `db:migrate` without showing the user the generated SQL first
- NEVER drop tables or columns without explicit user confirmation
- Always check for data loss implications when altering column types
- For destructive changes, recommend creating a Neon branch first: `neonctl branches create --name migration-test`

## Schema Location
- Schema files: `src/db/schema/*.ts`
- Schema index: `src/db/schema/index.ts`
- Drizzle config: `drizzle.config.ts`
- Generated migrations: `./drizzle/`
