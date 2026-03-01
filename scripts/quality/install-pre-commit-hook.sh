#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT_DIR}"

if [[ ! -d "${ROOT_DIR}/.git" ]]; then
  echo "Git directory not found. Run this from a git checkout."
  exit 1
fi

git config --local core.hooksPath .husky

if [[ ! -f "${ROOT_DIR}/.husky/pre-commit" ]]; then
  echo "Missing .husky/pre-commit hook file."
  exit 1
fi

if [[ "$(git config --get core.hooksPath || true)" != ".husky" ]]; then
  echo "Failed to activate Husky hooksPath (.husky)."
  exit 1
fi

chmod +x "${ROOT_DIR}/.husky/pre-commit"
echo "Installed Husky pre-commit hook (.husky/pre-commit)."
