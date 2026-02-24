# MS-14: Onboarding Quality Gates

## Goal
Upgrade onboarding completion from presence checks to production-readiness gates:
- required data quality thresholds
- guardrail checks before full autonomous mode
- explicit signoff trail

## Why This Matters
Offer promises quality outcomes. "Field exists" checks are insufficient for reliable AI performance and client confidence.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Onboarding status endpoint and checklist framework:
- `src/app/api/public/onboarding/status/route.ts`
- Existing onboarding milestone concepts and settings capture.

### Misaligned behavior to change
- Current checks emphasize existence, not quality/completeness.
- No gating policy tied to smart-assist exit or autonomous readiness.

## Target State
- Quality gates define minimum acceptable setup standards.
- Autonomous mode cannot activate until gate criteria pass (or explicit override).
- Operator can see failed gates and corrective actions.

## Work Units (Tiny, Executable)
### Milestone A: Gate policy definition
1. Define gate catalog:
- business profile completeness
- services/pricing boundaries completeness
- FAQ/objection coverage minimum
- escalation contact validation
2. Add policy thresholds and scoring per gate.
3. Add environment/client override mechanism with justification.

Refactor checkpoint A:
- Store all thresholds in one onboarding-policy module.

### Milestone B: Gate evaluator service
1. Build deterministic evaluator for each gate.
2. Return pass/fail + reasons + recommended actions.
3. Persist evaluation snapshots with timestamp.

Refactor checkpoint B:
- Extract reusable validation utilities for shared checks.

### Milestone C: Workflow enforcement
1. Block autonomous-mode transition when critical gates fail.
2. Support documented operator override for exceptional cases.
3. Log who approved override and why.

Refactor checkpoint C:
- Keep mode-transition rules in one service (not route-level branching).

### Milestone D: UX and coaching loop
1. Add onboarding UI panel for gate status and action checklist.
2. Add "what to fix next" guidance ordered by impact.
3. Add completion summary report for internal handoff.

Refactor checkpoint D:
- Reuse existing onboarding card components and activity feed.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove legacy "onboarding complete" flags that ignore quality gates.
- Remove duplicated gate logic embedded in front-end only checks.
- Remove docs that imply autonomous mode after checklist presence only.

## Testing & Acceptance
### Automated
1. Failed critical gate blocks autonomous transition.
2. Passing all required gates allows transition.
3. Override path records actor/reason and audit event.

### Manual
1. Operator sees exact failed criteria and correction steps.
2. Re-run gate evaluation after fixes updates status correctly.
3. Handoff summary reflects gate outcomes.

## Definition of Done
- Onboarding completion means production readiness, not just checkbox completion.
