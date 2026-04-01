#!/usr/bin/env bash
set -euo pipefail

# Seeds a fully-configured test client via the admin API.
# Saves ~30 min of manual Steps 1-4 setup.
#
# Usage:
#   ADMIN_COOKIE="<session-cookie>" ./scripts/test/seed-test-client.sh
#
# Prerequisites:
#   - App running on localhost:3000
#   - Logged in as admin (copy cookie from browser DevTools)
#   - TWILIO numbers configured per preflight

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_COOKIE="${ADMIN_COOKIE:-}"

if [[ -z "$ADMIN_COOKIE" ]]; then
  echo "ERROR: ADMIN_COOKIE is required."
  echo "Copy your session cookie from browser DevTools (Application > Cookies > next-auth.session-token)"
  exit 1
fi

echo "==> Creating test client..."

RESPONSE=$(curl -sS -w '\n%{http_code}' \
  "$BASE_URL/api/admin/clients" \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=$ADMIN_COOKIE" \
  -d '{
    "businessName": "Test Reno Co",
    "ownerName": "Test Owner",
    "email": "test-owner-'"$(date +%s)"'@test.com",
    "phone": "+15551000001",
    "timezone": "America/Toronto",
    "googleBusinessUrl": "https://g.page/test-business/review"
  }')

STATUS=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [[ "$STATUS" -lt 200 || "$STATUS" -ge 300 ]]; then
  echo "FAILED ($STATUS): Could not create client"
  echo "$BODY"
  exit 1
fi

CLIENT_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "OK: Client created with ID: $CLIENT_ID"

echo ""
echo "==> Next steps (manual — these are the learning moments):"
echo "   1. Open /admin/clients/$CLIENT_ID"
echo "   2. Assign Business Line phone number (#1)"
echo "   3. Configure knowledge base (/admin/clients/$CLIENT_ID/knowledge)"
echo "   4. Set business hours in the onboarding wizard"
echo "   5. Add a team member with Team Member number (#4)"
echo "   6. Copy the widget embed code from the Website Widget card"
echo ""
echo "CLIENT_ID=$CLIENT_ID"
