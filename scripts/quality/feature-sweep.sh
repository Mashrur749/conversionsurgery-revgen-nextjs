#!/usr/bin/env bash
set -euo pipefail

echo "==> 1/4 MS structural + type gate"
npm run ms:gate

echo "==> 2/5 Logging guard"
npm run quality:logging-guard

echo "==> 3/5 Production build"
npm run build

echo "==> 4/5 Full test suite"
npm test

echo "==> 5/5 Full runtime smoke profile"
SMOKE_PROFILE=full npm run quality:runtime-smoke

echo "Feature sweep passed."
