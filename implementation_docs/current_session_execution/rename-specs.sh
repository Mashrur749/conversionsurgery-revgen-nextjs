#!/bin/bash

# Rename specs with execution order prefix
# Usage: ./rename-specs.sh [directory]
# Default directory: current directory

DIR="${1:-.}"

echo "Renaming spec files in: $DIR"
echo ""

# Execution order based on BUILD-ORDER.md
rename_file() {
  local old="$1"
  local new="$2"
  if [ -f "$DIR/$old" ]; then
    echo "  $old -> $new"
    FOUND_FILES+=("$old|$new")
  else
    echo "  $old -> (FILE NOT FOUND)"
  fi
}

FOUND_FILES=()

echo "=== Preview ==="
rename_file "01-setup-database.md" "00E-setup-database.md"
rename_file "00-feature-flags.md" "01E-feature-flags.md"
rename_file "43-tcpa-compliance.md" "02E-tcpa-compliance.md"
rename_file "41-billing-schema.md" "03E-billing-schema.md"
rename_file "42-billing-ui.md" "04E-billing-ui.md"
rename_file "36-conversation-agent-schema.md" "05E-conversation-agent-schema.md"
rename_file "37-conversation-agent-core.md" "06E-conversation-agent-core.md"
rename_file "38-escalation-management.md" "07E-escalation-management.md"
rename_file "39-analytics-schema.md" "08E-analytics-schema.md"
rename_file "40-analytics-dashboard-ui.md" "09E-analytics-dashboard-ui.md"

echo ""
read -p "Proceed with rename? (y/N): " confirm

if [[ "$confirm" =~ ^[Yy]$ ]]; then
  echo ""
  echo "=== Renaming ==="
  for item in "${FOUND_FILES[@]}"; do
    old="${item%|*}"
    new="${item#*|}"
    mv "$DIR/$old" "$DIR/$new"
    echo "  ✓ $old -> $new"
  done
  echo ""
  echo "Done!"
else
  echo "Cancelled."
fi