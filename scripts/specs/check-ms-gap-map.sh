#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

GAP_FILE="docs/product/02-OFFER-PARITY-GAPS.md"

# Gap register was archived (all gaps resolved). Check archive location as fallback.
if [ ! -f "$GAP_FILE" ]; then
  GAP_FILE="docs/archive/02-OFFER-PARITY-GAPS.md"
fi

if [ ! -f "$GAP_FILE" ]; then
  echo "FAIL: gap register not found at docs/product/ or docs/archive/"
  exit 1
fi

missing=0
for f in docs/specs/MS-[0-9][0-9]-*.md; do
  [ -e "$f" ] || continue
  base=$(basename "$f")
  if ! grep -q "$base" "$GAP_FILE"; then
    echo "FAIL: $base not mapped in $GAP_FILE"
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  exit 1
fi

echo "OK: all MS specs are mapped in gap register"
