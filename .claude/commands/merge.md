Execute the merge sequence for a completed slice. Follow every step precisely.

**Arguments:** $ARGUMENTS
(Format: `<feature-name> <slice-number>`)

## Pre-Merge Checks

1. **Verify readiness:**
   ```bash
   # Check for uncommitted changes in worktree
   bash .claude/scripts/worktree-manager.sh status <feature-name>
   ```
   If the worktree has uncommitted changes, stop.

2. **Verify merge order.** Read `.claude/plans/<feature-name>.md`. Confirm this slice's dependencies are already merged. If not, stop and tell the user which slice needs to merge first.

3. **Verify build passes in the worktree:**
   ```bash
   cd <worktree-path>
   npm run build
   npm run lint
   ```

## Execute Merge

```bash
bash .claude/scripts/worktree-manager.sh merge <feature-name> <slice-number>
```

If merge conflicts occur, report them and help resolve.

## Post-Merge

1. **Rebase remaining worktrees:**
   ```bash
   bash .claude/scripts/worktree-manager.sh rebase-all <feature-name>
   ```
   Report any conflicts.

2. **Push:**
   ```bash
   git push origin main
   ```

3. **Clean up merged worktree:**
   ```bash
   bash .claude/scripts/worktree-manager.sh cleanup-slice <feature-name> <slice-number>
   ```

## Status Report

```
✅ Merged: feature/<feature>/slice-<N> → main
📊 Remaining:
   Slice X: <status>
   Slice Y: <status>

Next: /implement or /merge the next slice in dependency order.
```
