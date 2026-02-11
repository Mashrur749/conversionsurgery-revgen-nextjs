# Module: ab-testing-templates
> PREREQUISITE: Read `.claude/feature-plan.md` (foundation.md) first

## PURPOSE

A/B testing framework and template management — create and manage message template variants, track performance metrics across clients, determine winners, and roll out successful variants.

## FILE MANIFEST

| Path | Description |
|------|-------------|
| `src/db/schema/ab-tests.ts` | `abTests` table — test definitions and config |
| `src/db/schema/template-variants.ts` | `templateVariants` table — template A/B variants |
| `src/db/schema/template-performance-metrics.ts` | `templatePerformanceMetrics` table — aggregate metrics |
| `src/db/schema/template-metrics-daily.ts` | `templateMetricsDaily` table — daily metric snapshots |
| `src/db/schema/template-step-metrics.ts` | `templateStepMetrics` table — per-step metrics |
| `src/db/schema/message-templates.ts` | `messageTemplates` table — base templates |
| `src/app/api/admin/ab-tests/route.ts` | GET/POST — list and create A/B tests |
| `src/app/api/admin/ab-tests/[id]/route.ts` | GET/PATCH — view and update test |
| `src/app/api/admin/ab-tests/[id]/results/route.ts` | GET — test performance results |
| `src/app/api/admin/templates/route.ts` | GET — list all templates |
| `src/app/api/admin/templates/variants/route.ts` | GET/POST/PUT — variant CRUD |
| `src/app/api/admin/templates/performance/route.ts` | GET — template performance data |
| `src/app/api/admin/templates/assign/route.ts` | POST — assign variant to clients |
| `src/app/(dashboard)/admin/ab-tests/page.tsx` | A/B tests list page |
| `src/app/(dashboard)/admin/ab-tests/new/page.tsx` | Create new A/B test page |
| `src/app/(dashboard)/admin/ab-tests/[id]/page.tsx` | A/B test detail page |
| `src/app/(dashboard)/admin/template-performance/page.tsx` | Template performance dashboard |

## FROZEN_EXPORTS

None — this module has no exports consumed by other modules.

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

## REFACTORING GOALS

1. **Type safety** — Define interfaces for test config, variant data, performance metrics
2. **Test lifecycle** — Type the active → paused → completed → archived states
3. **Metrics aggregation** — Clean up performance calculation logic
4. **Winner determination** — Type and document the statistical comparison logic
5. **Rollout system** — Type the variant-to-client assignment flow
6. **API consistency** — All routes use Zod validation, admin auth, consistent responses
7. **Dashboard components** — Extract inline components to typed component files if needed

## DONE WHEN

- [ ] All test lifecycle states properly typed
- [ ] Performance metrics interfaces defined
- [ ] All admin routes check `isAdmin`
- [ ] All routes use Zod validation
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor(ab-testing-templates): ...` format
- [ ] `.refactor-complete` sentinel created
