# Session State Rules

> **Enforcement:** Self-enforced by every agent. Violations create silent data loss.  
> **Scope:** All sessions on this project, whether human- or agent-driven.

## Mandatory Checkpoints

Agents MUST update `.agent/progress.md` at the following moments:

1. **Before any long-running operation**
   - `pnpm run build`
   - `pnpm test`
   - `pnpm run db:generate`
   - `pnpm run db:migrate`
   - Any script expected to take >2 minutes
   - Update **Next Step** to `"Running [operation]"` and note the start time in **Session Log**.

2. **Before stopping** (for any reason — success, failure, context limit, user request)
   - Update all fields in `.agent/progress.md`.
   - If stopping mid-task, **Next Step** must be a single, actionable sentence.
   - If there are uncommitted changes, list them in **Commit State** and explain why.
   - Append stop reason to **Session Log**.

3. **When hitting a blocker**
   - Populate the **Blockers** section within one turn.
   - Record what was tried and the exact error.
   - If the blocker cannot be resolved in 3 attempts, STOP. Update **Next Step** to `"Blocked — requires human decision or external dependency"`.

## Commit Discipline

- **Checkpoint commits:** Every 3–5 files modified (or one coherent unit of work, whichever is smaller).
- **Commit message format:** `[area] verb noun — context`
  - Good: `feat(billing): add createCheckoutSession service — A2 implementation`
  - Bad: `update`, `wip`, `fix stuff`
- **Never leave unstaged changes unnoted.** If changes must remain unstaged, explain in **Commit State**.
- **Before stopping, commit if possible.** If the build is broken, commit with a `WIP:` prefix and note the failing gate.

## Memory & Decisions

- **Non-obvious decisions:** If you choose approach A over B and the reason is not self-evident from the code or AGENTS.md, write a memory entry (via `write_memory`) before stopping.
- **Why this matters:** The next agent will not have your reasoning context. A one-line memory entry prevents regressions.
- **What counts as non-obvious:**
  - Workarounds for library bugs
  - Deviations from established patterns (e.g., using raw SQL instead of Drizzle ORM for a specific query)
  - Any `// HACK:` or `// NOTE:` comment in code

## State Hygiene

- **Do not modify another agent's in-progress row** in `.agent/work-tracker.md`.
- **Do not delete old Session Log entries.** Archive them if the file grows >100 lines.
- **Keep `.agent/progress.md` truthful.** If you guessed at a commit hash or file list, mark it with `(estimated)`.
- **If you find stale / contradictory state, fix it.** Do not silently overwrite — append a correction note to the Session Log.

## Recovery Reference

If you are starting a new session, follow `.agent/workflows/session-recovery.md` before reading this file.
