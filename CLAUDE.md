# ConversionSurgery Revenue Recovery

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Drizzle ORM + Neon Serverless Postgres (`@neondatabase/serverless`)
- NextAuth v4 (email magic links via Resend)
- Twilio (SMS/Voice), Stripe (billing), OpenAI (AI responses)
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
- Auth (admin): use `auth()` from `@/lib/auth` for server components, `getServerSession(authOptions)` for API routes
- Auth (client portal): use `getClientSession()` from `@/lib/client-auth` — cookie-based, returns `{ clientId, userId }`
- Admin check: use `requireAdmin(session)` from `@/lib/utils/admin-auth` — all admin API routes must return 403 if not admin
- API route params: Next.js 16 uses `Promise<{ id: string }>` for async params — always `await` them
- Phone numbers: normalize with `normalizePhoneNumber()` from `@/lib/utils/phone`
- Validation: Zod schemas for all API input, return validation error details on 400
- Schema files: one table per file in `src/db/schema/`, re-exported from `src/db/schema/index.ts`
- UI components: shadcn/ui in `src/components/ui/`, install new ones with `npx shadcn@latest add <component>`
- Services: business logic in `src/lib/services/`, automations in `src/lib/automations/`

## Auto-Checklists (follow these — don't ask)

### New API Route
1. Auth: `/api/admin/*` → `getServerSession(authOptions)` + `requireAdmin(session)` + 403. `/api/client/*` → `getClientSession()` + 401. `/api/cron/*` → `verifyCronSecret()`. `/api/webhooks/*` → signature verification (no auth).
2. Validation: Zod schema with `.strict()`, return `{ error, details }` on 400
3. Params: `await` all route params (`Promise<{ id: string }>` in Next.js 16)
4. Response: return typed JSON, 404 for missing resources, 500 with `console.error` (never expose raw DB errors)
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

### External API Integration (Twilio, Stripe, OpenAI)
Before writing integration code, query Context7 for current API patterns:
- Twilio: resolve `/twilio/twilio-node`, then query for the specific API
- Stripe: resolve the Stripe library, then query
- OpenAI: resolve the OpenAI library, then query
This avoids stale patterns from training data. Always do this — don't rely on memory.

## Commands

- `npm run dev` — local dev server (port 3000)
- `npm run build` — production build (must pass with 0 TypeScript errors)
- `npm run lint` — ESLint check (next/core-web-vitals + next/typescript)
- `npm run db:generate` — generate Drizzle migrations after schema changes
- `npm run db:push` — push schema directly to database (use with caution)
- `npm run db:migrate` — run generated migrations
- `npm run typecheck` — fast TypeScript type-check only (~13s, no build output)
- `npm run db:studio` — open Drizzle Studio for visual database browsing

## After Making Changes

Two-tier verification — use the fast check often, full build at milestones:

1. **After each file change**: run `npm run typecheck` (~13s) to catch type errors immediately. Fix before moving on.
2. **After completing a task or major chunk**: run `npm run build` (full production build). Fix all errors before reporting done.
3. For UI-only changes, at minimum run `npm run lint`
4. Never leave a session with a broken build — the next session shouldn't start debugging your leftovers

## Session Discipline

- Commit working code frequently — small commits, not one giant commit at the end
- Before stopping (for any reason): ensure the build passes and all changes are committed
- When using worktrees: update `.claude/progress.md` before the session ends

## File Organization

### Where to write files

| What you're doing | Write to | Why |
|---|---|---|
| Research notes, exploration output, agent summaries | `.scratch/` | Temporary — gets auto-cleaned |
| Drafting a doc before it's ready for review | `.scratch/drafts/` | Move to `docs/` when finalized |
| Comparing options, dumping API responses, debug output | `.scratch/` | Never belongs in repo |
| Migration SQL review (before user confirms) | `.scratch/migrations/` | Only commit after `db:generate` |
| Curl output, webhook test payloads, log captures | `.scratch/` | Ephemeral test data |
| New application code (routes, services, components) | `src/` | **Always write directly** — never draft in scratch |
| Schema changes | `src/db/schema/` | **Always write directly** — then run `db:generate` |
| Finalized documentation | `docs/` | After content is complete and accurate |
| Config files, project-level docs | Root (`./`) | Only: README.md, CLAUDE.md, BUSINESS-CASE.md, DEPLOYMENT.md |

### Rules

1. **Code goes straight to `src/`** — never draft source code in `.scratch/`. Code is validated by `npm run build`, not by staging it.
2. **Docs start in `.scratch/drafts/` if large** (50+ lines) — move to `docs/` when done. Small edits go directly to `docs/`.
3. **Never create files at root** — no loose `.md`, `.png`, `.log`, or `.json` files in the project root. If it's not config or one of the 4 root docs, it doesn't belong there.
4. **Cleanup is automatic** — the Stop hook runs `.claude/scripts/cleanup.sh` on session end. It purges `.scratch/`, stale artifacts, `.DS_Store` files, and warns about untracked root files.
5. **Manual cleanup**: `bash .claude/scripts/cleanup.sh`

## Do NOT

- Read or edit `.env` files — they contain production secrets
- Run `db:push` or `db:migrate` without explicit user confirmation
- Modify `package-lock.json` or `node_modules/`
- Skip admin auth checks on `/api/admin/*` routes
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
