# Refactoring: {{MODULE_NAME}}

**Branch:** `{{BRANCH_NAME}}`
**Module:** {{MODULE_NAME}}

---

## Required Reading

Read these files FIRST, before any code changes:

1. `.claude/feature-plan.md` — Foundation patterns (getDb, auth, params, Zod, FROZEN files)
2. `.claude/module-plan.md` — This module's specific scope, files, and goals

---

## Module Scope

### Allowed Files:
{{FILE_MANIFEST}}

### Off-Limits (DO NOT TOUCH):
- `src/db/schema/index.ts` — FROZEN (merge conflict risk)
- `src/db/schema/relations.ts` — FROZEN (cross-module monolith)
- `src/lib/automations/incoming-sms.ts` — FROZEN (9 cross-module imports)
- `.env` / `.env.*` files
- `package.json` / `package-lock.json`
- `node_modules/`
- Any file not in the "Allowed Files" list above

**Touched an off-limits file? → STOP. Revert immediately.**

---

## Frozen Exports

These function signatures MUST NOT change (other modules import them):

{{FROZEN_EXPORTS}}

You may refactor internals. You must not rename, re-type, or relocate these exports.

---

## Refactoring Rules

1. Read 3 similar files in the codebase before writing new code
2. Commits: `refactor({{MODULE_NAME}}): description`
3. **No** `npm run db:generate` — migrations are batched by orchestrator
4. **No** new npm dependencies
5. **No** changes to files outside your scope
6. Preserve all FROZEN_EXPORTS signatures exactly
7. If you need a frozen file changed, write the request to `.refactor-notes.md`

---

## Done Checklist

- [ ] All refactoring goals from module plan completed
- [ ] `npm run build` — 0 TypeScript errors
- [ ] `npm run lint` — clean
- [ ] All commits use `refactor({{MODULE_NAME}}): ...` format
- [ ] `git diff main...HEAD --name-only` — all files within scope
- [ ] No FROZEN files modified
- [ ] No FROZEN_EXPORTS signatures changed
- [ ] Created `.refactor-complete` OR `.refactor-failed` sentinel file

**When done successfully:**
```bash
npm run build && npm run lint && touch .refactor-complete
```

**If you cannot complete the module** (unrecoverable build errors, missing dependencies, blocked by frozen files, etc.):
```bash
echo "REASON: <brief explanation of what went wrong>" > .refactor-failed
```

> **CRITICAL:** You MUST create exactly one sentinel file before finishing. The orchestrator monitors for these files to know you are done. If neither file exists, the orchestrator assumes you are still working (and will eventually time you out after 2 hours).
