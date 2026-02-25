---
name: ms-test-and-doc-sync
description: Verification gate and documentation synchronization for managed-service milestones
---

# Managed Service Test and Doc Sync

Use before marking any MS milestone done.

## Verification Gate
1. Run targeted tests for changed modules.
2. Run `npm run typecheck` for TypeScript integrity.
3. Run `npm run build` for high-risk or cross-cutting changes.
4. Execute manual checks from the milestone acceptance criteria.

## Documentation Gate
Update all relevant docs when behavior changes:
- `/docs/10-OFFER-PARITY-GAPS.md`
- `/docs/specs/README.md` (if structure changed)
- `/docs/02-TESTING-GUIDE.md` (when test flow changes)
- `/docs/04-OPERATIONS-GUIDE.md` (when operator behavior changes)

## Required Output
- What tests ran
- What passed/failed
- What docs were updated
- Any unresolved risks

## Templates and Scripts
- Template: `.claude/skills/ms-test-and-doc-sync/templates/verification-report.md`
- Script: `scripts/specs/ms-quality-gate.sh`
