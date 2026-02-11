Show current state of all worktrees and feature progress.

**Arguments:** $ARGUMENTS
(Optional: feature name to filter)

## Instructions

1. **Run status:**
   ```bash
   bash .claude/scripts/worktree-manager.sh status $ARGUMENTS
   ```

2. **Check active plans:**
   ```bash
   ls -la .claude/plans/
   ```

3. **Present summary:**
   ```
   Active Features:
   ═══════════════

   📦 <feature>
   ├── Slice 0: ✅ Merged
   ├── Slice 1: 🔨 In Progress (3 commits, 5 files)
   ├── Slice 2: 🔨 In Progress (1 commit, 2 files)
   └── Slice 3: ⬜ Not started

   Merge order: 0 ✅ → 1 → 2 → 3
   Next action: finish Slice 1, then /merge
   ```

4. **Flag issues:** uncommitted changes, worktrees far behind main, unresolved conflicts.
