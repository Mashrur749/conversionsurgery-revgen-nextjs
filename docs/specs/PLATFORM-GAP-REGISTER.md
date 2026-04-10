# Platform Gap Register

**Created**: 2026-04-09
**Source**: 10-agent stochastic consensus audit across all 18 service delivery domains
**Status**: Active — track resolution progress here

---

## Verification Status

All launch blockers verified against codebase on 2026-04-09. Claims confirmed accurate.

---

## WAVE 1 — Launch Blockers (fix before first client)

| ID | Domain | Gap | Effort | Status |
|----|--------|-----|--------|--------|
| LB-01 | Client Portal | No appointment list page — data exists, UI doesn't | 1-2 days | done |
| LB-02 | Booking | Crew not assigned/notified at booking | 1 day | done |
| LB-03 | Booking/All | Timezone hardcoded wrong in calendar_events, hot-transfer, campaigns | 1 day | done |
| LB-04 | Estimate Follow-Up | Sequences survive won/lost status changes | 30 min | done |
| LB-05 | Win-Back | Win-back fires on leads with active sequences from other automations | 1 hr | done |
| LB-06 | Voice AI | Callback requests stored but never actioned (no cron/notification) | 4 hrs | done |
| LB-07 | Onboarding | Business hours not checked in quality gates before AI activation | 2 hrs | done |
| LB-08 | Compliance | Quiet hours fallback to hardcoded timezone on resolution failure | 2 hrs | done |
| LB-09 | Lead Capture | Reply cancels ALL sequences indiscriminately (payment, review, etc.) | 2 hrs | done |
| LB-10 | Voice AI | Hot-transfer timezone hardcoded to America/Edmonton | 30 min | done |

## WAVE 2 — Pre-Launch (fix in first sprint)

| ID | Domain | Gap | Effort | Status |
|----|--------|-----|--------|--------|
| PL-01 | Client Portal | No job completion lifecycle — can't mark "done" to trigger review | 1 day | done |
| PL-02 | No-Show | Recovery fires without contractor verification | 4 hrs | done |
| PL-03 | Booking | Address not captured at booking time | 4 hrs | done |
| PL-04 | Reviews | No sentiment gate before review request — fires on frustrated leads | 4 hrs | done |
| PL-05 | Payment | No "Mark Paid (Cash/Check)" in client portal | 4 hrs | done |
| PL-06 | Reporting | "Without Us" ROI model uses wrong per-client baselines | 1 day | done |
| PL-07 | Reporting | `won` status never fires `job_won` funnel event via lead routes | 2 hrs | done |
| PL-08 | Compliance | No platform-level DNC — opt-outs are per-client only | 1 day | done |
| PL-09 | Onboarding | Quality gate doesn't block AI on empty KB (cascades to 6 domains) | 4 hrs | done |
| PL-10 | Voice AI | Overflow mode is selectable in UI but not implemented in webhook | 1 day | done |
| PL-11 | AI Conversation | Soft rejection ("not interested") not detected — win-back fires later | 4 hrs | done |
| PL-12 | Escalation | Single re-notification after 15 min insufficient for field crews | 4 hrs | done |
| PL-13 | Reviews | Referral request (day 4) fires even after negative review (day 1) | 2 hrs | done |
| PL-14 | Campaigns | Campaign scheduling uses UTC 10am, not client local time | 2 hrs | done |

## WAVE 3 — Post-Launch / Backlog

| ID | Domain | Gap | Effort | Status |
|----|--------|-----|--------|--------|
| BL-01 | Payment | No deposit/milestone payment split | 1-2 weeks | todo |
| BL-02 | Estimate FU | Static templates, no AI personalization (win-back uses AI, estimate doesn't) | 1 week | todo |
| BL-03 | Booking | Post-appointment quote capture via SMS to contractor | 1 week | todo |
| BL-04 | Booking | Booking window fixed at 7 days, no configurable lead time | 3 days | todo |
| BL-05 | Lead Capture | No MMS/photo-aware AI responses (photos sent but not analyzed) | 1 week | todo |
| BL-06 | Booking | appointments and calendar_events are parallel tables with no FK | 1 week | todo |
| BL-07 | AI Conversation | No returning customer recognition (repeat callers treated as new) | 3 days | todo |
| BL-08 | No-Show | No morning-of appointment confirmation (prevent vs recover) | 3 days | todo |
| BL-09 | Booking | Slot capacity not modeled — 1 appointment per slot regardless of crew count | 3 days | todo |
| BL-10 | AI Conversation | analyzeAndDecide node always uses Haiku regardless of lead value | 1 hr | done |
| BL-11 | Reporting | No lead source revenue breakdown in reports | 3 days | todo |
| BL-12 | Payment | Stripe payment link expiry not handled — no re-issue | 2 days | todo |
| BL-13 | Escalation | No callback scheduling from escalation queue | 1 week | todo |
| BL-14 | Win-Back | Win-back message ignores open objections in conversation history | 3 days | todo |
| BL-15 | Onboarding | No contractor portal walkthrough on first login | 1 week | todo |
| BL-16 | Voice AI | Voice AI has no SMS conversation memory (no cross-channel context) | 3 days | todo |
| BL-17 | Payment | Invoice dual amount model (dollars vs cents) — data integrity risk | 1 day | todo |
| BL-18 | Voice AI | No emergency escalation path for after-hours urgent calls | 3 days | todo |
| BL-19 | Compliance | Compliance cache not invalidated on opt-out (TCPA window) | 2 hrs | false_positive (cache IS cleared on opt-out + PL-08 adds cross-client DNC) |
| BL-20 | Reporting | `completed` without `won` loses revenue data ($0 in reports) | 1 day | todo |

## WAVE 4 — Outlier Ideas (high-creativity, evaluate for roadmap)

| ID | Domain | Idea | Effort | Status |
|----|--------|------|--------|--------|
| OUT-01 | Booking | Day-of homeowner prep SMS (who's coming, what to prepare) | 2 hrs | todo |
| OUT-02 | Reviews | Review count milestone celebrations (10/25/50/100) | 4 hrs | todo |
| OUT-03 | Reviews | Competitor review benchmarking via Google Places | 1 week | todo |
| OUT-04 | Weekly Digest | "Biggest opportunity this week" call-out in digest | 4 hrs | todo |
| OUT-05 | Compliance | Voice AI consent/recording disclosure | 2 hrs | todo |
| OUT-06 | Knowledge Base | KB answer quality scoring (track which entries lead to escalations) | 1 week | todo |
| OUT-07 | Compliance | CASL consent expiry dashboard for operator | 1 week | todo |
| OUT-08 | Lead Capture | Facebook Lead Ad integration | 2 weeks | todo |
