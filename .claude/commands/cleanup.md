Remove all worktrees, branches, and plan artifacts for a completed feature.

**Feature:** $ARGUMENTS

## Instructions

1. **Show what will be deleted:**
   ```bash
   bash .claude/scripts/worktree-manager.sh list $ARGUMENTS
   ```

2. **Ask for confirmation:** "This removes all worktrees and branches for '$ARGUMENTS'. Unmerged work will be lost. Proceed?"

3. **Only after confirmation:**
   ```bash
   bash .claude/scripts/worktree-manager.sh cleanup $ARGUMENTS
   ```

4. **Verify:**
   ```bash
   git worktree list
   ```

5. **Report:**
   ```
   ✅ Cleanup complete: $ARGUMENTS
   Worktrees removed: <count>
   Branches deleted: <list>
   ```
