# Neon Branch Setup — Test & Staging Environment

## Purpose

Isolate testing from production data. All development, testing (Phase 1), and migration validation happen on a staging branch. Production is only touched during explicit deploy.

---

## One-Time Setup (15 minutes)

### 1. Install neonctl

```bash
npm install -g neonctl
neonctl auth
```

### 2. Find your project ID

```bash
neonctl projects list
```

Copy the project ID (looks like `aged-forest-12345678`).

### 3. Create the staging branch

```bash
neonctl branches create --name staging --project-id <project-id>
```

This creates a full copy of your production database as a branch. Reads are instant (copy-on-write), writes are isolated.

### 4. Get the connection string

```bash
neonctl connection-string staging --project-id <project-id>
```

### 5. Configure local environment

Add to `.env.local` (never committed):

```
DATABASE_URL=<staging-connection-string>
```

Your production `.env` or Cloudflare environment keeps the production connection string. Local dev always points at staging.

---

## Run Pending Migrations

After setting up the staging branch:

```bash
# Generate any pending migrations from schema changes
npm run db:generate

# Review the generated SQL in ./drizzle/ before applying
# Look for: DROP TABLE, DROP COLUMN, type changes

# Apply to staging
npm run db:migrate

# Seed base data (plans, role templates, flow templates, system settings)
npm run db:seed -- --lean

# Create demo client for sales calls
npm run db:seed -- --demo
```

### Currently Pending Migrations

These schema changes are in the code but may not be applied to your database yet:

- `reNotifiedAt` on `escalation_claims` (FIX-04: escalation re-notification)
- `flag_resolved_at` + `flag_resolved_by` on `conversations` (AI quality resolution)
- Unique index on `appointments` `(clientId, appointmentDate, appointmentTime)` where status != cancelled
- `confirmedRevenue` on `leads` (CON-03: confirmed revenue tracking)

Run `npm run db:generate` to see if any migrations need generating, then `npm run db:migrate` to apply.

---

## Daily Workflow

| Action | Command |
|--------|---------|
| Start dev | Ensure `.env.local` points at staging branch |
| Reset staging to match production | `neonctl branches reset staging --parent --project-id <project-id>` |
| Run tests against staging | `npm test` (uses `DATABASE_URL` from `.env.local`) |
| Apply migration to staging | `npm run db:migrate` |
| Verify migration before production | Check tables, run smoke tests |
| Apply migration to production | Temporarily switch `DATABASE_URL` to production, run `npm run db:migrate`, switch back |

---

## Production Deploy Workflow

When ready to apply migrations to production:

1. Verify migration passed on staging (all tests green, smoke test clean)
2. **Option A — Direct apply** (for simple, non-destructive migrations):
   ```bash
   DATABASE_URL=<production-connection-string> npm run db:migrate
   ```
3. **Option B — Branch test first** (for risky migrations):
   ```bash
   # Create a test branch from production
   neonctl branches create --name migration-test --parent main --project-id <project-id>
   # Apply migration to test branch
   DATABASE_URL=<test-branch-string> npm run db:migrate
   # Verify, then apply to production
   DATABASE_URL=<production-connection-string> npm run db:migrate
   # Clean up test branch
   neonctl branches delete migration-test --project-id <project-id>
   ```

---

## Branch Cleanup

```bash
# List all branches
neonctl branches list --project-id <project-id>

# Delete a branch (staging is persistent — don't delete it)
neonctl branches delete <branch-name> --project-id <project-id>

# Reset staging to match current production
neonctl branches reset staging --parent --project-id <project-id>
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `neonctl: command not found` | `npm install -g neonctl` then `neonctl auth` |
| Connection refused | Check the connection string includes `?sslmode=require` |
| Migration fails on staging | Fix the migration, reset staging (`branches reset`), retry |
| Staging data is stale | `neonctl branches reset staging --parent` to refresh from production |
| Need to test with production data | Reset staging from parent — it gets a fresh copy |
