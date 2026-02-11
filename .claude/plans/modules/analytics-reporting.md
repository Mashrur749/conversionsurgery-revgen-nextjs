# Module: analytics-reporting
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

Analytics aggregation, reporting, and dashboards — daily/weekly/monthly stats rollup, platform analytics, funnel tracking, cohort analysis, report generation, and visualization components.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/daily-stats.ts` | `dailyStats` table — per-client daily metrics |
| `src/db/schema/reports.ts` | `reports` table — generated reports (JSONB) |
| `src/db/schema/analytics-daily.ts` | `analyticsDailyStats` table |
| `src/db/schema/analytics-weekly.ts` | `analyticsWeeklyStats` table |
| `src/db/schema/analytics-monthly.ts` | `analyticsMonthlyStats` table |
| `src/db/schema/platform-analytics.ts` | `platformAnalytics` table — cross-client metrics |
| `src/db/schema/funnel-events.ts` | `funnelEvents` table — conversion funnel tracking |
| `src/db/schema/client-cohorts.ts` | `clientCohorts` table — cohort assignments |
| `src/lib/services/analytics-aggregation.ts` | Daily/weekly/monthly aggregation jobs |
| `src/lib/services/analytics-queries.ts` | Analytics query helpers |
| `src/lib/services/funnel-tracking.ts` | Funnel event recording and analysis |
| `src/app/api/admin/reports/route.ts` | GET/POST — list and generate reports |
| `src/app/api/admin/reports/[id]/route.ts` | GET — view specific report |
| `src/app/api/admin/analytics/templates/route.ts` | GET — template analytics |
| `src/app/api/admin/analytics/templates/[id]/route.ts` | GET — specific template analytics |
| `src/app/(dashboard)/admin/reports/page.tsx` | Reports list page |
| `src/app/(dashboard)/admin/reports/new/page.tsx` | Generate report page |
| `src/app/(dashboard)/admin/reports/[id]/page.tsx` | Report detail page |
| `src/app/(dashboard)/admin/analytics/page.tsx` | Analytics dashboard |
| `src/app/(dashboard)/admin/platform-analytics/page.tsx` | Platform-wide analytics |
| `src/app/(dashboard)/analytics/page.tsx` | Client analytics page |
| `src/components/analytics/kpi-card.tsx` | KPI metric card component |
| `src/components/analytics/category-performance.tsx` | Category performance chart |
| `src/components/analytics/template-detail-stats.tsx` | Template detail statistics |
| `src/components/analytics/conversion-funnel.tsx` | Conversion funnel visualization |
| `src/components/analytics/lead-source-chart.tsx` | Lead source distribution chart |
| `src/components/analytics/response-time-chart.tsx` | Response time chart |
| `src/components/analytics/revenue-chart.tsx` | Revenue chart component |
| `src/components/analytics/analytics-dashboard.tsx` | Main analytics dashboard component |

## FROZEN_EXPORTS

These function signatures MUST NOT change:

```typescript
// From src/lib/services/analytics-aggregation.ts
export async function runDailyAnalyticsJob(): Promise<{ processed: number; errors: number }>
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
- `clients`, `leads`, `conversations` from `@/db/schema`
- `auth` / `authOptions` from `@/lib/auth`

## REFACTORING GOALS

1. **Type safety** — Define `DailyStat`, `Report`, `FunnelEvent`, `CohortData`, `AnalyticsPeriod` interfaces
2. **Aggregation service** — Type input/output of daily, weekly, monthly rollups
3. **Query helpers** — Type analytics query functions and result shapes
4. **Funnel tracking** — Type funnel stages and conversion calculations
5. **Report generation** — Type JSONB report data structure
6. **API consistency** — Zod validation, admin auth, consistent responses
7. **Component types** — Type all 8 analytics components
8. **Chart data** — Type chart data structures for all visualization components

## DONE WHEN

- [ ] FROZEN_EXPORTS signatures unchanged
- [ ] Analytics period types defined
- [ ] Report JSONB structure typed
- [ ] All admin routes check `isAdmin`
- [ ] All analytics components typed
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(analytics-reporting): ...` format
- [ ] `.refactor-complete` sentinel created
