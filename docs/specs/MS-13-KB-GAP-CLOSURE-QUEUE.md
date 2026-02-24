# MS-13: Knowledge Gap Closure Queue

## Goal
Turn knowledge-gap detection into an operator-owned closure workflow:
- capture gaps
- assign ownership
- close with KB update
- track closure SLA

## Why This Matters
Offer quality depends on AI answer quality. Capturing gaps without closure workflow leads to repeated deferrals and poor CX.

## Current Implementation (Relevant Existing Features)
### Existing features to keep
- Knowledge gap schema in `src/db/schema/knowledge-gaps.ts`.
- Context builder usage in `src/lib/agent/context-builder.ts`.

### Misaligned behavior to change
- No dedicated operator queue with ownership/status lifecycle.
- No enforced closure path tied to KB updates.

## Target State
- Every detected gap enters an actionable queue.
- Queue items have owner, due date, resolution notes, and linked KB change.
- BI/reporting shows open vs closed trends.

## Work Units (Tiny, Executable)
### Milestone A: Queue lifecycle model
1. Add statuses: `new`, `in_progress`, `blocked`, `resolved`, `verified`.
2. Add ownership fields and due-date policy.
3. Add simple priority scoring (frequency + client impact).

Refactor checkpoint A:
- Consolidate status constants into one shared module.

### Milestone B: Operator queue API + UI
1. Build queue listing/filter endpoints.
2. Add operator queue UI with assignment and status updates.
3. Add bulk actions for repeated identical gaps.

Refactor checkpoint B:
- Reuse existing admin table/list components and filter utilities.

### Milestone C: Resolution linkage
1. Add required resolution fields:
- KB article/entry updated
- resolution note
- resolver
- resolved timestamp
2. Require link to KB change before marking resolved.
3. Add verification step by reviewer for high-impact gaps.

Refactor checkpoint C:
- Create shared KB-link validator used by API and UI.

### Milestone D: Metrics and cadence
1. Add weekly summary metrics (opened, closed, aging).
2. Add alert for stale high-priority gaps.
3. Include queue health in bi-weekly internal ops review.

Refactor checkpoint D:
- Route metric aggregation through existing analytics pipeline.

## Immediate Deprecated Cleanup (Pre-Launch)
- Remove ad-hoc KB gap tracking spreadsheets/chats as source of truth.
- Remove duplicate fields that overlap with queue status.
- Remove unresolved-gap documentation workflows not tied to product.

## Testing & Acceptance
### Automated
1. Gap detection creates queue item with default status/priority.
2. Resolve action requires KB link and resolution note.
3. Stale high-priority gap triggers alert.

### Manual
1. Operator can triage, assign, and close gaps end-to-end.
2. Repeated gaps can be batched and resolved efficiently.
3. Queue metrics reflect real activity.

## Definition of Done
- Knowledge gaps are operationally owned and closed, not only logged.
