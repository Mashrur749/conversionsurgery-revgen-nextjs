# 06 — Migrations + Seed

## What this is
Push pending Drizzle migrations to your production database and confirm the plans table is seeded. This step is often skipped — when it is, the Day-14 cancel form crashes the first time a client invokes their cancel right.

## Before you start this
- [ ] Production database is reachable (you have `DATABASE_URL` set in production env)
- [ ] `pnpm tsx scripts/seed-plans.ts` ran cleanly in file 03
- [ ] You have read the **decision point** below before running anything

## Time required
~20 minutes (longer if you need to hand-curate migration 0028)

## Why this matters

The `client_cancellations` table (added by migration **0029**) is what `/admin/clients/[id]` writes to when a contractor invokes their Day-14 cancel right. If this table does not exist in production, the form throws a 500 the first time you click "Confirm Cancel" — exactly when you cannot afford a bug.

## Decision point — Migration 0028

Before pushing anything, look at the two latest migrations:

```
ls drizzle/ | tail -3
```

You will see `0028_bumpy_captain_midlands.sql` and `0029_orange_lady_vermin.sql`.

**Migration 0028 is contaminated.** It contains a leftover `DROP TABLE "subscription_plans" CASCADE` statement (residue from earlier schema drift) mixed in with the legitimate `ADD COLUMN first_recovery_replay_sent_at`. There is no `subscription_plans` table in production today — the `plans` table replaced it. So the DROP is a no-op against current prod, but it WILL fail loudly if your prod ever had a `subscription_plans` table from older history.

You have two choices:

1. **Skip the DROP, keep the ADD COLUMN.** Hand-edit `0028_bumpy_captain_midlands.sql` to remove the `DROP TABLE` line. Commit the cleaned migration. Then push.
2. **Skip 0028 entirely if you do not need `first_recovery_replay_sent_at` yet.** That column is used by First Missed Lead Replay logic. If you are launching without that feature wired, you can leave 0028 unmigrated and only push 0029. Drizzle will complain about the gap on next generate — make a note.

If you are unsure, choose option 1 (clean 0028, push both). It is the closer-to-tested path.

## Migration 0029 — read before pushing

Open `drizzle/0029_orange_lady_vermin.sql` and confirm it contains ONLY:

- `CREATE TABLE "client_cancellations" (...)`
- A foreign key constraint to `clients`
- Maybe an index

It must not contain any DROP, RENAME, or ALTER on existing tables. If it does, stop and ask before pushing.

## What you'll do

1. Decide on migration 0028 (above). Edit the SQL file if needed, commit the change.
2. List pending migrations:
   ```
   ls drizzle/
   ```
3. Push to production database:
   ```
   pnpm run db:push
   ```
   (Or `pnpm run db:migrate` if you prefer the migration-record path. Both are fine — `db:push` is simpler for solo operator launches.)
4. Verify `client_cancellations` exists:
   ```sql
   SELECT table_name FROM information_schema.tables WHERE table_name = 'client_cancellations';
   ```
   Expected: 1 row.
5. Verify `plans` table is seeded:
   ```sql
   SELECT slug, stripe_product_id, stripe_price_id_setup, stripe_price_id_monthly
   FROM plans ORDER BY slug;
   ```
   Expected: 3 rows (pilot, standard, premium), every Stripe ID column populated. If any column is empty, re-run `pnpm tsx scripts/seed-plans.ts` against the production `DATABASE_URL`.

## What success looks like
- [ ] You read migration 0029 before pushing
- [ ] Migration 0028 decision made and applied (cleaned, or deferred)
- [ ] `db:push` completed with no errors
- [ ] `client_cancellations` table exists in production
- [ ] `plans` has 3 rows with all Stripe IDs filled

## If something goes wrong

- **`db:push` fails with "relation does not exist"** — Drizzle is trying to run a destructive op against a table that is not there. Look at the SQL it tried, decide whether the op is safe to skip.
- **Plans table empty in production** — `seed-plans.ts` ran against your dev DB, not prod. Re-run with prod `DATABASE_URL` (export it temporarily, run the script, unset).
- **Stripe IDs in plans table point to test mode IDs** — that is correct for now. You will swap to live-mode IDs after E2E rehearsal in file 08.

## Reference
- Migration files: `drizzle/`
- Seed source: `scripts/seed-plans.ts`
- Schema: `src/db/schema/`
- Migration skill: `.claude/skills/create-migration/SKILL.md`

## Next
[07 — Day 1 Checkpoint](./07-day-1-checkpoint.md)
