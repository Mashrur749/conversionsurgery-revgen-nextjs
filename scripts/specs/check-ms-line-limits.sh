#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

failed=0
for f in docs/specs/MS-[0-9][0-9]-*.md; do
  [ -e "$f" ] || continue
  lines=$(wc -l < "$f" | tr -d ' ')
  if [ "$lines" -gt 300 ]; then
    echo "FAIL: $f has $lines lines (max 300)"
    failed=1
  fi
done

if [ "$failed" -eq 1 ]; then
  exit 1
fi

echo "OK: all MS spec docs are <= 300 lines"
