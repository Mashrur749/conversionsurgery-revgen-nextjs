# Module: usage-tracking
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

API usage metering and alerting — tracks SMS, API call, and AI token usage per client, aggregates into daily/monthly summaries, and triggers alerts when thresholds are exceeded.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/api-usage.ts` | `apiUsage` table — individual usage events |
| `src/db/schema/api-usage-daily.ts` | `apiUsageDaily` table — daily aggregates |
| `src/db/schema/api-usage-monthly.ts` | `apiUsageMonthly` table — monthly summaries |
| `src/db/schema/usage-alerts.ts` | `usageAlerts` table — threshold alerts |
| `src/lib/services/usage-tracking.ts` | Usage tracking and aggregation service |
| `src/lib/services/usage-alerts.ts` | Alert checking and notification service |
| `src/app/api/admin/usage/route.ts` | GET — usage overview for all clients |
| `src/app/api/admin/usage/[clientId]/route.ts` | GET — detailed usage for specific client |
| `src/app/api/admin/usage/alerts/[id]/acknowledge/route.ts` | POST — acknowledge usage alert |
| `src/app/(dashboard)/admin/usage/page.tsx` | Admin usage overview dashboard |
| `src/app/(dashboard)/admin/usage/[clientId]/page.tsx` | Client-specific usage detail page |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/usage-tracking.ts
export async function trackUsage(clientId: string, type: string, count: number): Promise<void>
export async function updateMonthlySummaries(clientId: string): Promise<void>
export async function getCurrentMonthUsage(clientId: string): Promise<UsageSummary>

// From src/lib/services/usage-alerts.ts
export async function checkAllClientAlerts(): Promise<void>
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
- `clients` from `@/db/schema`
- `authOptions` from `@/lib/auth`
- `sendEmail` from `@/lib/services/resend`

## REFACTORING GOALS

1. **Type safety** — Define `UsageSummary`, `UsageType`, `AlertThreshold` interfaces
2. **Service cleanup** — Ensure trackUsage handles concurrent writes safely
3. **Aggregation logic** — Verify daily/monthly rollup queries are correct
4. **Alert service** — Type threshold configuration, notification channels
5. **Admin dashboard** — Type usage chart data, client comparison views
6. **API consistency** — Zod validation on all routes, consistent response format

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] All types properly defined (no `any`)
- [ ] All admin routes check `isAdmin`
- [ ] Usage tracking handles concurrent writes
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(usage-tracking): ...` format
- [ ] `.refactor-complete` sentinel created
