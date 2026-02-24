# MS-07: Cancellation and Data Export Parity

## Status
- `STATE: DONE`
- `COMPLETED_ON: 2026-02-24`
- `IMPLEMENTATION: 30-day cancellation policy + tracked export lifecycle + secure download + admin SLA queue`

## Goal
Align product behavior to sold cancellation/export terms:
- month-to-month
- cancellation effective 30 calendar days after written notice
- full export available, delivered within 5 business days

## Why This Matters
Contract-term mismatch creates legal and trust risk at churn moments.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Cancellation request flow in `src/app/api/client/cancel/route.ts`.
- Cancellation service in `src/lib/services/cancellation.ts`.
- Lead CSV export path in `src/app/api/leads/export/route.ts`.

### Misaligned behavior to change
- `confirmCancellation()` currently called with 7-day grace in route flow.
- No full export bundle workflow (leads + conversations + pipeline/job status).
- No explicit export SLA tracking object.

## Target State
- Cancellation timeline uses 30-day notice by default.
- Export request and fulfillment lifecycle is tracked.
- Export package contains required datasets and delivery metadata.

## Work Units (Tiny, Executable)
### Milestone A: Policy and schema alignment
1. Add cancellation policy constants (single source):
- `CANCELLATION_NOTICE_DAYS = 30`
- `EXPORT_SLA_BUSINESS_DAYS = 5`
2. Add `data_export_requests` table with status lifecycle.
3. Add migration/backfill for existing cancellation requests if needed.

Refactor checkpoint A:
- Replace magic numbers in routes/services with policy constants.

### Milestone B: Cancellation flow alignment
1. Update cancel route to use 30-day effective date.
2. Preserve retention-call branch while keeping policy-consistent cancellation branch.
3. Expose effective cancellation date in client response.

Refactor checkpoint B:
- Isolate cancellation decision logic into service-layer orchestrator.

### Milestone C: Full export pipeline
1. Build export assembler:
- leads
- conversations
- pipeline/job status
2. Generate downloadable artifacts (CSV bundle or zipped files).
3. Add secure retrieval endpoint with expiry.

Refactor checkpoint C:
- Move export assembly into dedicated service module with composable dataset builders.

### Milestone D: SLA tracking and operator workflow
1. Create export request automatically on cancellation confirmation (optional by policy).
2. Add status transitions: `requested`, `processing`, `ready`, `delivered`, `failed`.
3. Add admin view for pending export requests and SLA breach alerts.

Refactor checkpoint D:
- Add centralized SLA calculator helper (business-day aware).

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove 7-day grace constants/calls in cancellation flow.
- Remove stale cancellation copy in client UI and emails.
- Deprecate ad hoc manual export handling once request workflow is live.

## Testing & Acceptance
### Automated
1. Cancellation effective date test (30-day rule).
2. Export request lifecycle tests.
3. Dataset assembly tests for required tables/fields.

### Manual
1. Client confirms cancellation -> effective date reflects 30-day notice.
2. Export request is created and visible to operator.
3. Download package includes leads, conversations, and pipeline status data.

## Definition of Done
- Cancellation and export workflows match sold terms end-to-end.
- SLA can be monitored and audited.
