# MS-12: Cron Catch-Up Guarantees for Managed Service

## Goal
Guarantee critical automations recover deterministically if scheduled windows are missed:
- monthly reset logic
- bi-weekly reporting jobs
- other period-bound managed-service tasks

## Why This Matters
Strict windows without catch-up create silent misses that break client-facing commitments.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Cron endpoints in `src/app/api/cron/*`.
- Existing monthly reset and reporting services.

### Misaligned behavior to change
- Some jobs rely on exact run windows.
- Explicit catch-up semantics are not consistently implemented.

## Target State
- Each periodic workflow has explicit cursor-based catch-up.
- Missed windows are auto-processed on next successful run.
- Operators can see backlog/catch-up status.

## Work Units (Tiny, Executable)
### Milestone A: Job cursor model
1. Add per-job cursor table/entity with:
- `jobKey`
- `lastSuccessfulPeriod`
- `lastRunAt`
- `status`
2. Initialize cursors for critical jobs.
3. Add helper to compute unprocessed periods.

Refactor checkpoint A:
- Remove date-window logic duplication across cron routes.

### Milestone B: Catch-up execution loop
1. Update each critical cron route to iterate missing periods.
2. Process each period idempotently.
3. Cap per-run backlog processing and carry forward remainder.

Refactor checkpoint B:
- Extract shared catch-up runner utility.

### Milestone C: Idempotency and safety
1. Add period-level idempotency keys for writes.
2. Ensure re-runs do not duplicate invoices/reports/actions.
3. Add partial-failure continuation and checkpointing.

Refactor checkpoint C:
- Centralize idempotency key strategy in one helper module.

### Milestone D: Observability and operator controls
1. Add dashboard showing missed periods and backlog age.
2. Add manual "run catch-up" control per job.
3. Add alert thresholds for backlog staleness.

Refactor checkpoint D:
- Reuse existing cron health dashboard where available.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove strict one-window assumptions in job docs.
- Remove legacy scripts that force manual backfills for routine misses.
- Remove duplicate job health indicators with conflicting states.

## Testing & Acceptance
### Automated
1. Missed monthly window is processed on next run.
2. Backlog loop handles multiple missed periods correctly.
3. Re-running same period does not duplicate side effects.

### Manual
1. Simulate downtime crossing period boundary and verify catch-up.
2. Confirm backlog dashboard reflects recovery progress.
3. Confirm final state matches on-time execution outcome.

## Definition of Done
- Periodic promises remain reliable even when cron timing is imperfect.
