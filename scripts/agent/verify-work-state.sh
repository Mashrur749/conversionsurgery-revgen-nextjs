#!/usr/bin/env bash
set -euo pipefail

# Agent Work State Verification Script
# Validates that the workspace is in a consistent state.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# Color helpers
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

PROGRESS_FILE=".agent/progress.md"
STATE="clean"
BLOCKERS=""
LAST_ACTION=""
RECOMMENDATIONS=""
ISSUES=0

# 1. Check if progress.md exists and is stale
if [ ! -f "$PROGRESS_FILE" ]; then
  fail "${PROGRESS_FILE} missing"
  STATE="dirty"
  BLOCKERS="${BLOCKERS}Missing progress.md; "
  RECOMMENDATIONS="${RECOMMENDATIONS}Initialize progress.md from template; "
  ISSUES=$((ISSUES + 1))
else
  ok "${PROGRESS_FILE} exists"

  # Check staleness (>4 hours)
  MTIME="$(stat -f %m "$PROGRESS_FILE" 2>/dev/null || stat -c %Y "$PROGRESS_FILE" 2>/dev/null || echo 0)"
  NOW="$(date +%s)"
  AGE_HOURS=$(((NOW - MTIME) / 3600))

  if [ "$AGE_HOURS" -gt 4 ]; then
    warn "${PROGRESS_FILE} is stale (~${AGE_HOURS} hours old)"
    STATE="dirty"
    RECOMMENDATIONS="${RECOMMENDATIONS}Update progress.md before proceeding; "
    ISSUES=$((ISSUES + 1))
  else
    ok "${PROGRESS_FILE} is fresh (${AGE_HOURS}h old)"
  fi

  # Extract last action from Session Log (newest non-empty line)
  LAST_ACTION="$(grep '^- ' "$PROGRESS_FILE" | head -1 | sed 's/^- //' || true)"
fi

# 2. Verify files in "Files Touched" exist/have changes
if [ -f "$PROGRESS_FILE" ]; then
  # Extract Files Touched value
  FILES_TOUCHED="$(grep '^| Files Touched' "$PROGRESS_FILE" | sed 's/^| Files Touched | //;s/ |$//' || true)"

  if [ -n "$FILES_TOUCHED" ] && [ "$FILES_TOUCHED" != "List files modified so far in this session" ]; then
    MISSING_FILES=()
    for f in $FILES_TOUCHED; do
      # Skip markdown table artifacts and backticks
      f_clean="$(echo "$f" | sed 's/[`|]//g')"
      [ -z "$f_clean" ] && continue
      if [ ! -f "$f_clean" ] && [ ! -d "$f_clean" ]; then
        MISSING_FILES+=("$f_clean")
      fi
    done

    if [ ${#MISSING_FILES[@]} -ne 0 ]; then
      warn "Files Touched references missing paths: ${MISSING_FILES[*]}"
      STATE="dirty"
      BLOCKERS="${BLOCKERS}Missing files referenced in progress.md; "
      ISSUES=$((ISSUES + 1))
    else
      ok "Files Touched entries exist"
    fi
  fi
fi

# 3. Check for uncommitted changes not in progress.md
UNCOMMITTED_COUNT="$(git status --short 2>/dev/null | wc -l | tr -d ' ')"
if [ "$UNCOMMITTED_COUNT" -gt 0 ]; then
  # Check if progress.md documents them
  if [ -f "$PROGRESS_FILE" ]; then
    PROGRESS_UNCOMMITTED="$(grep '^| Uncommitted Files' "$PROGRESS_FILE" | sed 's/^| Uncommitted Files | //;s/ |$//' || true)"
    if [ -z "$PROGRESS_UNCOMMITTED" ] || [ "$PROGRESS_UNCOMMITTED" = "List any unstaged / uncommitted files here" ]; then
      warn "${UNCOMMITTED_COUNT} uncommitted file(s) not documented in progress.md"
      STATE="dirty"
      BLOCKERS="${BLOCKERS}Undocumented uncommitted changes; "
      RECOMMENDATIONS="${RECOMMENDATIONS}Document uncommitted changes in progress.md or run pnpm run agent:ship; "
      ISSUES=$((ISSUES + 1))
    else
      ok "Uncommitted changes documented"
    fi
  fi
else
  ok "No uncommitted changes"
fi

# 4. Run quick typecheck
info "Running quick typecheck..."
if pnpm run typecheck >/dev/null 2>&1; then
  ok "Codebase typechecks"
else
  fail "Typecheck FAILED — codebase is broken"
  STATE="dirty"
  BLOCKERS="${BLOCKERS}Type errors in codebase; "
  RECOMMENDATIONS="${RECOMMENDATIONS}Fix type errors before proceeding; "
  ISSUES=$((ISSUES + 1))
fi

# 5. Print summary
echo
echo "----------------------------------------"
echo "  WORK STATE REPORT"
echo "----------------------------------------"
echo "  state:            ${STATE}"
echo "  issues:           ${ISSUES}"
echo "  blockers:         ${BLOCKERS:-none}"
echo "  last_action:      ${LAST_ACTION:-none recorded}"
echo "  recommendations:  ${RECOMMENDATIONS:-none}"
echo "----------------------------------------"
echo

if [ "$ISSUES" -eq 0 ]; then
  ok "Workspace is clean and consistent."
  exit 0
else
  fail "Workspace inconsistencies detected. Review blockers and recommendations above."
  exit 1
fi
