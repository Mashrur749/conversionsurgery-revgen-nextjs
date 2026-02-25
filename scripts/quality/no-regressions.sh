#!/usr/bin/env bash
set -euo pipefail

echo "==> 1/4 MS structural + type gate"
npm run ms:gate

echo "==> 2/5 Logging guard"
npm run quality:logging-guard

echo "==> 3/5 Production build"
# Defensive unset: some environments leave NODE_OPTIONS from prior node workers.
unset NODE_OPTIONS || true
npm run build

echo "==> 4/5 Test suite"
npm test

if [[ "${SKIP_RUNTIME_SMOKE:-0}" == "1" ]]; then
  echo "==> 5/5 Runtime smoke (skipped via SKIP_RUNTIME_SMOKE=1)"
else
  echo "==> 5/5 Runtime smoke"
  npm run quality:runtime-smoke
fi

echo "No-regressions gate passed."
