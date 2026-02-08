#!/bin/bash

# Claude Code Runner with Live Output
# Uses 'script' to show output in real-time

SPECS_DIR="${SPECS_DIR:-./implementation_docs}"
PROGRESS_FILE=".claude-progress"
LOG_DIR=".claude-logs"
QA_FILE="QA-CHECKLIST.md"

mkdir -p "$LOG_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get current spec
if [ -f "$PROGRESS_FILE" ]; then
  current=$(cat "$PROGRESS_FILE")
else
  current=1
  echo $current > "$PROGRESS_FILE"
fi

total=$(ls "$SPECS_DIR"/*.md 2>/dev/null | wc -l | tr -d ' ')

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║         Claude Code Runner - Live Output                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Specs: $total | Starting from: $current"
echo ""

while [ "$current" -le "$total" ]; do
  padded=$(printf "%02d" $current)
  spec_file=$(ls "$SPECS_DIR"/${padded}-*.md 2>/dev/null | head -1)
  
  if [ -z "$spec_file" ]; then
    echo -e "${YELLOW}Spec $current not found, skipping${NC}"
    current=$((current + 1))
    echo $current > "$PROGRESS_FILE"
    continue
  fi
  
  spec_name=$(basename "$spec_file" .md)
  log_file="$LOG_DIR/${spec_name}-$(date +%Y%m%d-%H%M%S).log"
  
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}[$current/$total] $spec_name${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "Log: $log_file"
  echo "Started: $(date)"
  echo ""
  
  # Create prompt
  prompt="Implement this spec completely: $spec_file

1. First read it: cat $spec_file
2. Implement ALL steps in order  
3. Commit after each step: git add -A && git commit -m 'feat($spec_name): description'
4. When done, append to $QA_FILE:

## $spec_name
### Manual Test Steps
- Specific URLs to visit
- Actions to take  
- Expected results
### Database Checks
- SQL queries to verify
### Edge Cases  
- Error scenarios

Begin now."

  # Run with script command for live output (macOS syntax)
  script -q "$log_file" claude --dangerously-skip-permissions -p "$prompt"
  exit_code=$?
  
  echo ""
  
  # Check for rate limit in log
  if grep -qi "rate limit\|usage limit\|try again later\|too many requests" "$log_file" 2>/dev/null; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}⏳ RATE LIMITED - Waiting 1 hour${NC}"
    echo -e "${YELLOW}Resume at: $(date -v+1H '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    sleep 3600
    echo -e "${GREEN}Resuming...${NC}"
    continue  # Retry same spec
  fi
  
  # Check for other errors
  if [ $exit_code -ne 0 ]; then
    echo -e "${RED}Exit code: $exit_code${NC}"
    
    # Check if it's a connection/timeout error
    if grep -qi "timeout\|connection\|network" "$log_file" 2>/dev/null; then
      echo -e "${YELLOW}Network issue. Waiting 5 minutes then retrying...${NC}"
      sleep 300
      continue
    fi
    
    echo -e "${YELLOW}Check log for details. Continuing to next spec...${NC}"
  else
    echo -e "${GREEN}✓ Completed: $spec_name${NC}"
  fi
  
  # Update progress
  current=$((current + 1))
  echo $current > "$PROGRESS_FILE"
  
  echo ""
  sleep 5
done

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 ALL SPECS COMPLETE!                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "QA Checklist: $QA_FILE"
echo "Logs: $LOG_DIR/"
