# ConversionSurgery Revenue Recovery

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Drizzle ORM + Neon Serverless Postgres (`@neondatabase/serverless`)
- NextAuth v4 (email magic links via Resend)
- Twilio (SMS/Voice), Stripe (billing), OpenAI (AI responses)
- shadcn/ui + Tailwind 4 + Radix UI
- Deploy: Cloudflare via OpenNext (`@opennextjs/cloudflare`)

## Autonomy Policy

**Default: just do the work.** Do not ask clarifying questions unless you are genuinely blocked — meaning you cannot proceed without information that is impossible to infer from the codebase, the task description, or this file.

Resolve ambiguity yourself by:
1. Reading the codebase (grep for existing patterns, check similar files)
2. Following the checklists below (they answer most "which approach?" questions)
3. Picking the simplest approach that fits existing patterns

**Only ask when:** the user's intent is truly unclear (e.g., "should this be admin-only or client-facing?" when both are plausible and the answer changes the architecture). Even then, prefer asking one precise question over multiple.

## Key Patterns

- Database: use `getDb()` from `@/db` — creates a Neon HTTP client per request. Never cache the instance.
- Auth (admin): use `auth()` from `@/lib/auth` for server components, `getServerSession(authOptions)` for API routes
- Auth (client portal): use `getClientSession()` from `@/lib/client-auth` — cookie-based, returns `{ clientId, userId }`
- Admin check: `(session as any).user?.isAdmin` — all admin API routes must return 403 if not admin
- API route params: Next.js 16 uses `Promise<{ id: string }>` for async params — always `await` them
- Phone numbers: normalize with `normalizePhoneNumber()` from `@/lib/utils/phone`
- Validation: Zod schemas for all API input, return validation error details on 400
- Schema files: one table per file in `src/db/schema/`, re-exported from `src/db/schema/index.ts`
- UI components: shadcn/ui in `src/components/ui/`, install new ones with `npx shadcn@latest add <component>`
- Services: business logic in `src/lib/services/`, automations in `src/lib/automations/`

## Auto-Checklists (follow these — don't ask)

### New API Route
1. Auth: `/api/admin/*` → `getServerSession(authOptions)` + isAdmin check + 403. `/api/client/*` → `getClientSession()` + 401. `/api/cron/*` → `verifyCronSecret()`. `/api/webhooks/*` → signature verification (no auth).
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
- `npm run db:studio` — open Drizzle Studio for visual database browsing

## After Making Changes

- **MANDATORY**: Run `npm run build` after completing any task. Fix errors before reporting done.
- For UI-only changes, at minimum run `npm run lint`
- Never leave a session with a broken build — the next session shouldn't start debugging your leftovers

## Session Discipline

- Commit working code frequently — small commits, not one giant commit at the end
- Before stopping (for any reason): ensure the build passes and all changes are committed
- When using worktrees: update `.claude/progress.md` before the session ends

## File Organization

- **`.scratch/`** — Temporary working files (drafts, research, intermediate outputs). Gitignored. Use this for anything that doesn't belong in the final commit: temp curl output, debug logs, draft content, exploration notes
- **`docs/`** — Committed documentation (guides, use cases, ops reference)
- **`src/`** — All application source code
- **Root level** — Only config files, README.md, CLAUDE.md, BUSINESS-CASE.md, DEPLOYMENT.md
- **Never create** loose .md files, screenshots, or log files at the project root
- **Cleanup**: Run `bash .claude/scripts/cleanup.sh` to purge scratch files and stale artifacts

## Do NOT

- Read or edit `.env` files — they contain production secrets
- Run `db:push` or `db:migrate` without explicit user confirmation
- Modify `package-lock.json` or `node_modules/`
- Skip admin auth checks on `/api/admin/*` routes

## Parallel Worktree Workflow

For large features (3+ files or 2+ concerns), use the worktree workflow via slash commands:

| Command                    | What                                          |
| -------------------------- | --------------------------------------------- |
| `/plan <feature>`          | Decompose into independently mergeable slices |
| `/scaffold <feature>`      | Create git worktrees for each slice           |
| `/implement <feature> <N>` | Build a slice within scope boundaries         |
| `/resume <feature> <N>`    | Pick up where a previous session left off     |
| `/review <feature> <N>`    | Code review before merge                      |
| `/merge <feature> <N>`     | Merge to main + rebase remaining worktrees    |
| `/status [feature]`        | Progress overview with cross-worktree notes   |
| `/cleanup <feature>`       | Remove worktrees when done                    |

Worktree manager script: `.claude/scripts/worktree-manager.sh`

### Progress Tracking

Each worktree maintains `.claude/progress.md` — a task-level tracker that persists across sessions. When Claude Code hits a usage limit or a session ends, progress is saved automatically. The next session runs `/resume` to pick up exactly where things stopped. The `/status` command reads progress from all worktrees and surfaces cross-worktree notes.

### Integration with Existing Tools

- **Schema slices:** Use the `create-migration` skill at `.claude/skills/create-migration/SKILL.md` for any Drizzle schema changes. Read it before generating migrations.
- **Database slices:** Use the `neon-postgres` skill at `.claude/skills/neon-postgres` for Neon-specific patterns and queries.
- **Review phase:** After running `/review`, also invoke the `security-reviewer` agent at `.claude/agents/security-reviewer.md` on any slice that touches API routes, auth, or user input.

### Terminal Setup for Parallel Worktrees

Use GhostTTY (`ghostty`) for running multiple Claude Code instances across worktrees. `Cmd+D` splits horizontal, `Cmd+Shift+D` splits vertical, `Cmd+Arrow` jumps between panes. Lighter than iTerm for high pane counts.
