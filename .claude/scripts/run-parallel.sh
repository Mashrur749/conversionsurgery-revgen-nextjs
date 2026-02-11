#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Parallel Refactoring Orchestrator
# Runs up to 3 Claude Code sessions in parallel git worktrees, merging
# completed modules to a staging branch (claude-main) in wave order.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="$(basename "$REPO_ROOT")"
WORKTREE_MGR="$SCRIPT_DIR/worktree-manager.sh"
WAVES_FILE="$REPO_ROOT/.claude/plans/refactor-waves.json"

# State directory (survives restarts)
STATE_DIR="$REPO_ROOT/.claude-refactor"
PROGRESS_FILE="$STATE_DIR/progress.json"
LOCKS_DIR="$STATE_DIR/locks"
LOGS_DIR="$STATE_DIR/logs"

# Configuration
MAX_PARALLEL=3
STAGING_BRANCH="claude-main"
HEARTBEAT_INTERVAL=10    # seconds between monitor checks
STALE_THRESHOLD=300      # 5 minutes = stale agent
RATE_LIMIT_PAUSE=3600    # 1 hour pause on rate limit

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

log_info()  { echo -e "${BLUE}[ORCH]${NC} $(date '+%H:%M:%S') $*"; }
log_ok()    { echo -e "${GREEN}[ORCH]${NC} $(date '+%H:%M:%S') $*"; }
log_warn()  { echo -e "${YELLOW}[ORCH]${NC} $(date '+%H:%M:%S') $*"; }
log_error() { echo -e "${RED}[ORCH]${NC} $(date '+%H:%M:%S') $*"; }
log_step()  { echo -e "${CYAN}[ORCH]${NC} $(date '+%H:%M:%S') $*"; }

# ============================================================================
# Utility Functions
# ============================================================================

ensure_deps() {
    for cmd in jq tmux git node npm; do
        command -v "$cmd" >/dev/null 2>&1 || { log_error "Missing: $cmd"; exit 1; }
    done
    [[ -f "$WAVES_FILE" ]] || { log_error "Missing: $WAVES_FILE"; exit 1; }
    command -v claude >/dev/null 2>&1 || { log_error "Missing: claude CLI"; exit 1; }
}

init_state() {
    mkdir -p "$STATE_DIR" "$LOCKS_DIR" "$LOGS_DIR"

    if [[ ! -f "$PROGRESS_FILE" ]]; then
        cat > "$PROGRESS_FILE" << 'EOF'
{
  "started_at": null,
  "current_wave": 0,
  "modules": {},
  "completed_waves": [],
  "rate_limit_pauses": 0,
  "crashes": 0
}
EOF
    fi

    # Update start time
    local tmp
    tmp=$(jq --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.started_at //= $t' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"
}

# Set file descriptor limit (M3)
bump_fd_limit() {
    ulimit -n 4096 2>/dev/null || log_warn "Could not set ulimit -n 4096"
}

get_module_status() {
    local module="$1"
    jq -r --arg m "$module" '.modules[$m].status // "pending"' "$PROGRESS_FILE"
}

set_module_status() {
    local module="$1" status="$2"
    local tmp
    tmp=$(jq --arg m "$module" --arg s "$status" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        '.modules[$m] = (.modules[$m] // {}) | .modules[$m].status = $s | .modules[$m][($s + "_at")] = $t' \
        "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"
}

get_module_pid() {
    local module="$1"
    jq -r --arg m "$module" '.modules[$m].pid // empty' "$PROGRESS_FILE"
}

set_module_pid() {
    local module="$1" pid="$2"
    local tmp
    tmp=$(jq --arg m "$module" --arg p "$pid" '.modules[$m].pid = ($p | tonumber)' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"
}

worktree_path() {
    local module="$1"
    echo "${REPO_ROOT}/../${PROJECT_NAME}-refactor-${module}"
}

# ============================================================================
# Wave Parsing
# ============================================================================

get_wave_count() {
    jq '.waves | length' "$WAVES_FILE"
}

get_wave_modules() {
    local wave="$1"
    jq -r --argjson w "$wave" '.waves[$w].modules[].name' "$WAVES_FILE"
}

get_all_modules_in_wave() {
    local wave_num="$1"
    # Waves in JSON are 0-indexed (wave 1 = index 0)
    local idx=$((wave_num - 1))
    jq -r --argjson w "$idx" '.waves[$w].modules[].name' "$WAVES_FILE"
}

# ============================================================================
# Agent Management
# ============================================================================

create_worktree() {
    local module="$1"
    log_step "Creating worktree for: $module"
    bash "$WORKTREE_MGR" create-refactor "$module" "$STAGING_BRANCH"
}

remove_worktree() {
    local module="$1"
    local wt_dir
    wt_dir=$(worktree_path "$module")
    local branch="refactor/${module}"

    [[ -d "$wt_dir/.next" ]] && rm -rf "$wt_dir/.next"
    [[ -d "$wt_dir" ]] && git -C "$REPO_ROOT" worktree remove "$wt_dir" --force 2>/dev/null
    git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch" && \
        git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null
}

launch_agent() {
    local module="$1"
    local wt_dir log_file pane_id
    wt_dir=$(worktree_path "$module")
    log_file="$LOGS_DIR/${module}.log"

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would launch Claude Code in: $wt_dir"
        # Simulate agent work
        (
            sleep 5
            touch "$wt_dir/.refactor-complete"
        ) &
        set_module_pid "$module" "$!"
        set_module_status "$module" "running"
        return
    fi

    # Find a free tmux pane (1-3)
    pane_id=$(find_free_pane)
    if [[ -z "$pane_id" ]]; then
        log_warn "No free tmux panes — waiting..."
        return 1
    fi

    local prompt
    prompt="You are refactoring the '$module' module. Read .claude/feature-plan.md (foundation patterns) and .claude/module-plan.md (module scope) first, then refactor all files listed in the module plan. Follow all FROZEN_EXPORTS and FROZEN_FILES rules. When done: npm run build && npm run lint && touch .refactor-complete"

    # Launch Claude Code in the tmux pane
    tmux send-keys -t "$TMUX_SESSION:0.$pane_id" \
        "cd '$wt_dir' && echo '$prompt' | claude --dangerously-skip-permissions 2>&1 | tee '$log_file'" Enter

    # We can't easily get the PID from tmux, so we track the pane instead
    local tmp
    tmp=$(jq --arg m "$module" --arg p "$pane_id" '.modules[$m].pane = ($p | tonumber)' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"

    set_module_status "$module" "running"
    log_ok "Launched agent for: $module (pane $pane_id)"
}

find_free_pane() {
    # Panes 1, 2, 3 are for agents (pane 0 is orchestrator)
    for pane in 1 2 3; do
        local in_use=false
        while IFS= read -r module; do
            local status pane_num
            status=$(get_module_status "$module")
            pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")
            if [[ "$status" == "running" && "$pane_num" == "$pane" ]]; then
                in_use=true
                break
            fi
        done < <(jq -r '.modules | keys[]' "$PROGRESS_FILE" 2>/dev/null)

        if [[ "$in_use" == "false" ]]; then
            echo "$pane"
            return
        fi
    done
}

# ============================================================================
# Monitoring
# ============================================================================

check_module_complete() {
    local module="$1"
    local wt_dir
    wt_dir=$(worktree_path "$module")
    [[ -f "$wt_dir/.refactor-complete" ]]
}

check_rate_limit() {
    local module="$1"
    local log_file="$LOGS_DIR/${module}.log"
    [[ -f "$log_file" ]] && grep -qi "rate.limit\|429\|too many requests" "$log_file" 2>/dev/null
}

check_agent_stale() {
    local module="$1"
    local log_file="$LOGS_DIR/${module}.log"
    if [[ -f "$log_file" ]]; then
        local last_modified
        last_modified=$(stat -f %m "$log_file" 2>/dev/null || stat -c %Y "$log_file" 2>/dev/null || echo 0)
        local now
        now=$(date +%s)
        local age=$(( now - last_modified ))
        [[ $age -gt $STALE_THRESHOLD ]]
    else
        return 1  # No log = not stale (might not have started)
    fi
}

check_agent_alive() {
    local module="$1"
    local pane_num
    pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")

    if [[ -z "$pane_num" ]]; then
        return 1  # No pane = not alive
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        local pid
        pid=$(get_module_pid "$module")
        [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
        return $?
    fi

    # Check if tmux pane has a running process
    tmux list-panes -t "$TMUX_SESSION:0.$pane_num" -F '#{pane_pid}' 2>/dev/null | head -1 | grep -q '[0-9]'
}

global_pause_all_agents() {
    log_warn "RATE LIMIT DETECTED — pausing ALL agents for ${RATE_LIMIT_PAUSE}s (C4)"

    # Update progress
    local tmp
    tmp=$(jq '.rate_limit_pauses += 1' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"

    # Kill all agent panes
    for pane in 1 2 3; do
        tmux send-keys -t "$TMUX_SESSION:0.$pane" C-c 2>/dev/null || true
    done

    # Mark running modules as paused
    while IFS= read -r module; do
        local status
        status=$(get_module_status "$module")
        [[ "$status" == "running" ]] && set_module_status "$module" "paused"
    done < <(jq -r '.modules | keys[]' "$PROGRESS_FILE" 2>/dev/null)

    log_info "Sleeping for ${RATE_LIMIT_PAUSE}s..."
    sleep "$RATE_LIMIT_PAUSE"

    # Restart paused modules
    while IFS= read -r module; do
        local status
        status=$(get_module_status "$module")
        if [[ "$status" == "paused" ]]; then
            log_info "Restarting: $module"
            launch_agent "$module"
        fi
    done < <(jq -r '.modules | keys[]' "$PROGRESS_FILE" 2>/dev/null)
}

handle_stale_agent() {
    local module="$1"
    log_warn "Agent stale for $module (no log activity for ${STALE_THRESHOLD}s)"

    local pane_num
    pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")

    # Check if sentinel exists (agent finished but logs stopped)
    if check_module_complete "$module"; then
        log_ok "Module $module actually completed — processing"
        return 0
    fi

    # Kill and restart
    if [[ -n "$pane_num" ]]; then
        tmux send-keys -t "$TMUX_SESSION:0.$pane_num" C-c 2>/dev/null || true
        sleep 2
    fi

    local tmp
    tmp=$(jq '.crashes += 1' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"

    log_info "Restarting agent for: $module"
    launch_agent "$module"
}

handle_crash() {
    local module="$1"
    log_error "Agent crashed for: $module"

    local tmp
    tmp=$(jq '.crashes += 1' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"

    # Check if it completed before crashing
    if check_module_complete "$module"; then
        log_ok "Module $module completed before crash — processing"
        return 0
    fi

    set_module_status "$module" "crashed"
    log_info "Will retry: $module"
    sleep 5
    launch_agent "$module"
}

# ============================================================================
# Merge Flow
# ============================================================================

merge_module() {
    local module="$1"
    local wt_dir branch
    wt_dir=$(worktree_path "$module")
    branch="refactor/${module}"

    log_step "Merging module: $module"

    # Acquire build lock (M2: sequential builds)
    (
        flock -x 200

        # Pre-merge build in worktree (M4)
        log_step "Build verification: $module"
        if ! (cd "$wt_dir" && npm run build 2>&1); then
            log_error "Build fails for $module — skipping merge"
            set_module_status "$module" "build-failed"
            return 1
        fi

        # Tag for rollback (H4)
        cd "$REPO_ROOT"
        git checkout "$STAGING_BRANCH"
        git tag "pre-merge-${module}" HEAD 2>/dev/null || true

        # Merge
        if git merge "$branch" --no-ff -m "refactor: merge module ${module}"; then
            log_ok "Merged: $module"
            set_module_status "$module" "merged"
        else
            log_error "Merge conflict for $module — aborting"
            git merge --abort 2>/dev/null || true
            set_module_status "$module" "conflict"
            return 1
        fi

    ) 200>"$LOCKS_DIR/build.lock"
}

between_waves_rebase() {
    local wave="$1"
    log_step "Between-wave rebase after wave $wave (C6)"

    # Rebase all active worktrees onto updated staging branch
    while IFS= read -r line; do
        local wt_path
        wt_path=$(echo "$line" | awk '{print $1}')
        [[ "$wt_path" == "$REPO_ROOT" ]] && continue
        [[ "$wt_path" != *"refactor-"* ]] && continue

        local wt_branch
        wt_branch=$(git -C "$wt_path" branch --show-current 2>/dev/null || echo "?")
        log_info "Rebasing $wt_branch onto $STAGING_BRANCH..."

        if git -C "$wt_path" rebase "$STAGING_BRANCH" 2>/dev/null; then
            log_ok "$wt_branch rebased"
        else
            log_warn "$wt_branch has conflicts — abort and continue"
            git -C "$wt_path" rebase --abort 2>/dev/null || true
        fi
    done < <(git -C "$REPO_ROOT" worktree list)
}

# ============================================================================
# Display
# ============================================================================

display_status() {
    clear 2>/dev/null || true
    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║     Parallel Refactoring Orchestrator             ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""

    local current_wave completed total_modules done_modules running_modules
    current_wave=$(jq -r '.current_wave' "$PROGRESS_FILE")
    completed=$(jq -r '.completed_waves | length' "$PROGRESS_FILE")
    total_modules=$(jq -r '.modules | length' "$PROGRESS_FILE")
    done_modules=$(jq -r '[.modules[] | select(.status == "merged")] | length' "$PROGRESS_FILE")
    running_modules=$(jq -r '[.modules[] | select(.status == "running")] | length' "$PROGRESS_FILE")

    echo -e "  Wave: ${CYAN}${current_wave}${NC} | Completed: ${GREEN}${done_modules}${NC}/${total_modules} | Running: ${YELLOW}${running_modules}${NC}"
    echo ""

    # Show per-module status
    jq -r '.modules | to_entries[] | "\(.key)\t\(.value.status)"' "$PROGRESS_FILE" 2>/dev/null | \
        while IFS=$'\t' read -r name status; do
            local color="$NC"
            case "$status" in
                running)      color="$YELLOW" ;;
                merged)       color="$GREEN" ;;
                build-failed) color="$RED" ;;
                conflict)     color="$RED" ;;
                crashed)      color="$RED" ;;
                paused)       color="$MAGENTA" ;;
            esac
            printf "  %-28s %b%s%b\n" "$name" "$color" "$status" "$NC"
        done

    echo ""
    local rate_limits crashes
    rate_limits=$(jq -r '.rate_limit_pauses' "$PROGRESS_FILE")
    crashes=$(jq -r '.crashes' "$PROGRESS_FILE")
    echo -e "  Rate limit pauses: $rate_limits | Crashes: $crashes"
    echo ""
}

# ============================================================================
# Main Orchestration Loop
# ============================================================================

run_wave() {
    local wave_num="$1"
    local wave_idx=$((wave_num - 1))

    log_step "Starting wave $wave_num"

    local tmp
    tmp=$(jq --argjson w "$wave_num" '.current_wave = $w' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"

    # Get modules for this wave
    local -a modules=()
    while IFS= read -r m; do
        modules+=("$m")
    done < <(get_all_modules_in_wave "$wave_num")

    if [[ ${#modules[@]} -eq 0 ]]; then
        log_warn "No modules in wave $wave_num"
        return
    fi

    log_info "Wave $wave_num modules: ${modules[*]}"

    # Initialize pending modules
    for module in "${modules[@]}"; do
        local status
        status=$(get_module_status "$module")
        if [[ "$status" == "merged" ]]; then
            log_info "Skipping already merged: $module"
            continue
        fi
        set_module_status "$module" "pending"
    done

    # Create worktrees for all modules in this wave
    for module in "${modules[@]}"; do
        local status
        status=$(get_module_status "$module")
        [[ "$status" == "merged" ]] && continue

        local wt_dir
        wt_dir=$(worktree_path "$module")
        if [[ ! -d "$wt_dir" ]]; then
            create_worktree "$module"
        fi
    done

    # Launch initial batch (up to MAX_PARALLEL)
    local launched=0
    for module in "${modules[@]}"; do
        [[ $launched -ge $MAX_PARALLEL ]] && break
        local status
        status=$(get_module_status "$module")
        [[ "$status" == "merged" ]] && continue

        launch_agent "$module"
        ((launched++))
    done

    # Monitor loop
    while true; do
        sleep "$HEARTBEAT_INTERVAL"

        local all_done=true
        local running_count=0

        for module in "${modules[@]}"; do
            local status
            status=$(get_module_status "$module")

            case "$status" in
                merged)
                    continue
                    ;;
                running)
                    all_done=false
                    ((running_count++))

                    # Check for completion sentinel
                    if check_module_complete "$module"; then
                        log_ok "Module complete: $module"
                        merge_module "$module" || true
                        remove_worktree "$module"

                        # Launch next pending module in freed slot
                        for next in "${modules[@]}"; do
                            local next_status
                            next_status=$(get_module_status "$next")
                            if [[ "$next_status" == "pending" ]]; then
                                local next_wt
                                next_wt=$(worktree_path "$next")
                                [[ ! -d "$next_wt" ]] && create_worktree "$next"
                                launch_agent "$next" && break
                            fi
                        done
                        continue
                    fi

                    # Check for rate limit (C4)
                    if check_rate_limit "$module"; then
                        global_pause_all_agents
                        continue
                    fi

                    # Check for stale agent (H3)
                    if check_agent_stale "$module"; then
                        handle_stale_agent "$module"
                        continue
                    fi

                    # Check if agent process died
                    if ! check_agent_alive "$module"; then
                        handle_crash "$module"
                    fi
                    ;;
                pending)
                    all_done=false
                    ;;
                build-failed|conflict|crashed)
                    all_done=false
                    # Retry crashed modules
                    if [[ "$status" == "crashed" && $running_count -lt $MAX_PARALLEL ]]; then
                        local wt_dir
                        wt_dir=$(worktree_path "$module")
                        [[ ! -d "$wt_dir" ]] && create_worktree "$module"
                        launch_agent "$module" && ((running_count++))
                    fi
                    ;;
            esac
        done

        display_status

        if [[ "$all_done" == "true" ]]; then
            log_ok "Wave $wave_num complete"
            break
        fi
    done

    # Mark wave as completed
    tmp=$(jq --argjson w "$wave_num" '.completed_waves += [$w]' "$PROGRESS_FILE")
    echo "$tmp" > "$PROGRESS_FILE"
}

# ============================================================================
# CLI Argument Parsing
# ============================================================================

DRY_RUN="false"
SINGLE_MODULE=""
MAX_WAVE=0
TMUX_SESSION="refactor"

usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run         Simulate without running Claude Code"
    echo "  --module <name>   Run single module only"
    echo "  --waves <n>       Only run waves 1 through n"
    echo "  --session <name>  tmux session name (default: refactor)"
    echo "  --help            Show this help"
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)    DRY_RUN="true"; shift ;;
        --module)     SINGLE_MODULE="$2"; shift 2 ;;
        --waves)      MAX_WAVE="$2"; shift 2 ;;
        --session)    TMUX_SESSION="$2"; shift 2 ;;
        --help|-h)    usage ;;
        *)            log_error "Unknown option: $1"; usage ;;
    esac
done

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    log_step "Starting Parallel Refactoring Orchestrator"
    ensure_deps
    init_state
    bump_fd_limit

    local wave_count
    wave_count=$(get_wave_count)

    if [[ $MAX_WAVE -gt 0 ]]; then
        wave_count=$MAX_WAVE
    fi

    # Ensure staging branch exists
    if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$STAGING_BRANCH"; then
        log_step "Creating staging branch: $STAGING_BRANCH"
        git -C "$REPO_ROOT" branch "$STAGING_BRANCH" HEAD
    fi

    # Single module mode
    if [[ -n "$SINGLE_MODULE" ]]; then
        log_info "Single module mode: $SINGLE_MODULE"
        set_module_status "$SINGLE_MODULE" "pending"
        create_worktree "$SINGLE_MODULE"
        launch_agent "$SINGLE_MODULE"

        while true; do
            sleep "$HEARTBEAT_INTERVAL"
            if check_module_complete "$SINGLE_MODULE"; then
                log_ok "Module complete: $SINGLE_MODULE"
                merge_module "$SINGLE_MODULE" || true
                remove_worktree "$SINGLE_MODULE"
                break
            fi
            display_status
        done

        log_ok "Single module run complete: $SINGLE_MODULE"
        return
    fi

    # Full wave orchestration
    for ((w=1; w<=wave_count; w++)); do
        # Skip already completed waves
        if jq -e --argjson w "$w" '.completed_waves | index($w) != null' "$PROGRESS_FILE" >/dev/null 2>&1; then
            log_info "Skipping completed wave $w"
            continue
        fi

        run_wave "$w"

        # Between-wave rebase (C6: only between waves, never during active work)
        if [[ $w -lt $wave_count ]]; then
            between_waves_rebase "$w"
        fi
    done

    # Final build verification
    log_step "Final build verification on $STAGING_BRANCH..."
    cd "$REPO_ROOT"
    git checkout "$STAGING_BRANCH"
    if npm run build 2>&1; then
        log_ok "FINAL BUILD PASSES on $STAGING_BRANCH"
    else
        log_error "Final build failed on $STAGING_BRANCH — check merged modules"
        exit 1
    fi

    # Cleanup worktrees
    log_step "Cleaning up remaining worktrees..."
    while IFS= read -r line; do
        local wt_path
        wt_path=$(echo "$line" | awk '{print $1}')
        [[ "$wt_path" == "$REPO_ROOT" ]] && continue
        [[ "$wt_path" != *"refactor-"* ]] && continue
        [[ -d "${wt_path}/.next" ]] && rm -rf "${wt_path}/.next"
        git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
    done < <(git -C "$REPO_ROOT" worktree list)

    display_status
    echo ""
    log_ok "======================================"
    log_ok "  REFACTORING COMPLETE"
    log_ok "  Branch: $STAGING_BRANCH"
    log_ok "  All modules merged and verified"
    log_ok "======================================"
}

main
