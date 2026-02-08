# Claude Code Spec Runner

Automated hands-free implementation of spec files using Claude Code, with rate limit handling and progress tracking.

## Features

- ✅ Sequential spec implementation
- ✅ Progress tracking (survives restarts)
- ✅ Automatic rate limit detection and waiting
- ✅ Detailed logging per spec
- ✅ tmux support for background execution
- ✅ Resume from where you left off

## Setup

1. **Copy files to your project:**
   ```bash
   cp run-specs.sh start-tmux.sh /path/to/your/project/
   chmod +x /path/to/your/project/*.sh
   ```

2. **Ensure your specs are in `implementation_docs/`:**
   ```
   your-project/
   ├── implementation_docs/
   │   ├── 01-admin-schema-auth.md
   │   ├── 02-admin-ui-components.md
   │   └── ... (35 total)
   ├── run-specs.sh
   └── start-tmux.sh
   ```

3. **Install dependencies:**
   ```bash
   # Required
   sudo apt install jq tmux
   
   # Claude Code must be installed and authenticated
   claude --version
   ```

## Usage

### Quick Start (Recommended)

```bash
cd /path/to/your/project

# Start in tmux (background, survives disconnect)
./start-tmux.sh

# Watch progress
tmux attach -t claude-runner

# Detach (keeps running): Ctrl+B, then D
```

### Direct Execution

```bash
cd /path/to/your/project

# Run directly (blocks terminal)
./run-specs.sh

# Or with custom paths
SPECS_DIR=./my-specs ./run-specs.sh
```

### Commands

```bash
# Check current progress
./run-specs.sh status

# Resume from last position
./run-specs.sh resume

# Skip current spec and move to next
./run-specs.sh skip

# Reset progress (start over from spec 1)
./run-specs.sh reset
```

## How It Works

### Progress Tracking

Progress is stored in `.claude-progress.json`:

```json
{
  "current_spec": 5,
  "completed": ["01-admin-schema-auth", "02-admin-ui-components", ...],
  "failed": [],
  "started_at": "2026-02-08T12:00:00Z",
  "last_updated": "2026-02-08T14:30:00Z"
}
```

### Rate Limit Handling

When Claude Code hits its usage limit:

1. Script detects rate limit error in output
2. Extracts wait time if provided (or defaults to 1 hour)
3. Saves state to progress file
4. Sleeps until reset time
5. Resumes automatically

### Logging

Each spec implementation is logged to `.claude-logs/`:

```
.claude-logs/
├── 01-admin-schema-auth-20260208-120000.log
├── 02-admin-ui-components-20260208-123000.log
└── ...
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PROJECT_DIR` | Current directory | Project root |
| `SPECS_DIR` | `$PROJECT_DIR/implementation_docs` | Spec files location |
| `PROGRESS_FILE` | `$PROJECT_DIR/.claude-progress.json` | Progress tracking |
| `LOG_DIR` | `$PROJECT_DIR/.claude-logs` | Log file directory |
| `RATE_LIMIT_WAIT` | `3600` (1 hour) | Default wait on rate limit |

Example with custom config:

```bash
SPECS_DIR=./docs RATE_LIMIT_WAIT=1800 ./run-specs.sh
```

## Monitoring

### Watch real-time progress

```bash
# If running in tmux
tmux attach -t claude-runner

# Or tail the current log
tail -f .claude-logs/$(ls -t .claude-logs/ | head -1)
```

### Check status remotely

```bash
# Quick status
./run-specs.sh status

# See what's completed
jq '.completed' .claude-progress.json

# See current spec
jq '.current_spec_name' .claude-progress.json
```

## Troubleshooting

### "Spec X not found"
Ensure your spec files are named with zero-padded numbers: `01-name.md`, `02-name.md`, etc.

### Rate limit not detected
The script looks for keywords like "rate limit", "too many requests", "usage limit". If Claude Code uses different wording, edit the `check_rate_limit()` function.

### Spec marked failed but actually worked
Check the log file in `.claude-logs/`. If implementation succeeded, you can manually edit `.claude-progress.json` to move the spec to `completed` array.

### Resume not working
The script reads `current_spec` from the progress file. Verify with:
```bash
jq '.current_spec' .claude-progress.json
```

## Files Generated

```
your-project/
├── .claude-progress.json    # Progress tracking
├── .claude-logs/            # Implementation logs
│   ├── 01-admin-schema-auth-20260208-120000.log
│   └── ...
└── implementation_docs/     # Your spec files (input)
```

## Tips

1. **Start small**: Test with a simple spec first to verify your setup
2. **Watch initially**: Attach to tmux for the first spec to ensure it's working
3. **Commit between specs**: The script tells Claude to commit after each step
4. **Check logs**: If something seems wrong, the logs have full Claude output
5. **Manual intervention**: You can always stop the script, fix something manually, then resume

## Extending

### Custom success detection

Edit `check_success()` to match your project's output patterns.

### Notifications

Add to `mark_complete()`:
```bash
# Slack notification
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"✅ Completed: '"$spec_name"'"}' \
  "$SLACK_WEBHOOK_URL"
```

### Different wait strategies

Edit `wait_for_reset()` to implement exponential backoff or custom schedules.
