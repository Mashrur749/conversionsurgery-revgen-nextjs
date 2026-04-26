#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "==> Running MS doc structure checks"
./scripts/specs/check-ms-line-limits.sh
./scripts/specs/check-ms-gap-map.sh
./scripts/specs/check-ms-spec-structure.sh
./scripts/specs/check-no-legacy-spec-refs.sh

echo "==> Running typecheck"
pnpm run typecheck

if [ "${1:-}" = "--with-build" ]; then
  echo "==> Running build"
  pnpm run build
fi

if [ "${2:-}" = "--with-tests" ]; then
  echo "==> Running tests"
  pnpm run test
fi

echo "OK: quality gate passed"
