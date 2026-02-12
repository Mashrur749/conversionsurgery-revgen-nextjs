#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# Worktree Manager — Git operations for parallel feature development
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECT_NAME="$(basename "$REPO_ROOT")"
TEMPLATES_DIR="$REPO_ROOT/.claude/templates"
PLANS_DIR="$REPO_ROOT/.claude/plans"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "${CYAN}[STEP]${NC} $*"; }

get_main_branch() {
    if git -C "$REPO_ROOT" show-ref --verify --quiet refs/heads/main; then echo "main"
    elif git -C "$REPO_ROOT" show-ref --verify --quiet refs/heads/master; then echo "master"
    else log_error "No main or master branch found."; exit 1; fi
}

worktree_dir() { echo "${REPO_ROOT}/../${PROJECT_NAME}-${1}-slice-${2}"; }
branch_name()  { echo "feature/${1}/slice-${2}"; }

# ---- create ----
cmd_create() {
    local feature="${1:?Usage: create <feature> <slice-num> \"<description>\"}"
    local slice_num="${2:?}" description="${3:?}"
    local wt_dir branch main_branch
    wt_dir=$(worktree_dir "$feature" "$slice_num")
    branch=$(branch_name "$feature" "$slice_num")
    main_branch=$(get_main_branch)

    [[ -d "$wt_dir" ]] && { log_error "Worktree exists: $wt_dir"; exit 1; }

    log_step "Creating worktree ${feature}/slice-${slice_num}..."

    git -C "$REPO_ROOT" fetch origin "$main_branch" 2>/dev/null || true
    git -C "$REPO_ROOT" checkout "$main_branch" 2>/dev/null || true
    git -C "$REPO_ROOT" pull origin "$main_branch" 2>/dev/null || true
    git -C "$REPO_ROOT" worktree add "$wt_dir" -b "$branch"

    if [[ -f "$TEMPLATES_DIR/slice-claude.md" ]]; then
        sed -e "s|{{FEATURE_NAME}}|$feature|g" \
            -e "s|{{SLICE_NUMBER}}|$slice_num|g" \
            -e "s|{{SLICE_DESCRIPTION}}|$description|g" \
            -e "s|{{BRANCH_NAME}}|$branch|g" \
            "$TEMPLATES_DIR/slice-claude.md" > "$wt_dir/CLAUDE.md"
        log_ok "Generated CLAUDE.md"
    fi

    if [[ -f "$PLANS_DIR/${feature}.md" ]]; then
        mkdir -p "$wt_dir/.claude"
        cp "$PLANS_DIR/${feature}.md" "$wt_dir/.claude/feature-plan.md"
        log_ok "Copied feature plan"
    fi

    # Symlink node_modules from main repo (C1: saves ~2.8GB per worktree)
    if [[ -d "$REPO_ROOT/node_modules" && ! -e "$wt_dir/node_modules" ]]; then
        ln -s "$REPO_ROOT/node_modules" "$wt_dir/node_modules"
        log_ok "Symlinked node_modules (saves ~2.8GB)"
    elif [[ -e "$wt_dir/node_modules" ]]; then
        log_info "node_modules already exists in worktree"
    else
        log_warn "No node_modules in main repo — run npm install in main repo first"
    fi

    echo ""
    log_ok "✅ Ready: $wt_dir"
    log_info "Branch: $branch"
    log_info "Next: cd $wt_dir && claude"
}

# ---- list ----
cmd_list() {
    echo ""; log_info "Active worktrees:"
    echo "────────────────────────────────────────"
    if [[ -n "${1:-}" ]]; then
        git -C "$REPO_ROOT" worktree list | grep "$1" || log_warn "None found for: $1"
    else git -C "$REPO_ROOT" worktree list; fi
    echo ""
}

# ---- review ----
cmd_review() {
    local feature="${1:?}" slice_num="${2:?}"
    local wt_dir main_branch
    wt_dir=$(worktree_dir "$feature" "$slice_num")
    main_branch=$(get_main_branch)

    [[ ! -d "$wt_dir" ]] && { log_error "Not found: $wt_dir"; exit 1; }

    mkdir -p "$wt_dir/.claude"
    local diff_file="$wt_dir/.claude/review-diff.patch"
    local review_file="$wt_dir/.claude/review-checklist.md"

    git -C "$wt_dir" diff "${main_branch}...HEAD" > "$diff_file"
    local lines_changed files_changed
    lines_changed=$(wc -l < "$diff_file" | tr -d ' ')
    files_changed=$(git -C "$wt_dir" diff "${main_branch}...HEAD" --name-only)

    cat > "$review_file" << EOF
# Review — ${feature}/slice-${slice_num}

**Branch:** $(branch_name "$feature" "$slice_num")
**Lines:** ${lines_changed}
**Files:**
${files_changed}

---

## Scope
- [ ] All changes within declared scope
- [ ] No out-of-scope files
- [ ] No unrelated changes

## Project Patterns
- [ ] getDb() per request, not cached
- [ ] Auth checks on API routes (admin check on /api/admin/*)
- [ ] API params awaited (Next.js 16 Promise params)
- [ ] Phone numbers via normalizePhoneNumber()
- [ ] Zod validation on API input, 400 with details
- [ ] Schema: one table per file, re-exported from index
- [ ] No .env reads or modifications

## Code Quality
- [ ] No \`any\` types
- [ ] No hardcoded values
- [ ] No duplicated logic
- [ ] Functions reasonably sized
- [ ] Error handling on async ops

## Tests
- [ ] Happy path covered
- [ ] At least 1 failure/edge case
- [ ] Tests pass independently

## Cleanup
- [ ] No console.log / TODO / FIXME
- [ ] No commented-out code
- [ ] Clean imports

## Integration
- [ ] Won't break existing if merged alone
- [ ] Contract matches other slices' expectations
- [ ] Migrations reversible (if any)

---

## Notes
> _Findings here_
EOF

    log_ok "Diff: $diff_file ($lines_changed lines)"
    log_ok "Checklist: $review_file"
}

# ---- merge ----
cmd_merge() {
    local feature="${1:?}" slice_num="${2:?}"
    local wt_dir branch main_branch
    wt_dir=$(worktree_dir "$feature" "$slice_num")
    branch=$(branch_name "$feature" "$slice_num")
    main_branch=$(get_main_branch)

    [[ ! -d "$wt_dir" ]] && { log_error "Not found: $wt_dir"; exit 1; }
    git -C "$wt_dir" diff --quiet HEAD 2>/dev/null || { log_error "Uncommitted changes in worktree"; exit 1; }

    log_step "Merging ${branch} → ${main_branch}..."

    # Pre-merge: verify build in worktree first (M4)
    log_step "Pre-merge build verification in worktree..."
    if ! (cd "$wt_dir" && npm run build 2>/dev/null); then
        log_error "Build fails in worktree — fix before merging"
        exit 1
    fi
    log_ok "Worktree build passes"

    cd "$REPO_ROOT"
    git checkout "$main_branch"
    git pull origin "$main_branch" 2>/dev/null || true

    # Pre-merge: tag for rollback (H4)
    git tag "pre-merge-${feature}-slice-${slice_num}" HEAD 2>/dev/null || true
    log_ok "Tagged pre-merge state for rollback"

    if git merge "$branch" --no-ff -m "feat: merge ${feature}/slice-${slice_num}"; then
        log_ok "✅ Merged"
        log_step "Verifying build..."
        if npm run build 2>/dev/null; then
            log_ok "Build passes"
        else
            log_warn "Build failed! Rollback: git reset --hard pre-merge-${feature}-slice-${slice_num}"
            exit 1
        fi
    else
        log_error "Merge conflict — resolve manually"
        exit 1
    fi

    echo ""
    log_info "Next:"
    echo "  git push origin ${main_branch}"
    echo "  bash .claude/scripts/worktree-manager.sh rebase-all ${feature}"
    echo "  bash .claude/scripts/worktree-manager.sh cleanup-slice ${feature} ${slice_num}"
}

# ---- rebase-all ----
cmd_rebase_all() {
    local feature="${1:?}" main_branch
    main_branch=$(get_main_branch)

    log_step "Rebasing all ${feature} worktrees..."
    git -C "$REPO_ROOT" fetch origin "$main_branch" 2>/dev/null || true

    local failed=0
    while IFS= read -r line; do
        local wt_path
        wt_path=$(echo "$line" | awk '{print $1}')
        [[ "$wt_path" == "$REPO_ROOT" || "$wt_path" != *"$feature"* ]] && continue

        local wt_branch
        wt_branch=$(git -C "$wt_path" branch --show-current 2>/dev/null || echo "?")
        log_step "Rebasing $wt_branch..."

        if git -C "$wt_path" rebase "origin/${main_branch}" 2>/dev/null; then
            log_ok "$wt_branch rebased"
        else
            log_error "$wt_branch has conflicts — resolve in $wt_path"
            git -C "$wt_path" rebase --abort 2>/dev/null || true
            ((failed++))
        fi
    done < <(git -C "$REPO_ROOT" worktree list)

    [[ $failed -gt 0 ]] && log_warn "$failed worktree(s) had conflicts" || log_ok "✅ All rebased"
}

# ---- status ----
cmd_status() {
    local feature="${1:-}" main_branch
    main_branch=$(get_main_branch)

    echo ""
    echo "╔═══════════════════════════════════════════╗"
    echo "║       Worktree Development Status          ║"
    echo "╚═══════════════════════════════════════════╝"
    echo ""

    while IFS= read -r line; do
        local wt_path
        wt_path=$(echo "$line" | awk '{print $1}')
        [[ -n "$feature" && "$wt_path" != *"$feature"* ]] && continue

        local wt_branch commits files dirty=""
        wt_branch=$(git -C "$wt_path" branch --show-current 2>/dev/null || echo "detached")
        commits=$(git -C "$wt_path" rev-list "${main_branch}..HEAD" --count 2>/dev/null || echo "?")
        files=$(git -C "$wt_path" diff "${main_branch}...HEAD" --name-only 2>/dev/null | wc -l | tr -d ' ')
        git -C "$wt_path" diff --quiet HEAD 2>/dev/null || dirty=" ${YELLOW}(dirty)${NC}"

        echo -e "  ${CYAN}${wt_branch}${NC}${dirty}"
        echo "    Path: $wt_path"
        echo "    Commits: $commits ahead | Files: $files changed"
        echo ""
    done < <(git -C "$REPO_ROOT" worktree list)
}

# ---- cleanup-slice ----
cmd_cleanup_slice() {
    local feature="${1:?}" slice_num="${2:?}"
    local wt_dir branch
    wt_dir=$(worktree_dir "$feature" "$slice_num")
    branch=$(branch_name "$feature" "$slice_num")

    # Clean up .next build cache before removing worktree
    [[ -d "$wt_dir/.next" ]] && { rm -rf "$wt_dir/.next"; log_ok "Cleaned .next cache"; }
    [[ -d "$wt_dir" ]] && { git -C "$REPO_ROOT" worktree remove "$wt_dir" --force; log_ok "Worktree removed"; }
    git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/$branch" && { git -C "$REPO_ROOT" branch -D "$branch"; log_ok "Branch deleted"; }
}

# ---- cleanup ----
cmd_cleanup() {
    local feature="${1:?}"
    log_step "Cleaning up: $feature"

    while IFS= read -r line; do
        local wt_path
        wt_path=$(echo "$line" | awk '{print $1}')
        [[ "$wt_path" == "$REPO_ROOT" || "$wt_path" != *"$feature"* ]] && continue
        git -C "$REPO_ROOT" worktree remove "$wt_path" --force 2>/dev/null || log_warn "Could not remove $wt_path"
    done < <(git -C "$REPO_ROOT" worktree list)

    while IFS= read -r branch; do
        branch=$(echo "$branch" | tr -d ' *')
        [[ -z "$branch" ]] && continue
        git -C "$REPO_ROOT" branch -D "$branch" 2>/dev/null && log_ok "Deleted: $branch"
    done < <(git -C "$REPO_ROOT" branch --list "feature/${feature}/*" 2>/dev/null)

    rm -f "$PLANS_DIR/${feature}.md"
    log_ok "✅ Done"
}

# ---- create-refactor ----
# Creates a worktree for refactoring a module (used by run-parallel.sh)
# Usage: create-refactor <module-name> <staging-branch>
cmd_create_refactor() {
    local module="${1:?Usage: create-refactor <module-name> <staging-branch>}"
    local staging_branch="${2:-claude-main}"
    local wt_dir branch
    wt_dir="${REPO_ROOT}/../${PROJECT_NAME}-refactor-${module}"
    branch="refactor/${module}"

    [[ -d "$wt_dir" ]] && { log_error "Worktree exists: $wt_dir"; exit 1; }

    log_step "Creating refactor worktree for module: ${module}..."

    # Ensure staging branch exists
    if ! git -C "$REPO_ROOT" show-ref --verify --quiet "refs/heads/${staging_branch}"; then
        log_step "Creating staging branch: ${staging_branch}"
        local main_branch
        main_branch=$(get_main_branch)
        git -C "$REPO_ROOT" branch "$staging_branch" "$main_branch"
    fi

    # Create worktree from staging branch
    git -C "$REPO_ROOT" worktree add "$wt_dir" -b "$branch" "$staging_branch"

    # Symlink node_modules (C1)
    if [[ -d "$REPO_ROOT/node_modules" && ! -e "$wt_dir/node_modules" ]]; then
        ln -s "$REPO_ROOT/node_modules" "$wt_dir/node_modules"
        log_ok "Symlinked node_modules"
    fi

    # Copy foundation doc
    mkdir -p "$wt_dir/.claude"
    if [[ -f "$PLANS_DIR/foundation.md" ]]; then
        cp "$PLANS_DIR/foundation.md" "$wt_dir/.claude/feature-plan.md"
        log_ok "Copied foundation.md"
    fi

    # Copy module plan
    if [[ -f "$PLANS_DIR/modules/${module}.md" ]]; then
        cp "$PLANS_DIR/modules/${module}.md" "$wt_dir/.claude/module-plan.md"
        log_ok "Copied module plan: ${module}.md"
    else
        log_warn "Module plan not found: $PLANS_DIR/modules/${module}.md"
    fi

    # Generate CLAUDE.md from refactoring template
    if [[ -f "$TEMPLATES_DIR/slice-claude-refactor.md" ]]; then
        local file_manifest="" frozen_exports=""

        # Extract file manifest from module plan (awk for macOS/Linux compat)
        if [[ -f "$PLANS_DIR/modules/${module}.md" ]]; then
            file_manifest=$(awk '/^## FILE MANIFEST/{found=1; next} /^## /{found=0} found' "$PLANS_DIR/modules/${module}.md")
            frozen_exports=$(awk '/^## FROZEN_EXPORTS/{found=1; next} /^## /{found=0} found' "$PLANS_DIR/modules/${module}.md")
        fi

        # Generate CLAUDE.md — write multiline vars to temp files for reliable substitution
        local tmp_files tmp_exports
        tmp_files=$(mktemp)
        tmp_exports=$(mktemp)
        printf '%s\n' "$file_manifest" > "$tmp_files"
        printf '%s\n' "$frozen_exports" > "$tmp_exports"

        awk -v module="$module" -v branch="$branch" \
            -v fmanifest="$tmp_files" -v fexports="$tmp_exports" '
        {
            gsub(/\{\{MODULE_NAME\}\}/, module)
            gsub(/\{\{BRANCH_NAME\}\}/, branch)
            if (index($0, "{{FILE_MANIFEST}}")) { while ((getline line < fmanifest) > 0) print line; next }
            if (index($0, "{{FROZEN_EXPORTS}}")) { while ((getline line < fexports) > 0) print line; next }
            print
        }' "$TEMPLATES_DIR/slice-claude-refactor.md" > "$wt_dir/CLAUDE.md"

        rm -f "$tmp_files" "$tmp_exports"
        log_ok "Generated refactoring CLAUDE.md"
    fi

    echo ""
    log_ok "✅ Refactor worktree ready: $wt_dir"
    log_info "Branch: $branch"
    log_info "Foundation: .claude/feature-plan.md"
    log_info "Module plan: .claude/module-plan.md"
    log_info "Next: cd $wt_dir && claude"
}

# ---- router ----
case "${1:-help}" in
    create)          shift; cmd_create "$@" ;;
    create-refactor) shift; cmd_create_refactor "$@" ;;
    list)            shift; cmd_list "$@" ;;
    review)          shift; cmd_review "$@" ;;
    merge)           shift; cmd_merge "$@" ;;
    rebase-all)      shift; cmd_rebase_all "$@" ;;
    status)          shift; cmd_status "$@" ;;
    cleanup-slice)   shift; cmd_cleanup_slice "$@" ;;
    cleanup)         shift; cmd_cleanup "$@" ;;
    *) echo "Usage: bash .claude/scripts/worktree-manager.sh <command> [args]"
       echo "Commands: create, create-refactor, list, review, merge, rebase-all, status, cleanup-slice, cleanup" ;;
esac
