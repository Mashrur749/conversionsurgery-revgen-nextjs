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

4. **Read relevant skills before starting:**
   - If this slice touches database schema → read `.claude/skills/create-migration/SKILL.md` first
   - If this slice touches Neon/Postgres queries → read `.claude/skills/neon-postgres/SKILL.md` first
   - If this slice touches UI pages or components → read `.claude/skills/ux-standards/SKILL.md` first

5. **Study existing patterns.** Read 3 similar files before writing anything. Match naming, error handling, and structure.

6. **Check for existing progress.** If `.claude/progress.md` exists, a previous session was interrupted. Run `/resume` instead of continuing here.

7. **Plan before building.** Produce a brief implementation plan for this slice:
   - What files will be created or modified (verify each is in scope)
   - What order to build them in
   - What the tricky parts are and how to handle them
   - What existing code to reference as a pattern
   
   Present this mini-plan to the user. Only proceed after approval.

8. **Create the progress tracker.** After the plan is approved, create `.claude/progress.md` from the template at `.claude/templates/progress.md`. Fill in:
   - Feature name and slice number
   - Break the approved plan into numbered tasks in the task table
   - Set overall status to 🔨 In Progress
   - Add Session 1 entry to the session log
   
   Commit it: `git add .claude/progress.md && git commit -m "chore(slice-N): initialize progress tracker"`

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
- **Update `.claude/progress.md` after each task completes.** Mark the task ✅, update "What's been built so far" and "What's next". This is your lifeline if the session gets interrupted.

## Implementation Order

For **schema slices:**
1. Read `.claude/skills/create-migration/SKILL.md` — follow its process exactly
2. Create table file in `src/db/schema/<table>.ts`
3. Add export to `src/db/schema/index.ts`
4. Run `npm run db:generate` to create migration (DO NOT run `db:push` or `db:migrate` without user confirmation)
5. Write tests

For **service slices:**
1. If querying Neon directly, read `.claude/skills/neon-postgres/SKILL.md` first
2. Import types/schema from shared slice
3. Build service in `src/lib/services/` or `src/lib/automations/`
4. Validate all inputs with Zod
5. Handle all error paths
6. Write tests

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

## If the Implementation Goes Sideways

If you've tried 2+ approaches and the code is getting messy — STOP. Do not keep layering fixes on a broken foundation. Instead:

1. Take stock of what you now know works and what doesn't
2. Note the valuable pieces worth keeping
3. Reset: `git checkout -- .` or `git reset --hard HEAD`
4. Reimplement from scratch using only the approach you now know is correct
5. Update `.claude/progress.md` — note the reset and why in the session log

## Cross-Worktree Discoveries

If during implementation you discover something that affects another slice — a type they'll need to import, an API shape that changed, a shared utility that should exist — add it to the "Blockers & Cross-Worktree Notes" section of `.claude/progress.md`. The `/status` command reads these across all worktrees.

## When Stopping (For Any Reason)

**ALWAYS do this before the session ends**, whether complete, hitting a limit, or pausing:

1. Update `.claude/progress.md`:
   - Mark completed tasks ✅
   - Mark current task 🔨 with specific notes on where within it you stopped
   - Update "What's been built so far"
   - Update "What's next" with the exact next action (be specific: "Create the sendReminder function in src/lib/services/reminders.ts — the schema and types are done, need the actual sending logic using Twilio")
   - Add session log entry
2. Commit: `git add .claude/progress.md && git commit -m "chore(slice-N): update progress"`
3. Tell the user: "Progress saved. Run `/resume $ARGUMENTS` in your next session to pick up."

## Completion

Before declaring done, verify:

```bash
npm run build          # must be 0 TypeScript errors
npm run lint           # no new warnings

git diff main...HEAD --name-only
# ↑ verify every file is in your declared scope
```

- [ ] Acceptance criteria from feature plan met
- [ ] `npm run build` passes (0 errors)
- [ ] `npm run lint` passes
- [ ] All changes committed with proper messages
- [ ] No files outside declared scope
- [ ] Patterns match existing codebase

Update `.claude/progress.md`: set overall status to ✅ Complete, mark all tasks done, add final session log entry.

Then tell the user: "Slice N complete. Run `/review $ARGUMENTS` to review, or `/merge $ARGUMENTS` to merge directly."

## If Stuck

- Blocked by another slice → tell user, add to cross-worktree notes, suggest reordering
- Decomposition feels wrong → say so, cheaper to re-plan
- Need a dependency not in scope → flag it, don't install without asking
