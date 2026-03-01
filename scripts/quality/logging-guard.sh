#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT_DIR"

violations=0

check() {
  local label="$1"
  local pattern="$2"
  local scope="$3"
  local matches
  matches="$(grep -rn -E "$pattern" $scope || true)"
  if [[ -n "$matches" ]]; then
    echo "Logging guard violation: ${label}"
    echo "$matches"
    echo
    violations=1
  fi
}

check \
  "Raw error.message returned to API clients" \
  "NextResponse\\.json\\(\\{[^\\n]*error:\\s*(error|err)\\.message" \
  "src/app/api"

check \
  "Raw error.stack returned to API clients" \
  "NextResponse\\.json\\(\\{[^\\n]*(error|details):\\s*(error|err)\\.stack" \
  "src/app/api"

check \
  "Direct stack exposure in generic JSON response" \
  "NextResponse\\.json\\(\\{[^\\n]*stack:" \
  "src/app/api"

check \
  "Raw error object logged in Twilio webhook routes" \
  "console\\.error\\([^\\n]*(error|err)\\b" \
  "src/app/api/webhooks/twilio"

check \
  "Raw error object logged in Twilio service client" \
  "console\\.error\\([^\\n]*(error|err)\\b" \
  "src/lib/services/twilio.ts"

check \
  "Verbose raw payload logged in Twilio webhooks" \
  "console\\.log\\([^\\n]*payload" \
  "src/app/api/webhooks/twilio"

if [[ "$violations" -ne 0 ]]; then
  echo "logging-guard failed."
  exit 1
fi

echo "logging-guard passed."
