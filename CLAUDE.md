# ConversionSurgery Revenue Recovery

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Drizzle ORM + Neon Serverless Postgres (`@neondatabase/serverless`)
- NextAuth v4 (email magic links via Resend)
- Twilio (SMS/Voice), Stripe (billing), OpenAI (AI responses)
- shadcn/ui + Tailwind 4 + Radix UI
- Deploy: Cloudflare via OpenNext (`@opennextjs/cloudflare`)

## Before Starting Work

Before implementing any non-trivial task, think through the request and identify:
- Ambiguous requirements or missing details
- Multiple valid approaches where user preference matters
- Edge cases or scope boundaries that aren't specified
- Assumptions you're about to make

If any of these exist, use AskUserQuestion to clarify BEFORE writing code.
Do NOT ask about things you can resolve by reading the codebase.
Do NOT ask when the user has given explicit, detailed instructions.
For simple, unambiguous tasks — just do them.

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

## Commands

- `npm run dev` — local dev server (port 3000)
- `npm run build` — production build (must pass with 0 TypeScript errors)
- `npm run lint` — ESLint check (next/core-web-vitals + next/typescript)
- `npm run db:generate` — generate Drizzle migrations after schema changes
- `npm run db:push` — push schema directly to database (use with caution)
- `npm run db:migrate` — run generated migrations
- `npm run db:studio` — open Drizzle Studio for visual database browsing

## After Making Changes

- Run `npm run build` after completing work to catch TypeScript errors before the user sees them
- If build fails, fix the errors — do not leave broken builds
- For UI-only changes, at minimum run `npm run lint`

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

## Twilio Documentation (Context7)

When working on Twilio-related features (SMS, Voice, webhooks, TwiML), always fetch the latest docs using Context7's `query-docs` tool before implementing. This ensures you use current APIs, not stale training data.

### Library IDs

| Library ID | Use For |
|---|---|
| `/twilio/twilio-node` | Node.js SDK usage — sending SMS, making calls, client initialization |
| `/websites/twilio_voice` | Programmable Voice — TwiML, call flows, conferencing, recording, IVR |
| `/twilio/twilio-voice.js` | Client-side JavaScript Voice SDK — browser-based calling |
| `/llmstxt/twilio_llms_txt` | General Twilio platform — Conversations API, webhooks, auth, pricing |

### How to Use

1. Call `resolve-library-id` with `libraryName: "twilio"` if you need to discover additional libraries
2. Call `query-docs` with the appropriate library ID and a specific question:
   ```
   query-docs(libraryId: "/twilio/twilio-node", query: "How to handle incoming SMS webhook")
   query-docs(libraryId: "/websites/twilio_voice", query: "TwiML Gather input with speech recognition")
   ```
3. Prefer `/twilio/twilio-node` for SDK-specific code and `/websites/twilio_voice` for Voice feature docs

### Terminal Setup for Parallel Worktrees

Use GhostTTY (`ghostty`) for running multiple Claude Code instances across worktrees. `Cmd+D` splits horizontal, `Cmd+Shift+D` splits vertical, `Cmd+Arrow` jumps between panes. Lighter than iTerm for high pane counts.
