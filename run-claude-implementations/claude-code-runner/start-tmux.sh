#!/bin/bash

# ============================================
# Tmux Launcher for Claude Code Runner
# Keeps the process running even if you disconnect
# ============================================

SESSION_NAME="claude-runner"
PROJECT_DIR="${1:-$(pwd)}"
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
  echo "Error: tmux is not installed"
  echo "Install with: sudo apt install tmux"
  exit 1
fi

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
  echo "Session '$SESSION_NAME' already exists."
  echo ""
  echo "Options:"
  echo "  Attach:  tmux attach -t $SESSION_NAME"
  echo "  Kill:    tmux kill-session -t $SESSION_NAME"
  echo "  Status:  $SCRIPT_DIR/run-specs.sh status"
  exit 0
fi

# Create new tmux session
echo "Starting Claude Code Runner in tmux session: $SESSION_NAME"
echo ""

tmux new-session -d -s "$SESSION_NAME" -c "$PROJECT_DIR"
tmux send-keys -t "$SESSION_NAME" "cd $PROJECT_DIR && $SCRIPT_DIR/run-specs.sh" Enter

echo "✓ Runner started in background"
echo ""
echo "Commands:"
echo "  Attach (watch progress):  tmux attach -t $SESSION_NAME"
echo "  Detach (from inside):     Ctrl+B, then D"
echo "  Check status:             $SCRIPT_DIR/run-specs.sh status"
echo "  View logs:                ls -la $PROJECT_DIR/.claude-logs/"
echo "  Kill session:             tmux kill-session -t $SESSION_NAME"
