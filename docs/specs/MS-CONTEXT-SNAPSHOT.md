# MS Context Snapshot

Last updated: 2026-02-24 (MS-13 Milestones A-D)
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
- `MS-03` Milestones A-D: complete.
  - Commits: `f25a9eb`, `650a32c`, `e90a35e`, `9773ae3`
- `MS-04` Milestones A-D: complete.
  - Commit: `4b1ab2f`
- `MS-05` Milestones A-D: complete.
  - Commit: `edc545d`
- `MS-06` Milestones A-D: complete.
  - Commit: `9388e70`
- `MS-07` Milestones A-D: complete.
  - Commit: `4bb3770`
- `MS-08` Milestones A-D: complete.
  - Commit: `cc97c11`
- `MS-09` Milestones A-D: complete.
  - Commit: `11f9737`
- `MS-10` Milestones A-D: complete in current working tree.
  - Milestone A: pricing catalog normalization and visibility baseline
  - Milestone B: idempotent add-on billing ledger + event emitters + voice rollup cron
  - Milestone C: shared add-on formatter + invoice line-item merge + cycle breakdown + CSV export
  - Milestone D: invoice linkage + provenance metadata + admin dispute annotation workflow
- `MS-11` Milestone A: complete.
  - Commit: `257b1e0`
- `MS-11` Milestones B-D: complete.
  - Commits: `5863974`, `17a16df`, `03953cf`
- `MS-12` Milestones A-D: complete.
  - cursor model + migration + legacy backfill bootstrap
  - shared catch-up runner and job registry (monthly + bi-weekly)
  - period-level idempotency key module + billing/report replay safety
  - admin catch-up status + manual run controls
- `MS-13` Milestones A-D: complete in current working tree.
  - knowledge-gap lifecycle model (`new`, `in_progress`, `blocked`, `resolved`, `verified`)
  - detection upsert now routes through queue service with scoring/due-date policy
  - admin queue APIs (`list`, `bulk`, `single-update`) and Knowledge Base `Gap Queue` operator UI
  - resolve/verify enforcement requires KB entry link + resolution note + reviewer separation for high-priority gaps
  - queue metrics (opened/closed/aging) and stale high-priority digest cron (`/api/cron/knowledge-gap-alerts`)

## Current Focus
- Next spec: `MS-14` (onboarding quality gates), Milestone A.
- `MS-12` Milestones A-D are implemented in the working tree:
  - `cron_job_cursors` model + migration (`drizzle/0031_gigantic_hourglass.sql`)
  - shared catch-up engine (`src/lib/services/cron-catchup.ts`)
  - monthly + bi-weekly catch-up job definitions and registry
  - cron routes now invoke catch-up jobs (`monthly-reset`, `biweekly-reports`)
  - orchestrator dispatch cadence updated for catch-up recovery
  - overage billing now uses period windows + idempotency keys (`billing_events.idempotency_key`)
  - centralized idempotency key helper (`src/lib/services/idempotency-keys.ts`)
  - admin observability + manual catch-up execution (`/api/admin/cron-catchup`, `/admin/settings`)
- `MS-10` Milestones A-D are implemented in the working tree:
  - centralized add-on pricing catalog keys and effective-date resolver
  - route limit messaging for team seats/phone numbers now sourced from add-on pricing resolver
  - client billing usage card now shows explicit add-on rates and projected recurring add-on subtotal
  - add-on billing ledger table + idempotency key model
  - unified ledger writer service for add-on billable events
  - event emission wired for team-seat over-base and phone-number purchases
  - voice-minute rollup cron endpoint integrated into orchestrator
  - shared add-on formatter for labels/units/currency used by billing paths
  - billing invoice DTO now includes add-on line items merged from ledger by period
  - client billing UI now renders cycle add-on breakdown and CSV export action
  - client add-on CSV export endpoint added for support-ready event evidence
  - add-on events now link to invoice IDs/line-item refs where periods match
  - admin provenance/dispute workflow is available on client detail page
- `MS-04` delivered end-to-end:
  - smart-assist config model on client (`enabled`, `delay`, `manual categories`)
  - centralized AI send-policy resolver with shared category constants
  - deferred draft queue with owner prompt and approve/edit/cancel command handling
  - auto-send processor for due smart-assist drafts in cron path
  - manual-only category enforcement
  - assist lifecycle statuses + transition helper + retry-safe send claim
  - operator visibility in scheduled/lead views
  - assist outcome counters in `daily_stats`
- `MS-05` delivered end-to-end:
  - quarterly campaign schema, enums, and relations
  - campaign service with planner, transitions, asset/evidence capture, and digest/alerts
  - cron planner and quarterly digest/alert endpoints integrated into orchestrator
  - admin workflow APIs and admin client execution UI card
  - client dashboard campaign status visibility and report-context campaign summary
- `MS-06` delivered end-to-end:
  - pure deterministic "Without Us" model service with model-versioned output
  - period input enrichment (after-hours leads, observed response speed, delayed follow-up count)
  - configurable assumption loading from `system_settings` with safe fallbacks
  - report persistence + admin report detail rendering + bi-weekly email summary integration
  - explicit insufficient-data guardrails
  - typed report DTO parsing in report UI paths
- `MS-07` delivered end-to-end:
  - policy constants for cancellation notice and export SLA
  - `data_export_requests` schema + migration + lifecycle statuses
  - cancellation confirmation now returns effective 30-day date and creates export requests automatically
  - full export bundle generation (`leads`, `conversations`, `pipeline/jobs`)
  - secure tokenized download endpoint with expiry and delivered-state tracking
  - admin billing SLA queue for pending/at-risk/breached exports
  - billing cancel-path bypass removed in favor of unified `/client/cancel` workflow
- `MS-08` delivered end-to-end:
  - quiet-hours policy module with strict default mode + inbound-reply-allowed mode
  - required message classification contract (`inbound_reply` / `proactive_outreach`) on all compliant outbound sends
  - fail-closed behavior when classification is missing
  - pure quiet-hours decision function with unit tests
  - compliance-service bypass option for policy-approved inbound replies during quiet hours
  - policy mode override storage (`quiet_hours_config.policy_mode_override`) + migration
  - policy diagnostics endpoint and admin compliance widget
  - mode-change compliance audit events and decision metadata logging on send/queue/block

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
Continue with MS-14 Milestone A only.
```
