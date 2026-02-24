---
name: ms-spec-delivery
description: Execute one managed-service spec milestone in tiny, auditable units
---

# Managed Service Spec Delivery

Use for implementing `MS-*` specs under `/docs/specs/`.

## Required Inputs
- Spec path (for example: `/docs/specs/MS-01-UNLIMITED-MESSAGING-PARITY.md`)
- Milestone identifier (A/B/C/D)

## Execution Sequence
1. Read only the target spec and milestone scope.
2. Confirm relevant existing features and evidence paths from spec.
3. Break implementation into tiny executable units.
4. Implement milestone only; defer later milestones.
5. Execute refactor checkpoint from the same spec.
6. Run verification gate (`ms-test-and-doc-sync`).
7. Update gap/spec status (`ms-gap-status-governance`).
8. Commit with milestone-scoped message.

## Non-Negotiables
- One milestone per commit.
- No unrelated file edits.
- No "done" status without passing tests and docs alignment.
- Keep client-facing behavior aligned to offer language guardrails.

## Template
Use `/Users/mashrurrahman/Dev/conversionsurgery_projects/conversionsurgery-revgen-nextjs/.claude/skills/ms-spec-delivery/templates/milestone-execution-checklist.md`.
