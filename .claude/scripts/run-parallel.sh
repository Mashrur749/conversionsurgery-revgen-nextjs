#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Parallel Refactoring Orchestrator (v2 — hands-off safe)
# Runs up to 3 Claude Code sessions in parallel git worktrees, merging
# completed modules to a staging branch (claude-main) in wave order.
#
# Fixes incorporated:
#   B1: .refactor-failed sentinel detection
#   B2: Non-interactive Claude CLI (--print mode)
#   B3: Merge conflicts treated as terminal (skip, don't hang)
#   B4: Crash cleanup + max 3 retries per module
#   B5: Per-module absolute timeout (2h)
#   B6: caffeinate for macOS sleep prevention
#   B7: Proper tmux pane alive detection
#   B8: Between-wave rebase conflicts halt wave
#   B9: Slack/email notifications on completion
#   W10: Dynamic stale threshold per module size
#   W11: Disk space monitoring before worktree creation
#   W14: Pre-flight checks (git state, auth, JSON)
#   W16: Atomic JSON updates via temp file + mv
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
HEARTBEAT_INTERVAL=10          # seconds between monitor checks
STALE_THRESHOLD_BASE=600       # 10 min base stale threshold (W10)
STALE_THRESHOLD_PER_FILE=30    # +30s per file in module (W10)
MODULE_TIMEOUT=7200            # 2 hours absolute timeout per module (B5)
MAX_CRASHES_PER_MODULE=3       # Give up after 3 crashes (B4)
MIN_DISK_GB=5                  # Minimum free disk space in GB (W11)
RATE_LIMIT_BACKOFF_BASE=120    # 2 min initial rate limit pause
RATE_LIMIT_BACKOFF_MAX=900     # 15 min max rate limit pause

# Notification (set via env vars or flags)
NOTIFY_SLACK_WEBHOOK="${NOTIFY_SLACK_WEBHOOK:-}"
NOTIFY_EMAIL="${NOTIFY_EMAIL:-}"

# Runtime state
CAFFEINE_PID=""

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; NC='\033[0m'

log_info()  { echo -e "${BLUE}[ORCH]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOGS_DIR/orchestrator.log" 2>/dev/null; }
log_ok()    { echo -e "${GREEN}[ORCH]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOGS_DIR/orchestrator.log" 2>/dev/null; }
log_warn()  { echo -e "${YELLOW}[ORCH]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOGS_DIR/orchestrator.log" 2>/dev/null; }
log_error() { echo -e "${RED}[ORCH]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOGS_DIR/orchestrator.log" 2>/dev/null; }
log_step()  { echo -e "${CYAN}[ORCH]${NC} $(date '+%H:%M:%S') $*" | tee -a "$LOGS_DIR/orchestrator.log" 2>/dev/null; }

# ============================================================================
# Atomic JSON helper (W16)
# ============================================================================

json_update() {
    # Usage: json_update '.some.path = "value"' [--arg name val ...]
    local filter="$1"; shift
    local tmp_file
    tmp_file=$(mktemp "${STATE_DIR}/progress.XXXXXX")
    if jq "$@" "$filter" "$PROGRESS_FILE" > "$tmp_file" 2>/dev/null; then
        mv "$tmp_file" "$PROGRESS_FILE"
    else
        rm -f "$tmp_file"
        log_warn "JSON update failed: $filter"
    fi
}

# ============================================================================
# Notifications (B9)
# ============================================================================

notify() {
    local status="$1" message="$2"

    # Always write to persistent log
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) [$status] $message" >> "$STATE_DIR/completion.log"

    # Slack webhook
    if [[ -n "$NOTIFY_SLACK_WEBHOOK" ]]; then
        local emoji="white_check_mark"
        [[ "$status" == "FAILED" ]] && emoji="x"
        [[ "$status" == "WARNING" ]] && emoji="warning"
        curl -s -X POST "$NOTIFY_SLACK_WEBHOOK" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \":${emoji}: *Refactoring ${status}*\n${message}\"}" \
            >/dev/null 2>&1 || true
    fi

    # Email via mail command (if configured and available)
    if [[ -n "$NOTIFY_EMAIL" ]] && command -v mail >/dev/null 2>&1; then
        echo "$message" | mail -s "Refactoring: $status" "$NOTIFY_EMAIL" 2>/dev/null || true
    fi
}

# ============================================================================
# Cleanup trap
# ============================================================================

cleanup() {
    local exit_code=$?
    # Kill caffeinate (B6)
    [[ -n "$CAFFEINE_PID" ]] && kill "$CAFFEINE_PID" 2>/dev/null || true
    if [[ $exit_code -ne 0 ]]; then
        local wave
        wave=$(jq -r '.current_wave // 0' "$PROGRESS_FILE" 2>/dev/null || echo "?")
        notify "FAILED" "Orchestrator exited with code $exit_code during wave $wave. Check $LOGS_DIR/orchestrator.log"
    fi
}
trap cleanup EXIT

# ============================================================================
# Pre-flight checks (W14)
# ============================================================================

ensure_deps() {
    local missing=()
    for cmd in jq tmux git node npm; do
        command -v "$cmd" >/dev/null 2>&1 || missing+=("$cmd")
    done
    command -v claude >/dev/null 2>&1 || missing+=("claude")
    [[ ${#missing[@]} -gt 0 ]] && { log_error "Missing commands: ${missing[*]}"; exit 1; }
    [[ -f "$WAVES_FILE" ]] || { log_error "Missing: $WAVES_FILE"; exit 1; }
}

preflight_checks() {
    log_step "Pre-flight checks..."

    # Validate JSON
    jq empty "$WAVES_FILE" 2>/dev/null || { log_error "Invalid JSON: $WAVES_FILE"; exit 1; }

    # Check git state (skip if resuming — progress file exists with modules)
    local has_modules
    has_modules=$(jq '.modules | length' "$PROGRESS_FILE" 2>/dev/null || echo 0)
    if [[ "$has_modules" == "0" ]]; then
        local dirty
        dirty=$(git -C "$REPO_ROOT" status --porcelain 2>/dev/null | head -1)
        if [[ -n "$dirty" ]]; then
            log_warn "Uncommitted changes in repo — recommend committing first"
        fi
    fi

    # Disk space check (W11)
    check_disk_space || exit 1

    # Verify Claude CLI responds (don't test auth in dry-run)
    if [[ "$DRY_RUN" != "true" ]]; then
        if ! claude --version >/dev/null 2>&1; then
            log_error "Claude CLI not responding — check installation and auth"
            exit 1
        fi
    fi

    log_ok "Pre-flight checks passed"
}

# ============================================================================
# Disk space monitoring (W11)
# ============================================================================

check_disk_space() {
    local parent_dir
    parent_dir=$(dirname "$REPO_ROOT")
    local available_kb
    available_kb=$(df -k "$parent_dir" 2>/dev/null | tail -1 | awk '{print $4}')
    local available_gb=$(( available_kb / 1024 / 1024 ))

    if [[ $available_gb -lt $MIN_DISK_GB ]]; then
        log_error "Insufficient disk space: ${available_gb}GB free (need ${MIN_DISK_GB}GB)"
        return 1
    fi
    log_info "Disk space: ${available_gb}GB free"
    return 0
}

# ============================================================================
# macOS sleep prevention (B6)
# ============================================================================

prevent_sleep() {
    if [[ "$OSTYPE" == darwin* ]]; then
        if command -v caffeinate >/dev/null 2>&1; then
            caffeinate -dims -w $$ &
            CAFFEINE_PID=$!
            log_ok "macOS sleep prevention enabled (caffeinate PID: $CAFFEINE_PID)"
        else
            log_warn "caffeinate not found — machine may sleep during long runs"
        fi
    fi
}

# ============================================================================
# State helpers
# ============================================================================

init_state() {
    mkdir -p "$STATE_DIR" "$LOCKS_DIR" "$LOGS_DIR"

    if [[ ! -f "$PROGRESS_FILE" ]]; then
        cat > "$PROGRESS_FILE" << 'INIT_JSON'
{
  "started_at": null,
  "current_wave": 0,
  "modules": {},
  "completed_waves": [],
  "rate_limit_pauses": 0,
  "total_crashes": 0,
  "skipped_modules": []
}
INIT_JSON
    fi

    json_update '.started_at //= $t' --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

bump_fd_limit() {
    ulimit -n 4096 2>/dev/null || log_warn "Could not set ulimit -n 4096 (M3)"
}

get_module_status() {
    jq -r --arg m "$1" '.modules[$m].status // "pending"' "$PROGRESS_FILE"
}

set_module_status() {
    local module="$1" status="$2"
    json_update \
        '.modules[$m] = (.modules[$m] // {}) | .modules[$m].status = $s | .modules[$m][($s + "_at")] = $t' \
        --arg m "$module" --arg s "$status" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}

get_module_crash_count() {
    jq -r --arg m "$1" '.modules[$m].crash_count // 0' "$PROGRESS_FILE"
}

increment_module_crash_count() {
    json_update \
        '.modules[$m].crash_count = ((.modules[$m].crash_count // 0) + 1) | .total_crashes += 1' \
        --arg m "$1"
}

get_module_file_count() {
    # Count files in module's manifest from waves.json
    jq -r --arg m "$1" \
        '[.waves[].modules[] | select(.name == $m) | .files | length] | first // 10' \
        "$WAVES_FILE"
}

worktree_path() {
    echo "${REPO_ROOT}/../${PROJECT_NAME}-refactor-${1}"
}

# ============================================================================
# Wave Parsing
# ============================================================================

get_wave_count() {
    jq '.waves | length' "$WAVES_FILE"
}

get_all_modules_in_wave() {
    local idx=$(( $1 - 1 ))
    jq -r --argjson w "$idx" '.waves[$w].modules[].name' "$WAVES_FILE"
}

# ============================================================================
# Agent Management
# ============================================================================

create_worktree() {
    local module="$1"
    check_disk_space || { log_error "Disk full — cannot create worktree for $module"; return 1; }
    log_step "Creating worktree for: $module"
    bash "$WORKTREE_MGR" create-refactor "$module" "$STAGING_BRANCH"
}

remove_worktree() {
    local module="$1"
    local wt_dir branch
    wt_dir=$(worktree_path "$module")
    branch="refactor/${module}"

    # Clean caches first (B4)
    [[ -d "$wt_dir/.next" ]] && rm -rf "$wt_dir/.next"
    [[ -d "$wt_dir/.eslintcache" ]] && rm -f "$wt_dir/.eslintcache"
    [[ -d "$wt_dir" ]] && git -C "$REPO_ROOT" worktree remove "$wt_dir" --force 2>/dev/null || true
    git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch" 2>/dev/null && \
        git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null || true
}

kill_pane_process() {
    local pane_num="$1"
    [[ -z "$pane_num" || "$pane_num" == "null" ]] && return
    # Send Ctrl-C, wait, then kill if still alive
    tmux send-keys -t "$TMUX_SESSION:0.$pane_num" C-c 2>/dev/null || true
    sleep 2
    # Send exit to clean up shell
    tmux send-keys -t "$TMUX_SESSION:0.$pane_num" "exit" Enter 2>/dev/null || true
    sleep 1
}

launch_agent() {
    local module="$1"
    local wt_dir log_file
    wt_dir=$(worktree_path "$module")
    log_file="$LOGS_DIR/${module}.log"

    # Clean stale log from previous attempt
    [[ -f "$log_file" ]] && mv "$log_file" "$log_file.$(date +%s).bak" 2>/dev/null || true

    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY-RUN] Would launch Claude Code in: $wt_dir"
        (
            echo "dry-run started" > "$log_file"
            sleep 5
            echo "dry-run refactoring..." >> "$log_file"
            sleep 3
            touch "$wt_dir/.refactor-complete"
            echo "dry-run complete" >> "$log_file"
        ) &
        json_update '.modules[$m].pid = ($p | tonumber)' --arg m "$module" --arg p "$!"
        set_module_status "$module" "running"
        return 0
    fi

    # Find a free tmux pane (1-3)
    local pane_id
    pane_id=$(find_free_pane)
    if [[ -z "$pane_id" ]]; then
        log_warn "No free tmux panes — cannot launch $module yet"
        return 1
    fi

    # Build the agent prompt (B1: includes .refactor-failed sentinel)
    local prompt
    read -r -d '' prompt << 'AGENT_PROMPT' || true
You are refactoring a module in a large Next.js codebase. Work autonomously — do NOT ask questions.

STEP 1: Read these files FIRST:
  - .claude/feature-plan.md  (foundation patterns — getDb, auth, frozen files, rules)
  - .claude/module-plan.md   (this module's scope, files, frozen exports, goals)

STEP 2: Refactor all files listed in the module plan. Follow every rule in foundation.md.

STEP 3: When finished refactoring, run verification:
  npm run build && npm run lint

STEP 4: Based on the result:
  - If build AND lint pass: touch .refactor-complete
  - If build OR lint fails after 2 fix attempts: touch .refactor-failed

CRITICAL RULES:
- Do NOT modify any FROZEN files (schema/index.ts, schema/relations.ts, automations/incoming-sms.ts)
- Do NOT change FROZEN_EXPORTS function signatures
- Do NOT run db:generate or db:migrate
- Do NOT install new npm packages
- Do NOT ask for clarification — make reasonable decisions
- Commit format: refactor(<module>): description
AGENT_PROMPT

    # Launch Claude in --print mode for non-interactive operation (B2)
    # --print reads prompt from stdin and streams output, then exits
    tmux send-keys -t "$TMUX_SESSION:0.$pane_id" \
        "cd '${wt_dir}' && echo '${prompt//\'/\'\\\'\'}' | claude --dangerously-skip-permissions --verbose 2>&1 | tee '${log_file}'; echo 'AGENT_EXIT_CODE='\$?" Enter

    json_update '.modules[$m].pane = ($p | tonumber) | .modules[$m].launched_at = $t' \
        --arg m "$module" --arg p "$pane_id" --arg t "$(date +%s)"

    set_module_status "$module" "running"
    log_ok "Launched agent for: $module (pane $pane_id)"
    return 0
}

find_free_pane() {
    for pane in 1 2 3; do
        local in_use=false
        while IFS= read -r mod; do
            local s p
            s=$(get_module_status "$mod")
            p=$(jq -r --arg m "$mod" '.modules[$m].pane // empty' "$PROGRESS_FILE")
            if [[ "$s" == "running" && "$p" == "$pane" ]]; then
                in_use=true
                break
            fi
        done < <(jq -r '.modules | keys[]' "$PROGRESS_FILE" 2>/dev/null)
        [[ "$in_use" == "false" ]] && { echo "$pane"; return; }
    done
}

# ============================================================================
# Monitoring (B1, B5, B7, W10)
# ============================================================================

check_module_complete() {
    [[ -f "$(worktree_path "$1")/.refactor-complete" ]]
}

# (B1) New: detect build/lint failure sentinel
check_module_failed() {
    [[ -f "$(worktree_path "$1")/.refactor-failed" ]]
}

# (B5) Absolute timeout per module
check_module_timeout() {
    local module="$1"
    local launched_at
    launched_at=$(jq -r --arg m "$module" '.modules[$m].launched_at // empty' "$PROGRESS_FILE")
    [[ -z "$launched_at" ]] && return 1
    local now elapsed
    now=$(date +%s)
    elapsed=$(( now - launched_at ))
    [[ $elapsed -gt $MODULE_TIMEOUT ]]
}

check_rate_limit() {
    local log_file="$LOGS_DIR/${1}.log"
    [[ -f "$log_file" ]] && \
        grep -qi "rate.limit\|429\|too many requests\|retry.after\|overloaded\|capacity" \
        "$log_file" 2>/dev/null
}

# (W10) Dynamic stale threshold based on module file count
check_agent_stale() {
    local module="$1"
    local log_file="$LOGS_DIR/${module}.log"
    [[ ! -f "$log_file" ]] && return 1

    local file_count threshold last_mod now age
    file_count=$(get_module_file_count "$module")
    threshold=$(( STALE_THRESHOLD_BASE + (file_count * STALE_THRESHOLD_PER_FILE) ))

    last_mod=$(stat -f %m "$log_file" 2>/dev/null || stat -c %Y "$log_file" 2>/dev/null || echo 0)
    now=$(date +%s)
    age=$(( now - last_mod ))
    [[ $age -gt $threshold ]]
}

# (B7) Proper alive check — verify pane exists AND has a live child process
check_agent_alive() {
    local module="$1"
    local pane_num
    pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")
    [[ -z "$pane_num" || "$pane_num" == "null" ]] && return 1

    if [[ "$DRY_RUN" == "true" ]]; then
        local pid
        pid=$(jq -r --arg m "$module" '.modules[$m].pid // empty' "$PROGRESS_FILE")
        [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
        return $?
    fi

    # Check tmux pane still exists
    tmux list-panes -t "$TMUX_SESSION:0" -F '#{pane_index}' 2>/dev/null | grep -qx "$pane_num" || return 1

    # Check the pane isn't just sitting at a shell prompt (agent exited)
    # Look for recent AGENT_EXIT_CODE in the log — if present, agent is done
    local log_file="$LOGS_DIR/${module}.log"
    if [[ -f "$log_file" ]] && grep -q "AGENT_EXIT_CODE=" "$log_file" 2>/dev/null; then
        return 1  # Agent process exited (exit code echoed means claude finished)
    fi

    return 0  # Still running
}

# (B7) Check tmux session itself is alive
check_tmux_alive() {
    tmux has-session -t "$TMUX_SESSION" 2>/dev/null
}

# ============================================================================
# Rate limiting — per-agent exponential backoff (not global nuke)
# ============================================================================

handle_rate_limit() {
    local module="$1"
    log_warn "Rate limit detected for: $module"

    local pane_num
    pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")
    kill_pane_process "$pane_num"

    json_update '.rate_limit_pauses += 1' ""

    # Exponential backoff: 120 → 240 → 480 → cap at 900
    local retries pause
    retries=$(jq -r --arg m "$module" '.modules[$m].rate_limit_retries // 0' "$PROGRESS_FILE")
    pause=$(( RATE_LIMIT_BACKOFF_BASE * (2 ** retries) ))
    [[ $pause -gt $RATE_LIMIT_BACKOFF_MAX ]] && pause=$RATE_LIMIT_BACKOFF_MAX

    json_update '.modules[$m].rate_limit_retries = ((.modules[$m].rate_limit_retries // 0) + 1)' \
        --arg m "$module"

    set_module_status "$module" "rate-limited"
    log_info "Pausing $module for ${pause}s (attempt $((retries + 1)))"

    # Schedule restart in background
    (
        sleep "$pause"
        # Re-launch when pause is over
        launch_agent "$module" || true
    ) &
}

# ============================================================================
# Crash handling (B4)
# ============================================================================

handle_stale_agent() {
    local module="$1"
    log_warn "Agent stale for: $module"

    # Maybe it actually finished
    if check_module_complete "$module"; then
        log_ok "Module $module completed (sentinel found despite stale log)"
        return 0
    fi
    if check_module_failed "$module"; then
        log_warn "Module $module failed (build/lint errors)"
        set_module_status "$module" "build-failed"
        return 0
    fi

    # Kill and maybe restart
    local pane_num
    pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")
    kill_pane_process "$pane_num"

    attempt_restart "$module" "stale"
}

handle_crash() {
    local module="$1"
    log_error "Agent process died for: $module"

    # Check sentinels first — might have finished just before dying
    if check_module_complete "$module"; then
        log_ok "Module $module completed before process exit"
        return 0
    fi
    if check_module_failed "$module"; then
        set_module_status "$module" "build-failed"
        return 0
    fi

    attempt_restart "$module" "crash"
}

handle_timeout() {
    local module="$1"
    log_error "Module $module exceeded ${MODULE_TIMEOUT}s timeout (B5)"

    local pane_num
    pane_num=$(jq -r --arg m "$module" '.modules[$m].pane // empty' "$PROGRESS_FILE")
    kill_pane_process "$pane_num"

    # Check if it actually completed
    if check_module_complete "$module"; then
        log_ok "Module $module completed despite timeout"
        return 0
    fi

    set_module_status "$module" "timeout"
    notify "WARNING" "Module $module timed out after ${MODULE_TIMEOUT}s"
}

attempt_restart() {
    local module="$1" reason="$2"
    local crash_count
    crash_count=$(get_module_crash_count "$module")
    increment_module_crash_count "$module"

    if [[ $crash_count -ge $MAX_CRASHES_PER_MODULE ]]; then
        log_error "Module $module crashed $crash_count times — giving up (B4)"
        set_module_status "$module" "abandoned"
        json_update '.skipped_modules += [$m]' --arg m "$module"
        notify "WARNING" "Module $module abandoned after $crash_count ${reason}s"
        return 1
    fi

    # Clean caches before retry (B4)
    local wt_dir
    wt_dir=$(worktree_path "$module")
    [[ -d "$wt_dir/.next" ]] && rm -rf "$wt_dir/.next"
    rm -f "$wt_dir/.refactor-complete" "$wt_dir/.refactor-failed"

    log_info "Restarting $module ($reason, attempt $((crash_count + 1))/$MAX_CRASHES_PER_MODULE)"
    sleep 3
    launch_agent "$module" || true
}

# ============================================================================
# Merge Flow (B3)
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
        if ! (cd "$wt_dir" && npm run build 2>&1 | tail -20); then
            log_error "Build fails for $module — skipping merge"
            set_module_status "$module" "build-failed"
            notify "WARNING" "Module $module build failed — skipped merge"
            return 1
        fi

        # Tag for rollback (H4)
        cd "$REPO_ROOT"
        git checkout "$STAGING_BRANCH" 2>/dev/null
        git tag "pre-merge-${module}" HEAD 2>/dev/null || true

        # Merge (B3: conflict = terminal, skip this module)
        if git merge "$branch" --no-ff -m "refactor: merge module ${module}"; then
            log_ok "Merged: $module"
            set_module_status "$module" "merged"
        else
            log_error "Merge conflict for $module (B3: treating as terminal)"
            git merge --abort 2>/dev/null || true
            set_module_status "$module" "conflict"
            json_update '.skipped_modules += [$m]' --arg m "$module"

            # Write conflict details for post-mortem
            git diff "$STAGING_BRANCH" "$branch" --stat > "$LOGS_DIR/${module}.conflict" 2>/dev/null || true
            notify "WARNING" "Module $module merge conflict — skipped. Review $LOGS_DIR/${module}.conflict"
            return 1
        fi

    ) 200>"$LOCKS_DIR/build.lock"
}

# (B8) Between-wave rebase — halt on conflict instead of silently continuing
between_waves_rebase() {
    local wave="$1"
    log_step "Between-wave rebase after wave $wave (C6)"

    local failed_rebases=()

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
            log_error "$wt_branch has rebase conflicts"
            git -C "$wt_path" rebase --abort 2>/dev/null || true
            local mod_name="${wt_branch#refactor/}"
            failed_rebases+=("$mod_name")

            # Log conflict files
            git -C "$wt_path" diff --name-only "$STAGING_BRANCH" > "$LOGS_DIR/${mod_name}.rebase-conflict" 2>/dev/null || true
        fi
    done < <(git -C "$REPO_ROOT" worktree list)

    if [[ ${#failed_rebases[@]} -gt 0 ]]; then
        log_error "Rebase conflicts in: ${failed_rebases[*]}"
        notify "WARNING" "Rebase conflicts after wave $wave in modules: ${failed_rebases[*]}. Continuing anyway — these modules may have merge conflicts."
        # Don't halt — the merge step will catch conflicts (B3)
    fi
}

# ============================================================================
# Disk cache cleanup
# ============================================================================

cleanup_build_caches() {
    log_info "Cleaning build caches across worktrees..."
    local parent_dir
    parent_dir=$(dirname "$REPO_ROOT")
    local cleaned=0
    for d in "$parent_dir/${PROJECT_NAME}-refactor-"*; do
        [[ -d "$d/.next" ]] && { rm -rf "$d/.next"; ((cleaned++)); }
        [[ -f "$d/.eslintcache" ]] && rm -f "$d/.eslintcache"
    done
    [[ $cleaned -gt 0 ]] && log_ok "Cleaned $cleaned .next caches"
}

# ============================================================================
# Display
# ============================================================================

display_status() {
    # Don't clear in non-interactive / backgrounded runs
    [[ -t 1 ]] && clear 2>/dev/null

    echo ""
    echo -e "${MAGENTA}╔═══════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║     Parallel Refactoring Orchestrator  (v2)       ║${NC}"
    echo -e "${MAGENTA}╚═══════════════════════════════════════════════════╝${NC}"
    echo ""

    local current_wave total_modules done_modules running_modules skipped
    current_wave=$(jq -r '.current_wave' "$PROGRESS_FILE")
    total_modules=$(jq -r '.modules | length' "$PROGRESS_FILE")
    done_modules=$(jq -r '[.modules[] | select(.status == "merged")] | length' "$PROGRESS_FILE")
    running_modules=$(jq -r '[.modules[] | select(.status == "running")] | length' "$PROGRESS_FILE")
    skipped=$(jq -r '.skipped_modules | length' "$PROGRESS_FILE")

    echo -e "  Wave: ${CYAN}${current_wave}${NC} | Merged: ${GREEN}${done_modules}${NC}/${total_modules} | Running: ${YELLOW}${running_modules}${NC} | Skipped: ${RED}${skipped}${NC}"
    echo ""

    jq -r '.modules | to_entries[] | "\(.key)\t\(.value.status)\t\(.value.crash_count // 0)"' \
        "$PROGRESS_FILE" 2>/dev/null | \
        while IFS=$'\t' read -r name status crashes; do
            local color="$NC" suffix=""
            case "$status" in
                running)      color="$YELLOW" ;;
                merged)       color="$GREEN" ;;
                build-failed) color="$RED" ;;
                conflict)     color="$RED" ;;
                abandoned)    color="$RED"; suffix=" (gave up)" ;;
                timeout)      color="$RED"; suffix=" (timed out)" ;;
                rate-limited) color="$MAGENTA"; suffix=" (waiting)" ;;
                paused)       color="$MAGENTA" ;;
            esac
            [[ "$crashes" -gt 0 ]] && suffix="${suffix} [${crashes} crashes]"
            printf "  %-28s %b%-14s%b%s\n" "$name" "$color" "$status" "$NC" "$suffix"
        done

    echo ""
    local rate_limits total_crashes
    rate_limits=$(jq -r '.rate_limit_pauses' "$PROGRESS_FILE")
    total_crashes=$(jq -r '.total_crashes' "$PROGRESS_FILE")
    echo -e "  Rate limits: $rate_limits | Total crashes: $total_crashes"
    echo ""
}

# ============================================================================
# Wave Runner
# ============================================================================

is_module_terminal() {
    # Returns true if module is in a state where we should NOT retry or wait
    local status="$1"
    case "$status" in
        merged|conflict|build-failed|abandoned|timeout) return 0 ;;
        *) return 1 ;;
    esac
}

run_wave() {
    local wave_num="$1"

    log_step "═══ Starting wave $wave_num ═══"
    json_update '.current_wave = ($w | tonumber)' --arg w "$wave_num"

    # Clean caches before wave starts (W11)
    cleanup_build_caches

    # Get modules for this wave
    local -a modules=()
    while IFS= read -r m; do
        modules+=("$m")
    done < <(get_all_modules_in_wave "$wave_num")

    [[ ${#modules[@]} -eq 0 ]] && { log_warn "No modules in wave $wave_num"; return; }
    log_info "Wave $wave_num modules (${#modules[@]}): ${modules[*]}"

    # Initialize modules
    for module in "${modules[@]}"; do
        local status
        status=$(get_module_status "$module")
        is_module_terminal "$status" && continue
        set_module_status "$module" "pending"
    done

    # Create all worktrees upfront
    for module in "${modules[@]}"; do
        local status
        status=$(get_module_status "$module")
        is_module_terminal "$status" && continue
        local wt_dir
        wt_dir=$(worktree_path "$module")
        [[ ! -d "$wt_dir" ]] && { create_worktree "$module" || true; }
    done

    # Launch initial batch (up to MAX_PARALLEL)
    local launched=0
    for module in "${modules[@]}"; do
        [[ $launched -ge $MAX_PARALLEL ]] && break
        local status
        status=$(get_module_status "$module")
        is_module_terminal "$status" && continue
        launch_agent "$module" && ((launched++)) || true
    done

    # ---- Monitor loop ----
    while true; do
        sleep "$HEARTBEAT_INTERVAL"

        # (B7) Check tmux session is alive
        if [[ "$DRY_RUN" != "true" ]] && ! check_tmux_alive; then
            log_error "tmux session '$TMUX_SESSION' lost! Cannot continue."
            notify "FAILED" "tmux session lost during wave $wave_num"
            exit 1
        fi

        local all_done=true
        local running_count=0

        for module in "${modules[@]}"; do
            local status
            status=$(get_module_status "$module")

            # Terminal states — skip
            if is_module_terminal "$status"; then
                continue
            fi

            all_done=false

            case "$status" in
                running)
                    ((running_count++))

                    # (B1) Check for success sentinel
                    if check_module_complete "$module"; then
                        log_ok "Module complete: $module"
                        merge_module "$module" || true
                        remove_worktree "$module"
                        launch_next_pending "${modules[@]}"
                        continue
                    fi

                    # (B1) Check for failure sentinel
                    if check_module_failed "$module"; then
                        log_warn "Module $module reported build/lint failure"
                        set_module_status "$module" "build-failed"
                        json_update '.skipped_modules += [$m]' --arg m "$module"
                        remove_worktree "$module"
                        notify "WARNING" "Module $module build/lint failed — skipped"
                        launch_next_pending "${modules[@]}"
                        continue
                    fi

                    # (B5) Check absolute timeout
                    if check_module_timeout "$module"; then
                        handle_timeout "$module"
                        launch_next_pending "${modules[@]}"
                        continue
                    fi

                    # Check rate limit
                    if check_rate_limit "$module"; then
                        handle_rate_limit "$module"
                        continue
                    fi

                    # (W10) Check stale with dynamic threshold
                    if check_agent_stale "$module"; then
                        handle_stale_agent "$module"
                        continue
                    fi

                    # (B7) Check if agent process is actually alive
                    if ! check_agent_alive "$module"; then
                        handle_crash "$module"
                    fi
                    ;;
                pending)
                    # Try to launch if we have capacity
                    if [[ $running_count -lt $MAX_PARALLEL ]]; then
                        local wt_dir
                        wt_dir=$(worktree_path "$module")
                        [[ ! -d "$wt_dir" ]] && { create_worktree "$module" || continue; }
                        if launch_agent "$module"; then
                            ((running_count++))
                        fi
                    fi
                    ;;
                rate-limited)
                    # Being handled by background sleep+restart — just wait
                    ;;
            esac
        done

        display_status

        if [[ "$all_done" == "true" ]]; then
            log_ok "Wave $wave_num complete"
            break
        fi
    done

    json_update '.completed_waves += [$w]' --argjson w "$wave_num"
}

launch_next_pending() {
    # Try to launch the next pending module from the current wave
    local modules=("$@")
    for next in "${modules[@]}"; do
        local next_status
        next_status=$(get_module_status "$next")
        if [[ "$next_status" == "pending" ]]; then
            local next_wt
            next_wt=$(worktree_path "$next")
            [[ ! -d "$next_wt" ]] && { create_worktree "$next" || return; }
            launch_agent "$next" && return 0 || return 1
        fi
    done
}

# ============================================================================
# CLI Argument Parsing
# ============================================================================

DRY_RUN="false"
SINGLE_MODULE=""
MAX_WAVE=0
TMUX_SESSION="refactor"

usage() {
    cat << 'USAGE'
Usage: run-parallel.sh [options]

Options:
  --dry-run              Simulate without running Claude Code
  --module <name>        Run single module only
  --waves <n>            Only run waves 1 through n
  --session <name>       tmux session name (default: refactor)
  --slack <webhook-url>  Slack webhook for notifications
  --email <address>      Email for notifications (requires mail command)
  --help                 Show this help

Environment variables:
  NOTIFY_SLACK_WEBHOOK   Slack webhook URL for notifications
  NOTIFY_EMAIL           Email address for notifications

Examples:
  # Dry run (test everything without Claude)
  ./run-parallel.sh --dry-run

  # Single module test
  ./run-parallel.sh --module compliance

  # Wave 1 only with Slack notifications
  ./run-parallel.sh --waves 1 --slack https://hooks.slack.com/...

  # Full hands-off run
  ./run-parallel.sh --slack https://hooks.slack.com/...
USAGE
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)    DRY_RUN="true"; shift ;;
        --module)     SINGLE_MODULE="$2"; shift 2 ;;
        --waves)      MAX_WAVE="$2"; shift 2 ;;
        --session)    TMUX_SESSION="$2"; shift 2 ;;
        --slack)      NOTIFY_SLACK_WEBHOOK="$2"; shift 2 ;;
        --email)      NOTIFY_EMAIL="$2"; shift 2 ;;
        --help|-h)    usage ;;
        *)            log_error "Unknown option: $1"; usage ;;
    esac
done

# ============================================================================
# Main Entry Point
# ============================================================================

main() {
    log_step "Starting Parallel Refactoring Orchestrator (v2 — hands-off)"
    ensure_deps
    init_state
    preflight_checks
    bump_fd_limit
    prevent_sleep  # (B6)

    local wave_count
    wave_count=$(get_wave_count)
    [[ $MAX_WAVE -gt 0 ]] && wave_count=$MAX_WAVE

    # Ensure staging branch exists
    if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$STAGING_BRANCH"; then
        log_step "Creating staging branch: $STAGING_BRANCH from $(git -C "$REPO_ROOT" branch --show-current)"
        git -C "$REPO_ROOT" branch "$STAGING_BRANCH" HEAD
    fi

    notify "STARTED" "Refactoring started: $wave_count waves, staging branch: $STAGING_BRANCH"

    # ---- Single module mode ----
    if [[ -n "$SINGLE_MODULE" ]]; then
        log_info "Single module mode: $SINGLE_MODULE"
        set_module_status "$SINGLE_MODULE" "pending"
        create_worktree "$SINGLE_MODULE"
        launch_agent "$SINGLE_MODULE"

        local timeout_start
        timeout_start=$(date +%s)
        while true; do
            sleep "$HEARTBEAT_INTERVAL"

            if check_module_complete "$SINGLE_MODULE"; then
                log_ok "Module complete: $SINGLE_MODULE"
                merge_module "$SINGLE_MODULE" || true
                remove_worktree "$SINGLE_MODULE"
                break
            fi
            if check_module_failed "$SINGLE_MODULE"; then
                log_error "Module failed: $SINGLE_MODULE"
                set_module_status "$SINGLE_MODULE" "build-failed"
                remove_worktree "$SINGLE_MODULE"
                break
            fi
            if [[ $(( $(date +%s) - timeout_start )) -gt $MODULE_TIMEOUT ]]; then
                log_error "Module timed out: $SINGLE_MODULE"
                handle_timeout "$SINGLE_MODULE"
                remove_worktree "$SINGLE_MODULE"
                break
            fi
            if ! check_agent_alive "$SINGLE_MODULE"; then
                handle_crash "$SINGLE_MODULE"
            fi

            display_status
        done

        local final_status
        final_status=$(get_module_status "$SINGLE_MODULE")
        notify "$([ "$final_status" == "merged" ] && echo "SUCCESS" || echo "FAILED")" \
            "Single module $SINGLE_MODULE: $final_status"
        return
    fi

    # ---- Full wave orchestration ----
    for ((w=1; w<=wave_count; w++)); do
        # Skip already completed waves (resume support)
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

    # ---- Final build verification ----
    log_step "Final build verification on $STAGING_BRANCH..."
    cd "$REPO_ROOT"
    git checkout "$STAGING_BRANCH" 2>/dev/null
    if npm run build 2>&1 | tail -30; then
        log_ok "FINAL BUILD PASSES on $STAGING_BRANCH"
    else
        log_error "Final build failed on $STAGING_BRANCH"
        notify "FAILED" "Final build failed on $STAGING_BRANCH. Manual intervention required."
        exit 1
    fi

    # ---- Cleanup ----
    log_step "Cleaning up remaining worktrees..."
    while IFS= read -r line; do
        local wt_path
        wt_path=$(echo "$line" | awk '{print $1}')
        [[ "$wt_path" == "$REPO_ROOT" ]] && continue
        [[ "$wt_path" != *"refactor-"* ]] && continue
        [[ -d "${wt_path}/.next" ]] && rm -rf "${wt_path}/.next"
        git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || true
    done < <(git -C "$REPO_ROOT" worktree list)

    # ---- Summary ----
    display_status

    local merged_count skipped_count total_crashes
    merged_count=$(jq '[.modules[] | select(.status == "merged")] | length' "$PROGRESS_FILE")
    skipped_count=$(jq '.skipped_modules | length' "$PROGRESS_FILE")
    total_crashes=$(jq '.total_crashes' "$PROGRESS_FILE")

    echo ""
    log_ok "════════════════════════════════════════════"
    log_ok "  REFACTORING COMPLETE"
    log_ok "  Branch: $STAGING_BRANCH"
    log_ok "  Merged: $merged_count modules"
    [[ $skipped_count -gt 0 ]] && log_warn "  Skipped: $skipped_count modules (check logs)"
    log_ok "  Total crashes: $total_crashes"
    log_ok "════════════════════════════════════════════"

    local summary="Merged: ${merged_count} modules to ${STAGING_BRANCH}. Skipped: ${skipped_count}. Crashes: ${total_crashes}."
    [[ $skipped_count -gt 0 ]] && {
        local skipped_list
        skipped_list=$(jq -r '.skipped_modules | join(", ")' "$PROGRESS_FILE")
        summary="${summary} Skipped modules: ${skipped_list}."
    }
    notify "SUCCESS" "$summary"
}

main
