#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

# Ensure we don't regress to retired SPEC-07..SPEC-21 naming in active docs/tooling.
if rg -n \
  --glob '!scripts/specs/check-no-legacy-spec-refs.sh' \
  "SPEC-(0[7-9]|1[0-9]|2[0-1])" \
  docs .github .claude/skills scripts/specs AGENTS.md \
  >/tmp/ms-legacy-spec-refs.txt 2>/dev/null; then
  echo "FAIL: found legacy SPEC-07..SPEC-21 references. Use MS-01..MS-15 instead."
  cat /tmp/ms-legacy-spec-refs.txt
  rm -f /tmp/ms-legacy-spec-refs.txt
  exit 1
fi

rm -f /tmp/ms-legacy-spec-refs.txt
echo "OK: no legacy SPEC-07..SPEC-21 references found in active docs/scripts"
