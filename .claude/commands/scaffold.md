You are setting up the parallel development environment for a feature.

**Feature to scaffold:** $ARGUMENTS

## Instructions

1. **Read the plan** at `.claude/plans/$ARGUMENTS.md`. If it doesn't exist, tell the user to run `/plan $ARGUMENTS` first.

2. **Verify prerequisites:**
   ```bash
   # Must be clean and on main
   git status
   git branch --show-current
   ```
   If dirty or not on main, tell the user to commit/stash and switch first.

3. **Create worktrees** for each slice in the plan:
   ```bash
   bash .claude/scripts/worktree-manager.sh create <feature> <slice-num> "<description>"
   ```
   Execute this for every slice (0, 1, 2, etc.).

4. **Customize each worktree's CLAUDE.md.** After creation, `cd` into each worktree and edit its generated `CLAUDE.md` with the real scope boundaries from the plan:
   - Exact files/directories allowed
   - Exact contract (produces/consumes)
   - Explicit off-limits areas

   This step is critical — the generic template needs real values to enforce boundaries.

5. **Report what was created:**
   ```
   Worktrees created:
     ../conversionsurgery-<feature>-slice-0/  →  feature/<feature>/slice-0
     ../conversionsurgery-<feature>-slice-1/  →  feature/<feature>/slice-1
     ...

   To start implementing:
     cd ../conversionsurgery-<feature>-slice-0 && claude
     Then: /implement <feature> 0
   ```

   Remind the user: each worktree needs its own terminal + Claude Code session for true parallel work.
