#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f docs/10-OFFER-PARITY-GAPS.md ]; then
  echo "FAIL: docs/10-OFFER-PARITY-GAPS.md not found"
  exit 1
fi

missing=0
for f in docs/specs/MS-[0-9][0-9]-*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  if ! rg -q "$base" docs/10-OFFER-PARITY-GAPS.md; then
    echo "FAIL: $base not mapped in docs/10-OFFER-PARITY-GAPS.md"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  exit 1
fi

echo "OK: all MS specs are mapped in gap register"
