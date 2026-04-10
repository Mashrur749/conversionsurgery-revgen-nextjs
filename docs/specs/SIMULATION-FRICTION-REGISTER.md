# Simulation Friction Register

**Source**: 11-agent real-world simulation (10 personas + 1 compliance audit)
**Created**: 2026-04-10
**Total frictions**: 119 across 10 execution waves
**Consensus report**: `active/consensus/consensus_report.md`

---

## WAVE 1 — Verified Code Bugs (4 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| A1 | Win-back step 2 skips `estimate_sent` leads | win-back.ts | done |
| A2 | Dormant lead status not promoted on inbound reply | incoming-sms.ts | done |
| A3 | Voice callback cron misses null `callbackTime` | voice-callbacks/route.ts | done |
| A4 | Blocked scheduled message has no state transition | process-scheduled/route.ts | done |

## WAVE 2 — Compliance Fixes (4 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| E1 | Quiet hours must use recipient timezone, not client timezone | compliance-gateway.ts | done |
| E2 | Voice AI greeting: AI disclosure + recording consent | voice/ai/route.ts | done |
| E3 | CASL 6-month expiry: calendar months + pre-expiry guard | compliance-service.ts, dormant-reengagement.ts | done |
| E4 | Platform DNC blockedNumbers not cleared on re-opt-in | incoming-sms.ts | done |

## WAVE 3 — Template/Content Fixes (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| B1 | Add callback phone to missed-call template | templates.ts + missed-call.ts | done |
| B2 | Add "call to pay by phone" to payment templates | templates.ts + payment-reminder.ts | done |
| B3 | Add "call us when ready" to estimate follow-up templates | templates.ts + estimate-followup.ts | done |
| B4 | Dormant re-engagement template tone mismatch | dormant-reengagement.ts | done |
| B5 | Review request needs project-specific reference | templates.ts + review-request.ts | done |

## WAVE 4 — Sequence Logic Fixes (4 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| D1 | Estimate reply pause-and-resume instead of cancel-all | incoming-sms.ts | done |
| D2 | Soft rejection should cancel ALL sequences | incoming-sms.ts | done |
| D3 | Aggregate message rate cap before review/referral | review-request.ts | done |
| D4 | Win-back timing adjustment for mid-sequence repliers | win-back.ts | done |

## WAVE 5 — Data Integrity & Retention (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| F1 | Stuck estimate nudge (weekly, estimate_sent > 21d) | New: stuck-estimate-nudge.ts + cron | done |
| F2 | Cancellation page: actual vs estimated ROI | cancellation.ts | done |
| F3 | Operator cancellation alert on request creation | cancellation.ts | done |
| F4 | Win-back email personalization with valueShown data | cancellation-reminders.ts | done |
| F5 | Weekly digest should call out stuck estimates | weekly-digest.ts | done |

## WAVE 6 — Notification Routing / Team Support (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| C1 | Team member notification for bookings (secondary recipients) | reminder-routing.ts | done |
| C2 | No-show notification to assigned crew, not just owner | no-show-recovery.ts | done |
| C3 | Weekly digest per-membership opt-in | weekly-digest.ts + schema | done |
| C4 | Escalation notifications to office manager role | team-bridge.ts (documented) | done |
| C5 | Pre-appointment context brief SMS to assigned estimator | appointment-reminder.ts | done |

## WAVE 7 — Compliance Hardening (3 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| E5 | Aggregate message rate cap + consent upgrade at job completion | compliance-gateway.ts, review-request.ts | done |
| E6 | CASL calendar month fix + pre-expiry pause (remainder) | compliance-service.ts | done (verified existing) |
| E7 | Quiet hours wall clock vs intended-send time | compliance-gateway.ts | done |

## WAVE 8 — UX & AI Behavioral Fixes (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| J1 | Known-lead missed call gets contextual SMS | missed-call.ts | done |
| J2 | One-word reply confusion detection → escalate | guardrails.ts | done |
| J3 | Vendor/spam caller screening | incoming-sms.ts | done |
| J4 | AI callback time promises guardrail | guardrails.ts | done |
| J5 | Booking address required before confirmation | booking-conversation.ts + incoming-sms.ts | done |

## WAVE 9 — Operator Tooling (6 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| I1 | Batch escalation acknowledge | New: admin API route | done |
| I2 | Cross-client KB gap queue | New: admin page + API | done |
| I3 | Agency weekly summary dashboard | New: admin page | done |
| I4 | Triage card trigger detail + trend sparkline | admin/triage/ | done |
| I5 | Digest preview before Monday send | New: admin API route | done |
| I6 | Engagement health root cause analysis | engagement-health.ts | done |

## WAVE 10 — Capacity/Scale & Multi-Person (8 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| G1 | Team member SMS command authentication (EST, NOSHOW, DONE) | incoming-sms.ts, team-bridge.ts | todo |
| G2 | Crew availability/DND toggle | Schema + API route | todo |
| G3 | Hot transfer role filtering | hot-transfer.ts | todo |
| G4 | Notification batching (hourly digest vs per-message) | team-escalation.ts + new service | todo |
| H1 | Message limit raise for managed service tier | usage/subscription config | todo |
| H2 | Booking window waitlist when all slots full | booking-conversation.ts | todo |
| H3 | Escalation batching during surge | team-escalation.ts | todo |
| H4 | Conversation history token-budget-aware truncation | context-builder.ts | todo |
