# Claude Code Prompt Templates

## Default Implementation Prompt

Used by `run-specs.sh` - you can customize this:

```
Please implement the following specification completely. 

Read the spec file carefully and implement ALL steps in order.
After each major step, commit with a descriptive message.
If you encounter any issues, document them but continue with other steps.

Spec file: {SPEC_FILE_PATH}

Begin implementation now. Work through each step methodically.
```

## Enhanced Prompt (Recommended)

For better results, update the `prompt` variable in `run-specs.sh`:

```bash
local prompt="You are implementing a ConversionSurgery feature based on a detailed spec.

INSTRUCTIONS:
1. Read the entire spec file first: $spec_file
2. Identify all files to create/modify
3. Implement each step in the exact order specified
4. After completing each major step, run: git add -A && git commit -m 'feat: [step description]'
5. If a step requires a database migration, run it immediately
6. If tests are specified, write and run them
7. If you encounter an error, try to fix it. If you can't, document it in IMPLEMENTATION_NOTES.md and continue

QUALITY CHECKS:
- Ensure TypeScript types are complete (no 'any' unless spec allows)
- Follow existing code patterns in the project
- Add console.log statements for debugging webhook handlers
- Verify imports are correct before moving to next file

COMPLETION:
When finished, create a brief summary in IMPLEMENTATION_NOTES.md listing:
- What was implemented
- Any deviations from spec
- Known issues or TODOs
- What to test manually

Begin now with: cat $spec_file"
```

## Prompt for Resuming Mid-Spec

If a spec was interrupted:

```bash
claude -p "You were implementing $spec_file but were interrupted.

Current state:
$(git log --oneline -5)

Files modified:
$(git status --short)

Please:
1. Review the spec: cat $spec_file
2. Determine where you left off based on git history
3. Continue from that point
4. Complete all remaining steps

Resume implementation now."
```

## Prompt for Fix-and-Continue

When a spec failed and needs fixes:

```bash
claude -p "The previous implementation of $spec_file had issues.

Error log:
$(tail -100 $log_file)

Please:
1. Analyze what went wrong
2. Fix the issues
3. Verify the fix works
4. Continue with any remaining steps from the spec
5. Commit fixes with: git commit -m 'fix: [description]'

Begin diagnosis and repair now."
```

## Prompt for Verification

After all specs are done:

```bash
claude -p "All specs have been implemented. Please verify the system:

1. Run: npm run build (or equivalent)
2. Check for TypeScript errors
3. Run: npm run lint
4. Run database migrations if pending
5. Start the dev server and check for console errors
6. Create a VERIFICATION_REPORT.md with:
   - Build status
   - Any errors found
   - Recommended manual tests
   - Overall assessment

Begin verification now."
```

## Custom Prompt Builder

For programmatic prompt generation:

```bash
build_prompt() {
  local spec_file=$1
  local spec_num=$2
  local total=$3
  
  cat << EOF
═══════════════════════════════════════════════════════════
SPEC $spec_num OF $total: $(basename "$spec_file" .md)
═══════════════════════════════════════════════════════════

You are a senior developer implementing a feature for ConversionSurgery,
an SMS automation platform for contractors.

CONTEXT:
- This is spec $spec_num of $total in the implementation sequence
- Previous specs have already been implemented
- The codebase uses: Next.js 14, TypeScript, Drizzle ORM, Tailwind CSS
- Database: PostgreSQL via Supabase

YOUR TASK:
Implement everything in this spec file: $spec_file

WORKFLOW:
1. cat "$spec_file" to read the full specification
2. Review existing code to understand patterns: ls -la src/
3. Implement each numbered step in order
4. Commit after each major component:
   git add -A && git commit -m "feat($(basename "$spec_file" .md)): [description]"
5. If you need to install packages: npm install [package]
6. For database changes: npx drizzle-kit generate && npx drizzle-kit migrate

ERROR HANDLING:
- If a command fails, try to diagnose and fix
- If you cannot fix, note in ISSUES.md and continue
- Do not stop implementation for minor issues

QUALITY:
- Match existing code style
- Add proper TypeScript types
- Include error handling in API routes
- Add loading states in UI components

Begin by reading the spec file.
EOF
}
```

## Using Different Prompts

Modify `run-specs.sh` around line 147:

```bash
# Option 1: Simple prompt (current)
local prompt="Please implement..."

# Option 2: Load from file
local prompt=$(cat "$SCRIPT_DIR/prompts/implement.txt" | sed "s|{SPEC_FILE}|$spec_file|g")

# Option 3: Use builder function
local prompt=$(build_prompt "$spec_file" "$spec_num" "$total_specs")
```
