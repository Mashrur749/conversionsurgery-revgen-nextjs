# Slice {{SLICE_NUMBER}} — {{FEATURE_NAME}}

**Branch:** `{{BRANCH_NAME}}`
**What:** {{SLICE_DESCRIPTION}}

Feature plan: `.claude/feature-plan.md`

---

## Scope

### Allowed:
<!-- FILL IN with real paths from the plan -->
- `src/...`

### Off-limits:
- Everything not listed above
- `.env` files
- `package-lock.json`
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
5. Verify before done:
   ```bash
   npm run build
   npm run lint
   git diff main...HEAD --name-only  # all files in scope?
   ```

## Done

- [ ] Acceptance criteria met
- [ ] `npm run build` — 0 errors
- [ ] `npm run lint` — clean
- [ ] All committed, proper messages
- [ ] No files outside scope
