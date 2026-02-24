# SPEC-11: Quarterly Growth Blitz Productization

## Goal
Operationalize the quarterly campaign promise into trackable, repeatable platform workflows.

## Why This Matters
The quarterly blitz is a retention anchor in the offer. Without scheduling and evidence, the promise is fragile.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Win-back automation primitives (`src/lib/automations/win-back.ts`).
- Review and messaging infrastructure already present in platform.
- Bi-weekly reporting and daily stats data sources.

### Misaligned behavior to change
- No quarterly campaign scheduler or campaign ledger.
- No standardized campaign execution checklist and outcome capture.
- No client-facing campaign visibility status.

## Target State
Each active client has a quarterly campaign lifecycle:
- planned
- scheduled
- launched
- completed
- outcome logged

## Work Units (Tiny, Executable)
### Milestone A: Campaign data model
1. Add `quarterly_campaigns` table:
- clientId, quarter, type, status, scheduledAt, launchedAt, completedAt
- plan notes, outcome summary, createdBy
2. Add campaign type enum aligned to offer menu.

Refactor checkpoint A:
- Encapsulate campaign persistence in `campaign-service.ts`.

### Milestone B: Scheduler and defaults
1. Add cron-safe planner to create upcoming quarter campaign drafts.
2. Apply rule-based default recommendation by account state.
3. Prevent duplicate campaign records per client/quarter.

Refactor checkpoint B:
- Extract recommendation rules into pure functions for testing.

### Milestone C: Operator execution workflow
1. Add admin workflow actions:
- approve plan
- launch campaign
- mark completed
2. Track required assets (e.g., list extraction completed).
3. Log evidence links/notes for each campaign.

Refactor checkpoint C:
- Move workflow transition checks into a single transition guard module.

### Milestone D: Visibility and retention reporting
1. Add campaign status summary to client report context.
2. Add admin digest section for quarterly campaign progress.
3. Add missed-quarter alert if campaign not launched by target date.

Refactor checkpoint D:
- Reuse reporting DTO layer for campaign summary to avoid duplicate formatting.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove any "quarterly" claims from client-facing templates that are not yet trackable.
- Remove ad hoc operator spreadsheets/processes once campaign ledger is live.

## Testing & Acceptance
### Automated
1. Scheduler idempotency tests.
2. Transition guard tests (invalid state jumps blocked).
3. Recommendation rules tests by sample client metrics.

### Manual
1. New quarter draft appears for active client.
2. Operator can run full lifecycle to completed.
3. Outcome appears in reporting context.

## Definition of Done
- Quarterly campaign promise is executable, auditable, and visible in platform operations.
