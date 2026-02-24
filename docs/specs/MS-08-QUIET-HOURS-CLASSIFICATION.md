# MS-08: Quiet-Hours Classification Switch

## Goal
Implement a legally controlled switch for quiet-hours handling so behavior can be changed immediately after counsel decision:
- mode A: queue all outbound during quiet hours
- mode B: allow inbound-reply messages during quiet hours; queue proactive outreach

## Why This Matters
Offer language is currently qualification-based. Operations need one controlled flag to move from interim policy to approved policy without risky code edits.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Compliance gateway orchestration in `src/lib/compliance/compliance-gateway.ts`.
- Quiet-hours queue behavior and deferred processing in existing scheduled flows.
- Existing audit logging patterns for compliance decisions.

### Misaligned behavior to change
- No explicit message-type classification policy that can be toggled by legal decision.
- No admin-facing visibility of active legal mode.

## Target State
- Message classification enum exists (`inbound_reply`, `proactive_outreach`).
- Quiet-hours policy mode is configurable per environment (and optionally per client override).
- Every blocked/sent decision logs message class + policy mode used.

## Work Units (Tiny, Executable)
### Milestone A: Policy model and resolver
1. Add quiet-hours policy mode config:
- `STRICT_ALL_OUTBOUND_QUEUE`
- `INBOUND_REPLY_ALLOWED`
2. Add shared resolver `getQuietHoursPolicy(clientId)`.
3. Default to strict mode until legal approval is entered.

Refactor checkpoint A:
- Consolidate all quiet-hours branching into one policy module.

### Milestone B: Message classification contract
1. Add message intent classification at call sites (`inbound_reply`, `proactive_outreach`).
2. Validate classification is required at send entrypoint.
3. Fail closed if classification is missing.

Refactor checkpoint B:
- Replace ad-hoc booleans with typed classification enum/constants.

### Milestone C: Gateway enforcement
1. In strict mode, queue all outbound during quiet hours.
2. In inbound-allowed mode, send `inbound_reply` immediately during quiet hours.
3. In inbound-allowed mode, queue `proactive_outreach` during quiet hours.

Refactor checkpoint C:
- Move quiet-hours decision logic to a pure function with unit tests.

### Milestone D: Audit and operator visibility
1. Log policy mode + classification on every quiet-hours decision.
2. Add admin diagnostics endpoint/widget showing active policy mode.
3. Add alert when policy mode changes.

Refactor checkpoint D:
- Use one shared compliance log formatter for quiet-hours records.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove any stale docs that imply hard-coded quiet-hours behavior only.
- Remove duplicate quiet-hours checks outside the compliance gateway.
- Remove dead config keys replaced by policy resolver.

## Testing & Acceptance
### Automated
1. Strict mode test: all outbound queued during quiet hours.
2. Inbound-allowed mode test: inbound replies send, proactive messages queue.
3. Missing-classification test: send is rejected with explicit error.

### Manual
1. Flip policy mode and verify behavior without deployment code changes.
2. Confirm audit logs show mode + message class.
3. Confirm dashboard/ops view reflects active mode.

## Definition of Done
- Legal decision can be implemented via config/policy switch.
- Quiet-hours behavior is deterministic and auditable.
