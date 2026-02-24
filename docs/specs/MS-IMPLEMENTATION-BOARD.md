# MS Implementation Board

Last updated: 2026-02-24
Purpose: single session-to-session execution board for `MS-01..MS-15`.

## Status Legend
- `OPEN`: not started
- `IN_PROGRESS`: milestone actively being implemented
- `DONE`: implemented, verified, docs synced
- `BLOCKED`: waiting on decision/dependency

## Rules
1. Only one milestone can be `IN_PROGRESS` at a time.
2. Each milestone must map to one commit.
3. Move a milestone to `DONE` only after `npm run ms:gate` + milestone-specific checks pass.
4. Reflect any milestone completion in `docs/10-OFFER-PARITY-GAPS.md`.

## Board

| Spec | Gap | Milestone A | Milestone B | Milestone C | Milestone D | Notes |
|---|---|---|---|---|---|---|
| MS-01 | GAP-001 | DONE | DONE | DONE | DONE | MS-01 complete: unlimited policy model + runtime + billing + UI alignment. |
| MS-02 | GAP-002 | DONE | DONE | DONE | DONE | MS-02 complete (A-E): guarantee model, evaluators, extension logic, visibility, cancellation alignment. |
| MS-03 | GAP-003 | DONE | DONE | DONE | DONE | MS-03 complete: unified triggers + SMS keyword + quick-reply + fallback nudge cron. |
| MS-04 | GAP-004 | DONE | DONE | DONE | DONE | MS-04 complete: policy model + deferred lifecycle + category controls + observability. |
| MS-05 | GAP-005 | DONE | DONE | DONE | DONE | MS-05 complete: campaign ledger, planner, transitions, reporting visibility, and operator digest/alerts. |
| MS-06 | GAP-006 | DONE | DONE | DONE | DONE | MS-06 complete: deterministic model service, enriched inputs, report/email rendering, insufficient-data guardrails, typed report DTOs. |
| MS-07 | GAP-007 | DONE | DONE | DONE | DONE | MS-07 complete: 30-day cancellation policy + export request lifecycle + full bundle + secure download + admin SLA queue. |
| MS-08 | GAP-101 | DONE | DONE | DONE | DONE | MS-08 complete: policy mode resolver + required message classification + pure decision tests + diagnostics API/widget + mode-change audit events. |
| MS-09 | GAP-102 | OPEN | OPEN | OPEN | OPEN | |
| MS-10 | GAP-103 | OPEN | OPEN | OPEN | OPEN | |
| MS-11 | GAP-104 | OPEN | OPEN | OPEN | OPEN | |
| MS-12 | GAP-105 | OPEN | OPEN | OPEN | OPEN | |
| MS-13 | GAP-201 | OPEN | OPEN | OPEN | OPEN | |
| MS-14 | GAP-202 | OPEN | OPEN | OPEN | OPEN | |
| MS-15 | GAP-203 | OPEN | OPEN | OPEN | OPEN | |

## Execution Order
1. P0: `MS-01` to `MS-07`
2. P1: `MS-08` to `MS-12`
3. P2: `MS-13` to `MS-15`
