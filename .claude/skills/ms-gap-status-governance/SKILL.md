---
name: ms-gap-status-governance
description: Keep offer-parity gap register and milestone statuses aligned with implementation truth
---

# Gap Status Governance

Use when any MS milestone changes implementation state.

## Rules
1. Update `docs/10-OFFER-PARITY-GAPS.md` status tags only after verification gate passes.
2. Never mark "Done" unless tests and docs are complete.
3. If partially complete, mark explicitly as "In Progress" with remaining scope.
4. Keep evidence paths accurate to code locations.

## Required Updates
- Gap row status for impacted gap(s)
- Last verified commit hash/date when state changes
- Remaining work note if not fully complete

## Template
Use `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-gap-status-governance/templates/gap-update-entry.md`.
