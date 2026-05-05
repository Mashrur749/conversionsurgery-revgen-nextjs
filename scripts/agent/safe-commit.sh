#!/usr/bin/env bash
set -euo pipefail

# Agent Safe Commit Script
# Wraps git commit with mandatory quality gates.
# Usage: ./safe-commit.sh "[area] verb noun — context"
#        ./safe-commit.sh --force "[area] verb noun — context"

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

FORCE=0
MESSAGE=""

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=1
      ;;
    *)
      if [ -z "$MESSAGE" ]; then
        MESSAGE="$arg"
      else
        MESSAGE="${MESSAGE} ${arg}"
      fi
      ;;
  esac
done

# If no message provided, generate one from changed files
if [ -z "$MESSAGE" ]; then
  CHANGED_FILES="$(git diff --name-only 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')"
  if [ -z "$CHANGED_FILES" ]; then
    CHANGED_FILES="$(git diff --cached --name-only 2>/dev/null | tr '\n' ' ' | sed 's/ *$//')"
  fi
  if [ -n "$CHANGED_FILES" ]; then
    # Take the first changed file's directory as area, and list files
    AREA="$(echo "$CHANGED_FILES" | awk '{print $1}' | cut -d'/' -f1-2 | tr '/' '-')"
    FILE_COUNT="$(echo "$CHANGED_FILES" | wc -w | tr -d ' ')"
    MESSAGE="[${AREA}] update ${FILE_COUNT} file(s)"
  else
    fail "No changed files detected and no commit message provided."
    exit 1
  fi
fi

info "Preparing safe commit: ${MESSAGE}"

# Run gates unless --force
if [ "$FORCE" -eq 1 ]; then
  warn "=============================================="
  warn "  EMERGENCY OVERRIDE: --force flag detected"
  warn "  Skipping quality gates. This is discouraged."
  warn "=============================================="
  warn "You MUST log a memory entry explaining why --force was used."
  echo
else
  # Gate 1: typecheck
  info "Running typecheck..."
  if pnpm run typecheck; then
    ok "typecheck passed"
  else
    fail "typecheck FAILED. Commit aborted."
    exit 1
  fi

  # Gate 2: logging guard
  info "Running logging-guard..."
  if pnpm run quality:logging-guard; then
    ok "logging-guard passed"
  else
    fail "logging-guard FAILED. Commit aborted."
    exit 1
  fi
fi

# Stage all changes and commit
info "Staging all changes..."
git add -A

info "Committing with message: ${MESSAGE}"
if git commit -m "$MESSAGE"; then
  NEW_HASH="$(git rev-parse --short HEAD)"
  ok "Committed successfully: ${NEW_HASH}"
  echo
  echo "Next steps:"
  echo "  - Update .Codex/progress.md Commit State"
  echo "  - Append to Session Log"
  exit 0
else
  fail "git commit failed."
  exit 1
fi
