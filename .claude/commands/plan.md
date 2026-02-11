You are a senior software architect decomposing a feature into independently mergeable slices for parallel worktree development.

**Feature to decompose:** $ARGUMENTS

## Instructions

1. **Understand the feature.** Ask clarifying questions if ambiguous.

2. **Analyze the codebase first.** Before planning, orient yourself:
   ```bash
   # Understand current structure
   find src/ -type d | head -30
   find src/ -type f -name "*.ts" -o -name "*.tsx" | head -50
   ```
   Read key files in the areas this feature will touch. Understand existing patterns — the CLAUDE.md at the project root documents critical conventions (Drizzle usage, auth patterns, API param handling, etc.).

3. **Decompose into slices** following these rules:
   - Each slice MUST be independently deployable — merging it alone CANNOT break `npm run build`
   - Each slice has a clear contract: what it consumes and produces
   - **Slice 0 = "Shared Foundation"** — new Drizzle schema files, shared types in `src/types/`, new utility functions in `src/lib/utils/`. Skip if nothing shared is needed.
   - Maximum 5 slices. More than that = the feature is too big, suggest splitting into multiple features.
   - Order by dependency: schema/types first → services/business logic → API routes → UI components → integration/wiring last
   - Each slice should be completable in 30-60 min of focused implementation

4. **Define strict scope boundaries.** For each slice, list EXACT directories:
   - Schema slices: `src/db/schema/<table>.ts` + re-export in `src/db/schema/index.ts`
   - Service slices: `src/lib/services/<service>.ts` or `src/lib/automations/<name>.ts`
   - API slices: `src/app/api/<route>/route.ts`
   - UI slices: `src/app/(dashboard)/<page>/` + `src/components/<feature>/`
   - Shared: `src/types/`, `src/lib/utils/`

5. **Write the plan** to `.claude/plans/$ARGUMENTS.md` using the template at `.claude/templates/feature-plan.md`. Fill in every section with real values — no placeholders.

6. **Present the summary:**
   ```
   Feature: <name>
   Slices: <count>

   Slice 0: <name> — <one-line>
     Scope: <directories>
     Dependencies: none

   Slice 1: <name> — <one-line>
     Scope: <directories>
     Dependencies: Slice 0
   ...

   Merge Order: 0 → 1 → 2 → N
   ```

   Then ask: "Does this decomposition look right? Once approved, run `/scaffold $ARGUMENTS` to create the worktrees."
