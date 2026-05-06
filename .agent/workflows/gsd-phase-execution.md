# GSD Phase Execution with Agent Orchestration

> **Applies to:** Any agent executing a GSD phase (`/gsd-plan-phase`, `/gsd-execute-phase`, or manual phase work).
> **Purpose:** Ensure GSD phase execution integrates with session continuity, work tracking, and quality gates.

## Pre-Phase Checklist

Run these steps **before** invoking any GSD command or starting phase work.

### 1. Session Pre-Flight

```bash
pnpm run agent:start
```

If this fails, resolve the issue before proceeding. Do not start a GSD phase with a dirty workspace.

### 2. Update Progress.md for GSD Context

Open `.agent/progress.md` and fill in:

| Field | Value |
|---|---|
| **Task ID** | GSD Phase `N` (e.g., `GSD-P3`) |
| **Description** | Phase name from `ROADMAP.md` or `.planning/` |
| **Files Touched** | Initially empty; append as you go |
| **Started At** | Current ISO timestamp |

In the **Session Log**, add:
```
- `HH:MM` — Started GSD Phase N: [phase name]
```

### 3. Read Phase Context

- Read `.planning/PROJECT.md` for project state
- Read `.planning/ROADMAP.md` (if exists) for phase list
- Read the phase's `RESEARCH.md`, `PLAN.md`, or `SPEC.md` if already generated
- Read `.agent/work-tracker.md` to see if any parallel work is in progress

## During Phase Execution

### Per-Wave Checkpoint (Execute Phase)

If running `/gsd-execute-phase` with wave-based parallelization, update `.agent/progress.md` **before spawning each wave**:

```markdown
## Next Step
1. Running Wave N of Phase P — spawning subagents for [plan names]
```

Append to **Session Log**:
```
- `HH:MM` — Wave N started: [plan names]
```

After each wave completes:
- Append results to **Session Log**
- Update **Files Touched** with any new files created
- Run `pnpm run agent:check` to verify workspace consistency
- If wave passed all gates, make a checkpoint commit:
  ```bash
  pnpm run agent:ship "feat(phase-N): complete wave N — [brief description]"
  ```

### Per-Plan Checkpoint (Interactive Mode)

If running with `--interactive` (sequential, no subagents), update `.agent/progress.md` after every plan:
- Mark the plan done in **Session Log**
- Update **Files Touched**
- Run `pnpm run agent:check`
- Commit every 3–5 files with `pnpm run agent:ship`

## Post-Phase Checklist

After the phase completes (all waves done, verification passed):

1. **Update `.agent/progress.md`:**
   - Set **Next Step** to `"Phase complete — awaiting verification or next phase"`
   - Mark all verification gates as ✅ or ❌
   - Record final commit hash in **Commit State**

2. **Update `.agent/work-tracker.md`:**
   - If this phase was tracked as a work item, mark it `done`
   - Unlock dependent waves/items if applicable

3. **Final Commit:**
   ```bash
   pnpm run agent:ship "feat(phase-N): complete [phase name] — all waves verified"
   ```

4. **Doc Sync:**
   - Check the AGENTS.md Change→Doc mapping table
   - Update any affected docs (`PLATFORM-CAPABILITIES.md`, `TESTING-GUIDE.md`, etc.)

## Emergency Stop

If a GSD phase must be abandoned mid-wave:

1. Immediately update `.agent/progress.md`:
   - **Blockers:** Record why the phase stopped
   - **Next Step:** `"Abandoned — resume from Wave N, Plan [name]"`
   - **Commit State:** Note any uncommitted files

2. Commit whatever is safe:
   ```bash
   pnpm run agent:ship --force "wip(phase-N): emergency stop — [reason]"
   ```

3. The next session's `session-recovery.md` pre-flight will detect this and route to resume.
