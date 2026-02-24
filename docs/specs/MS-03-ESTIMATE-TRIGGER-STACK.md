# MS-03: Estimate Trigger Stack Parity

## Goal
Deliver all low-friction estimate trigger methods promised in offer v2.1:
- SMS keyword trigger
- notification quick-reply trigger
- dashboard trigger (existing)
- fallback nudge for stale contacted leads

## Why This Matters
Estimate follow-up is a core revenue driver. If triggers are fragile, the highest-value automation silently fails.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Follow-up sequence scheduler in `src/lib/automations/estimate-followup.ts`.
- API trigger route in `src/app/api/sequences/estimate/route.ts`.
- Agency action prompt plumbing in `src/lib/services/agency-communication.ts`.

### Misaligned behavior to change
- `start_sequences` prompt action throws integration error.
- No robust SMS keyword trigger (`EST ...`) for contractor-side initiation.
- No fallback nudge cron for stale contacted leads without estimate flag.

## Target State
Any realistic contractor action path can start estimate follow-up with low friction and full auditability.

## Work Units (Tiny, Executable)
### Milestone A: Trigger service unification
1. Create `src/lib/services/estimate-triggers.ts` with one entrypoint:
- `triggerEstimateFollowup({ clientId, leadId, source })`
2. Route existing dashboard/API flow to the new service.
3. Add idempotency guard to prevent duplicate sequence starts.

Refactor checkpoint A:
- Remove direct sequence-start calls from route handlers; use service only.

### Milestone B: SMS keyword trigger
1. Implement parser for contractor inbound commands:
- `EST <lead-id|lead-name|phone>`
2. Resolve target lead deterministically and return confirmation/error SMS.
3. Log trigger source as `sms_keyword` in execution metadata.

Refactor checkpoint B:
- Move command parsing into standalone parser util with tests.

### Milestone C: Notification quick-reply trigger
1. Implement `YES` quick-reply handling for estimate prompt context.
2. Wire `executePromptAction('start_sequences')` to trigger service.
3. Add expiry-safe behavior and fallback operator notification.

Refactor checkpoint C:
- Consolidate prompt action dispatch map in one module (no switch sprawl).

### Milestone D: Fallback nudge cron
1. Add cron job to find leads in `contacted` for 5+ days without estimate flag.
2. Send contractor nudge SMS with one-tap reply semantics.
3. Prevent repeated nudges within configured cooldown window.

Refactor checkpoint D:
- Add reusable stale-lead query helper for future campaign tooling.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove temporary "reply YES" copy that references non-functional start action.
- Remove throw branches for `start_sequences` in prompt execution.
- Remove stale docs stating estimate trigger is dashboard-only.

## Testing & Acceptance
### Automated
1. Keyword parser tests: valid/invalid/ambiguous inputs.
2. Idempotency tests: repeated triggers do not duplicate sequence steps.
3. Nudge eligibility tests (age, status, cooldown).

### Manual
1. Trigger via dashboard/API works.
2. Trigger via SMS keyword works for at least one real test lead.
3. Trigger via quick-reply YES works from prompt flow.
4. Fallback nudge sends and starts sequence when user confirms.

## Definition of Done
- All promised estimate trigger methods function and are auditable.
- No dead prompt actions remain.
