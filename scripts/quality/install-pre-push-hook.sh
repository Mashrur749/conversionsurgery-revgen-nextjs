#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK_PATH="${ROOT_DIR}/.git/hooks/pre-push"
BACKUP_PATH="${ROOT_DIR}/.git/hooks/pre-push.user"
MARKER="# conversionsurgery-no-regressions-hook"

if [[ ! -d "${ROOT_DIR}/.git/hooks" ]]; then
  echo "Git hooks directory not found. Run this from a git checkout."
  exit 1
fi

if [[ -f "${HOOK_PATH}" ]] && ! grep -q "${MARKER}" "${HOOK_PATH}"; then
  cp "${HOOK_PATH}" "${BACKUP_PATH}"
  chmod +x "${BACKUP_PATH}"
  echo "Backed up existing pre-push hook to ${BACKUP_PATH}"
fi

cat >"${HOOK_PATH}" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

# conversionsurgery-no-regressions-hook
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -x "${HOOK_DIR}/pre-push.user" ]]; then
  "${HOOK_DIR}/pre-push.user" "$@"
fi

echo "[pre-push] Running no-regressions gate..."
npm run quality:no-regressions
HOOK

chmod +x "${HOOK_PATH}"
echo "Installed pre-push hook at ${HOOK_PATH}"
