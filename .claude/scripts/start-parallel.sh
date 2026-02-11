#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# tmux Launcher for Parallel Refactoring Orchestrator
# Creates a 4-pane tmux session: orchestrator + 3 agent panes
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSION="${1:-refactor}"

# Kill existing session if present
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create new session with pane 0 (orchestrator status)
tmux new-session -d -s "$SESSION" -x 220 -y 50

# Split into 4 panes:
#   ┌──────────────┬──────────────┐
#   │   Pane 0     │   Pane 1     │
#   │ Orchestrator │   Agent 1    │
#   ├──────────────┼──────────────┤
#   │   Pane 2     │   Pane 3     │
#   │   Agent 2    │   Agent 3    │
#   └──────────────┴──────────────┘

tmux split-window -h -t "$SESSION:0"
tmux split-window -v -t "$SESSION:0.0"
tmux split-window -v -t "$SESSION:0.1"

# Label panes
tmux send-keys -t "$SESSION:0.0" "echo '=== ORCHESTRATOR ===' && echo 'Starting in 2s...'" Enter
tmux send-keys -t "$SESSION:0.1" "echo '=== Agent Pane 1 ==='" Enter
tmux send-keys -t "$SESSION:0.2" "echo '=== Agent Pane 2 ==='" Enter
tmux send-keys -t "$SESSION:0.3" "echo '=== Agent Pane 3 ==='" Enter

sleep 2

# Forward CLI args to orchestrator
shift 2>/dev/null || true
EXTRA_ARGS="${*:-}"

# Launch orchestrator in pane 0
tmux send-keys -t "$SESSION:0.0" \
    "bash '$SCRIPT_DIR/run-parallel.sh' --session '$SESSION' $EXTRA_ARGS" Enter

# Attach to session
tmux attach-session -t "$SESSION"
