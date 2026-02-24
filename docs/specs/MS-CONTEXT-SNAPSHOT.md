# MS Context Snapshot

Last updated: 2026-02-24
Purpose: compact handoff context for fresh sessions without replaying chat history.

## Source of Truth
- Offer: `/docs/GRAND-SLAM-OFFER.md`
- Gap register: `/docs/10-OFFER-PARITY-GAPS.md`
- Milestone board: `/docs/specs/MS-IMPLEMENTATION-BOARD.md`
- Execution runbook: `/docs/11-MS-SPEC-EXECUTION-RUNBOOK.md`
- Agent rules: `/AGENTS.md`

## Completed Work
- `MS-01` Milestones A-D: complete.
  - Commits: `d01ac13`, `6c36d01`, `f138a66`, `ff00229`
- `MS-02` Milestones A-E: complete.
  - Commits: `c263613`, `e4e757d`, `a65e212`, `c2d9d2c`, `bc6554e`
- `MS-03` Milestone A: complete.
  - Commits: `f25a9eb`
- `MS-03` Milestone B: complete.
  - Commits: plus current Milestone B commit

## Current Focus
- `MS-03` (Estimate trigger stack)
- `MS-02` delivered end-to-end:
  - guarantee-v2 domain module and status mapping
  - schema fields for proof/recovery windows and extension metadata
  - migration with safe backfill mapping
  - QLE proof-of-life evaluator + metrics query module
  - 90-day recovery evaluator + transition/audit persistence
  - low-volume extension formula with persisted adjusted windows and audit events
  - admin/client guarantee visibility + cancellation workflow guarantee context
- `MS-03` Milestone A delivered:
  - unified estimate trigger service (`triggerEstimateFollowup`)
  - idempotency guard for duplicate sequence starts
  - dashboard/API route migrated to service entrypoint
- `MS-03` Milestone B delivered:
  - SMS keyword parser (`EST <lead-id|lead-name|phone>`)
  - deterministic lead resolution for command targets
  - owner-side inbound keyword handling with confirmation/error replies
- Next: MS-03 Milestone C (notification quick-reply wiring)

## Required Skills For Any MS Milestone
- `ms-spec-delivery`
- `ms-refactor-checkpoint`
- `ms-test-and-doc-sync`
- `ms-gap-status-governance`
- `ms-cx-offer-guardrails`

## Required Gate Before Marking Done
- `npm run ms:gate`
- milestone-targeted tests
- update board + gap register

## New Session Prompt (Copy/Paste)
```text
Reload from repo state only.
Use AGENTS.md skills and docs/11-MS-SPEC-EXECUTION-RUNBOOK.md.
Business source-of-truth: docs/GRAND-SLAM-OFFER.md.
Read docs/specs/MS-IMPLEMENTATION-BOARD.md and docs/10-OFFER-PARITY-GAPS.md.
Continue with MS-03 Milestone C only.
```
