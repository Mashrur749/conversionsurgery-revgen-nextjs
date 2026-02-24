# Managed Service Spec Execution Runbook

Last updated: 2026-02-24
Audience: beginner operator using coding agents to implement `MS-*` specs safely.

## 1) One Milestone at a Time
Never ask the agent to implement a full spec in one request.
Use one prompt per milestone (`A`, then `B`, etc.).

## 2) Required Skill Stack
For any `MS-*` milestone, require these skills in prompt:
- `ms-spec-delivery`
- `ms-refactor-checkpoint`
- `ms-test-and-doc-sync`
- `ms-gap-status-governance`
- `ms-cx-offer-guardrails`

Add these only when needed:
- `create-migration` + `neon-postgres` (schema/migrations)
- `ux-standards` (frontend UI changes)

## 3) Prompt Template
Use this exact pattern:

```text
Use: ms-spec-delivery, ms-refactor-checkpoint, ms-test-and-doc-sync,
ms-gap-status-governance, ms-cx-offer-guardrails.

Implement ONLY Milestone A of
/docs/specs/MS-01-UNLIMITED-MESSAGING-PARITY.md.

Constraints:
- Keep scope to this milestone only.
- Apply the milestone refactor checkpoint.
- Run verification gate and report exact results.
- Update docs/10-OFFER-PARITY-GAPS.md status accurately.
- Commit with message: ms-01 milestone-a: <summary>
```

## 4) Execution Order
1. `MS-01` to `MS-07` (P0)
2. `MS-08` to `MS-12` (P1)
3. `MS-13` to `MS-15` (P2)

## 5) Mandatory Gate Before "Done"
Before marking any milestone done:
- run `npm run ms:gate` (or `npm run ms:gate:build` for broader validation)
- run milestone-specific tests/manual checks from the spec
- verify docs updated to match behavior

## 6) Status Discipline
`docs/10-OFFER-PARITY-GAPS.md` must always reflect truth:
- `OPEN`: not started
- `IN_PROGRESS`: partial milestone delivery
- `DONE`: verified and documented

Also update:
- `docs/specs/MS-IMPLEMENTATION-BOARD.md` for milestone A/B/C/D state.

## 7) Common Beginner Mistakes to Avoid
- Implementing multiple milestones at once
- Skipping refactor checkpoint after large code edits
- Marking done without docs/testing updates
- Mixing unrelated cleanup into milestone commits
