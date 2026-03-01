#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT_DIR}"

ZERO_SHA="0000000000000000000000000000000000000000"
DOCMOST_PATH_REGEX='^(docs/|docmost\.sync\.config\.json|scripts/docmost-sync/)'

has_docs_changes=0
saw_refs=0

check_changed_files() {
  local files="$1"
  if [[ -n "${files}" ]] && printf "%s\n" "${files}" | grep -Eq "${DOCMOST_PATH_REGEX}"; then
    return 0
  fi
  return 1
}

while read -r local_ref local_sha remote_ref remote_sha; do
  if [[ -z "${local_ref:-}" ]]; then
    continue
  fi
  saw_refs=1

  # Skip deleted refs.
  if [[ "${local_sha}" == "${ZERO_SHA}" ]]; then
    continue
  fi

  if [[ "${remote_sha}" == "${ZERO_SHA}" ]]; then
    # New remote branch/tag: compare against origin/main merge-base when available.
    if git show-ref --verify --quiet "refs/remotes/origin/main"; then
      base_sha="$(git merge-base "${local_sha}" "refs/remotes/origin/main" || true)"
      if [[ -z "${base_sha}" ]]; then
        has_docs_changes=1
        break
      fi
      changed="$(git diff --name-only "${base_sha}" "${local_sha}" || true)"
      if check_changed_files "${changed}"; then
        has_docs_changes=1
        break
      fi
    else
      # No baseline available; run sync for safety.
      has_docs_changes=1
      break
    fi
    continue
  fi

  changed="$(git diff --name-only "${remote_sha}" "${local_sha}" || true)"
  if check_changed_files "${changed}"; then
    has_docs_changes=1
    break
  fi
done

# Fallback for clients that don't pass refs to pre-push.
if [[ "${saw_refs}" -eq 0 ]]; then
  if git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' >/dev/null 2>&1; then
    changed="$(git diff --name-only '@{upstream}...HEAD' || true)"
    if check_changed_files "${changed}"; then
      has_docs_changes=1
    fi
  else
    has_docs_changes=1
  fi
fi

if [[ "${has_docs_changes}" -eq 0 ]]; then
  echo "[pre-push] No docs changes detected. Skipping Docmost sync."
  exit 0
fi

echo "[pre-push] Docs changes detected. Running Docmost sync..."
npm run docmost:sync:local
