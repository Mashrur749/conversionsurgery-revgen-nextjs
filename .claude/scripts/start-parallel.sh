#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# tmux Launcher for Parallel Refactoring Orchestrator (v2)
# Creates a 4-pane tmux session: orchestrator + 3 agent panes
#
# Features:
#   - Reattaches to existing session if found (resume support)
#   - Logs to .claude-refactor/logs/ for post-mortem
#   - Passes all CLI args through to run-parallel.sh
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SESSION="refactor"
EXTRA_ARGS=()

# Parse our own args (--session) and pass rest through
while [[ $# -gt 0 ]]; do
    case "$1" in
        --session) SESSION="$2"; shift 2 ;;
        *)         EXTRA_ARGS+=("$1"); shift ;;
    esac
done

# Check if session already exists (resume scenario)
if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "[INFO] tmux session '$SESSION' already exists."
    echo "       Reattaching... (orchestrator may still be running)"
    echo ""
    echo "  To kill and restart: tmux kill-session -t $SESSION"
    echo ""
    sleep 2
    tmux attach-session -t "$SESSION"
    exit 0
fi

# Create new session with pane 0 (orchestrator status)
echo "[INFO] Creating tmux session: $SESSION"
tmux new-session -d -s "$SESSION" -x 220 -y 55

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

# Label panes for clarity
tmux send-keys -t "$SESSION:0.1" "echo '=== Agent Pane 1 (waiting for work) ==='" Enter
tmux send-keys -t "$SESSION:0.2" "echo '=== Agent Pane 2 (waiting for work) ==='" Enter
tmux send-keys -t "$SESSION:0.3" "echo '=== Agent Pane 3 (waiting for work) ==='" Enter

sleep 1

# Build orchestrator command
ORCH_CMD="bash '${SCRIPT_DIR}/run-parallel.sh' --session '${SESSION}'"
for arg in "${EXTRA_ARGS[@]}"; do
    ORCH_CMD+=" '${arg}'"
done

# Launch orchestrator in pane 0
tmux send-keys -t "$SESSION:0.0" "$ORCH_CMD" Enter

echo ""
echo "╔═══════════════════════════════════════════════════╗"
echo "║  Parallel Refactoring Orchestrator                ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Session: $SESSION"
echo "║  Pane 0:  Orchestrator (monitor + merge)          ║"
echo "║  Pane 1-3: Claude Code agents                     ║"
echo "╠═══════════════════════════════════════════════════╣"
echo "║  Detach:  Ctrl-B then D  (runs in background)     ║"
echo "║  Reattach: tmux attach -t $SESSION"
echo "║  Kill:    tmux kill-session -t $SESSION"
echo "║  Logs:    .claude-refactor/logs/                   ║"
echo "╚═══════════════════════════════════════════════════╝"
echo ""

# Attach to session
tmux attach-session -t "$SESSION"
