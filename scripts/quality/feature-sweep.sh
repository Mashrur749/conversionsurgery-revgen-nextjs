#!/usr/bin/env bash
set -euo pipefail

echo "==> 1/4 MS structural + type gate"
pnpm run ms:gate

echo "==> 2/5 Logging guard"
pnpm run quality:logging-guard

echo "==> 3/5 Production build"
pnpm run build

echo "==> 4/5 Full test suite"
pnpm test

echo "==> 5/5 Full runtime smoke profile"
SMOKE_PROFILE=full pnpm run quality:runtime-smoke

echo "Feature sweep passed."
