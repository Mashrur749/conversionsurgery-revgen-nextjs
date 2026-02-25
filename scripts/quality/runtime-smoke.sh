#!/usr/bin/env bash
set -euo pipefail

PORT="${SMOKE_PORT:-4100}"
BASE_URL="http://127.0.0.1:${PORT}"
LOG_FILE="${TMPDIR:-/tmp}/cs-runtime-smoke-${PORT}.log"
STARTUP_TIMEOUT_SECONDS="${SMOKE_STARTUP_TIMEOUT_SECONDS:-90}"
HEALTHCHECK_PATH="${SMOKE_HEALTHCHECK_PATH:-/login}"
SMOKE_PROFILE="${SMOKE_PROFILE:-base}"

export DATABASE_URL="${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}"
export NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-ci-build-secret}"
export NEXTAUTH_URL="${NEXTAUTH_URL:-$BASE_URL}"
export AUTH_SECRET="${AUTH_SECRET:-${NEXTAUTH_SECRET}}"
export CLIENT_SESSION_SECRET="${CLIENT_SESSION_SECRET:-smoke-client-session-secret}"
export CRON_SECRET="${CRON_SECRET:-smoke-cron-secret}"
export STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_smoke_placeholder}"
export OPENAI_API_KEY="${OPENAI_API_KEY:-smoke-openai-key}"
export TWILIO_ACCOUNT_SID="${TWILIO_ACCOUNT_SID:-AC00000000000000000000000000000000}"
export TWILIO_AUTH_TOKEN="${TWILIO_AUTH_TOKEN:-smoke-twilio-token}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-$BASE_URL}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

print_server_log() {
  echo "---- server log (tail) ----"
  tail -n 160 "${LOG_FILE}" || cat "${LOG_FILE}"
}

curl_status() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local status

  if [[ "${method}" == "GET" ]]; then
    status="$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" "${BASE_URL}${path}")"
  else
    status="$(curl -sS --max-time 10 -o /dev/null -w "%{http_code}" -X "${method}" \
      -H "Content-Type: application/json" \
      -d "${body}" \
      "${BASE_URL}${path}")"
  fi

  echo "${status}"
}

echo "==> Starting production server on ${BASE_URL}"
npm run start -- --port "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 "${STARTUP_TIMEOUT_SECONDS}"); do
  if ! kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    echo "Runtime smoke failed: server process exited before ready."
    print_server_log
    exit 1
  fi

  if curl -sS --max-time 5 -o /dev/null "${BASE_URL}${HEALTHCHECK_PATH}"; then
    break
  fi
  sleep 1
done

if ! curl -sS --max-time 5 -o /dev/null "${BASE_URL}${HEALTHCHECK_PATH}"; then
  echo "Runtime smoke failed: server did not become ready within ${STARTUP_TIMEOUT_SECONDS}s."
  print_server_log
  exit 1
fi

check_get() {
  local path="$1"
  local expected="$2"
  local status
  status="$(curl_status "GET" "${path}")"
  if [[ "${status}" != "${expected}" ]]; then
    echo "GET ${path} expected ${expected}, got ${status}"
    print_server_log
    exit 1
  fi
  echo "OK GET ${path} -> ${status}"
}

check_get_any() {
  local path="$1"
  local expected_csv="$2"
  local status
  status="$(curl_status "GET" "${path}")"

  IFS=',' read -r -a expected_values <<< "${expected_csv}"
  for candidate in "${expected_values[@]}"; do
    local trimmed
    trimmed="$(echo "${candidate}" | xargs)"
    if [[ "${status}" == "${trimmed}" ]]; then
      echo "OK GET ${path} -> ${status} (accepted: ${expected_csv})"
      return 0
    fi
  done

  echo "GET ${path} expected one of [${expected_csv}], got ${status}"
  print_server_log
  exit 1
}

check_post_json() {
  local path="$1"
  local json="$2"
  local expected="$3"
  local status
  status="$(curl_status "POST" "${path}" "${json}")"
  if [[ "${status}" != "${expected}" ]]; then
    echo "POST ${path} expected ${expected}, got ${status}"
    print_server_log
    exit 1
  fi
  echo "OK POST ${path} -> ${status}"
}

echo "==> Running runtime smoke checks"
check_get "/login" "200"
check_get "/signup" "200"
check_get "/client-login" "200"
check_post_json "/api/cron" "{}" "401"
check_get "/api/public/onboarding/status" "400"
check_post_json "/api/public/signup" "{}" "400"
check_post_json "/api/public/onboarding/request-setup" "{}" "400"

if [[ "${SMOKE_PROFILE}" == "full" ]]; then
  echo "==> Running extended auth and route guardrail checks"
  check_get_any "/admin" "302,303,307"
  check_get_any "/dashboard" "302,303,307"
  check_get_any "/client" "302,303,307"
  check_get_any "/api/admin/clients" "401,403"
  check_get_any "/api/client/revenue" "401,403"
fi

echo "Runtime smoke passed."
