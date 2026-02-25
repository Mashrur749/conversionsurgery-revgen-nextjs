#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HOOK_PATH="${ROOT_DIR}/.git/hooks/pre-commit"
BACKUP_PATH="${ROOT_DIR}/.git/hooks/pre-commit.user"
MARKER="# conversionsurgery-ms-gate-hook"

if [[ ! -d "${ROOT_DIR}/.git/hooks" ]]; then
  echo "Git hooks directory not found. Run this from a git checkout."
  exit 1
fi

if [[ -f "${HOOK_PATH}" ]] && ! grep -q "${MARKER}" "${HOOK_PATH}"; then
  cp "${HOOK_PATH}" "${BACKUP_PATH}"
  chmod +x "${BACKUP_PATH}"
  echo "Backed up existing pre-commit hook to ${BACKUP_PATH}"
fi

cat >"${HOOK_PATH}" <<'HOOK'
#!/usr/bin/env bash
set -euo pipefail

# conversionsurgery-ms-gate-hook
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -x "${HOOK_DIR}/pre-commit.user" ]]; then
  "${HOOK_DIR}/pre-commit.user" "$@"
fi

echo "[pre-commit] Running ms:gate..."
npm run ms:gate
echo "[pre-commit] Running logging guard..."
npm run quality:logging-guard
HOOK

chmod +x "${HOOK_PATH}"
echo "Installed pre-commit hook at ${HOOK_PATH}"
