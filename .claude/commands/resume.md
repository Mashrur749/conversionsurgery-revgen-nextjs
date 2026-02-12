You are resuming implementation of a slice that was interrupted — likely by a usage limit, a session timeout, or the user stepping away.

**Arguments:** $ARGUMENTS
(Format: `<feature-name> <slice-number>`, or leave blank if already inside a worktree)

## Step 1: Orient Yourself

Read these files in this exact order. Do not skip any.

1. **`CLAUDE.md`** (in this worktree) — your scope and contract
2. **`.claude/feature-plan.md`** — how this slice fits into the whole
3. **`.claude/progress.md`** — THIS IS THE CRITICAL FILE. It tells you:
   - What tasks are done, in progress, or not started
   - What the current state of the code is
   - What decisions were made and why
   - What the exact next task is
   - Any blockers or cross-worktree notes

If `.claude/progress.md` doesn't exist, tell the user: "No progress file found. This slice either hasn't been started or wasn't tracking progress. Want me to assess the current state from git history and create a progress file?"

## Step 2: Assess Current State

Verify what the progress file says against reality:

```bash
# What files have been changed?
git diff main...HEAD --name-only

# What's the latest commit?
git log --oneline -5

# Are there uncommitted changes?
git status

# Does the build pass?
npm run build 2>&1 | tail -10
```

If the progress file and actual state don't match (e.g., progress says Task 3 is done but the file doesn't exist), trust the filesystem over the progress file and update it.

## Step 3: Report to User

Present a brief status:

```
Resuming: <feature> / Slice <N>
Last session: <what was completed>
Current state: <what exists and works>
Next up: <exact next task>
Blockers: <any, or "none">
```

Ask: "Ready to continue from here?"

## Step 4: Continue Implementation

Pick up from the exact next task in the progress file. Follow all the same rules from `/implement`:
- Stay within scope boundaries
- Commit frequently
- Write tests alongside code
- Run build/lint after changes
- Read relevant skills (create-migration, neon-postgres) if applicable

**Update `.claude/progress.md` as you go** — after each task completion, update the task status and the "Current State" section.

## Step 5: When Stopping (For Any Reason)

Before the session ends — whether you're done, hitting a limit, or the user is stepping away — **ALWAYS update `.claude/progress.md`**:

1. Mark completed tasks as ✅
2. Mark the current in-progress task as 🔨 with notes on where you are within it
3. Update "What's been built so far" with any new files
4. Update "What's next" with the specific next action
5. Add a session log entry:
   ```
   ### Session N — <date>
   - Started: <where you picked up>
   - Completed: <tasks finished>
   - Stopped because: <reason — limit hit / user paused / slice complete>
   ```
6. Commit the progress file:
   ```bash
   git add .claude/progress.md
   git commit -m "chore(slice-N): update progress tracker"
   ```

This commit ensures the next session — or a different developer — can pick up seamlessly.
