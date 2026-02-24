#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

required_sections=(
  "## Goal"
  "## Why This Matters"
  "## Current Implementation \(Relevant Existing Features\)"
  "## Target State"
  "## Work Units \(Tiny, Executable\)"
  "Refactor checkpoint"
  "## Immediate Deprecated Cleanup \(Pre-Launch\)"
  "## Testing & Acceptance"
  "## Definition of Done"
)

failed=0
for f in docs/specs/MS-[0-9][0-9]-*.md; do
  [ -e "$f" ] || continue

  for section in "${required_sections[@]}"; do
    if ! rg -q "$section" "$f"; then
      echo "FAIL: $f missing section/pattern: $section"
      failed=1
    fi
  done

done

if [ "$failed" -eq 1 ]; then
  exit 1
fi

echo "OK: all MS specs include required implementation sections"
