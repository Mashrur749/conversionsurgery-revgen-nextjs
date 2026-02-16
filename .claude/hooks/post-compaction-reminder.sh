#!/bin/bash
# SessionStart hook: re-injects critical patterns after context compaction
# Only fires on "resume" (after compaction), not fresh sessions

cat <<'REMINDER'
## Critical Patterns (post-compaction reminder)
- Database: `getDb()` from `@/db` — Neon HTTP client per request, NEVER cache
- API params: Next.js 16 uses `Promise<{ id: string }>` — ALWAYS await
- Admin auth: check `(session as any).user?.isAdmin` on ALL `/api/admin/*` routes
- Client auth: `getClientSession()` from `@/lib/client-auth` — cookie-based
- Schema: one table per file in `src/db/schema/`, re-export from index.ts
- Validation: Zod `.strict()` on all API input
- Dialog: custom DialogTrigger does NOT support `asChild` — use className directly
- After changes: run `npm run build` — MANDATORY, fix errors before reporting done
- External APIs: query Context7 BEFORE writing Twilio/Stripe/OpenAI code
- Autonomy: do NOT ask clarifying questions — follow the auto-checklists in CLAUDE.md
- Session end: commit all working code, ensure build passes, update progress.md if in worktree
REMINDER
