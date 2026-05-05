# Session Recovery Workflow

> **Applies to:** Every agent starting a new session on this project.  
> **Purpose:** Avoid lost context, duplicate work, and corrupted state when picking up after an interruption.

## Pre-Flight Checklist

Do these steps **in order**. Do not skip. Do not start coding until the checklist is complete.

### 1. Read the Work Tracker

Read `.Codex/work-tracker.md`.

- Identify which wave is active.
- Identify which items are `in_progress`.
- If another item is `in_progress` and assigned to a different agent, verify whether it has stalled (no update in >30 min). If stalled, note it but do not take it over unless instructed.

### 2. Read the Session Progress File

Read `.Codex/progress.md`.

- Was there an interrupted session?
- Check **Blockers** — is the previous agent stuck on something you can resolve?
- Check **Next Step** — is it explicit enough to resume?
- Check **Verification Status** — which gates passed or failed?
- Check **Commit State** — are there uncommitted files? Are they expected?

### 3. Decide: Resume or Restart

| Condition | Action |
|---|---|
| `progress.md` exists, no blocker, uncommitted files match expectation | **Resume** from Next Step |
| `progress.md` exists, blocker listed, you can resolve it | **Resume** after resolving blocker; document the fix |
| `progress.md` exists, but state is inconsistent (e.g., files listed as touched do not exist, commit hash is wrong) | **Restart** the current task from last known good commit; document the restart in progress.md |
| `progress.md` missing or empty | Treat as cold start; initialize progress.md with current session info |
| Uncommitted files exist but are NOT noted in progress.md | **Stop and investigate.** Do not commit mystery files. Use `git diff` to inspect. Record findings in progress.md before proceeding. |

### 4. Read Project Rules

Read `AGENTS.md` at project root.

- Pay special attention to: **Autonomy & Assumptions**, **Coding Principles**, **Key Patterns**, and **Auto-Checklists**.
- Note any **Learned Rules** appended since your last session.

### 5. Check Git State

Run:

```bash
git status
git log --oneline -3
```

- Verify branch matches `progress.md` **Branch** field.
- Verify working tree is clean OR matches **Uncommitted Files**.
- If there are unexpected changes, resolve or document them before starting new work.

### 6. Begin Work

Only after steps 1–5 are complete:

1. Update `.Codex/progress.md` **Current Session** with today's date, branch, and your model.
2. If resuming: append to **Session Log** — `"Resuming from [last next-step]"`.
3. If restarting: append to **Session Log** — `"Restarting [task ID] from commit [hash]"`.
4. Proceed with the task.

## Emergency Override

If you are explicitly instructed by the user to ignore recovery and start a brand-new task immediately:

1. Still read `.Codex/work-tracker.md` and `.Codex/progress.md`.
2. Append a note to **Session Log**: `"Emergency override — starting new task [ID] per user instruction. Previous state archived."`.
3. Archive the old **Active Task** section by moving it to a new `## Archived Sessions` section at the bottom of `progress.md`.
4. Initialize a fresh **Active Task** for the new work.
