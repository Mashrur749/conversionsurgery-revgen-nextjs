#!/usr/bin/env bash
# Twilio bypass guard — fails CI if any unauthorized direct Twilio access lands
# in `src/`. Authorized files are explicitly whitelisted below.
#
# Two checks:
#   1. `import twilio from 'twilio'` (and the double-quoted variant) outside
#      the whitelist.
#   2. `<...>.messages.create` outside `services/twilio.ts` and the
#      Anthropic provider (which has unrelated `messages.create`).
#
# Wave A Hardening Phase 0 Task 9. See `.planning/phases/wave-A-hardening/PLAN.md`.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

# ---------------------------------------------------------------------------
# Whitelists
# ---------------------------------------------------------------------------

# Files allowed to `import twilio from 'twilio'` directly.
TWILIO_IMPORT_ALLOW=(
  "src/lib/services/twilio.ts"
  "src/lib/services/twilio-provisioning.ts"
  "src/lib/services/ring-group.ts"
  "src/app/api/cron/check-missed-calls/route.ts"
)

# `messages.create` is allowed only inside the privileged transport file. The
# Anthropic SDK uses the same method name on a different client and is
# unrelated to SMS — exclude it from the SMS-bypass check.
MESSAGES_CREATE_ALLOW=(
  "src/lib/services/twilio.ts"
  "src/lib/ai/providers/anthropic.ts"
)

# Webhook handlers are wildcarded since signature handlers may import twilio
# for `validateRequest`.
TWILIO_IMPORT_WILDCARD_PREFIXES=(
  "src/app/api/webhooks/twilio/"
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

is_in_list() {
  local needle="$1"
  shift
  for entry in "$@"; do
    if [[ "$needle" == "$entry" ]]; then
      return 0
    fi
  done
  return 1
}

is_in_wildcard_prefix() {
  local needle="$1"
  for prefix in "${TWILIO_IMPORT_WILDCARD_PREFIXES[@]}"; do
    if [[ "$needle" == "$prefix"* ]]; then
      return 0
    fi
  done
  return 1
}

# ---------------------------------------------------------------------------
# Check 1 — twilio import
# ---------------------------------------------------------------------------

violations=0

import_matches=$(grep -rn -E "import twilio from ['\"]twilio['\"]" src/ 2>/dev/null || true)

if [[ -n "$import_matches" ]]; then
  while IFS=: read -r file line _; do
    [[ -z "$file" ]] && continue
    if is_in_list "$file" "${TWILIO_IMPORT_ALLOW[@]}"; then
      continue
    fi
    if is_in_wildcard_prefix "$file"; then
      continue
    fi
    if [[ $violations -eq 0 ]]; then
      echo "[twilio-bypass-guard] Unauthorized 'import twilio from \"twilio\"' detected:" >&2
    fi
    violations=$((violations + 1))
    echo "  $violations) $file:$line" >&2
  done <<<"$import_matches"
fi

# ---------------------------------------------------------------------------
# Check 2 — messages.create
# ---------------------------------------------------------------------------

create_matches=$(grep -rn -E "\.messages\.create\(" src/ 2>/dev/null || true)
create_violations=0

if [[ -n "$create_matches" ]]; then
  while IFS=: read -r file line _; do
    [[ -z "$file" ]] && continue
    if is_in_list "$file" "${MESSAGES_CREATE_ALLOW[@]}"; then
      continue
    fi
    if [[ $create_violations -eq 0 ]]; then
      echo "[twilio-bypass-guard] Unauthorized '.messages.create(' detected (use sendCompliantMessage / sendInternalSMS):" >&2
    fi
    create_violations=$((create_violations + 1))
    echo "  $create_violations) $file:$line" >&2
  done <<<"$create_matches"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

total=$((violations + create_violations))

if [[ $total -gt 0 ]]; then
  echo "" >&2
  echo "[twilio-bypass-guard] FAIL — $total unauthorized site(s)." >&2
  echo "  Use sendCompliantMessage() (lead-facing) or sendInternalSMS() (operator)" >&2
  echo "  from @/lib/compliance/compliance-gateway. See .planning/phases/wave-A-hardening/PLAN.md." >&2
  exit 1
fi

echo "[twilio-bypass-guard] OK — no unauthorized Twilio bypasses detected."
exit 0
