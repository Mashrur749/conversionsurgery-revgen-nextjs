# Managed Service Spec Execution Runbook

Last updated: 2026-02-24
Audience: beginner operator using coding agents to implement `MS-*` specs safely.

Business source-of-truth for all implementations:
- `/docs/GRAND-SLAM-OFFER.md`
- `/docs/specs/MS-*.md` must be implemented in a way that satisfies the offer promise.

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
- Update docs/product/02-OFFER-PARITY-GAPS.md status accurately.
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
`docs/product/02-OFFER-PARITY-GAPS.md` must always reflect truth:
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

## 8) Session Context Hygiene
Use this to prevent context bloat in long implementation cycles:
- Keep one request to one milestone (`MS-XX`, `A|B|C|D`).
- Do not paste long docs repeatedly; reference file paths instead.
- End each milestone with commit + board/gap status updates.
- Start a fresh session every 2-4 milestones (or after each spec) with:
  - "Reload from repo state only"
  - target spec + milestone
  - required skills list
- Treat repo files as source of truth; avoid relying on chat memory.
