# STATE.md — ConversionSurgery RevGen

> Session-to-session state tracker. Updated at the end of every coding session.
> For project charter and validated requirements, see `.planning/PROJECT.md`.

## Current Phase

**Wave A — Billing & Checkout Infrastructure** (closing)

### Completed
- A1: Schema migration (plans table, setup fee, tier availability)
- A2: `createCheckoutSession` + checkout-link admin API endpoint
- A4: `isPlanAvailable()` + Pilot cap guard
- A5: Day-21 go-live guarantee gate (`processGoLiveGate`)
- A6: Day-30 logging guarantee gate (`processLoggingGate`) with low-volume deferral
- A7: `seed-plans.ts` for plan provisioning
- A5/A6 cron wiring: `guarantee-21day` and `guarantee-30day` routes now dispatched in main cron scheduler
- Migrations 0028/0029 committed (`client_cancellations`, `first_recovery_replay_sent_at`)

### In Progress
- A8: Doc reconciliation — ensure OFFER-APPROVED-COPY.md matches built capabilities
- A9: Test coverage for billing routes, webhooks, cron handlers

### Blockers
- None

## Gap Register Status

| Gap | Status | Notes |
|-----|--------|-------|
| PG-001 (21/30-day guarantee) | **Resolved** | A5/A6 implemented and wired in cron dispatcher |
| PG-002 (channel attribution) | **Open** | Only `missed_call`/`form`/`manual` captured. Blocks Standard tier if source-visibility is promised. |
| PG-003 (won/lost reason) | Open | `lostReason` only on `jobs`, not `leads` |
| PG-004 (estimator reporting) | Open | No `assignedEstimatorId` FK |
| PG-005 (first-response time KPI) | Open | Metric logged internally; unverified in reports/portal |

## Branch Health

- **Branch:** `main`
- **Last commit:** `feat(kimi): add CLI parity infrastructure`
- **Typecheck:** Clean
- **Uncommitted changes:** None (except `active/consensus/` — review and move/delete)
- **Migrations:** 0028/0029 committed, applied to dev DB

## Capacity Signal

- **Active clients:** 0
- **Operator max:** 10
- **Onboarding cap:** 2/week
- **Status:** GREEN (accepting)

## Next Decision Needed

1. **A8 completion:** Reconcile offer copy with built features. Does anything in OFFER-APPROVED-COPY.md claim something not yet implemented?
2. **PG-002:** Implement channel-level lead source attribution (Google/Houzz/LSA/referral/organic) or change offer language.
3. **A9 test strategy:** Which billing/webhook/cron routes need unit tests first?

## Operational Notes

- Kimi CLI parity now complete. See `KIMI.md` for hook inventory and tool mapping.
- All safety hooks active: env protection (read + write), sensitive file blocks, dangerous command blocks, commit validation, cleanup.
- Context-mode plugin memory block removed from `AGENTS.md` (stale). Use `.planning/STATE.md` + `.claude/progress.md` for cross-session context.

---
*Last updated: 2026-05-05*
