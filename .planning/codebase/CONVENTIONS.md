# Coding Conventions

**Analysis Date:** 2026-05-04

## Naming Patterns

**Files:**
- kebab-case for all source files: `route-handler.ts`, `cancellation-policy.ts`, `smart-assist-state.ts`
- One concern per file — schema files map 1:1 to DB tables
- Test files co-located with source: `cancellation-policy.ts` + `cancellation-policy.test.ts`
- AI eval tests use `*.ai-test.ts` suffix (excluded from standard `pnpm test`)

**Functions:**
- camelCase for all functions: `routeAfterDecision()`, `buildGuardrailPrompt()`, `selectModelTier()`
- Route wrappers exported as constants: `export const GET = adminRoute(...)`
- Factory/builder helpers use verb prefix: `makeConfig()`, `makeState()`, `buildSystemPrompt()`

**Variables:**
- camelCase: `fakeAgencySession`, `normalizedPhone`, `baseQuery`
- Constants: SCREAMING_SNAKE_CASE: `CANCELLATION_NOTICE_DAYS`, `AGENCY_PERMISSIONS`, `FLAG_REASONS`
- Boolean flags: `is`/`has`/`can` prefix: `isUnlimitedMessaging`, `hasKey`, `canDiscussPricing`

**Types/Interfaces:**
- PascalCase: `PlanFeatures`, `ClientUsagePolicy`, `AdminContext`, `GuardrailConfig`
- `type` preferred for union/alias, `interface` for object shapes
- Schema-inferred types exported from each schema file: `export type Client = typeof clients.$inferSelect`
- `NewFoo` for insert types: `export type NewClient = typeof clients.$inferInsert`

## Code Style

**Formatting:**
- Tabs for indentation (not spaces) — see eslint.config.mjs baseline
- Single quotes for strings in TypeScript
- Trailing commas in multi-line structures

**Linting:**
- ESLint with `next/core-web-vitals` + `next/typescript` rule sets (`eslint.config.mjs`)
- Zero tolerance for `any` type — use schema-inferred types, generics, `unknown` with guards, or `as unknown as T` for jsonb narrowing
- `pnpm run lint` enforces on CI

**TypeScript:**
- `strict: true` in `tsconfig.json`
- `target: es2024`
- Path alias `@/*` maps to `src/*` — always use `@/` imports, never relative `../../`

## Import Organization

**Order (enforced by convention, not automated):**
1. Framework imports: `next/server`, `react`
2. Third-party: `zod`, `drizzle-orm`
3. Internal via `@/` alias: `@/db`, `@/lib/...`, `@/db/schema`

**Path Aliases:**
- `@/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`)

**Re-exports:**
- Schema barrel: `src/db/schema/index.ts` re-exports all tables
- Route handler barrel: `@/lib/utils/route-handler` re-exports `AGENCY_PERMISSIONS`, `PORTAL_PERMISSIONS`, session types

## API Route Patterns

**Auth wrappers (mandatory — never write raw route handlers):**
```typescript
// Admin routes
export const GET = adminRoute(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW },
  async ({ session, request, params }) => {
    const db = getDb();
    return NextResponse.json({ data });
  }
);

// Admin routes with client scoping
export const GET = adminClientRoute<{ id: string }>(
  { permission: AGENCY_PERMISSIONS.CLIENTS_VIEW, clientIdFrom: (p) => p.id },
  async ({ session, params, clientId }) => { ... }
);

// Client portal routes
export const GET = portalRoute(
  { permission: PORTAL_PERMISSIONS.DASHBOARD },
  async ({ session, params }) => { ... }
);
```

**Validation:** Zod schema with `.strict()` defined inline in route file, `.parse()` throws automatically handled by wrapper:
```typescript
const createClientSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  phone: z.string().min(10, 'Phone number is required'),
}).strict();

// Inside handler — ZodError auto-caught by wrapper → 400
const data = createClientSchema.parse(body);
```

**Phone normalization:** Always call `normalizePhoneNumber()` before any DB lookup or insert involving phone fields.

## Database Patterns

**Client:** `getDb()` from `@/db` — creates Neon HTTP client per request. Never cache the instance.

**Schema files:** One table per file in `src/db/schema/`, pattern:
```typescript
export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // ... columns
}, (table) => ({
  emailIdx: index('clients_email_idx').on(table.email),
}));

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
```

**Column naming:** camelCase in TypeScript, snake_case in DB column names (explicit string arg to column constructors).

**Foreign keys:** Always specify `onDelete: 'cascade'` or `onDelete: 'set null'` explicitly.

**jsonb narrowing:** Use `as unknown as T` — `as any` is banned:
```typescript
const data = row.jsonbColumn as unknown as MyType;
```

## Service Layer

**Location:** `src/lib/services/` for business logic, `src/lib/automations/` for scheduled/triggered flows.

**Pattern:** Pure functions preferred — services export named functions, not classes. Dependencies injected as parameters or fetched inside (`getDb()`).

**AI callers:** All non-agent AI callers use `getTrackedAI()` for usage tracking. Agent nodes use `getAIProvider()` directly.

**SMS sending:** All outbound messages go through the compliance gateway — never call Twilio directly.

- **Lead-facing** (homeowner messages) → `sendCompliantMessage()` from `src/lib/compliance/compliance-gateway.ts`. Enforces consent, opt-out, DNC, quiet hours.
- **Operator-facing** (hot-transfer, escalation, ops alerts) → `sendInternalSMS()` from the same gateway. Sentinel-protected and audit-logged; skips homeowner-specific checks.
- **Banned:** direct `twilio` imports outside the whitelist (`twilio.ts`, `twilio-provisioning.ts`, `ring-group.ts`, `webhooks/twilio/**`, `cron/check-missed-calls`). The legacy `sendSMS` is now `_sendSmsToTwilio` (private). Enforced by ESLint rule + `quality:no-regressions` CI gate (`scripts/quality/twilio-bypass-guard.sh`).

## Error Handling

**API layer:**
- Auth/permission errors: thrown by `requireAgencyPermission()` / `requirePortalPermission()`, caught by route wrapper → 401/403
- Validation errors: `ZodError` thrown by `.parse()`, caught by wrapper → 400 with `{ error, details }`
- Generic errors: caught by wrapper → `safeErrorResponse()` → 500 with `{ error: 'Internal server error' }` (full error logged server-side, never leaked to client)

**Service layer:**
- Errors logged with `console.error('[ServiceName] Message:', error)` — bracket-prefixed tag pattern
- Async fire-and-forget wrapped in `.catch((err) => console.error(...))` to prevent unhandled rejections

**Anti-patterns:**
- Never return `error.message` or `error.stack` in API responses — use `safeErrorResponse()`
- Never use `any` to bypass type errors — use `unknown` + guards or `as unknown as T`

## Logging

**Framework:** `console.error` / `console.warn` — no structured logging library.

**Pattern:** Bracket-prefixed service tag:
```typescript
console.error('[Escalation] Failed to send SMS to recipient:', error);
console.error('[SmartAssist] Lifecycle error:', err);
```

**Server-side errors:** Use `logInternalError()` + `logSanitizedConsoleError()` from `@/lib/services/internal-error-log` for errors that should be persisted to the DB error log.

## Comments

**File-level:** JSDoc block at top of complex files explaining purpose and usage pattern:
```typescript
/**
 * Route handler wrappers that eliminate auth/error boilerplate.
 *
 * Usage:
 *   export const GET = adminRoute(...)
 */
```

**Section dividers:** `// ---------------------------------------------------------------------------` separator lines used to delineate logical sections within long files.

**Test files:** Block comment at top explaining what the test covers and any non-obvious constraints.

**Inline:** Only when non-obvious — avoid commenting what the code obviously does.

## JSX / UI

**HTML entities in JSX text:** Always use entity refs, never literal quotes:
- `'` → `&apos;` or `&rsquo;`
- `"` → `&quot;` or `&ldquo;`/`&rdquo;`
- `&` → `&amp;`

**Colors:** Brand CSS custom properties only — never raw Tailwind colors (`blue-500`, `red-600`).

**Mobile:** All layouts must work at 375px — use `flex + min-h-0 + dvh`, never `h-[calc(100vh-Xrem)]`.

---

*Convention analysis: 2026-05-04*
