#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"

usage() {
  cat <<'USAGE'
Deterministic replay helper for critical cron pipelines.

Usage:
  ./scripts/ops/replay.sh <job>

Jobs:
  process-scheduled
  process-queued-compliance
  monthly-reset
  biweekly-reports
  report-delivery-retries
  guarantee-check
  onboarding-sla-check
  estimate-fallback-nudges
  knowledge-gap-alerts
  quarterly-campaign-planner
  quarterly-campaign-alerts
  voice-usage-rollup
  access-review
  all-core

Required env:
  CRON_SECRET=<value>

Optional env:
  BASE_URL=http://localhost:3000
USAGE
}

if [[ "${1:-}" == "" ]]; then
  usage
  exit 1
fi

if [[ -z "$CRON_SECRET" ]]; then
  echo "ERROR: CRON_SECRET is required."
  exit 1
fi

JOB="$1"

call_endpoint() {
  local path="$1"
  echo "==> Replaying: $path"

  local response
  response="$(curl -sS -w $'\n%{http_code}' \
    "$BASE_URL$path" \
    -H "Authorization: Bearer $CRON_SECRET")"

  local status
  status="$(echo "$response" | tail -n1)"
  local body
  body="$(echo "$response" | sed '$d')"

  if [[ "$status" -lt 200 || "$status" -ge 300 ]]; then
    echo "FAILED ($status): $path"
    echo "$body"
    exit 1
  fi

  echo "OK ($status): $path"
  echo "$body"
  echo
}

run_core_sequence() {
  call_endpoint "/api/cron/process-scheduled"
  call_endpoint "/api/cron/process-queued-compliance"
  call_endpoint "/api/cron/report-delivery-retries"
  call_endpoint "/api/cron/guarantee-check"
}

case "$JOB" in
  process-scheduled)
    call_endpoint "/api/cron/process-scheduled"
    ;;
  process-queued-compliance)
    call_endpoint "/api/cron/process-queued-compliance"
    ;;
  monthly-reset)
    call_endpoint "/api/cron/monthly-reset"
    ;;
  biweekly-reports)
    call_endpoint "/api/cron/biweekly-reports"
    ;;
  report-delivery-retries)
    call_endpoint "/api/cron/report-delivery-retries"
    ;;
  guarantee-check)
    call_endpoint "/api/cron/guarantee-check"
    ;;
  onboarding-sla-check)
    call_endpoint "/api/cron/onboarding-sla-check"
    ;;
  estimate-fallback-nudges)
    call_endpoint "/api/cron/estimate-fallback-nudges"
    ;;
  knowledge-gap-alerts)
    call_endpoint "/api/cron/knowledge-gap-alerts"
    ;;
  quarterly-campaign-planner)
    call_endpoint "/api/cron/quarterly-campaign-planner"
    ;;
  quarterly-campaign-alerts)
    call_endpoint "/api/cron/quarterly-campaign-alerts"
    ;;
  voice-usage-rollup)
    call_endpoint "/api/cron/voice-usage-rollup"
    ;;
  access-review)
    call_endpoint "/api/cron/access-review"
    ;;
  all-core)
    run_core_sequence
    ;;
  *)
    echo "ERROR: Unknown job '$JOB'."
    usage
    exit 1
    ;;
esac
