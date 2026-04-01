#!/usr/bin/env bash
set -euo pipefail

# Fires every cron endpoint in sequence and reports results.
# Replaces ~40 individual curl commands across Steps 10-25.
#
# Usage:
#   CRON_SECRET="<secret>" ./scripts/test/run-all-crons.sh
#
# Options:
#   --verbose    Show response bodies
#   --quick      Skip slow crons (quarterly, monthly)

BASE_URL="${BASE_URL:-http://localhost:3000}"
CRON_SECRET="${CRON_SECRET:-}"
VERBOSE=false
QUICK=false
FAILED=0
PASSED=0

for arg in "$@"; do
  case "$arg" in
    --verbose) VERBOSE=true ;;
    --quick) QUICK=true ;;
  esac
done

if [[ -z "$CRON_SECRET" ]]; then
  echo "ERROR: CRON_SECRET is required."
  exit 1
fi

fire() {
  local label="$1"
  local path="$2"
  local method="${3:-GET}"

  printf "  %-45s" "$label"

  local response
  response="$(curl -sS -w $'\n%{http_code}' \
    -X "$method" \
    "$BASE_URL$path" \
    -H "Authorization: Bearer $CRON_SECRET" 2>&1)" || true

  local status
  status="$(echo "$response" | tail -n1)"
  local body
  body="$(echo "$response" | sed '$d')"

  if [[ "$status" -ge 200 && "$status" -lt 300 ]]; then
    echo "OK ($status)"
    PASSED=$((PASSED + 1))
  else
    echo "FAILED ($status)"
    FAILED=$((FAILED + 1))
  fi

  if [[ "$VERBOSE" == "true" ]]; then
    echo "    $body"
  fi
}

echo "==> Firing all cron endpoints"
echo ""

echo "--- Every 5 minutes ---"
fire "Process scheduled messages"     "/api/cron/process-scheduled"
fire "Check missed calls"             "/api/cron/check-missed-calls"
fire "Escalation re-notification"     "/api/cron/escalation-renotify" "POST"

echo ""
echo "--- Every 30 minutes ---"
fire "Auto review response"           "/api/cron/auto-review-response" "POST"
fire "Calendar sync"                  "/api/cron/calendar-sync"
fire "Report delivery retries"        "/api/cron/report-delivery-retries"

echo ""
echo "--- Hourly ---"
fire "Onboarding SLA check"           "/api/cron/onboarding-sla-check"

echo ""
echo "--- Daily ---"
fire "Main orchestrator"              "/api/cron" "POST"
fire "Win-back"                       "/api/cron/win-back"
fire "No-show recovery"               "/api/cron/no-show-recovery"
fire "Guarantee check"                "/api/cron/guarantee-check"
fire "Stripe reconciliation"          "/api/cron/stripe-reconciliation"
fire "Knowledge gap alerts"           "/api/cron/knowledge-gap-alerts"
fire "Daily summary"                  "/api/cron/daily-summary"
fire "Estimate fallback nudges"       "/api/cron/estimate-fallback-nudges"
fire "Queued compliance replay"       "/api/cron/process-queued-compliance"

if [[ "$QUICK" != "true" ]]; then
  echo ""
  echo "--- Periodic (bi-weekly / monthly / quarterly) ---"
  fire "Bi-weekly reports"            "/api/cron/biweekly-reports"
  fire "Monthly reset"                "/api/cron/monthly-reset"
  fire "Quarterly campaign planner"   "/api/cron/quarterly-campaign-planner"
  fire "Quarterly campaign alerts"    "/api/cron/quarterly-campaign-alerts"
fi

echo ""
echo "==> Results: $PASSED passed, $FAILED failed"

if [[ "$FAILED" -gt 0 ]]; then
  echo "Re-run with --verbose to see failure details."
  exit 1
fi
