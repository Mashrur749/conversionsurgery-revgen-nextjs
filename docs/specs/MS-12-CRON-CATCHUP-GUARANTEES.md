# MS-12: Cron Catch-Up Guarantees for Managed Service

## Status
- `STATE: DONE`
- `DONE: [Milestone A, Milestone B, Milestone C, Milestone D]`
- `REMAINING: []`

## Goal
Guarantee critical automations recover deterministically if scheduled windows are missed:
- monthly reset logic
- bi-weekly reporting jobs
- other period-bound managed-service tasks

## Why This Matters
Strict windows without catch-up create silent misses that break client-facing commitments.

## Current Implementation (Relevant Existing Features)
### Existing features kept
- Cron endpoints in `src/app/api/cron/*`.
- Existing monthly reset and reporting services.

### Misaligned behavior resolved
- Exact-window assumptions in monthly reset and bi-weekly reporting jobs.
- Missing operator visibility for period backlog/recovery state.

## Target State
- Critical periodic jobs have explicit cursor-based catch-up semantics.
- Missed monthly/bi-weekly periods are replayed deterministically on next successful run.
- Replay is idempotent for billing/report side effects.
- Operators can inspect and manually trigger catch-up from admin settings.

## Work Units (Tiny, Executable)
### Milestone A: Job cursor model
1. Added per-job cursor entity with `jobKey`, `lastSuccessfulPeriod`, `lastRunAt`, `status`, and backlog/error metadata:
- `src/db/schema/cron-job-cursors.ts`
- `drizzle/0031_gigantic_hourglass.sql`
2. Initialized cursors for critical jobs (`monthly_reset`, `biweekly_reports`) with legacy-setting backfill migration.
3. Added shared period/cursor helpers:
- `src/lib/services/cron-catchup.ts`

Refactor checkpoint A:
- Removed duplicated period-window logic from cron routes; routes now dispatch catch-up jobs.

### Milestone B: Catch-up execution loop
1. Added shared catch-up runner with deterministic period iteration and capped per-run processing:
- `runCronCatchupJob(...)` in `src/lib/services/cron-catchup.ts`
2. Refactored monthly and bi-weekly jobs onto explicit job definitions:
- `src/lib/services/monthly-reset-job.ts`
- `src/lib/services/biweekly-report-job.ts`
3. Updated cron routes to call catch-up jobs:
- `src/app/api/cron/monthly-reset/route.ts`
- `src/app/api/cron/biweekly-reports/route.ts`
4. Updated orchestrator cadence so missed windows recover on next successful daily run:
- `src/app/api/cron/route.ts`

Refactor checkpoint B:
- Extracted shared catch-up registry/service:
- `src/lib/services/cron-catchup-jobs.ts`

### Milestone C: Idempotency and safety
1. Added centralized idempotency key helper:
- `src/lib/services/idempotency-keys.ts`
2. Added billing-event idempotency key field + unique index:
- `src/db/schema/billing-events.ts`
- `drizzle/0031_gigantic_hourglass.sql`
3. Refactored monthly overage billing to be period-driven and idempotent per client-month:
- `src/lib/services/overage-billing.ts`
4. Added report period reuse guard to avoid duplicate bi-weekly report records on reruns:
- `src/lib/services/report-generation.ts`

Refactor checkpoint C:
- Idempotency key strategy is now centralized and shared by cron/billing paths.

### Milestone D: Observability and operator controls
1. Added admin catch-up status + manual run API:
- `GET/POST /api/admin/cron-catchup`
- `src/app/api/admin/cron-catchup/route.ts`
2. Added operator dashboard panel in admin settings:
- `src/app/(dashboard)/admin/settings/cron-catchup-manager.tsx`
- `src/app/(dashboard)/admin/settings/page.tsx`
3. Added backlog staleness signals (`oldestPendingAgeHours`, `staleBacklog`) in status snapshots.

Refactor checkpoint D:
- Reused existing admin settings surface for operator controls (no duplicate cron dashboard).

## Immediate Deprecated Cleanup (Pre-Launch)
- Removed strict monthly-reset day-1 guard behavior from runtime route.
- Removed strict bi-weekly schedule lock dependence for period processing.
- Legacy `system_settings` period markers are now migration-only bootstrap sources.

## Testing & Acceptance
### Automated
1. Added period helper tests:
- `src/lib/services/cron-catchup.test.ts`
2. Added idempotency key tests:
- `src/lib/services/idempotency-keys.test.ts`
3. Verified type/build/gate:
- `npm run typecheck`
- `npm run ms:gate`
- `npm run build`

### Manual
1. Trigger `/api/cron/monthly-reset` and `/api/cron/biweekly-reports` with `CRON_SECRET` outside legacy window and verify catch-up payload is returned.
2. Open `/admin/settings` and verify `Cron Catch-Up Controls` shows backlog state and allows manual run per job.
3. Re-run catch-up and confirm no duplicate overage billing events for same client-month.

## Definition of Done
- Periodic managed-service promises remain reliable even when cron timing is imperfect.
