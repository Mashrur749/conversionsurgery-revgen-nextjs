#!/bin/bash
# PreToolUse hook: blocks Edit/Write to sensitive files
# Exit 0 = allow, Exit 2 = block (shows stderr to Claude)

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // empty')

# Nothing to check if no file path
[ -z "$FILE_PATH" ] && exit 0

# Blocked patterns
BLOCKED=(
  ".env"
  ".env."
  "node_modules/"
  "package-lock.json"
  ".git/"
  "secrets/"
)

for pattern in "${BLOCKED[@]}"; do
  case "$FILE_PATH" in
    *"$pattern"*)
      echo "BLOCKED: Cannot edit '$FILE_PATH' — matches protected pattern '$pattern'" >&2
      exit 2
      ;;
  esac
done

exit 0
