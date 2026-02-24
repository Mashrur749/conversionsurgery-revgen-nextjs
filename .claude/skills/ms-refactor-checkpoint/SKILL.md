---
name: ms-refactor-checkpoint
description: Mandatory post-implementation refactor checkpoint for managed-service milestones
---

# Managed Service Refactor Checkpoint

Use immediately after completing a major milestone implementation.

## Refactor Rules
1. Centralize branching logic into shared policy/resolver helpers.
2. Remove duplicate checks from routes and services.
3. Keep public contracts stable unless spec requires changes.
4. Remove dead code introduced by superseded paths.
5. Keep naming explicit to business intent (offer-aligned).

## Refactor Checklist
- [ ] Single source of truth for policy decisions.
- [ ] No duplicate literals for statuses/categories.
- [ ] No stale feature flag paths left active accidentally.
- [ ] Deprecated copy/config removed where replaced.

## Template
Use `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-refactor-checkpoint/templates/refactor-report.md` for summary notes.
