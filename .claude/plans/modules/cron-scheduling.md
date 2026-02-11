# Module: cron-scheduling
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Cron job management and scheduled message processing — handles periodic tasks like message delivery, missed call checks, weekly summaries, agent health checks, and daily analytics aggregation.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/scheduled-messages.ts` | `scheduledMessages` table — queued messages for delivery |
| `src/db/schema/jobs.ts` | `jobs` table — background job tracking |
| `src/lib/services/weekly-summary.ts` | Weekly summary generation service |
| `src/app/api/cron/process-scheduled/route.ts` | POST — process scheduled message queue |
| `src/app/api/cron/check-missed-calls/route.ts` | POST — check for unhandled missed calls |
| `src/app/api/cron/weekly-summary/route.ts` | POST — generate weekly summaries |
| `src/app/api/cron/agent-check/route.ts` | POST — check agent health |
| `src/app/api/cron/daily/route.ts` | POST — daily aggregation tasks |
| `src/app/api/cron/route.ts` | GET — cron status/health endpoint |
| `src/app/(dashboard)/scheduled/page.tsx` | Scheduled messages view page |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/weekly-summary.ts
export async function processWeeklySummaries(): Promise<void>
```

## SCOPE

### Allowed:
All files listed in FILE MANIFEST above.

### Off-limits:
- `src/db/schema/index.ts` — FROZEN
- `src/db/schema/relations.ts` — FROZEN
- `src/lib/automations/incoming-sms.ts` — FROZEN
- Everything not listed in FILE MANIFEST

## IMPORTS FROM OTHER MODULES (read-only deps)

- `getDb` from `@/db`
- `clients`, `leads`, `conversations`, `dailyStats` from `@/db/schema`
- `sendSMS` from `@/lib/services/twilio`
- `sendEmail` from `@/lib/services/resend`
- `runDailyAnalyticsJob` from `@/lib/services/analytics-aggregation`
- `checkAllClientAlerts` from `@/lib/services/usage-alerts`

## REFACTORING GOALS

1. **Type safety** — Define interfaces for job status, scheduled message state, cron results
2. **Cron authentication** — Ensure cron routes verify secret/API key (not just admin auth)
3. **Error handling** — Each cron should handle individual item failures without aborting the batch
4. **Idempotency** — Document or ensure cron jobs are safe to re-run
5. **Scheduled messages** — Type the message queue and delivery status transitions
6. **Weekly summary** — Type the summary data structure and generation logic
7. **Job tracking** — Ensure jobs table properly tracks start/end/status/error

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] All cron routes have proper authentication
- [ ] Error handling for individual item failures
- [ ] Job types properly defined
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(cron-scheduling): ...` format
- [ ] `.refactor-complete` sentinel created
