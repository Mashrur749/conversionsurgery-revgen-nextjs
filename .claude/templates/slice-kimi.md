# Slice {{SLICE_NUMBER}} — {{FEATURE_NAME}}

**Branch:** `{{BRANCH_NAME}}`
**What:** {{SLICE_DESCRIPTION}}

Feature plan: `.claude/feature-plan.md`
Progress tracker: `.claude/progress.md` (create on first start, read to resume)

---

## Scope

### Allowed:
<!-- FILL IN with real paths from the plan -->
- `src/...`

### Off-limits:
- Everything not listed above
- `.env` files
- `package-lock.json`
- `pnpm-lock.yaml`
- Other slices' directories

**Outside scope? → STOP. Tell the user.**

## Contract

**Produces:** <!-- FILL IN -->
- ...

**Consumes:** <!-- FILL IN -->
- ...

## Rules

1. Read 3 similar files before writing new code
2. Commits: `feat(slice-{{SLICE_NUMBER}}): description`
3. Tests alongside code, not after
4. No console.log / TODO / commented-out code
5. Update `.claude/progress.md` after every completed task
6. Verify before done:
   ```bash
   pnpm run build
   pnpm run lint
   git diff main...HEAD --name-only  # all files in scope?
   ```

## Resuming Work

If a previous session was interrupted, read `.claude/progress.md` and pick up where things left off. Do not restart full implementation if progress already exists.

## Tool Reference

This worktree supports both Claude Code and Kimi CLI.
- Claude-specific commands: see `CLAUDE.md` (if present)
- Kimi-specific guidance: see `KIMI.md` (repo root or parent)

## Done

- [ ] Acceptance criteria met
- [ ] `pnpm run build` — 0 errors
- [ ] `pnpm run lint` — clean
- [ ] All committed, proper messages
- [ ] No files outside scope
- [ ] Progress tracker marked ✅ Complete
