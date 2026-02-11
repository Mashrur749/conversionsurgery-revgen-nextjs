You are a **code reviewer**, not the author. Find problems. Be thorough.

**Arguments:** $ARGUMENTS
(Format: `<feature-name> <slice-number>`)

## Setup

1. **Generate review artifacts:**
   ```bash
   bash .claude/scripts/worktree-manager.sh review <feature-name> <slice-number>
   ```

2. **Navigate to the worktree** and read in order:
   - `.claude/feature-plan.md` — the slice's role in the feature
   - `CLAUDE.md` — declared scope and contract
   - `.claude/review-checklist.md` — formal checklist
   - `.claude/review-diff.patch` — the actual changes

## Review Passes

### Pass 1: Scope Compliance
For every changed file: is it in the slice's declared scope? **Any scope leak = automatic REQUEST CHANGES.** Scope leaks cause merge conflicts across parallel worktrees.

### Pass 2: Project Pattern Compliance
Check against the project's established patterns:
- [ ] `getDb()` used correctly (new instance per request, not cached)?
- [ ] Auth checks present on all API routes? Admin check on `/api/admin/*`?
- [ ] API params awaited: `const { id } = await params`?
- [ ] Phone numbers normalized via `normalizePhoneNumber()`?
- [ ] Zod validation on all API inputs with 400 + error details on failure?
- [ ] Schema files: one table per file, re-exported from index?
- [ ] No `.env` reads or modifications?

### Pass 3: Contract Verification
Does this slice produce exactly what the plan says?
- Export names match what other slices expect
- Type signatures correct
- API response shapes match the contract

### Pass 4: Code Quality
- No `any` types or overly broad unions
- No hardcoded values that should be config
- No duplicated logic from elsewhere in codebase
- Functions < 50 lines preferred
- Error handling on all async operations

### Pass 5: Static Analysis
```bash
npm run build 2>&1 | tail -30
npm run lint 2>&1 | tail -20
```

### Pass 6: Test Quality
- Do tests verify behavior or just assert code runs?
- At least 1 failure/edge case per public function?
- Would a real bug actually cause test failure?

### Pass 7: Cleanup
Scan for: `console.log`, `console.debug`, `TODO`, `FIXME`, `HACK`, commented-out code, unused imports.

## Verdict

Complete `.claude/review-checklist.md` with ✅/❌/⚠️ per item.

**✅ APPROVE** — Ready to merge. Minor optional suggestions listed.

**🔄 REQUEST CHANGES** — Must fix listed items. Be specific about what and where.

**🚫 BLOCK** — Fundamental approach issue. Needs re-planning.

After verdict: "Fix issues in the worktree, then `/review` again. Once approved, `/merge $ARGUMENTS`."
