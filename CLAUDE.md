# ConversionSurgery Revenue Recovery

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Drizzle ORM + Neon Serverless Postgres (`@neondatabase/serverless`)
- NextAuth v4 (email magic links via Resend)
- Twilio (SMS/Voice), Stripe (billing), Anthropic (AI responses)
- shadcn/ui + Tailwind 4 + Radix UI
- Deploy: Cloudflare via OpenNext (`@opennextjs/cloudflare`)
- n8n automation: `n8n-internal.conversionsurgery.io` (customer acquisition pipeline)

## n8n Acquisition Automation

Six workflows (CS 0-5) automate lead sourcing, AI enrichment, audit generation, Instantly.ai campaigns, and outreach orchestration for Calgary basement contractor acquisition.

- **Full docs:** `docs/operations/N8N-ACQUISITION-AUTOMATION.md` — workflow IDs, sheet columns, credential IDs, execution flow
- **MCP access:** `.mcp.json` (gitignored — contains bearer token). Provides `search_workflows`, `get_workflow_details`, `execute_workflow`
- **REST API:** For creating/updating workflows via `curl`. Load key with `source .n8n-credentials` then use `$N8N_API_KEY` and `$N8N_BASE_URL`. File is gitignored
- **Google Sheet:** `1p4IbPtuJjftVIViUmFfz0iWuCxu5JakiTEn4F9pBm4Q` — 5 tabs (Leads, Audits, Campaigns, DailyBriefs, FollowUps)
- **AI nodes** use n8n credential auth (httpHeaderAuth), not env vars. Credential IDs in the docs
- **Playbook alignment:** Maps to `ACQUISITION-PLAYBOOK-0-TO-5.md` and `templates/SALES-TOOLKIT-BASEMENT.md`

## Autonomy & Assumptions

**Default: just do the work.** But state your assumptions when they matter.

Three tiers of ambiguity — handle each differently:

1. **Resolvable by codebase** → decide silently. Grep for existing patterns, check similar files, follow checklists below. No need to announce.
2. **Multiple valid approaches, low stakes** → state your assumption briefly ("Assuming this is admin-only since the route is under `/api/admin/`") and proceed. If wrong, easy to correct.
3. **Multiple valid approaches, architectural impact** → present the options and ask. One precise question, not a list of five. Example: "Should this be admin-only or client-facing? Both are plausible but the answer changes the data model."

If a simpler approach exists than what was requested, say so. Push back when warranted.

## Coding Principles

Derived from [Karpathy's observations](https://x.com/karpathy/status/2015883857489522876) on LLM coding pitfalls. Biases toward caution over speed — use judgment on trivial tasks.

### Think Before Coding

- State assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If something is unclear, stop. Name what's confusing. Ask one precise question.
- This interacts with the Autonomy tiers above: tier 1 (codebase-resolvable) = decide silently, tier 2/3 = surface assumptions or ask.

### Simplicity First

- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### Surgical Changes

- Every changed *code* line must trace directly to the user's request.
- Don't "improve" adjacent code, comments, or formatting.
- Match existing style, even if you'd do it differently.
- When your changes create orphans: remove imports/variables/functions YOUR changes made unused. Don't remove pre-existing dead code — mention it instead.
- **Scope boundary:** Doc sync, quality gates, and checklist items are process obligations, not scope creep. Surgical Changes governs *code* — process rules still apply alongside it.

### Goal-Driven Execution

- Transform tasks into verifiable goals before coding:
  - "Add validation" → write tests for invalid inputs, then make them pass
  - "Fix the bug" → write a test that reproduces it, then make it pass
  - "Refactor X" → ensure tests pass before and after
- For multi-step tasks, state a brief plan with verification at each step:
  ```
  1. [Step] → verify: [check]
  2. [Step] → verify: [check]
  ```
- Strong success criteria let you loop independently. Weak criteria ("make it work") require clarification.

## Key Patterns

- Database: use `getDb()` from `@/db` — creates a Neon HTTP client per request. Never cache the instance.
- Auth (admin API): use `adminRoute()` or `adminClientRoute()` from `@/lib/utils/route-handler` — handles permission checks, error responses, and params automatically
- Auth (client portal API): use `portalRoute()` from `@/lib/utils/route-handler` — handles portal session, permissions, and error responses
- Auth (server components): use `auth()` from `@/lib/auth` for admin, `getClientSession()` from `@/lib/client-auth` for portal
- API route params: Next.js 16 uses `Promise<{ id: string }>` for async params — always `await` them
- Phone numbers: normalize with `normalizePhoneNumber()` from `@/lib/utils/phone`
- Validation: Zod schemas for all API input, return validation error details on 400
- Schema files: one table per file in `src/db/schema/`, re-exported from `src/db/schema/index.ts`
- UI components: shadcn/ui in `src/components/ui/`, install new ones with `pnpm dlx shadcn@latest add <component>`
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
7. Run `pnpm run db:generate` → review SQL → ask user before `db:push`/`db:migrate`

### New UI Page

1. Layout: client portal = `max-w-3xl`, admin = `max-w-7xl`
2. Components: shadcn/ui from `src/components/ui/`, install missing with `pnpm dlx shadcn@latest add <name>`
3. Stat cards: max 4 per row, always include context line ("+12% vs last week")
4. Empty states: explanation + next action button
5. Loading: Skeleton fallbacks matching content shape (use Suspense)
6. Colors: green=active, yellow=pending, gray=inactive, red=error, blue=info
7. Destructive actions: always AlertDialog confirmation
8. Breadcrumbs: add `<Breadcrumbs>` from `src/components/breadcrumbs.tsx` on all deep pages
9. Mobile: always test at 375px — cards not tables, stack layouts, min 44px tap targets

### UI/UX Change (modify existing page or component)

**Proportionality:** Not every change needs the full checklist. Match effort to scope:
- **Small fix** (color, copy, spacing, single element): typecheck + visual check + doc sync only (items 3, 9)
- **Component change** (new behavior, layout shift, interactive element): items 1-3, 8-9
- **New page or major rework**: full checklist

1. Read `.claude/skills/ux-standards/SKILL.md` first — it defines patterns, anti-patterns, and brand conventions
2. Check `docs/specs/UX-AUDIT-FULL.md` — is this change tracking an open audit item? If yes, mark it Done in the "Already Fixed" table after implementation
3. Mobile-first: test every change at 375px width. Use `sm:hidden` / `hidden sm:block` for responsive variants
4. Polling: use 5s for active views (conversations), 15s for lists, 30s for dashboards
5. Unread/badge state: track in localStorage (prefix `cs-`), clear on view
6. Unsaved changes: use `useUnsavedChangesWarning` hook from `src/lib/hooks/use-unsaved-changes-warning.ts` on any form
7. Tooltips: add `<Tooltip>` with info text next to any non-obvious setting label
8. After implementation, verify these personas are unbroken:
   - **Homeowner (SMS only):** Are outbound messages clear, professional, no jargon?
   - **Contractor (client portal):** Can they do their top 3 tasks in < 3 taps on mobile?
   - **Operator (admin dashboard):** Can they triage across clients without excessive scrolling?
9. Update docs per the Change→Doc mapping table below (mandatory)

### External API Integration (Twilio, Stripe, Anthropic)

Before writing integration code, query Context7 for current API patterns:

- Twilio: resolve `/twilio/twilio-node`, then query for the specific API
- Stripe: resolve the Stripe library, then query
- Anthropic: resolve the Anthropic SDK, then query
  This avoids stale patterns from training data. Always do this — don't rely on memory.

## Commands

- `pnpm run dev` — local dev server (port 3000)
- `pnpm run build` — production build (must pass with 0 TypeScript errors)
- `pnpm run lint` — ESLint check (next/core-web-vitals + next/typescript)
- `pnpm run db:generate` — generate Drizzle migrations after schema changes
- `pnpm run db:push` — push schema directly to database (use with caution)
- `pnpm run db:migrate` — run generated migrations
- `pnpm run typecheck` — fast TypeScript type-check only (~13s, no build output)
- `pnpm test` — run Vitest test suite (312 deterministic tests: agent scenarios, guardrails, graph routing, model routing, route-handler, permissions, etc.)
- `pnpm run test:ai` — run AI criteria + scenario tests (29 tests, requires ANTHROPIC_API_KEY, real LLM calls — pre-launch quality gate)
- `pnpm run test:ai:visual` — run AI scenario tests with color-coded terminal output + HTML report (standalone runner, not vitest)
- `pnpm run test:watch` — run Vitest in watch mode
- `pnpm run db:studio` — open Drizzle Studio for visual database browsing
- `pnpm run quality:no-regressions` — required gate (`ms:gate` + build + tests + runtime smoke)
- `pnpm run quality:feature-sweep` — release/refactor gate with extended smoke profile
- `pnpm run quality:smart-gate` — diff-aware gate: classifies staged files, runs minimum checks (auto-runs via pre-commit hook)
- `pnpm run quality:logging-guard` — blocks direct API error-detail leaks (`error.message`/`error.stack`)
- `pnpm run quality:code-review` — automated code review via `claude -p` against diff from main (fresh context window)
- `pnpm run quality:install-agent-hooks` — installs repo-enforced pre-commit + pre-push checks

## After Making Changes

Verification is hook-driven. Do NOT run gate commands manually — hooks handle it automatically, saving tokens and time.

- **Pre-commit hook** (`smart-gate.sh`): diff-aware, runs minimum checks based on staged files. UI-only = typecheck (~8s). Logic changes = typecheck + tests. Docs-only = skip. Quiet on success (1 line). You see output only if it fails — fix the error shown.
- **Pre-push hook**: runs full `no-regressions` gate (ms:gate + logging-guard + build + tests + runtime smoke). Nothing leaves the machine without passing.
- **Code review before merge:** run `pnpm run quality:code-review` from feature branch. This is the one manual gate — fresh context window catches what the author's context is blind to.
- **Release/refactor/deletion gate:** run `pnpm run quality:feature-sweep`.
- Never mark a task done with a red hook.

**Manual override** (rare — only when debugging a gate failure):
- `pnpm run quality:smart-gate` — run the diff-aware gate manually
- `pnpm run quality:no-regressions` — run full pipeline manually

## Session Discipline

- Commit working code frequently — small commits, not one giant commit at the end. Hooks verify each commit automatically.
- Before stopping (for any reason): ensure all changes are committed (hooks verify on commit + push)
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

1. **Code goes straight to `src/`** — never draft source code in `.scratch/`. Code is validated by `pnpm run build`, not by staging it.
2. **Docs start in `.scratch/drafts/` if large** (50+ lines) — move to `docs/` when done. Small edits go directly to `docs/`.
3. **Never create files at root** — no loose `.md`, `.png`, `.log`, or `.json` files in the project root. If it's not config or one of the 4 root docs, it doesn't belong there.
4. **Cleanup is automatic** — the Stop hook runs `.claude/scripts/cleanup.sh` on session end. It purges `.scratch/`, stale artifacts, `.DS_Store` files, and warns about untracked root files.
5. **Manual cleanup**: `bash .claude/scripts/cleanup.sh`

## Documentation Sync

When code changes affect product behavior, operator workflows, UI, permissions, billing, automations, AI behavior, schema, routes, or tests, consult `.claude/references/doc-sync-map.md` and update the mapped docs in the same change.

Rules:
- Do not update `docs/business-intel/OFFER-APPROVED-COPY.md` without asking; flag discrepancies instead.
- `docs/product/PLATFORM-CAPABILITIES.md` reflects built behavior only, not planned work.
- Keep `docs/engineering/01-TESTING-GUIDE.md` runnable when changing verification steps.

## Do NOT

- Read or edit `.env` files — they contain production secrets
- Run `db:push` or `db:migrate` without explicit user confirmation
- Modify `pnpm-lock.yaml` or `node_modules/`
- Skip admin auth checks on `/api/admin/*` routes
- Implement one-off client-specific code paths; always use reusable config/policy/template mechanisms
- Use `any` TypeScript type — always use proper types. Use schema-inferred types (`Lead`, `Client`, etc.), generic parameters, `unknown` with type guards, or explicit interfaces. Zero tolerance for `any`.
- Use literal quotes in JSX text content — use HTML character entity references instead:
  - `'` → `&apos;` (or `&rsquo;` for curly)
  - `"` → `&quot;` (or `&ldquo;`/`&rdquo;` for curly)
  - `&` → `&amp;`
  - `<` → `&lt;`, `>` → `&gt;`

## Parallel Agent Execution

For multi-item execution, use `.claude/work-tracker.md` as the source of truth. Keep agent prompts lean: assign item IDs, disjoint files, requirements, and `pnpm run typecheck`. Do not repeat this full `CLAUDE.md` in subagent prompts.

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
6. [ARCH] AI test files use `*.ai-test.ts` naming convention — excluded from `pnpm test`, run only via `pnpm run test:ai`.
7. [PROCESS] Doc sync is mandatory — check the Change→Doc mapping table before marking any task done.
8. [CODE] `compliance-gateway.ts` has a pre-existing block-scoped variable redeclaration typecheck warning — ignore it, don't try to fix.
9. [ARCH] Attribution is event-driven (NOT cron) — `trackFunnelEvent()` triggers `attributeFunnelEvent()` synchronously.
10. [UX] Brand palette only — never use raw Tailwind colors (blue-500, red-600, etc.). Use CSS custom properties or the established brand tokens.
11. [PROCESS] Every UI/UX change must follow the process in `.claude/skills/ux-standards/SKILL.md` — read skill first, reuse established patterns, update UX audit doc + all matching docs from Change-to-Doc table.
12. [UX] No emojis in SMS notifications, email subjects, or any user-facing text — use professional text labels (URGENT:, REMINDER:, Claimed:).
13. [UX] Mobile layouts must use flex + min-h-0 + dvh — never `h-[calc(100vh-Xrem)]` which breaks on iOS with dynamic browser chrome.
14. [UX] Tables on mobile (< 640px) must use card layout fallback — `hidden sm:block` for table, `sm:hidden` for cards.
15. [CODE] Operator-facing alerts use `sendInternalSMS()` from `compliance-gateway.ts` (sentinel-protected). Lead-facing messages use `sendCompliantMessage()`. Never call `_sendSmsToTwilio` directly or import `twilio` from outside the whitelist (twilio.ts, twilio-provisioning.ts, ring-group.ts, webhooks/twilio/**, cron/check-missed-calls). Enforced by ESLint + CI gate.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Use graphify as an index for broad architecture/codebase questions, not as a mandatory prelude to routine `Grep`/`Glob`.
- Prefer `.planning/codebase/` docs for compact architecture orientation.
- Read only the relevant section of `graphify-out/GRAPH_REPORT.md`; do not load the full report for narrow symbol/file searches.
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
