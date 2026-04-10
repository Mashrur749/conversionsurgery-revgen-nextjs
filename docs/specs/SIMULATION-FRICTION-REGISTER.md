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
| E1 | Quiet hours must use recipient timezone, not client timezone | compliance-gateway.ts | todo |
| E2 | Voice AI greeting: AI disclosure + recording consent | voice/ai/route.ts | todo |
| E3 | CASL 6-month expiry: calendar months + pre-expiry guard | compliance-service.ts, dormant-reengagement.ts | todo |
| E4 | Platform DNC blockedNumbers not cleared on re-opt-in | incoming-sms.ts | todo |

## WAVE 3 — Template/Content Fixes (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| B1 | Add callback phone to missed-call template | templates.ts + missed-call.ts | todo |
| B2 | Add "call to pay by phone" to payment templates | templates.ts + payment-reminder.ts | todo |
| B3 | Add "call us when ready" to estimate follow-up templates | templates.ts + estimate-followup.ts | todo |
| B4 | Dormant re-engagement template tone mismatch | dormant-reengagement.ts | todo |
| B5 | Review request needs project-specific reference | templates.ts + review-request.ts | todo |

## WAVE 4 — Sequence Logic Fixes (4 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| D1 | Estimate reply pause-and-resume instead of cancel-all | incoming-sms.ts | todo |
| D2 | Soft rejection should cancel ALL sequences | incoming-sms.ts | todo |
| D3 | Aggregate message rate cap before review/referral | review-request.ts | todo |
| D4 | Win-back timing adjustment for mid-sequence repliers | win-back.ts | todo |

## WAVE 5 — Data Integrity & Retention (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| F1 | Stuck estimate nudge (weekly, estimate_sent > 21d) | New: stuck-estimate-nudge.ts + cron | todo |
| F2 | Cancellation page: actual vs estimated ROI | cancellation.ts | todo |
| F3 | Operator cancellation alert on request creation | cancellation.ts | todo |
| F4 | Win-back email personalization with valueShown data | cancellation-reminders.ts | todo |
| F5 | Weekly digest should call out stuck estimates | weekly-digest.ts | todo |

## WAVE 6 — Notification Routing / Team Support (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| C1 | Team member notification for bookings (secondary recipients) | reminder-routing.ts | todo |
| C2 | No-show notification to assigned crew, not just owner | no-show-recovery.ts | todo |
| C3 | Weekly digest per-membership opt-in | weekly-digest.ts + schema | todo |
| C4 | Escalation notifications to office manager role | team-escalation.ts | todo |
| C5 | Pre-appointment context brief SMS to assigned estimator | New: appointment-context-brief.ts | todo |

## WAVE 7 — Compliance Hardening (3 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| E5 | Aggregate message rate cap + consent upgrade at job completion | compliance-gateway.ts, review-request.ts | todo |
| E6 | CASL calendar month fix + pre-expiry pause (remainder) | compliance-service.ts | todo |
| E7 | Quiet hours wall clock vs intended-send time | compliance-gateway.ts | todo |

## WAVE 8 — UX & AI Behavioral Fixes (5 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| J1 | Known-lead missed call gets contextual SMS | missed-call.ts | todo |
| J2 | One-word reply confusion detection → escalate | analyze-and-decide.ts | todo |
| J3 | Vendor/spam caller screening | missed-call.ts | todo |
| J4 | AI callback time promises guardrail | guardrails.ts | todo |
| J5 | Booking address required before confirmation | booking-conversation.ts | todo |

## WAVE 9 — Operator Tooling (6 items)

| ID | Description | File | Status |
|----|-------------|------|--------|
| I1 | Batch escalation acknowledge | New: admin API route | todo |
| I2 | Cross-client KB gap queue | New: admin page | todo |
| I3 | Agency weekly summary dashboard | New: admin page | todo |
| I4 | Triage card trigger detail + trend sparkline | admin/triage/page.tsx | todo |
| I5 | Digest preview before Monday send | New: admin API route | todo |
| I6 | Engagement health root cause analysis | engagement-health.ts | todo |

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
