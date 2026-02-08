#!/bin/bash

# ============================================
# Claude Code Spec Runner - Simple Version
# ============================================

set -e

PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
SPECS_DIR="${SPECS_DIR:-$PROJECT_DIR/implementation_docs}"
PROGRESS_FILE="$PROJECT_DIR/.claude-progress.json"
LOG_DIR="$PROJECT_DIR/.claude-logs"
QA_FILE="$PROJECT_DIR/QA-CHECKLIST.md"

mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Initialize progress
if [ ! -f "$PROGRESS_FILE" ]; then
  echo '{"current_spec": 1, "completed": [], "failed": []}' > "$PROGRESS_FILE"
fi

get_current() {
  cat "$PROGRESS_FILE" | grep -o '"current_spec": [0-9]*' | grep -o '[0-9]*'
}

mark_done() {
  local num=$1
  local name=$2
  local tmp=$(mktemp)
  cat "$PROGRESS_FILE" | sed "s/\"current_spec\": $num/\"current_spec\": $((num + 1))/" > "$tmp"
  mv "$tmp" "$PROGRESS_FILE"
  echo -e "${GREEN}✓ Completed: $name${NC}"
}

# Get spec file by number
get_spec() {
  local num=$1
  local padded=$(printf "%02d" $num)
  ls "$SPECS_DIR"/${padded}-*.md 2>/dev/null | head -1
}

# Count specs
total=$(ls "$SPECS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           Claude Code Spec Runner                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Specs: $total | Directory: $SPECS_DIR"
echo ""

current=$(get_current)

while [ "$current" -le "$total" ]; do
  spec_file=$(get_spec "$current")
  
  if [ -z "$spec_file" ]; then
    echo -e "${YELLOW}Spec $current not found, skipping${NC}"
    current=$((current + 1))
    continue
  fi
  
  spec_name=$(basename "$spec_file" .md)
  log_file="$LOG_DIR/${spec_name}-$(date +%Y%m%d-%H%M%S).log"
  prompt_file=$(mktemp)
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}[$current/$total] Implementing: $spec_name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "Log: $log_file"
  echo "Started: $(date)"
  echo ""
  
  # Write prompt to temp file to avoid shell escaping issues
  cat > "$prompt_file" << PROMPT
Implement this specification completely: $spec_file

Instructions:
1. Read the spec file first with: cat $spec_file
2. Implement ALL steps in the exact order shown
3. After each major step, commit: git add -A && git commit -m "feat($spec_name): description"
4. If you hit errors, try to fix them. If stuck, note in ISSUES.md and continue.

When FINISHED, append a QA section to $QA_FILE with this format:

## $spec_name

### Manual Test Steps
- Step-by-step instructions to verify each feature works
- Include URLs to visit, buttons to click, expected results

### Database Checks  
- SQL queries to verify data

### Edge Cases
- Error scenarios to test

Begin now by reading the spec file.
PROMPT

  # Run Claude Code
  if claude --dangerously-skip-permissions -p "$(cat "$prompt_file")" 2>&1 | tee "$log_file"; then
    mark_done "$current" "$spec_name"
  else
    exit_code=$?
    
    # Check for rate limit
    if grep -qi "rate limit\|usage limit\|try again" "$log_file"; then
      echo -e "${YELLOW}Rate limited. Waiting 1 hour...${NC}"
      echo "Resume at: $(date -v+1H '+%Y-%m-%d %H:%M:%S')"
      sleep 3600
      continue  # Retry same spec
    else
      echo -e "${RED}Failed with exit code: $exit_code${NC}"
      echo -e "${YELLOW}Check log: $log_file${NC}"
      read -p "Continue to next spec? (y/n) " -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
      fi
    fi
  fi
  
  rm -f "$prompt_file"
  current=$(get_current)
  sleep 5
done

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    ALL DONE!                              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "QA Checklist: $QA_FILE"
