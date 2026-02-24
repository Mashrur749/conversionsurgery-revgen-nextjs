# MS-02: Guarantee v2 Parity (30-Day Proof + 90-Day Recovery)

## Goal
Implement the sold two-layer guarantee model:
- Layer 1: 30-day proof-of-life (>=5 qualified lead engagements)
- Layer 2: 90-day attributed opportunity guarantee
- Low-volume extension formula based on observed monthly average leads

## Why This Matters
Guarantee mismatch is a direct legal, billing, and trust risk.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Guarantee cron entrypoint in `src/app/api/cron/guarantee-check/route.ts`.
- Billing event audit trail in `src/lib/services/guarantee-monitor.ts`.
- Subscription metadata fields in `src/db/schema/subscriptions.ts`.

### Misaligned behavior to change
- Current evaluator only supports 30-day recovered-lead logic.
- No proof-of-life engagement counting logic.
- No 90-day attributed opportunity state machine.
- No low-volume extension formula support.

## Target State
- Deterministic guarantee state machine with auditable transitions.
- Both guarantee layers and extension formula are machine-evaluated.
- Admin and client views show current guarantee stage/status and dates.

## Work Units (Tiny, Executable)
### Milestone A: Domain model + state machine
1. Define explicit statuses:
- `proof_pending`, `proof_passed`, `proof_failed_refund_review`
- `recovery_pending`, `recovery_passed`, `recovery_failed_refund_review`
2. Add required fields for:
- proof/recovery windows
- observed monthly lead average
- extension factor and adjusted end dates
3. Add migration for new fields and safe backfill mapping from old statuses.

Refactor checkpoint A:
- Move guarantee logic into dedicated domain module:
- `src/lib/services/guarantee-v2/`

### Milestone B: Proof-of-life evaluator
1. Implement qualified lead engagement query and count rules.
2. Evaluate 30-day proof window against required threshold (5).
3. Emit billing events and notes for pass/fail transitions.

Refactor checkpoint B:
- Extract query builders for reusable, testable guarantee metrics.

### Milestone C: 90-day recovery evaluator
1. Implement attributed opportunity determination rule set.
2. Evaluate 90-day window and transition states.
3. Emit billing events and clear operator action hints.

Refactor checkpoint C:
- Split evaluator into independent steps:
- metrics collection
- rule evaluation
- state transition persistence

### Milestone D: Low-volume extension formula
1. Compute monthly average lead volume across guarantee period.
2. Apply formula only when volume < 15.
3. Persist adjusted windows and expose rationale in notes/audit.

Refactor checkpoint D:
- Isolate formula in pure function with deterministic tests.

### Milestone E: Visibility + operations
1. Update admin billing views with guarantee stage timeline.
2. Add client-side guarantee status endpoint/summary.
3. Update cancellation/refund workflow to use new states.

Refactor checkpoint E:
- Consolidate guarantee DTO/serializer for admin and client UIs.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove legacy `recovered lead only` assumptions in docs/UI copy.
- Remove stale hard-coded "30-day only" labels from admin views and cron comments.
- Remove old status branches no longer reachable.

## Testing & Acceptance
### Automated
1. State machine tests for all transitions.
2. Formula tests for extension examples (12, 10, 8 leads/month).
3. Regression tests for billing event emission consistency.

### Manual
1. Simulate client with >=5 QLE within 30 days -> proof passes.
2. Simulate low-volume client -> adjusted windows computed as specified.
3. Simulate no attributed opportunity by adjusted recovery end -> refund review required.

## Definition of Done
- Guarantee behavior matches v2.1 offer definitions.
- Transition audit trail is complete and explainable.
- Admin/client visibility is clear.
