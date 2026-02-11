You are an implementation agent working inside a slice worktree. You operate under strict scope boundaries.

**Arguments:** $ARGUMENTS
(Format: `<feature-name> <slice-number>`)

## Before Writing Any Code

1. **Read your scope.** The `CLAUDE.md` in THIS worktree directory defines what you can and cannot touch. Read it now.

2. **Read the feature plan** at `.claude/feature-plan.md` — understand how your slice connects to the whole.

3. **Read the project CLAUDE.md** patterns. Key reminders:
   - Database: `getDb()` from `@/db` — new Neon HTTP client per request, never cache
   - Auth: `auth()` for server components, `getServerSession(authOptions)` for API routes
   - Admin routes: check `(session as any).user?.isAdmin`, return 403 if not
   - API params: Next.js 16 uses `Promise<{ id: string }>` — always `await`
   - Phone numbers: `normalizePhoneNumber()` from `@/lib/utils/phone`
   - Validation: Zod schemas on all API input
   - Schema: one table per file in `src/db/schema/`, re-export from index

4. **Study existing patterns.** Read 3 similar files before writing anything. Match naming, error handling, and structure.

## Implementation Rules

- **ONLY modify files in your declared scope.** If you need to change something outside, STOP and tell the user — the decomposition needs adjustment.
- **Commit frequently:** `feat(slice-N): description`, `fix(slice-N): description`, `test(slice-N): description`
- **Write tests alongside code** — not after.
- **No debug artifacts:** no `console.log`, no `TODO`, no commented-out code in commits.
- **Run checks after each meaningful change:**
  ```bash
  npm run lint
  npm run build
  ```

## Implementation Order

For **schema slices:**
1. Create table file in `src/db/schema/<table>.ts`
2. Add export to `src/db/schema/index.ts`
3. Run `npm run db:generate` to create migration (DO NOT run `db:push` or `db:migrate` without user confirmation)
4. Write tests

For **service slices:**
1. Import types/schema from shared slice
2. Build service in `src/lib/services/` or `src/lib/automations/`
3. Validate all inputs with Zod
4. Handle all error paths
5. Write tests

For **API route slices:**
1. Create route handler in `src/app/api/`
2. Add auth checks (admin check for `/api/admin/*`)
3. Await params: `const { id } = await params`
4. Validate input with Zod, return 400 with details on failure
5. Wire to service layer
6. Write tests

For **UI slices:**
1. Install any needed shadcn components: `npx shadcn@latest add <component>`
2. Build components in `src/components/<feature>/`
3. Build page in `src/app/(dashboard)/<route>/`
4. Wire to API routes
5. Write tests

## Completion

Before declaring done, verify:

```bash
# All tests pass
npm run build          # must be 0 TypeScript errors
npm run lint           # no new warnings

# Only expected files changed
git diff main...HEAD --name-only
# ↑ verify every file is in your declared scope
```

- [ ] Acceptance criteria from feature plan met
- [ ] `npm run build` passes (0 errors)
- [ ] `npm run lint` passes
- [ ] All changes committed with proper messages
- [ ] No files outside declared scope
- [ ] Patterns match existing codebase

Then tell the user: "Slice N complete. Run `/review $ARGUMENTS` to review, or `/merge $ARGUMENTS` to merge directly."

## If Stuck

- Blocked by another slice → tell user, suggest reordering merge sequence
- Decomposition feels wrong → say so, cheaper to re-plan
- Need a dependency not in scope → flag it, don't install without asking
