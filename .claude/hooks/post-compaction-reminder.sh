#!/bin/bash
# SessionStart hook: re-injects critical patterns after context compaction

cat <<'REMINDER'
## Critical Patterns (post-compaction reminder)
- Database: `getDb()` from `@/db` — Neon HTTP client per request, NEVER cache
- API params: Next.js 16 uses `Promise<{ id: string }>` — ALWAYS await
- Admin auth: `adminRoute()` / `adminClientRoute()` from `@/lib/utils/route-handler` on ALL `/api/admin/*` routes
- Client auth: `portalRoute()` from `@/lib/utils/route-handler` for `/api/client/*` routes
- Schema: one table per file in `src/db/schema/`, re-export from index.ts
- Validation: Zod `.strict()` on all API input
- Dialog: custom DialogTrigger does NOT support `asChild` — use className directly
- TypeScript: NEVER use `any` — use proper types, schema-inferred types, or `unknown` with type guards
- JSX text: NEVER use literal quotes — use `&apos;` `&quot;` `&amp;` `&lt;` `&gt;` entity references
- Verification: `npx tsc --noEmit` after each change, `npm run build` at task completion
- External APIs: query Context7 BEFORE writing Twilio/Stripe/Anthropic code
- Autonomy: resolve ambiguity by reading the codebase — only ask when genuinely blocked
- Session end: commit all working code, ensure build passes, update progress.md if in worktree
- AI agent: orchestrator at `src/lib/agent/orchestrator.ts`, graph at `graph.ts`, model routing at `src/lib/ai/model-routing.ts`
- Compliance: ALL outbound messages go through `sendCompliantMessage()` from compliance-gateway

## UX Patterns (read .claude/skills/ux-standards/SKILL.md for full list)
- Brand colors ONLY — forest #1B2F26, sienna #C15B2E, olive #6B7E54, sage-light #C8D4CC. No raw Tailwind colors.
- No emojis in SMS, email, or UI text
- Mobile: flex + dvh, NEVER h-[calc(100vh-Xrem)]. Tables use card fallback below 640px.
- Reuse: Breadcrumbs, NotificationBell, SlaCountdown, useUnsavedChangesWarning, split-pane, mobile cards, URL-persisted tabs
- After UI changes: update docs/specs/UX-AUDIT-FULL.md + check CLAUDE.md Change-to-Doc table
REMINDER
