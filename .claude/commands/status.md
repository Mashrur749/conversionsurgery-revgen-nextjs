Show current state of all worktrees, task progress, and cross-worktree notes.

**Arguments:** $ARGUMENTS
(Optional: feature name to filter)

## Instructions

1. **Run git status:**
   ```bash
   bash .claude/scripts/worktree-manager.sh status $ARGUMENTS
   ```

2. **Read progress from each worktree.** For each active worktree, check if `.claude/progress.md` exists and read it:
   ```bash
   # List all worktrees
   git worktree list
   
   # For each worktree path, check for progress
   cat <worktree-path>/.claude/progress.md
   ```

3. **Present a comprehensive summary:**

   ```
   Feature: <feature-name>
   ════════════════════════

   Slice 0: Shared Foundation
   Status: ✅ Complete (merged)
   
   Slice 1: Reminder Service
   Status: ⏸️ Paused (limit hit)
   Progress: 3/5 tasks done
   Last session: Built sendReminder and scheduleReminder functions
   Next up: Write retry logic for failed SMS sends
   Blockers: none
   
   Slice 2: API Routes + UI  
   Status: 🔨 In Progress
   Progress: 1/6 tasks done
   Last session: Created API route stubs
   Next up: Add Zod validation to POST /api/admin/reminders
   Blockers: none
   
   Merge order: 0 ✅ → 1 (⏸️) → 2 (🔨)
   Next action: Resume Slice 1 → /resume <feature> 1
   ```

4. **Surface cross-worktree notes.** Check the "Blockers & Cross-Worktree Notes" section of every progress file. If any slice has notes that affect other slices, highlight them:

   ```
   ⚠️ Cross-Worktree Notes:
   
   From Slice 1: "Added ReminderStatus type to src/types/reminders.ts — 
   Slice 2 will need to import this for the UI status badges"
   
   From Slice 2: "The POST endpoint expects { scheduleId, message } — 
   Slice 1 service should return scheduleId in its response"
   ```

5. **Flag issues:**
   - Slices paused with no progress file (can't resume cleanly)
   - Worktrees with uncommitted changes
   - Worktrees far behind main
   - Conflicting cross-worktree notes (Slice 1 says X, Slice 2 expects Y)
   - Blocked slices that need attention
