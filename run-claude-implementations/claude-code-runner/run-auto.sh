#!/bin/bash

# Claude Code Runner with Auto Rate Limit Handling
SPECS_DIR="${SPECS_DIR:-./implementation_docs/current_session_execution}"
PROGRESS_FILE=".claude-progress"
LOG_DIR=".claude-logs"
QA_FILE="QA-CHECKLIST.md"

mkdir -p "$LOG_DIR"

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
echo "║     Claude Code Runner - Auto Rate Limit Handling         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo "Specs: $total | Starting from: $current"
echo ""

run_spec() {
  local spec_file="$1"
  local spec_name="$2"
  local log_file="$3"
  
  local prompt="Read $spec_file and implement everything step by step. Commit after each step with: git add -A && git commit -m 'feat($spec_name): description'. When done, append QA test steps to $QA_FILE."
  
  # Run using pipe (shows live output)
  echo "$prompt" | claude --dangerously-skip-permissions 2>&1 | tee "$log_file"
  return ${PIPESTATUS[1]}
}

while [ "$current" -le "$total" ]; do
  padded=$(printf "%02d" $current)
  spec_file=$(ls "$SPECS_DIR"/${padded}*.md 2>/dev/null | head -1)
  
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
  echo "Started: $(date)"
  echo ""
  
  # Retry loop for rate limits
  while true; do
    run_spec "$spec_file" "$spec_name" "$log_file"
    exit_code=$?
    
    # Check log for rate limit indicators
    if grep -qi "rate limit\|usage limit\|session limit\|resets\|too many\|try again" "$log_file" 2>/dev/null; then
      # Try to extract reset time from log
      reset_time=$(grep -oE "resets [0-9]+[ap]m" "$log_file" | tail -1 | grep -oE "[0-9]+[ap]m")
      
      if [ -n "$reset_time" ]; then
        echo ""
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${YELLOW}⏳ RATE LIMITED - Resets at $reset_time${NC}"
        echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        
        # Calculate seconds until reset (rough estimate - wait 1 hour to be safe)
        echo "Waiting 1 hour then retrying..."
        sleep 3600
      else
        echo ""
        echo -e "${YELLOW}Rate limited. Waiting 1 hour...${NC}"
        sleep 3600
      fi
      
      echo -e "${GREEN}Resuming...${NC}"
      echo ""
      continue  # Retry same spec
    fi
    
    # Check for connection/API errors
    if grep -qi "connection\|timeout\|network\|API error\|server error" "$log_file" 2>/dev/null; then
      echo -e "${YELLOW}Connection issue. Waiting 5 minutes...${NC}"
      sleep 300
      continue  # Retry
    fi
    
    # Success or non-retryable error - move on
    break
  done
  
  echo ""
  echo -e "${GREEN}✓ Completed: $spec_name${NC}"
  echo ""
  
  # Update progress
  current=$((current + 1))
  echo $current > "$PROGRESS_FILE"
  
  sleep 5
done

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 ALL SPECS COMPLETE!                       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "QA Checklist: $QA_FILE"
echo "Logs: $LOG_DIR/"
