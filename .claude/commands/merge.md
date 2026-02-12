Execute the merge sequence for a completed slice. Follow every step precisely.

**Arguments:** $ARGUMENTS
(Format: `<feature-name> <slice-number>`)

## Pre-Merge Checks

1. **Verify readiness:**
   ```bash
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

4. **Check cross-worktree notes.** Read the merged slice's `.claude/progress.md` "Blockers & Cross-Worktree Notes" section before the worktree is deleted. If there are notes affecting other slices, surface them to the user so remaining worktrees can account for them.

5. **Update CLAUDE.md if this slice introduced new patterns.** If the merged slice established any new conventions, services, utilities, or patterns that future sessions need to know about — update the project CLAUDE.md. Examples:
   - New service → document import path and usage
   - New schema table → document query patterns
   - New utility function → add to Key Patterns
   - New API route convention → document it
   
   Skip if the slice purely followed existing patterns.

## Status Report

```
✅ Merged: feature/<feature>/slice-<N> → main
📊 Remaining:
   Slice X: <status> (<progress>)
   Slice Y: <status> (<progress>)

Cross-worktree notes from merged slice: <any, or "none">
Next: /resume or /implement the next slice in dependency order.
```
