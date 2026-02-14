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
- After changes: run `npm run build` to verify 0 TypeScript errors
REMINDER
