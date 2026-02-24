# MS-06: Bi-Weekly "Without Us" Model Parity

## Goal
Implement the standardized "Without Us" modeled risk line in bi-weekly reports with explicit assumptions and low/base/high ranges.

## Why This Matters
This is a retention proof artifact. It must be transparent, repeatable, and non-manipulative.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Bi-weekly report generation in `src/lib/services/report-generation.ts`.
- Daily metrics source in `daily_stats` and report storage in `reports`.
- Admin report views in `src/app/(dashboard)/admin/reports/*`.

### Misaligned behavior to change
- No modeled risk section for "Without Us".
- No standardized assumptions payload stored with report.

## Target State
Each bi-weekly report includes:
- low/base/high risk range
- assumptions used
- input metrics used
- disclaimer text

## Work Units (Tiny, Executable)
### Milestone A: Model service
1. Create `src/lib/services/without-us-model.ts`.
2. Define input contract from period metrics.
3. Output low/base/high plus assumptions metadata.

Refactor checkpoint A:
- Keep model pure and deterministic; no DB access inside model function.

### Milestone B: Data input enrichment
1. Add required period inputs to report generation pipeline.
2. Compute observed response-time baseline and delayed follow-up counts.
3. Add assumption defaults configurable via system settings.

Refactor checkpoint B:
- Split report generation into:
- metrics collection
- model calculation
- persistence

### Milestone C: Report persistence and rendering
1. Persist model output in report JSON fields.
2. Render model section in admin report details.
3. Add explicit disclaimer block in rendered report/email summary.

Refactor checkpoint C:
- Create typed report DTO to prevent ad hoc json parsing in UI.

### Milestone D: Operator safeguards
1. Add guardrail to suppress model if required inputs missing.
2. Show "insufficient data" state instead of fabricated values.
3. Log model version for future changes.

Refactor checkpoint D:
- Add `modelVersion` constant and migration-safe compatibility handler.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove old generic ROI text that implies hard certainty without model basis.
- Remove any one-number-only risk displays.

## Testing & Acceptance
### Automated
1. Model unit tests with fixed input fixtures.
2. Missing-input tests return `insufficient_data` state.
3. Report generation tests include model payload on valid data.

### Manual
1. Bi-weekly cron generates report with "Without Us" section.
2. Assumptions and disclaimer are visible and understandable.
3. Report remains readable if model is suppressed for insufficient data.

## Definition of Done
- "Without Us" is standardized, transparent, and delivered in bi-weekly reports.
