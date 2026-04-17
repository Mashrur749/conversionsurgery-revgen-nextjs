#!/usr/bin/env bash
set -euo pipefail

# Automated code review using Claude in a fresh context window.
# Runs against the diff between current branch and main (or a specified base).
#
# Usage:
#   npm run quality:code-review            # diff against main
#   npm run quality:code-review -- develop  # diff against develop

BASE="${1:-main}"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

if [[ "${BRANCH}" == "${BASE}" ]]; then
  echo "[code-review] On ${BASE} — nothing to review. Run from a feature branch."
  exit 0
fi

# Check for changes
DIFF="$(git diff "${BASE}"...HEAD)"
if [[ -z "${DIFF}" ]]; then
  echo "[code-review] No diff between ${BRANCH} and ${BASE}. Nothing to review."
  exit 0
fi

STAT="$(git diff --stat "${BASE}"...HEAD)"
COMMITS="$(git log --oneline "${BASE}"..HEAD)"

if ! command -v claude &>/dev/null; then
  echo "[code-review] Claude CLI not found. Install: https://docs.anthropic.com/en/docs/claude-code"
  exit 1
fi

echo "[code-review] Reviewing ${BRANCH} against ${BASE}..."
echo "[code-review] $(echo "${COMMITS}" | wc -l | tr -d ' ') commits, $(echo "${STAT}" | tail -1)"

PROMPT='Review this git diff for a Next.js/TypeScript project (React 19, Drizzle ORM, shadcn/ui).

Check for:
1. Bugs & logic errors — wrong conditions, off-by-one, null derefs, race conditions, missing await
2. Security — injection, auth bypasses, leaked secrets, missing validation at system boundaries
3. Overcomplicated code — abstractions that serve one call site, unnecessary indirection, 200 lines that could be 50
4. Dead code & orphans — unused imports, unreachable branches, variables written but never read
5. Style drift — inconsistency with surrounding code patterns (not your preferred style, the existing style)

For each issue found, output:
- File and line range
- Severity: bug | security | simplify | dead-code | style
- One-line description
- Suggested fix (code snippet if helpful)

If the diff is clean, say so in one line. Do not pad with praise or summaries.'

echo "${DIFF}" | claude -p "${PROMPT}"

echo ""
echo "[code-review] Done."
