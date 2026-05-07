# STATE.md — ConversionSurgery RevGen

> Session-to-session state tracker. Updated at the end of every coding session.
> For project charter and validated requirements, see `.planning/PROJECT.md`.

## Current Phase

**Pre-launch hardening — closed.** Awaiting operator queue (DB migrations 0030+0031, R2 bucket provisioning, A2P/10DLC, Stripe live setup, E2E rehearsal). No code blockers.

### Recently Completed (last session 2026-05-07)

**Wave A — Billing & Checkout Infrastructure** (closed)
- A1-A7: schema, Stripe checkout, plan-availability, A5/A6 guarantee gates wired in cron, seed-plans script
- A8: doc reconciliation against Business Reference v1.0
- A9: tests for billing routes + cron handlers

**Wave A Hardening — Pre-Launch Compliance + Observability** (closed via commits `a5901c0` + `97002df`)
- Phase 0: 7 compliance-bypass sites migrated to gateway, `sendInternalSMS` sentinel, ESLint rule + CI gate
- Phase 1: lead-detail UI inquiry_date + sienna/red boundary badges, 3-mode discriminated union API, 24-month existing_customer path, both CSV uploaders (admin + client portal) with intakeMode toggle
- Phase 2: R2 audit log export with COMPLIANCE-mode Object Lock (7-year retention), sentinel block counter on `/admin/system-health`, Decision F per-client `contractor_alert_quiet_hours_enabled` toggle
- Wave 2B: vitest jsdom + @testing-library/react infra, 3 component tests (consent-status-badge, intake-mode-selector, create-lead-dialog)

**Test count:** 983 passing, 7 skipped, 0 failures (up from 312 at session start). Typecheck clean.

### Migrations Generated, NOT Yet Pushed

- `drizzle/0030_flawless_stingray.sql` — leads.inquiry_date, leads.dormant_reengagement_sent_at, consent_records.consent_evidence (CASL gate columns)
- `drizzle/0031_big_boom_boom.sql` — clients.contractor_alert_quiet_hours_enabled (Decision F)

Operator action: `pnpm run db:push` for both. See `.planning/phases/wave-A-hardening/OPERATOR-ACTIONS.md` Actions 1A + 2A.

### Operator Queue (Code Done, Human Required)

See `.planning/phases/wave-A-hardening/OPERATOR-ACTIONS.md` for full checklist (~3-4 hours).

| Checkpoint | Action | Time |
|---|---|---|
| 1A | Push migration 0030 | 2 min |
| 1A.1 | Verify columns + measure legacy lead count | 2 min |
| 1B | Create R2 bucket + COMPLIANCE Object Lock 2557 days | 10 min |
| 1C | Add 5 R2 env vars | 5 min |
| 2A | Push migration 0031 | 1 min |
| 2.5A/B/C | Pre-rehearsal sanity (7 grep audits + typecheck + decisions) | 10 min |
| 3A | 19-test E2E rehearsal | 110-150 min |
| 4A-4E | Doc sync + out-of-scope decisions (PG-002 deferral, etc.) | 60 min |

Plus pending tasks #17-30, #36 (Stripe live setup, A2P/10DLC, prospect list, etc.).

## Gap Register Status

`docs/product/02-OFFER-PARITY-GAPS.md`:

| Gap | Status | Notes |
|-----|--------|-------|
| PG-001 (21/30-day guarantee) | **Done** | A5/A6 cron handlers wired in main dispatcher (commit `dc907a9`) |
| PG-002 (channel attribution) | **Deferred** | Offer copy softened to "entry channel" — call vs. form vs. manual. Premium-tier only (PG-101..106). Reword complete in OFFER-APPROVED-COPY §6.2-6.3. |
| PG-003 (won/lost reason on leads) | **Open (P1)** | `lostReason` only on `jobs`, not `leads`. Win-back AI uses convo history without classifying objections. Cross-ref BL-14. |
| PG-004 (estimator reporting) | **Open (P1)** | No `assignedEstimatorId` FK on leads/appointments. Portal cannot filter pipeline by estimator. |
| PG-005 (first-response time KPI) | **Done** | Verified 2026-05-07. Surfaces in `/client/revenue` portal page, bi-weekly report payload (`report-generation.ts:402-424`), `/admin/reports/[id]`, ROI dashboard, call-prep, analytics-dashboard, AI-health. |

`docs/specs/PLATFORM-GAP-REGISTER.md`:
- Wave 1 (LB-01..10): all done
- Wave 2 (PL-01..14): all done
- Wave 3 backlog (BL-01..20): 16 todo, 1 done (BL-10), 1 false-positive (BL-19), 2 partially-addressed
- Wave 4 outliers (OUT-01..08): 8 todo
- Wave 5 Premium (W5-01..08): all todo — defer until first Standard buyer requests Premium

## Wave A Hardening Tracking

Lives separately at `.planning/phases/wave-A-hardening/`:
- `PLAN.md` — strategic plan (frozen, with Phase 2 implementation note resolving Neon-snapshot vs R2 drift)
- `OPERATOR-ACTIONS.md` — human-only checklist (5 checkpoints, ~3-4 hours)

This work was a NEW track, not a PG/BL line item. Going forward, map new work to existing register IDs (PG-003+PG-004 phase, BL-08+12+17+20 quality phase, etc.) so registers stay source of truth.

## Branch Health

- **Branch:** `main`
- **Last commit:** `97002df` feat(wave-a-hardening): Phase 2 + React test infra (Wave 2 complete)
- **Typecheck:** Clean
- **Tests:** 983 pass / 7 skip / 0 fail
- **Pre-push gate:** passed (build + tests + runtime smoke)
- **Uncommitted changes:** None

## Capacity Signal

- **Active clients:** 0
- **Operator max:** 10
- **Onboarding cap:** 2/week
- **Status:** GREEN (accepting)

## Next Decision Needed

1. **Operator queue execution.** Push migrations 0030 + 0031, provision R2, run 19-test E2E rehearsal. Code-side has no blockers.
2. **Next code phase target.** Three plausible tracks (pick one):
   - **PG-003 + PG-004** — won/lost reason on leads + estimator FK + portal filtering. P1 gaps for Standard tier.
   - **BL-08 + BL-12 + BL-17 + BL-20** — quality bundle (morning-of confirmation, Stripe link expiry, dollars/cents integrity, completed-without-won reporting hole).
   - **Sales execution support** — A2P/10DLC monitoring helpers, prospect list tooling, audit-template generation. Aligns with pending operator tasks #17-30.
3. **Self-serve tier opening.** Per memory: built but not sold. Future phase after first 3 managed Pilots validate.

## Operational Notes

- Wave A Hardening adds 4 new schema columns + 1 new R2 dependency + 1 new cron route (`/api/cron/audit-log-export`).
- Compliance gateway is now the single source of truth for outbound SMS (lead-facing via `sendCompliantMessage`, operator via `sendInternalSMS`). ESLint rule + CI gate prevent future bypass.
- All safety hooks active: env protection, sensitive-file blocks, dangerous-command blocks, commit validation, cleanup, smart-gate, twilio-bypass-guard, logging-guard.
- React component tests (jsdom + Testing Library) require Radix UI polyfills — see `vitest.setup.ts`.

---
*Last updated: 2026-05-07 (post Wave A Hardening close)*
