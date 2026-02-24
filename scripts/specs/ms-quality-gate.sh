#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

echo "==> Running MS doc structure checks"
./scripts/specs/check-ms-line-limits.sh
./scripts/specs/check-ms-gap-map.sh

echo "==> Running typecheck"
npm run typecheck

if [ "${1:-}" = "--with-build" ]; then
  echo "==> Running build"
  npm run build
fi

if [ "${2:-}" = "--with-tests" ]; then
  echo "==> Running tests"
  npm run test
fi

echo "OK: quality gate passed"
