#!/bin/bash
# PreToolUse hook: blocks Bash commands that read env files
# Exit 0 = allow, Exit 2 = block (shows stderr to Claude)

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Nothing to check if no command
[ -z "$COMMAND" ] && exit 0

# Block direct reads of .env files via common utilities
if echo "$COMMAND" | grep -qE '(cat|head|tail|less|more|bat|source|\.)\s+.*\.env(\s|$|\.|\*)'; then
  echo "BLOCKED: Cannot read .env files via Bash — secrets must stay hidden" >&2
  exit 2
fi

# Block grep/rg searching inside .env files
if echo "$COMMAND" | grep -qE '(grep|rg|ag|ack)\s+.*\.env(\s|$|\.|\*)'; then
  echo "BLOCKED: Cannot search inside .env files — secrets must stay hidden" >&2
  exit 2
fi

# Block piping or redirecting .env contents
if echo "$COMMAND" | grep -qE '< *\.env|\.env\s*\|'; then
  echo "BLOCKED: Cannot pipe .env file contents — secrets must stay hidden" >&2
  exit 2
fi

exit 0
