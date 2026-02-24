# SPEC-17: Report Delivery Observability and Retry UX

## Goal
Make bi-weekly report delivery operationally reliable and visible:
- delivery status tracked end-to-end
- retries are deterministic
- operator and client can see report state

## Why This Matters
The managed-service retention loop depends on consistent reporting. Invisible failures erode trust before issues are detected.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Report generation service in `src/lib/services/report-generation.ts`.
- Existing bi-weekly report job scheduling foundations.

### Misaligned behavior to change
- Delivery visibility is limited.
- Retry behavior is not clearly modeled in UX.

## Target State
- Report lifecycle states are explicit (`generated`, `queued`, `sent`, `failed`, `retried`).
- Failures generate actionable operator tasks.
- Client view indicates latest report status and delivery timestamp.

## Work Units (Tiny, Executable)
### Milestone A: Delivery state model
1. Add report delivery table/entity for each report cycle.
2. Store state transitions with timestamps and channel metadata.
3. Add latest-delivery query helper per client.

Refactor checkpoint A:
- Move report state mutation out of ad-hoc cron logic into one service.

### Milestone B: Retry engine
1. Define retry policy (attempt count, backoff, terminal failure).
2. Implement idempotent resend operation.
3. Persist attempt logs and last error code/message.

Refactor checkpoint B:
- Share retry helper with other outbound workflows if patterns match.

### Milestone C: Operator observability
1. Add report delivery ops dashboard/filter (failed, pending retry, sent).
2. Add one-click retry from operator UI.
3. Add alerting for terminal failures.

Refactor checkpoint C:
- Reuse existing alerting channel abstraction.

### Milestone D: Client-facing clarity
1. Add "last report delivered" panel in client portal.
2. Show fallback status if delivery failed and retry is in progress.
3. Provide download link for generated report artifact.

Refactor checkpoint D:
- Reuse shared report card component; avoid duplicate rendering paths.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove undocumented manual resend process where product retry exists.
- Remove duplicate "latest report" indicators that read from inconsistent sources.
- Remove dead cron-only assumptions from ops docs.

## Testing & Acceptance
### Automated
1. Delivery success path persists complete state transitions.
2. Retry path respects backoff and idempotency.
3. Terminal failure path triggers operator alert.

### Manual
1. Simulate send failure and verify retry/visibility in UI.
2. Operator can force retry and observe updated state.
3. Client sees correct report status and delivery timestamp.

## Definition of Done
- Report delivery failures are visible, recoverable, and auditable.
