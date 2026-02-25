#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

"${ROOT_DIR}/scripts/quality/install-pre-commit-hook.sh"
"${ROOT_DIR}/scripts/quality/install-pre-push-hook.sh"

echo "Installed agent quality hooks (pre-commit + pre-push)."
