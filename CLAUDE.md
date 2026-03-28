# ConversionSurgery Revenue Recovery

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Drizzle ORM + Neon Serverless Postgres (`@neondatabase/serverless`)
- NextAuth v4 (email magic links via Resend)
- Twilio (SMS/Voice), Stripe (billing), Anthropic (AI responses)
- shadcn/ui + Tailwind 4 + Radix UI
- Deploy: Cloudflare via OpenNext (`@opennextjs/cloudflare`)

## Autonomy Policy

**Default: just do the work.** Don't ask clarifying questions for things you can resolve by reading the codebase or following the checklists below.

Resolve ambiguity yourself by:

1. Reading the codebase (grep for existing patterns, check similar files)
2. Following the checklists below (they answer most "which approach?" questions)
3. Picking the simplest approach that fits existing patterns

**Do ask when:** you genuinely cannot determine the user's intent — e.g., "should this be admin-only or client-facing?" when both are plausible and the answer changes the architecture, or when requirements are contradictory. Ask one precise question, not a list of five.

## Key Patterns

- Database: use `getDb()` from `@/db` — creates a Neon HTTP client per request. Never cache the instance.
- Auth (admin API): use `adminRoute()` or `adminClientRoute()` from `@/lib/utils/route-handler` — handles permission checks, error responses, and params automatically
- Auth (client portal API): use `portalRoute()` from `@/lib/utils/route-handler` — handles portal session, permissions, and error responses
- Auth (server components): use `auth()` from `@/lib/auth` for admin, `getClientSession()` from `@/lib/client-auth` for portal
- API route params: Next.js 16 uses `Promise<{ id: string }>` for async params — always `await` them
- Phone numbers: normalize with `normalizePhoneNumber()` from `@/lib/utils/phone`
- Validation: Zod schemas for all API input, return validation error details on 400
- Schema files: one table per file in `src/db/schema/`, re-exported from `src/db/schema/index.ts`
- UI components: shadcn/ui in `src/components/ui/`, install new ones with `npx shadcn@latest add <component>`
- Services: business logic in `src/lib/services/`, automations in `src/lib/automations/`

## Auto-Checklists (follow these — don't ask)

### New API Route

1. Auth wrappers (preferred):
   - `/api/admin/*` → `export const GET = adminRoute({ permission: AGENCY_PERMISSIONS.X }, async ({ session, params }) => { ... })`
   - `/api/admin/clients/[id]/*` → `export const GET = adminClientRoute({ permission: ..., clientIdFrom: (p) => p.id }, async ({ session, params, clientId }) => { ... })`
   - `/api/client/*` → `export const GET = portalRoute({ permission: PORTAL_PERMISSIONS.X }, async ({ session, params }) => { ... })`
   - `/api/cron/*` → `verifyCronSecret()` (no wrapper — unique pattern)
   - `/api/webhooks/*` → signature verification (no wrapper — unique pattern)
   - Import from `@/lib/utils/route-handler` (also re-exports `AGENCY_PERMISSIONS`, `PORTAL_PERMISSIONS`)
2. Validation: Zod schema with `.strict()`, return `{ error, details }` on 400 (ZodErrors auto-handled by wrapper)
3. Params: automatically resolved by wrapper — access via `params` in context
4. Response: return typed JSON, 404 for missing resources (generic errors auto-handled by wrapper via `safeErrorResponse`)
5. Phone numbers: always `normalizePhoneNumber()` before DB lookup

### New Schema Table

1. One file: `src/db/schema/<table-name>.ts`
2. Standard columns: `id` (uuid, primaryKey, defaultRandom), `createdAt` (timestamp, defaultNow), `updatedAt` if mutable
3. Foreign keys: `onDelete: 'cascade'` or `'set null'`
4. Indexes: add on columns used in WHERE/JOIN
5. Export types: `export type Foo = typeof foos.$inferSelect; export type NewFoo = typeof foos.$inferInsert;`
6. Re-export from `src/db/schema/index.ts`
7. Run `npm run db:generate` → review SQL → ask user before `db:push`/`db:migrate`

### New UI Page

1. Layout: client portal = `max-w-3xl`, admin = `max-w-7xl`
2. Components: shadcn/ui from `src/components/ui/`, install missing with `npx shadcn@latest add <name>`
3. Stat cards: max 4 per row, always include context line ("+12% vs last week")
4. Empty states: explanation + next action button
5. Loading: Skeleton fallbacks matching content shape (use Suspense)
6. Colors: green=active, yellow=pending, gray=inactive, red=error, blue=info
7. Destructive actions: always AlertDialog confirmation

### External API Integration (Twilio, Stripe, Anthropic)

Before writing integration code, query Context7 for current API patterns:

- Twilio: resolve `/twilio/twilio-node`, then query for the specific API
- Stripe: resolve the Stripe library, then query
- Anthropic: resolve the Anthropic SDK, then query
  This avoids stale patterns from training data. Always do this — don't rely on memory.

## Commands

- `npm run dev` — local dev server (port 3000)
- `npm run build` — production build (must pass with 0 TypeScript errors)
- `npm run lint` — ESLint check (next/core-web-vitals + next/typescript)
- `npm run db:generate` — generate Drizzle migrations after schema changes
- `npm run db:push` — push schema directly to database (use with caution)
- `npm run db:migrate` — run generated migrations
- `npm run typecheck` — fast TypeScript type-check only (~13s, no build output)
- `npm test` — run Vitest test suite (312 deterministic tests: agent scenarios, guardrails, graph routing, model routing, route-handler, permissions, etc.)
- `npm run test:ai` — run AI criteria + scenario tests (29 tests, requires ANTHROPIC_API_KEY, real LLM calls — pre-launch quality gate)
- `npm run test:ai:visual` — run AI scenario tests with color-coded terminal output + HTML report (standalone runner, not vitest)
- `npm run test:watch` — run Vitest in watch mode
- `npm run db:studio` — open Drizzle Studio for visual database browsing
- `npm run quality:no-regressions` — required gate (`ms:gate` + build + tests + runtime smoke)
- `npm run quality:feature-sweep` — release/refactor gate with extended smoke profile
- `npm run quality:logging-guard` — blocks direct API error-detail leaks (`error.message`/`error.stack`)
- `npm run quality:install-agent-hooks` — installs repo-enforced pre-commit + pre-push checks

## After Making Changes

Two-tier verification protocol (mandatory):

1. **Fast gate during implementation:** run `npm run ms:gate` and `npm run quality:logging-guard` frequently.
2. **Completion gate for every coding task:** run `npm run quality:no-regressions`.
3. **Release/refactor/deletion gate:** run `npm run quality:feature-sweep`.
4. Never mark a task done with a red gate.

## Session Discipline

- Commit working code frequently — small commits, not one giant commit at the end
- Before stopping (for any reason): ensure the build passes and all changes are committed
- When using worktrees: update `.claude/progress.md` before the session ends

## File Organization

### Where to write files

| What you're doing                                      | Write to               | Why                                                         |
| ------------------------------------------------------ | ---------------------- | ----------------------------------------------------------- |
| Research notes, exploration output, agent summaries    | `.scratch/`            | Temporary — gets auto-cleaned                               |
| Drafting a doc before it's ready for review            | `.scratch/drafts/`     | Move to `docs/` when finalized                              |
| Comparing options, dumping API responses, debug output | `.scratch/`            | Never belongs in repo                                       |
| Migration SQL review (before user confirms)            | `.scratch/migrations/` | Only commit after `db:generate`                             |
| Curl output, webhook test payloads, log captures       | `.scratch/`            | Ephemeral test data                                         |
| New application code (routes, services, components)    | `src/`                 | **Always write directly** — never draft in scratch          |
| Schema changes                                         | `src/db/schema/`       | **Always write directly** — then run `db:generate`          |
| Finalized documentation                                | `docs/`                | After content is complete and accurate                      |
| Config files, project-level docs                       | Root (`./`)            | Only: README.md, CLAUDE.md, BUSINESS-CASE.md, DEPLOYMENT.md |

### Rules

1. **Code goes straight to `src/`** — never draft source code in `.scratch/`. Code is validated by `npm run build`, not by staging it.
2. **Docs start in `.scratch/drafts/` if large** (50+ lines) — move to `docs/` when done. Small edits go directly to `docs/`.
3. **Never create files at root** — no loose `.md`, `.png`, `.log`, or `.json` files in the project root. If it's not config or one of the 4 root docs, it doesn't belong there.
4. **Cleanup is automatic** — the Stop hook runs `.claude/scripts/cleanup.sh` on session end. It purges `.scratch/`, stale artifacts, `.DS_Store` files, and warns about untracked root files.
5. **Manual cleanup**: `bash .claude/scripts/cleanup.sh`

## Documentation Sync

When you change code, check whether the affected docs need updating. This is mandatory — stale docs are worse than no docs.

### Change → Doc mapping

| What you changed | Check / update these docs |
|-----------------|--------------------------|
| Any automation (estimate, payment, review, win-back, no-show, appointment) | `docs/product/PLATFORM-CAPABILITIES.md` (Section 2: Follow-Up Automation) |
| Any automation schedule or touch count | `docs/engineering/01-TESTING-GUIDE.md` (matching test step) |
| Voice AI flow, modes, or transfer logic | `docs/product/PLATFORM-CAPABILITIES.md` (Section 3: Voice AI) |
| Voice AI webhooks or kill switch | `docs/engineering/01-TESTING-GUIDE.md` (Step 16) |
| Lead pipeline stages, scoring, or context fields | `docs/product/PLATFORM-CAPABILITIES.md` (Section 4: Communication Hub) |
| Client portal pages, permissions, or nav | `docs/product/PLATFORM-CAPABILITIES.md` (Section 5: Client Portal) |
| Compliance rules, consent types, quiet hours, or gateway logic | `docs/product/PLATFORM-CAPABILITIES.md` (Section 6: Compliance) |
| Compliance behavior | `docs/business-intel/OFFER-CLIENT-FACING.md` (Sections 6-7: Quiet Hours + Compliance) |
| Reporting metrics, Without Us model, or delivery | `docs/product/PLATFORM-CAPABILITIES.md` (Section 7: Reporting) |
| Billing, plans, add-ons, guarantee, or cancellation | `docs/product/PLATFORM-CAPABILITIES.md` (Section 8: Billing) |
| Billing terms or pricing | `docs/business-intel/OFFER-CLIENT-FACING.md` (Sections 4-5: Pricing + Terms) |
| Onboarding milestones, quality gates, or progressive activation | `docs/product/PLATFORM-CAPABILITIES.md` (Section 9: Onboarding) |
| Quarterly campaign types or planner logic | `docs/product/PLATFORM-CAPABILITIES.md` (Section 10: Quarterly Growth Blitz) |
| AI agent behavior, guardrails, model routing, or decision pipeline | `docs/product/PLATFORM-CAPABILITIES.md` (Section 1: AI Conversation Agent + Section 11: Observability) |
| AI agent tests or evaluation criteria | `docs/engineering/01-TESTING-GUIDE.md` (Steps 32-35: model routing, scenarios, AI criteria, effectiveness) |
| AI effectiveness metrics, attribution, or dashboard | `docs/product/PLATFORM-CAPABILITIES.md` (Section 11: Observability), `docs/operations/01-OPERATIONS-GUIDE.md` (items 28-30) |
| Admin tools, kill switches, cron jobs, or observability | `docs/product/PLATFORM-CAPABILITIES.md` (Section 11: Agency Operations) |
| New cron job added or removed | `docs/engineering/01-TESTING-GUIDE.md` (Section 3: Useful Commands — cron list) |
| Review monitoring, auto-response, or Google integration | `docs/product/PLATFORM-CAPABILITIES.md` (Section 12: Review Monitoring) |
| New API route or webhook | `docs/engineering/01-TESTING-GUIDE.md` (add test step if user-facing) |
| Schema migration (new table, dropped column, FK change) | `docs/engineering/01-TESTING-GUIDE.md` (preflight — `db:migrate` step) |
| Permission changes (new permission, route guard change) | `docs/engineering/02-ACCESS-MANAGEMENT.md` |
| Feature added, removed, or substantially changed | `docs/product/PLATFORM-CAPABILITIES.md` (relevant section) |
| Feature removed that was in the offer | `docs/product/02-OFFER-PARITY-GAPS.md` |
| Feature backlog item implemented | `docs/product/FEATURE-BACKLOG.md` (mark resolved or remove) |

### Key docs (quick reference)

| Doc | Purpose | When it gets stale |
|-----|---------|-------------------|
| `docs/product/PLATFORM-CAPABILITIES.md` | **What the platform does** — complete feature inventory | Any feature add/change/remove |
| `docs/business-intel/OFFER-CLIENT-FACING.md` | **What we promise clients** — approved sales language | Pricing, compliance, or capability changes that affect claims |
| `docs/engineering/01-TESTING-GUIDE.md` | **How to verify it works** — manual + automated test steps | New features, changed flows, new crons |
| `docs/product/02-OFFER-PARITY-GAPS.md` | **What's promised vs built** — gap register | Features shipped or descoped |
| `docs/product/FEATURE-BACKLOG.md` | **What's planned** — future work with context | Backlog items implemented or deprioritized |
| `docs/engineering/02-ACCESS-MANAGEMENT.md` | **Who can do what** — permissions and routes | Permission or auth changes |
| `docs/operations/01-OPERATIONS-GUIDE.md` | **How to run the platform** — operator playbook | Workflow or ops process changes |

### Rules

1. **Check before marking done.** After completing a coding task, scan the table above. If your change maps to a doc, update it in the same commit or immediately after.
2. **Don't update offer docs without asking.** `OFFER-CLIENT-FACING.md` is approved sales copy — flag the discrepancy to the user rather than editing directly.
3. **Capabilities doc is ground truth.** `PLATFORM-CAPABILITIES.md` reflects what's *built*, not what's *planned*. Only add features that are implemented and passing tests.
4. **Testing guide stays runnable.** Every test step must be executable as written. If you change a flow, update the step so someone following the guide doesn't hit a wall.

## Do NOT

- Read or edit `.env` files — they contain production secrets
- Run `db:push` or `db:migrate` without explicit user confirmation
- Modify `package-lock.json` or `node_modules/`
- Skip admin auth checks on `/api/admin/*` routes
- Implement one-off client-specific code paths; always use reusable config/policy/template mechanisms
- Use `any` TypeScript type — always use proper types. Use schema-inferred types (`Lead`, `Client`, etc.), generic parameters, `unknown` with type guards, or explicit interfaces. Zero tolerance for `any`.
- Use literal quotes in JSX text content — use HTML character entity references instead:
  - `'` → `&apos;` (or `&rsquo;` for curly)
  - `"` → `&quot;` (or `&ldquo;`/`&rdquo;` for curly)
  - `&` → `&amp;`
  - `<` → `&lt;`, `>` → `&gt;`

## Worktree Workflow

For large features (3+ files), use slash commands: `/plan`, `/scaffold`, `/implement`, `/resume`, `/review`, `/merge`, `/status`, `/cleanup`. Script: `.claude/scripts/worktree-manager.sh`. Each worktree tracks progress in `.claude/progress.md`.

Skills to use during worktree work:

- Schema changes: read `.claude/skills/create-migration/SKILL.md` first
- Neon queries: read `.claude/skills/neon-postgres/` for patterns
- Security review: run on any slice touching API routes, auth, or user input

## Learned Rules

Rules are appended when corrections happen. Format: `N. [CATEGORY] Instruction — reason.` Higher numbers win on conflict. Never delete, only supersede.

1. [CODE] All outbound messages MUST go through `sendCompliantMessage()` from compliance-gateway — never call Twilio directly.
2. [ARCH] Agent nodes use `getAIProvider()` raw; all other AI callers use `getTrackedAI()` — orchestrator tracks aggregate usage.
3. [CODE] Radix `Select` does NOT work with FormData forms — use native `<select>` with standard styling instead.
4. [CODE] Custom `DialogTrigger` does NOT support `asChild` — pass `className` directly.
5. [CODE] Use `as unknown as T` for jsonb→domain type narrowing — `as any` is banned project-wide.
6. [ARCH] AI test files use `*.ai-test.ts` naming convention — excluded from `npm test`, run only via `npm run test:ai`.
7. [PROCESS] Doc sync is mandatory — check the Change→Doc mapping table before marking any task done.
8. [CODE] `compliance-gateway.ts` has a pre-existing block-scoped variable redeclaration typecheck warning — ignore it, don't try to fix.
9. [ARCH] Attribution is event-driven (NOT cron) — `trackFunnelEvent()` triggers `attributeFunnelEvent()` synchronously.
10. [UX] Brand palette only — never use raw Tailwind colors (blue-500, red-600, etc.). Use CSS custom properties or the established brand tokens.
