#!/usr/bin/env bash
# Cleanup script for Claude Code temporary artifacts
# Run manually: bash .claude/scripts/cleanup.sh
# Or automatically via post-session hook

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

echo "Cleaning up Claude Code artifacts..."

# 1. Clear scratch directory (temporary working files)
if [ -d "$PROJECT_DIR/.scratch" ]; then
  find "$PROJECT_DIR/.scratch" -type f ! -name '.gitkeep' -delete 2>/dev/null || true
  find "$PROJECT_DIR/.scratch" -type d -empty ! -path "$PROJECT_DIR/.scratch" -delete 2>/dev/null || true
  echo "  Cleared .scratch/"
fi

# 2. Remove stale progress/log artifacts if they reappear
rm -f "$PROJECT_DIR/.claude-progress" "$PROJECT_DIR/.claude-progress.json" 2>/dev/null || true
rm -rf "$PROJECT_DIR/.claude-logs" 2>/dev/null || true
rm -rf "$PROJECT_DIR/.claude-refactor" 2>/dev/null || true

# 3. Remove root-level screenshots (gitignored but can accumulate)
find "$PROJECT_DIR" -maxdepth 1 -name "*.png" -delete 2>/dev/null || true

# 4. Remove orphaned .DS_Store files
find "$PROJECT_DIR" -name ".DS_Store" -delete 2>/dev/null || true

# 5. Check for untracked markdown files at root that might be stale
UNTRACKED_MD=$(git -C "$PROJECT_DIR" ls-files --others --exclude-standard -- "*.md" 2>/dev/null | grep -v "^docs/" | grep -v "^src/" || true)
if [ -n "$UNTRACKED_MD" ]; then
  echo ""
  echo "  Untracked .md files at root (review and delete if stale):"
  echo "$UNTRACKED_MD" | while read -r f; do echo "    $f"; done
fi

echo "Done."
