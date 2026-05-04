#!/usr/bin/env bash
set -euo pipefail

# Smart pre-commit gate: classifies staged changes, runs minimum viable checks.
# Quiet on success (1 line max). Verbose only on failure.

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# Run a command quietly — show output only on failure.
run_quiet() {
  local label="$1"
  shift
  local output
  if output=$("$@" 2>&1); then
    return 0
  else
    local rc=$?
    echo "FAIL: ${label}"
    echo "$output"
    return $rc
  fi
}

# What's being committed?
STAGED_FILES="$(git diff --cached --name-only 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || echo "")"

if [[ -z "$STAGED_FILES" ]]; then
  echo "gate: nothing staged"
  exit 0
fi

# Classify change scope
HAS_DOCS=false
HAS_UI=false
HAS_API=false
HAS_SCHEMA=false
HAS_SERVICE=false
HAS_CONFIG=false
FILE_COUNT=0

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  FILE_COUNT=$((FILE_COUNT + 1))

  case "$f" in
    docs/*|*.md|.planning/*|.scratch/*)
      HAS_DOCS=true ;;
    src/components/*|src/app/**/page.tsx|src/app/**/layout.tsx|*.css)
      HAS_UI=true ;;
    src/app/api/*|src/lib/utils/route-handler*)
      HAS_API=true ;;
    src/db/schema/*)
      HAS_SCHEMA=true ;;
    src/lib/services/*|src/lib/automations/*)
      HAS_SERVICE=true ;;
    package.json|tsconfig*|next.config*|drizzle.config*|*.config.ts|*.config.js)
      HAS_CONFIG=true ;;
  esac
done <<< "$STAGED_FILES"

# Force full gate for large changesets or config changes
if [[ "$FILE_COUNT" -gt 15 ]] || [[ "$HAS_CONFIG" == "true" ]]; then
  echo "gate: full (${FILE_COUNT} files or config change)"
  pnpm run quality:no-regressions
  exit $?
fi

# Docs-only: skip
if [[ "$HAS_DOCS" == "true" && "$HAS_UI" == "false" && "$HAS_API" == "false" && "$HAS_SCHEMA" == "false" && "$HAS_SERVICE" == "false" ]]; then
  echo "gate: docs-only"
  exit 0
fi

# Schema changes: typecheck + tests + warning
if [[ "$HAS_SCHEMA" == "true" ]]; then
  echo "gate: schema (typecheck + tests)"
  run_quiet "typecheck" pnpm run typecheck
  run_quiet "tests" pnpm test
  echo "WARNING: schema changed — run db:generate before push"
  exit 0
fi

# API routes or services: typecheck + tests
if [[ "$HAS_API" == "true" || "$HAS_SERVICE" == "true" ]]; then
  echo "gate: logic (typecheck + tests)"
  run_quiet "typecheck" pnpm run typecheck
  run_quiet "tests" pnpm test
  exit 0
fi

# UI-only: typecheck only
if [[ "$HAS_UI" == "true" ]]; then
  echo "gate: ui (typecheck)"
  run_quiet "typecheck" pnpm run typecheck
  exit 0
fi

# Fallback: typecheck
echo "gate: default (typecheck)"
run_quiet "typecheck" pnpm run typecheck
