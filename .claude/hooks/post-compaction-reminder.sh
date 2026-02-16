#!/bin/bash
# SessionStart hook: re-injects critical patterns after context compaction
# Only fires on "resume" (after compaction), not fresh sessions

cat <<'REMINDER'
## Critical Patterns (post-compaction reminder)
- Database: `getDb()` from `@/db` — Neon HTTP client per request, NEVER cache
- API params: Next.js 16 uses `Promise<{ id: string }>` — ALWAYS await
- Admin auth: `requireAdmin(session)` from `@/lib/utils/admin-auth` on ALL `/api/admin/*` routes
- Client auth: `getClientSession()` from `@/lib/client-auth` — cookie-based
- Schema: one table per file in `src/db/schema/`, re-export from index.ts
- Validation: Zod `.strict()` on all API input
- Dialog: custom DialogTrigger does NOT support `asChild` — use className directly
- TypeScript: NEVER use `any` — use proper types, schema-inferred types, or `unknown` with type guards
- JSX text: NEVER use literal quotes — use `&apos;` `&quot;` `&amp;` `&lt;` `&gt;` entity references
- Verification: `npx tsc --noEmit` after each change, `npm run build` at task completion
- External APIs: query Context7 BEFORE writing Twilio/Stripe/OpenAI code
- Autonomy: resolve ambiguity by reading the codebase — only ask when genuinely blocked
- Session end: commit all working code, ensure build passes, update progress.md if in worktree
REMINDER
