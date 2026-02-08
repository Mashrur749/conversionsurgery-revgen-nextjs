#!/bin/bash

# Ultra-simple Claude Code runner
SPECS_DIR="${SPECS_DIR:-./implementation_docs}"
PROGRESS_FILE=".claude-progress"
QA_FILE="QA-CHECKLIST.md"

# Get current spec number
if [ -f "$PROGRESS_FILE" ]; then
  current=$(cat "$PROGRESS_FILE")
else
  current=1
fi

total=$(ls "$SPECS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

echo "Starting from spec $current of $total"
echo ""

while [ "$current" -le "$total" ]; do
  padded=$(printf "%02d" $current)
  spec_file=$(ls "$SPECS_DIR"/${padded}-*.md 2>/dev/null | head -1)
  
  if [ -z "$spec_file" ]; then
    echo "Spec $current not found, skipping"
    current=$((current + 1))
    echo $current > "$PROGRESS_FILE"
    continue
  fi
  
  spec_name=$(basename "$spec_file" .md)
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "[$current/$total] $spec_name"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Started: $(date)"
  echo ""
  
  # Run Claude Code directly - no piping
  claude --dangerously-skip-permissions -p "Implement this spec completely: $spec_file

1. First read it: cat $spec_file
2. Implement ALL steps in order
3. Commit after each step: git add -A && git commit -m 'feat($spec_name): description'
4. When done, append QA steps to $QA_FILE"

  echo ""
  echo "✓ Finished: $spec_name"
  echo ""
  
  # Update progress
  current=$((current + 1))
  echo $current > "$PROGRESS_FILE"
  
  sleep 3
done

echo ""
echo "ALL DONE!"