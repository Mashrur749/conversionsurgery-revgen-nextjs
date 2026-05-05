# Agent Infrastructure Work Tracker

> This tracker coordinates the multi-agent build-out of hands-off coding agent infrastructure.
> Rules: Each item lists exact files touched. No two agents may modify the same file concurrently.
> Update status in your assigned row when you start and finish.

## Usage

### Adding Items

1. Append a new row to the appropriate wave table.
2. Use a sequential ID within the wave (e.g., `A2`, `B2`).
3. Set `Status` to `pending`.
4. List every file the task will touch in `Files Touched`.
5. List dependency IDs in `Depends On`; leave blank for wave 1 items.

### Status Values

| Value | Meaning | Who Updates |
|---|---|---|
| `pending` | Not started | Coordinator (human or root agent) |
| `in_progress` | Assigned and active | The agent working the item |
| `done` | Completed and verified | The agent working the item |
| `blocked` | Cannot start or proceed until dependency resolves | The agent working the item, or coordinator |

### Assignment Rules

- The **coordinator** (human or root agent) assigns items by filling the `Assigned Agent` column.
- An agent **must not** self-assign without explicit coordinator approval.
- An agent updates **only** the row they are assigned to.
- An agent **must not** pick up a new item until their current item is marked `done`.

### Dependency Rules

- An item with non-empty `Depends On` **must not** start until every dependency is `done`.
- If a dependency stalls (>30 min no update), escalate to the coordinator rather than bypassing.
- If a wave contains only `done` items, the coordinator may unlock the next wave by updating `blocked` statuses to `pending`.

## Wave 1 — Independent (No Dependencies)

| ID | Status | Assigned Agent | Task | Files Touched | Depends On |
|---|---|---|---|---|---|
| A1 | `done` | a42e9b607 | MCP zero-friction: Remove Serena, pin versions, document env | `~/.kimi/mcp.json`, `docs/engineering/AGENT-ENVIRONMENT.md` | — |
| B1 | `done` | a05388554 | Session continuity: Create recovery workflow, progress template, state rules | `.Codex/work-tracker.md` (meta section only), `.Codex/progress.md`, `.agent/workflows/session-recovery.md`, `.agent/rules/session-state.md` | — |

## Wave 2 — Depends on Wave 1B

| ID | Status | Assigned Agent | Task | Files Touched | Depends On |
|---|---|---|---|---|---|
| C1 | `done` | abfb8c2e5 | Agent guardrails: Create start-session, safe-commit, verify-state scripts + package.json entry | `scripts/agent/start-session.sh`, `scripts/agent/safe-commit.sh`, `scripts/agent/verify-work-state.sh`, `package.json`, `AGENTS.md` | B1 |

## Wave 3 — Depends on Wave 2

| ID | Status | Assigned Agent | Task | Files Touched | Depends On |
|---|---|---|---|---|---|
| D1 | `done` | a43e14d72 | CI hardening + setup docs: Enhance CI with agent checks, create one-command setup guide | `.github/workflows/ci.yml`, `docs/engineering/AGENT-SETUP.md` | C1 |

## Completion Gate

- [ ] All waves complete
- [ ] `pnpm run quality:no-regressions` passes
- [ ] `pnpm run typecheck` passes
- [ ] Work-tracker updated to all `done`
