# Kimi CLI Configuration — ConversionSurgery RevGen

This file augments `AGENTS.md` with Kimi Code CLI-specific directives.
`AGENTS.md` remains the primary source of truth for coding standards, stack info, and business rules.

## Active Safety Hooks (Kimi Global)

The following hooks run automatically on every session in this repo:

| Hook | Event | Purpose |
|------|-------|---------|
| `session-state.sh` | SessionStart | Injects project state from `.planning/PROJECT.md`, `AGENTS.md`, git status |
| `check-update.sh` | SessionStart | Background GSD framework update check |
| `validate-commit.sh` | PreToolUse (Shell) | Enforces Conventional Commits format on `git commit` |
| `protect-env.sh` | PreToolUse (WriteFile/StrReplaceFile) | Blocks direct edits to `.env` files |
| `protect-env-bash.sh` | PreToolUse (Shell) | Blocks Bash reads/greps/pipes of `.env` files |
| `protect-sensitive-files.sh` | PreToolUse (WriteFile/StrReplaceFile) | Blocks edits to `node_modules/`, `.git/`, `package-lock.json`, `secrets/` |
| `cleanup.sh` | SessionEnd | Runs `.kimi/scripts/cleanup.sh` — purges `.scratch/`, `.DS_Store`, stale artifacts |

**All hooks are fail-open.** If a hook crashes or times out, the operation is allowed through.

## Claude → Kimi Tool Mapping

| Claude Tool | Kimi Tool | Notes |
|-------------|-----------|-------|
| `Task` (subagent) | `Agent` (`coder`/`explore`/`plan`) | Use `Agent` with explicit `subagent_type` |
| `TodoWrite` | `SetTodoList` | Same concept, different API |
| `Read` | `ReadFile` | Supports `line_offset` and `n_lines` |
| `Grep` | `Grep` | Same syntax (ripgrep-based) |
| `Glob` | `Glob` | Same syntax |
| `Bash` | `Shell` | Supports `run_in_background` for long tasks |
| `Write` / `Edit` / `MultiEdit` | `WriteFile` / `StrReplaceFile` | Use `StrReplaceFile` for surgical edits |
| `AskUserQuestion` | `AskUserQuestion` | Same behavior |

## Known Differences from Claude Setup

1. **No Context-Mode Plugin** — Kimi does not have the persistent memory plugin. The `<claude-mem-context>` block in `AGENTS.md` is static; it will not auto-update across sessions. Treat it as a reference snapshot, not live memory.

2. **No Claude Plugins** — `superpowers`, `feature-dev`, `typescript-lsp`, `code-review`, `github`, `caveman` plugins are unavailable. Equivalent functionality:
   - `context7` → MCP server (✅ configured)
   - `github` → Use `gh` CLI via Shell
   - `code-review` → Run `pnpm run quality:code-review` manually
   - `caveman` statusline → Not available

3. **No `$CLAUDE_PROJECT_DIR`** — Hooks detect CWD from stdin JSON. Repo paths are resolved dynamically.

4. **GSD Slash Commands** — `/gsd-*`, `/plan`, `/scaffold`, `/implement`, etc. are Claude slash commands. In Kimi, invoke them by skill name or as natural language intent (e.g., "use the gsd-plan-phase skill" or "run the planning workflow").

5. **Permissions Model** — Kimi does not have per-repo `permissions.allow/deny` lists. Safety is enforced via hooks only. The critical denys (`rm -rf`, `db:push`, `git push --force`) from `.claude/settings.json` are **not mechanically enforced** in Kimi — they rely on the agent following rules.

## Skills Available to Kimi

Kimi loads skills from all discovered directories (`merge_all_available_skills = true`):

- **User-level**: `~/.claude/skills/` (GSD framework, graphify, FMEA, etc.)
- **Repo-level (`.claude/skills/`)**: `create-migration`, `ms-*`, `neon-postgres`, `service-delivery-simulation`, `ux-standards`
- **Repo-level (`.agents/skills/`)**: `claude-command-parity`, `create-migration`, `ms-*`, `neon-postgres`, `service-delivery-simulation`, `ux-standards`

Invoke a skill by referencing its name in conversation, e.g.:
- "Run the `ux-standards` skill before making UI changes"
- "Use `claude-command-parity` to translate `/plan` workflow"

## Verification Commands

Run these gates after any coding task:

```bash
pnpm run ms:gate              # Fast gate during implementation
pnpm run quality:logging-guard # Blocks API error-detail leaks
pnpm run quality:no-regressions # Completion gate (required)
```

## Worktree Workflow

For large features (3+ files), use the worktree manager:

```bash
bash .claude/scripts/worktree-manager.sh create <feature> <slice-num> "<description>"
```

Then `cd` into the worktree directory and start Kimi there.

## Context Management (No Context-Mode Plugin)

Claude's `context-mode` plugin maintained a persistent memory block in `AGENTS.md`. That block has been removed because:
1. It becomes stale without the plugin auto-refreshing it
2. The project's own rules forbid volatile memory exports in `AGENTS.md`

**For cross-session context, use:**
- `.planning/PROJECT.md` — high-level project state and current phase
- `.claude/progress.md` — in-flight work tracker (if using GSD workflows)
- Git history — `git log --oneline -20` for recent work

If you need persistent memory in Kimi, use the `write_memory` / `read_memory` MCP tools from the `serena` server, or maintain notes in `.scratch/drafts/` and promote to `docs/` when stable.

## Emergency Overrides

If a hook is blocking legitimate work, you can bypass by editing `~/.kimi/config.toml` and commenting out the hook, or by using the `--config-file` flag with a temporary config.
