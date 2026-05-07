#!/usr/bin/env bash
set -euo pipefail

# Build-time env defaults — Next.js page-data collection evaluates server
# modules (which call getDb()), so DATABASE_URL must exist even though no
# real DB connection happens at build. Real env values from .env.local
# take precedence via the :- fallback pattern.
export DATABASE_URL="${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}"
export AUTH_SECRET="${AUTH_SECRET:-ci-build-secret}"
export CLIENT_SESSION_SECRET="${CLIENT_SESSION_SECRET:-ci-client-session-secret}"
export CRON_SECRET="${CRON_SECRET:-ci-cron-secret}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_ci_placeholder}"
export STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_ci_placeholder}"
export RESEND_API_KEY="${RESEND_API_KEY:-re_ci_placeholder}"
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-ci-anthropic-key}"
export TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-AC00000000000000000000000000000000}"
export TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-ci-twilio-token}"

echo "==> 1/6 MS structural + type gate"
pnpm run ms:gate

echo "==> 2/6 Logging guard"
pnpm run quality:logging-guard

echo "==> 3/6 Twilio bypass guard"
pnpm run quality:twilio-guard

echo "==> 4/6 Production build"
# Defensive unset: some environments leave NODE_OPTIONS from prior node workers.
unset NODE_OPTIONS || true
pnpm run build

echo "==> 5/6 Test suite"
pnpm test

if [[ "${SKIP_RUNTIME_SMOKE:-0}" == "1" ]]; then
  echo "==> 6/6 Runtime smoke (skipped via SKIP_RUNTIME_SMOKE=1)"
else
  echo "==> 6/6 Runtime smoke"
  pnpm run quality:runtime-smoke
fi

echo "No-regressions gate passed."
