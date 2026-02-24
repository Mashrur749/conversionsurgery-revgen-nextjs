---
name: neon-postgres
description: Neon operational workflow for safe branching, migration validation, and rollback readiness
---

# Neon Postgres

Use this skill when schema or data migration work touches production-bound workflows.

## Use Cases
- Any change in `src/db/schema/*`
- Any generated migration in `drizzle/*`
- Any migration-affecting spec milestone

## Workflow
1. Validate scope of schema change and affected tables.
2. Generate migration SQL (`npm run db:generate`).
3. Review SQL for destructive operations.
4. If change is risky, recommend Neon branch testing before apply.
5. Apply migration only after explicit confirmation.
6. Verify runtime with `npm run typecheck` and targeted tests.

## Safety Checklist
- No unintended `DROP TABLE`/`DROP COLUMN`.
- Nullability/default changes are backward compatible or explicitly handled.
- Index changes are deliberate and documented.
- Rollback strategy is documented in PR/commit notes for risky migrations.

## Commands
- Generate: `npm run db:generate`
- Validate: `npm run db:check`
- Apply (with approval): `npm run db:migrate` or `npm run db:push`

## Notes
- If `neonctl` is available, recommend branch testing for risky migrations.
- If `neonctl` is unavailable, require extra SQL review discipline.
