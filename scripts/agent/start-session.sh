#!/usr/bin/env bash
set -euo pipefail

# Agent Session Start Script
# Run this at the beginning of every agent session to verify a safe working state.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# Color helpers (fallback gracefully)
red='' green='' yellow='' blue='' reset=''
if command -v tput >/dev/null 2>&1 && [ -t 1 ]; then
  red=$(tput setaf 1)
  green=$(tput setaf 2)
  yellow=$(tput setaf 3)
  blue=$(tput setaf 4)
  reset=$(tput sgr0)
fi

warn()  { echo "${yellow}[warn]${reset} $*" >&2; }
fail()  { echo "${red}[fail]${reset} $*" >&2; }
info()  { echo "${blue}[info]${reset} $*"; }
ok()    { echo "${green}[ok]${reset} $*"; }

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

header() {
  echo
  echo "========================================"
  echo "  [agent-session] Starting session"
  echo "  Branch: ${BRANCH}"
  echo "  Time:   ${TIMESTAMP}"
  echo "========================================"
  echo
}

header

# 1. Verify required tools
info "Checking required tools..."
MISSING_TOOLS=()
for tool in pnpm node git; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    MISSING_TOOLS+=("$tool")
  fi
done

if [ ${#MISSING_TOOLS[@]} -ne 0 ]; then
  fail "Missing required tools: ${MISSING_TOOLS[*]}"
  exit 1
fi
ok "All required tools available (pnpm, node, git)"

# 2. Verify progress.md exists
PROGRESS_FILE=".agent/progress.md"
if [ ! -f "$PROGRESS_FILE" ]; then
  warn "${PROGRESS_FILE} not found. Creating from template..."
  mkdir -p .Codex
  cat > "$PROGRESS_FILE" <<'EOF'
<!--
  MANDATORY: Agents MUST update this file before stopping, before any long-running
  operation (build, test, migration), and when hitting a blocker. The next agent
  reads this first to assess whether to resume or restart. Keep it accurate and
  concise — stale progress.md is worse than none.
-->

# Session Progress

## Current Session

| Field | Value |
|---|---|
| Date | YYYY-MM-DD |
| Branch | `main` or feature branch name |
| Agent Model | e.g., claude-sonnet-4-20250514 |

## Active Task

| Field | Value |
|---|---|
| Task ID | e.g., B1, C1, or freeform |
| Description | One-line summary of what is being built |
| Files Touched | List files modified so far in this session |
| Started At | ISO timestamp |

## Blockers

- **Blocker:** (description)
- **Tried:** (steps already attempted)
- **Error / Behavior:** (exact output or symptom)

## Next Step

1. (next action)

## Verification Status

| Gate | Status | Notes |
|---|---|---|
| `pnpm run typecheck` | ⏳ |  |
| `pnpm run lint` | ⏳ |  |
| `pnpm run build` | ⏳ |  |
| `pnpm test` | ⏳ |  |
| `pnpm run quality:no-regressions` | ⏳ |  |
| `pnpm run quality:logging-guard` | ⏳ |  |

## Commit State

| Field | Value |
|---|---|
| Last Commit Hash | `unknown` |
| Last Commit Message | (update to actual) |
| Uncommitted Files | List any unstaged / uncommitted files here |
| Uncommitted Note | Why they are not committed yet |

---

## Session Log

- `HH:MM` — (event description)
EOF
  ok "Created ${PROGRESS_FILE} from template"
else
  ok "${PROGRESS_FILE} found"
fi

# 3. Check git state
info "Checking git state..."
LAST_COMMIT_HASH="$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
LAST_COMMIT_MSG="$(git log -1 --pretty=%s 2>/dev/null || echo 'unknown')"

# Count uncommitted files (untracked + modified + staged)
UNCOMMITTED_COUNT="$(git status --short 2>/dev/null | wc -l | tr -d ' ')"

# Extract uncommitted files from progress.md if documented
PROGRESS_UNCOMMITTED=""
if [ -f "$PROGRESS_FILE" ]; then
  # Read the "Uncommitted Files" line from progress.md
  PROGRESS_UNCOMMITTED="$(grep '^| Uncommitted Files' "$PROGRESS_FILE" | sed 's/^| Uncommitted Files | //;s/ |$//' || true)"
fi

# Determine if state is safe
STATE_CLEAN=0
if [ "$UNCOMMITTED_COUNT" -eq 0 ]; then
  STATE_CLEAN=1
  ok "Working tree is clean"
elif [ -n "$PROGRESS_UNCOMMITTED" ] && [ "$PROGRESS_UNCOMMITTED" != "List any unstaged / uncommitted files here" ] && [ "$PROGRESS_UNCOMMITTED" != "List any unstaged / uncommitted files here |" ]; then
  ok "Uncommitted files documented in ${PROGRESS_FILE} (${UNCOMMITTED_COUNT} files)"
  STATE_CLEAN=1
else
  fail "Working tree has ${UNCOMMITTED_COUNT} uncommitted file(s) NOT documented in ${PROGRESS_FILE}"
  echo
  echo "Uncommitted files:"
  git status --short
  echo
  warn "Document these in ${PROGRESS_FILE} or commit them before proceeding."
fi

# 4. Work-tracker status
WORK_TRACKER=".agent/work-tracker.md"
IN_PROGRESS_COUNT=0
if [ -f "$WORK_TRACKER" ]; then
  IN_PROGRESS_COUNT="$(grep -c 'in_progress' "$WORK_TRACKER" || true)"
  ok "Work-tracker: ${IN_PROGRESS_COUNT} item(s) in_progress"
else
  warn "Work-tracker not found at ${WORK_TRACKER}"
fi

# 5. Print summary
echo
echo "----------------------------------------"
echo "  SESSION SUMMARY"
echo "----------------------------------------"
echo "  Branch:           ${BRANCH}"
echo "  Last Commit:      ${LAST_COMMIT_HASH} — ${LAST_COMMIT_MSG}"
echo "  Uncommitted:      ${UNCOMMITTED_COUNT} file(s)"
echo "  Work-Tracker:     ${IN_PROGRESS_COUNT} in_progress"
echo "----------------------------------------"
echo

if [ "$STATE_CLEAN" -eq 1 ]; then
  ok "Session pre-flight complete. Safe to proceed."
  exit 0
else
  fail "Session pre-flight FAILED. Human intervention required."
  exit 1
fi
