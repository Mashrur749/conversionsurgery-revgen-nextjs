# Failure Mode Analysis Report: Managed Service Delivery

**Target**: ConversionSurgery managed service delivery system — full client lifecycle from sales through Month 6+ steady-state
**Boundary**: Service delivery process, guarantee mechanics, operator workflows, platform reliability where it affects client-facing promises. Excludes internal engineering concerns that don't surface to the client.
**Perspectives**: Contractor (client experience/trust), Operator (workload/sustainability), Business (revenue/guarantee risk)
**Time horizon**: Per client per quarter
**Date**: 2026-04-14
**Simulation**: 10,000 scenarios, 59 failure modes, seed 42

---

## Executive Summary

This analysis identified **59 failure modes** across the full managed service lifecycle — from sales qualification through Month 6 steady-state operations. Monte Carlo simulation across 10,000 stochastic scenarios reveals that **zero-failure quarters are essentially impossible** (0.2% of scenarios). In a typical quarter, expect **17 failure modes to fire** with a severity score of 111. The worst realistic case (P95) involves **29 failures** with severity of 188.

**The single highest-leverage finding**: the "disengaged contractor" correlation group drives **+32 points of P95 severity** — more than all other correlation groups combined. When a contractor disengages (doesn't flag estimates, doesn't mark jobs WON/LOST, ignores KB gap notifications, doesn't respond to booking confirmations), six downstream systems fail simultaneously: ROI reporting goes blank, guarantee evaluation has no data, the highest-value automation (estimate follow-up) goes unused, and the bi-weekly report — the #1 retention mechanism — shows $0 value.

**The three highest-leverage mitigations** (in order):
1. **Contractor engagement automation** — proactive detection and intervention when EST/WON/LOST triggers go silent. Breaks the disengaged_contractor cascade.
2. **Operator capacity planning** — define the hiring trigger (client count threshold) and cross-train a backup. Breaks operator_overload cascade affecting 6 failure modes.
3. **Quiet hours legal resolution** — the 13-hour daily gap is the single highest-RPN failure mode (100). Legal confirmation of inbound-reply exemption would eliminate it entirely.

---

## Risk Distribution (Monte Carlo, N=10,000)

| Metric | P5 | P25 | P50 (typical) | P75 | P95 (worst realistic) | P99 (catastrophic) |
|--------|:--:|:---:|:-------------:|:---:|:---------------------:|:------------------:|
| Failures fired per quarter | 5 | 12 | 17 | 22 | 29 | 33 |
| Total severity score | 28 | 76 | 111 | 145 | 188 | 212 |
| Max detection delay (min) | 60 | 120 | 120 | 120 | 480 | 480 |
| Cascade depth | 0 | 1 | 2 | 4 | 6 | 7 |

**Interpretation**: In a typical quarter per client, expect ~17 things to go at least partially wrong with a combined severity of 111. Most are low-severity (spam engagement, minor timing issues). In the worst realistic case (1 in 20 quarters), 29 failures compound to severity 188 — this is the "bad quarter" where a disengaged contractor + operator overload + platform hiccup stack. The catastrophic tail (1 in 100) hits 212 with cascade depth 7, meaning a failure chain propagated 7 levels deep.

### Per-Perspective Severity Distribution

| Perspective | P50 | P95 | Mean |
|------------|:---:|:---:|:----:|
| **Business** (revenue, guarantee, churn) | 57 | 96 | 55.1 |
| **Contractor** (experience, trust) | 34 | 67 | 33.5 |
| **Operator** (workload, sustainability) | 22 | 44 | 21.7 |

Business risk dominates — the revenue/guarantee exposure is nearly 2x the contractor experience risk. This is because contractor-facing failures (AI hallucination, wrong booking) are individually severe but rare, while business failures (missing WON data, silent disengagement, guarantee exposure) are individually moderate but highly probable and correlated.

---

## Top 15 Failure Modes by Risk Priority Number (RPN)

| # | ID | Component | Failure Mode | S | P | D | RPN | Prob | Cascade? |
|---|:--:|-----------|-------------|:-:|:-:|:-:|:---:|:----:|:--------:|
| 1 | FM-38 | AI Conversations | Quiet hours gap — 13h window, lead contacts competitor | 5 | 25% | 8 | 100 | 25% | No |
| 2 | FM-40 | Estimate Follow-Up | Contractor never flags estimates — highest-value automation unused | 8 | 20% | 6 | 96 | 20% | Yes (2) |
| 3 | FM-56 | Revenue Capture | Contractor never marks WON/LOST — ROI invisible, guarantee data missing | 8 | 15% | 6 | 72 | 15% | Yes (2) |
| 4 | FM-70 | At-Risk Detection | At-risk signals missed — contractor silently disengaging | 8 | 10% | 8 | 64 | 10% | No |
| 5 | FM-31 | KB Sprint | KB gaps accumulate — contractor ignores gap notifications | 6 | 20% | 5 | 60 | 20% | Yes (2) |
| 6 | FM-01 | Sales Qualification | Wrong ICP signed (<5 leads/mo, no dead quotes) | 7 | 10% | 8 | 56 | 10% | Yes (3) |
| 7 | FM-53 | Bi-Weekly Report | Report shows $0 revenue — contractor not flagging WON | 7 | 20% | 4 | 56 | 20% | Yes (1) |
| 8 | FM-09 | Phone Setup | Voicemail not disabled — intercepts before forward | 8 | 12% | 5 | 48 | 12% | Yes (1) |
| 9 | FM-11 | KB Population | No pricing ranges entered — AI defers #1 question | 6 | 20% | 4 | 48 | 20% | Yes (2) |
| 10 | FM-73 | Operator Capacity | Operator at capacity (>8 clients) — quality degrades | 8 | 10% | 6 | 48 | 10% | Yes (5) |
| 11 | FM-05 | Payment Capture | Contractor forgets trial — Day 31 charge surprise | 6 | 10% | 7 | 42 | 10% | Yes (1) |
| 12 | FM-13 | KB Population | KB too thin for autonomous — <10 entries | 7 | 15% | 4 | 42 | 15% | Yes (2) |
| 13 | FM-14 | Exclusion List | Exclusion list skipped — AI texts family/friends | 10 | 5% | 8 | 40 | 5% | No |
| 14 | FM-59 | Guarantee | Layer 2 attribution ambiguous — contractor disputes | 7 | 8% | 7 | 39 | 8% | No |
| 15 | FM-02 | Sales Qualification | Volume disclosure skipped — guarantee extension not explained | 5 | 8% | 9 | 36 | 8% | Yes (1) |

---

## Cascade Chains

| Chain | Trigger | Propagation Path | Combined Impact | Sim Frequency |
|-------|---------|-----------------|-----------------|:-------------:|
| **CC-1: Disengaged Contractor Death Spiral** | FM-40 (no EST triggers) | FM-40 → FM-56 (no WON/LOST) → FM-53 ($0 reports) → FM-61 (false guarantee refund) | ROI invisible, guarantee refund on active client, retention impossible | 71% (FM-61 fires) |
| **CC-2: Thin KB Cascade** | FM-06 (vague onboarding) | FM-06 → FM-13 (KB too thin) → FM-33 (premature autonomous) → FM-35 (hallucination) + FM-37 (missed escalation) | AI gives wrong info, misses escalations, trust destruction | 56% (FM-13 fires) |
| **CC-3: Operator Overload Cascade** | FM-73 (>8 clients) | FM-73 → FM-28 (Smart Assist delayed) + FM-54 (calls skipped) + FM-64 (Day 45 missed) + FM-21 (audit late) + FM-68 (escalations breached) | All quality touchpoints degrade simultaneously | 44% (FM-73 fires) |
| **CC-4: Wrong ICP Cascade** | FM-01 (bad fit signed) | FM-01 → FM-20 (zero leads) → FM-27 (no Day 7 data) + FM-58 (L1 guarantee fails) + FM-65 (empty reactivation list) | Guarantee triggered, empty campaigns, wasted operator time | 10% (FM-01 fires) |
| **CC-5: Phone Setup Cascade** | FM-09 (voicemail active) | FM-09 → FM-18 (text-back fails) → FM-20 (no wow moment) | Day-1 value delivery fails, contractor doubts service | 12% (FM-09 fires) |
| **CC-6: Solo Operator Failure** | FM-74 (operator unavailable) | FM-74 → FM-28 + FM-54 + FM-68 (all manual touchpoints fail simultaneously) | Complete service interruption for all clients | 5% (FM-74 fires) |

---

## Sensitivity Analysis — Highest-Leverage Risks

The following table shows how much P95 severity improves when each failure mode's probability is halved. Higher delta = higher leverage for mitigation investment.

| # | Failure Mode | P (current) | P (halved) | P95 Impact (baseline) | P95 (mitigated) | Delta | Rank |
|---|-------------|:-----------:|:----------:|:--------------------:|:---------------:|:-----:|:----:|
| 1 | FM-01: Wrong ICP signed | 10% | 5% | 188 | 184 | +4.0 | 1 |
| 2 | FM-05: Trial charge surprise | 10% | 5% | 188 | 184 | +4.0 | 1 |
| 3 | FM-31: KB gaps accumulate | 20% | 10% | 188 | 184 | +4.0 | 1 |
| 4 | FM-43: No Google Calendar | 15% | 7.5% | 188 | 184 | +4.0 | 1 |
| 5 | FM-15: No old quotes available | 15% | 7.5% | 188 | 184.05 | +3.95 | 5 |
| 6 | FM-11: No pricing ranges | 20% | 10% | 188 | 185 | +3.0 | 6 |
| 7 | FM-38: Quiet hours gap | 25% | 12.5% | 188 | 186 | +2.0 | 7 |
| 8 | FM-73: Operator overload | 10% | 5% | 188 | 186 | +2.0 | 7 |

Note: Individual FM sensitivity deltas are modest (2-4 points) because risk is distributed across 59 failure modes. The real leverage is in correlation groups (see below).

---

## Correlation Groups — The Highest-Leverage Architecture Finding

Correlation groups model failures that share a root cause and fire together. Breaking a correlation (making failures independent) shows how much P95 severity drops.

| Group | Shared Root Cause | Member FMs | P95 (correlated) | P95 (decorrelated) | Delta | Interpretation |
|-------|------------------|:----------:|:-----------------:|:------------------:|:-----:|---------------|
| **disengaged_contractor** | Contractor stops engaging with system triggers | FM-05, FM-07, FM-15, FM-31, FM-40, FM-44, FM-53, FM-56, FM-63 | 188 | 156 | **+32** | **Single biggest risk driver.** When one engagement drops, all drop. |
| **operator_overload** | Solo operator hits capacity wall | FM-21, FM-28, FM-54, FM-64, FM-68, FM-73 | 188 | 170 | **+18** | Second-biggest. Manual touchpoints fail as a group. |
| **platform_down** | External service outage | FM-18, FM-75, FM-76, FM-77 | 188 | 182 | +6 | Moderate. Mitigated by service SLAs (Twilio 99.95%, Stripe 99.99%). |
| **low_volume** | Contractor has <15 leads/month | FM-20, FM-24, FM-27, FM-67 | 188 | 183 | +5 | Moderate. Pre-qualification is the only mitigation. |
| **thin_kb** | Knowledge base insufficiently populated | FM-06, FM-11, FM-13 | 188 | 184 | +4 | Lower. KB quality assurance process exists but needs enforcement. |
| **bad_fit** | Wrong ICP signed despite red flags | FM-01, FM-02 | 188 | 185 | +3 | Lowest. Sales discipline is the only lever. |

**The disengaged_contractor group is worth deep analysis.** It contains 9 failure modes that fire together when a contractor mentally checks out. The correlation makes sense: a contractor who doesn't flag estimates (FM-40) also doesn't mark WON/LOST (FM-56), also ignores KB gap notifications (FM-31), also doesn't respond to booking confirmations (FM-44). These aren't independent — they're symptoms of one underlying state: the contractor isn't bought in.

The +32 P95 delta means that if you could make these failures independent (i.e., a contractor who doesn't flag estimates but still marks WON/LOST), the worst-case quarter drops from 188 to 156. **That's a 17% reduction in worst-case severity from a single architectural intervention.**

---

## Mitigation Priority Matrix

Ranked by effectiveness score = (RPN_before - RPN_after) / effort_weight, where S=1, M=2, L=3.

| # | Failure Mode(s) | Mitigation | P Before → After | RPN Before → After | Effort | Effectiveness | Cascade Chains Broken |
|---|----------------|-----------|:-----------------:|:------------------:|:------:|:-------------:|:---------------------:|
| 1 | FM-40, FM-56 (EST/WON triggers unused) | **Contractor engagement score + auto-escalation.** Platform tracks days-since-last-EST and days-since-last-WON. After 14 days with no EST trigger: escalate to operator with specific intervention script. After 21 days with no WON/LOST: auto-prompt on bi-weekly call agenda. Combine with the existing probable-wins-nudge and stuck-estimate-nudge but add operator visibility when nudges go unanswered. | 20%→8% / 15%→6% | 96→38 / 72→29 | M | **33.5** | CC-1 (Death Spiral) |
| 2 | FM-73, FM-74 (Operator overload + solo failure) | **Capacity trigger + backup operator.** Define hard cap: at 8 clients, hire part-time ops support. Cross-train one person on Smart Assist review, escalation handling, and bi-weekly call format. Document all operator playbook steps as checklists (already done in MANAGED-SERVICE-PLAYBOOK.md). | 10%→3% / 5%→2% | 48→14 / 45→9 | L | **23.3** | CC-3, CC-6 |
| 3 | FM-38 (Quiet hours gap) | **Legal review completion.** If inbound-reply exemption confirmed: update compliance gateway to distinguish inbound replies (send immediately) from proactive outreach (queue). If not confirmed: update all marketing to "during permitted hours" and adjust Leads at Risk methodology. Already flagged as high-priority legal item in OFFER-STRATEGY Part 10. | 25%→5% (if confirmed) | 100→20 | S | **80** | None (standalone) |
| 4 | FM-09 (Voicemail intercepts forwarding) | **Pre-onboarding SMS test.** Before the onboarding call, send a test SMS to the contractor's business line and verify delivery. Add voicemail disable to a mandatory checklist item with carrier-specific codes. Already partially covered in playbook (Section 10) but make it a blocking gate. | 12%→3% | 48→12 | S | **36** | CC-5 |
| 5 | FM-14 (Exclusion list skipped) | **Make exclusion list a mandatory onboarding gate.** Platform blocks autonomous mode activation until exclusion list has been reviewed (even if empty — the gate requires the operator to confirm "asked about exclusions"). Add to onboarding quality gates. | 5%→1% | 40→8 | S | **32** | None (nuclear event prevention) |
| 6 | FM-01 (Wrong ICP signed) | **Sales qualification checklist enforcement.** The 30-second qualifier exists in ICP-DEFINITION.md. Add a structured pre-call form in the CRM that blocks client creation unless volume, project value, and follow-up gap are recorded. Flag sub-15 volume with mandatory guarantee extension disclosure. | 10%→3% | 56→17 | S | **39** | CC-4 |
| 7 | FM-11 (No pricing ranges) | **Pricing range as onboarding quality gate.** Already implemented — the onboarding quality gate requires at least 1 service with a pricing range. Enforcement needs verification: check if the gate actually blocks autonomous mode or just warns. | 20%→5% | 48→12 | S | **36** | CC-2 (partial) |
| 8 | FM-70 (At-risk signals missed) | **Automated engagement health scoring.** Already partially built (`engagement-health.ts` + weekly cron). Add: if engagement score drops below threshold for 2 consecutive weeks, auto-create a priority-1 operator task. Connect to the at-risk recovery process in playbook Section 1.5. | 10%→3% | 64→19 | M | **22.5** | CC-1 (early warning) |
| 9 | FM-05 (Trial charge surprise) | **Day 25 billing reminder SMS.** Automated message to contractor: "Your free month ends in 5 days. Billing starts [date] at $1,000/month. Questions? Reply to this message." Prevents surprise charge and gives 5-day window to cancel or ask questions. | 10%→2% | 42→8 | S | **34** | None |
| 10 | FM-33 (Premature autonomous) | **Autonomous mode readiness score.** Auto-calculate: KB entry count, reviewed interaction count, escalation rate over last 7 days, AI test pass rate. Block mode transition until score exceeds threshold. Gate already partially exists — needs enforcement in the UI. | 8%→2% | 40→10 | M | **15** | CC-2 |

---

## Complete Failure Mode Register

### Sales & Onboarding

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-01 | Sales Qualification | Wrong ICP signed (<5 leads/mo, no dead quotes) | 7 | 10 | 8 | 56 | 10% | bad_fit |
| FM-02 | Sales Qualification | Volume disclosure skipped | 5 | 8 | 9 | 36 | 8% | bad_fit |
| FM-03 | Sales Demo | "Call Your Number" demo fails | 6 | 5 | 1 | 3 | 5% | — |
| FM-04 | Payment Capture | Card not captured on call | 8 | 15 | 1 | 12 | 15% | — |
| FM-05 | Payment Capture | Trial charge surprise (Day 31) | 6 | 10 | 7 | 42 | 10% | disengaged |
| FM-06 | Onboarding Call | Contractor vague on KB (<3 entries) | 7 | 15 | 3 | 32 | 15% | thin_kb |
| FM-07 | Onboarding Call | Onboarding call no-show | 5 | 8 | 1 | 4 | 8% | disengaged |

### Phone & Configuration

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-08 | Phone Setup | Call forwarding fails (carrier/VoIP) | 8 | 8 | 2 | 13 | 8% | — |
| FM-09 | Phone Setup | Voicemail not disabled | 8 | 12 | 5 | 48 | 12% | — |
| FM-11 | KB Population | No pricing ranges entered | 6 | 20 | 4 | 48 | 20% | thin_kb |
| FM-12 | KB Population | KB entries are wrong | 9 | 5 | 7 | 32 | 5% | — |
| FM-13 | KB Population | KB too thin for autonomous | 7 | 15 | 4 | 42 | 15% | thin_kb |
| FM-14 | Exclusion List | Exclusion list skipped | 10 | 5 | 8 | 40 | 5% | — |

### Quote Import & Early Activation

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-15 | Quote Import | No old quotes available | 5 | 15 | 2 | 15 | 15% | disengaged |
| FM-16 | Quote Import | Imported numbers wrong/disconnected | 4 | 10 | 3 | 12 | 10% | — |
| FM-18 | Day-1 Activation | Missed call text-back doesn't fire | 8 | 5 | 3 | 12 | 5% | platform_down |
| FM-20 | Week 1 | Zero inbound leads first 48h | 5 | 12 | 6 | 36 | 12% | low_volume |
| FM-21 | Revenue Leak Audit | Audit not delivered within 48h | 5 | 10 | 5 | 25 | 10% | operator_overload |
| FM-23 | Week 1 | Web form integration fails | 5 | 10 | 4 | 20 | 10% | — |
| FM-24 | Week 1 | Zero lead volume entire Week 1 | 4 | 8 | 6 | 19 | 8% | low_volume |

### Listing Migration & Week 2

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-25 | Listing Migration | Contractor refuses migration | 4 | 25 | 3 | 30 | 25% | — |
| FM-27 | Listing Migration | Day 7 call with zero data | 4 | 10 | 4 | 16 | 10% | low_volume |
| FM-28 | Smart Assist | Operator overwhelmed (8+ SA clients) | 7 | 8 | 3 | 17 | 8% | operator_overload |
| FM-29 | Smart Assist | SA SMS goes to contractor (no op phone) | 5 | 5 | 2 | 5 | 5% | — |
| FM-31 | KB Sprint | KB gaps accumulate (ignored notifications) | 6 | 20 | 5 | 60 | 20% | disengaged |
| FM-33 | Autonomous Transition | Premature autonomous (<30 interactions) | 8 | 8 | 5 | 32 | 8% | — |

### Ongoing Operations

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-35 | AI Conversations | AI hallucination (wrong info stated) | 9 | 5 | 7 | 32 | 5% | — |
| FM-37 | AI Conversations | AI fails to escalate | 8 | 3 | 6 | 14 | 3% | — |
| FM-38 | AI Conversations | Quiet hours gap (13h window) | 5 | 25 | 8 | 100 | 25% | — |
| FM-39 | AI Conversations | AI engages spam/wrong number | 2 | 15 | 5 | 15 | 15% | — |
| FM-40 | Estimate Follow-Up | EST trigger never used | 8 | 20 | 6 | 96 | 20% | disengaged |
| FM-42 | Estimate Follow-Up | Follow-up after competitor chosen | 4 | 10 | 6 | 24 | 10% | — |
| FM-43 | Appointment Booking | No Google Calendar connected | 6 | 15 | 3 | 27 | 15% | — |
| FM-44 | Appointment Booking | Booking confirmation timeout | 5 | 10 | 3 | 15 | 10% | disengaged |
| FM-45 | Appointment Booking | Wrong time booked (timezone) | 6 | 3 | 4 | 7 | 3% | — |
| FM-46 | No-Show Recovery | No-show SMS when appointment happened | 5 | 5 | 5 | 13 | 5% | — |
| FM-47 | Payment Collection | Reminder for paid invoice | 6 | 2 | 4 | 5 | 2% | — |
| FM-49 | Review Generation | Review ask after negative experience | 7 | 3 | 6 | 13 | 3% | — |
| FM-51 | Win-Back | Reactivation to reassigned numbers | 6 | 5 | 7 | 21 | 5% | — |

### Reporting & Guarantee

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-53 | Bi-Weekly Report | Report shows $0 revenue | 7 | 20 | 4 | 56 | 20% | disengaged |
| FM-54 | Strategy Call | Call skipped (operator overloaded) | 7 | 10 | 5 | 35 | 10% | operator_overload |
| FM-56 | Revenue Capture | Never marks WON/LOST | 8 | 15 | 6 | 72 | 15% | disengaged |
| FM-58 | Guarantee | Layer 1 fails on legit client | 9 | 5 | 3 | 14 | 5% | — |
| FM-59 | Guarantee | Layer 2 attribution ambiguous | 7 | 8 | 7 | 39 | 8% | — |
| FM-61 | Guarantee | False refund (client has value but $0 data) | 9 | 5 | 8 | 36 | 5% | — |
| FM-62 | Billing | Card declines on Day 31 | 5 | 5 | 2 | 5 | 5% | — |
| FM-63 | Billing | Contractor disputes Day 31 charge | 6 | 5 | 3 | 9 | 5% | disengaged |

### Retention & Growth

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-64 | Day 45 Call | Retention call not made | 6 | 10 | 5 | 30 | 10% | operator_overload |
| FM-65 | Growth Blitz | Dormant list empty | 5 | 12 | 4 | 24 | 12% | — |
| FM-66 | Growth Blitz | Reactivation to reassigned numbers (6mo+) | 5 | 8 | 7 | 28 | 8% | — |
| FM-67 | Pipeline SMS | Alarming numbers trigger cancellation inquiry | 5 | 10 | 3 | 15 | 10% | low_volume |
| FM-70 | At-Risk Detection | Churn signals missed | 8 | 10 | 8 | 64 | 10% | — |

### Operator Capacity & Platform

| ID | Component | Failure Mode | S | P(%) | D | RPN | Prob | Corr Group |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:----:|:----------:|
| FM-68 | Escalation Queue | Queue overwhelmed, SLA breached | 7 | 8 | 3 | 17 | 8% | operator_overload |
| FM-73 | Operator Capacity | >8 clients, quality degrades | 8 | 10 | 6 | 48 | 10% | operator_overload |
| FM-74 | Operator Capacity | Solo operator unavailable | 9 | 5 | 2 | 9 | 5% | — |
| FM-75 | Platform | Twilio outage | 9 | 2 | 2 | 4 | 2% | platform_down |
| FM-76 | Platform | Stripe outage | 5 | 1 | 2 | 1 | 1% | platform_down |
| FM-77 | Platform | Anthropic API outage | 8 | 2 | 2 | 3 | 2% | platform_down |
| FM-79 | Platform | Google Calendar API quota | 5 | 3 | 3 | 5 | 3% | — |

---

## Component Dependency Graph

```
C1: [Sales Qualification] → C2: [Sales Demo/Close] → C3: [Payment Capture]
                                                       ↓
C4: [Onboarding Call] ─────────────────────────────────┘
  ├→ C5: [Phone Setup] ──→ C9: [Day-1 Activation]
  ├→ C6: [KB Population] ──→ C14: [KB Sprint]
  ├→ C7: [Exclusion List]     ↓
  └→ C8: [Quote Import] ──→ C10: [Revenue Leak Audit]
                               ↓
C9 ──→ C11: [Week 1 Operation]
         ├→ C12: [Day 7 Listing Migration]
         └→ C13: [Smart Assist (Week 2)]
                   ↓
              C15: [Autonomous Mode] ────────────────────────────────┐
                ├→ C16: [AI Conversations] → C31: [Escalations]     │
                ├→ C17: [Estimate Follow-Up]                         │
                ├→ C18: [Appointment Booking] → C19: [No-Show]      │
                ├→ C20: [Payment Collection]                         │
                ├→ C21: [Review Generation]                          │
                ├→ C22: [Win-Back]                                   │
                ├→ C23: [Bi-Weekly Report + Call] → C24: [Rev Cap]   │
                ├→ C25: [Day 30 Guarantee] → C26: [Billing Start]   │
                ├→ C27: [Day 45 Retention Call]                      │
                ├→ C28: [Day 90 Guarantee]                           │
                ├→ C29: [Quarterly Growth Blitz]                     │
                ├→ C30: [Weekly Pipeline SMS]                        │
                └→ C32: [At-Risk Detection]                          │
                                                                     │
C33: [Cancellation & Export] ←───────────────────────────────────────┘

Cross-cutting dependencies:
  C31: [Escalations] depends on C6 (KB quality) + C73 (operator capacity)
  C24: [Revenue Capture] feeds C23, C25, C28 (reporting + guarantees)
  C32: [At-Risk Detection] feeds C33 (cancellation prevention)
```

---

## Simulation Parameters

### Failure Probabilities (per client per quarter)

Calibrated using `references/probability-calibration.md` base rates with the following adjustments:

- **Process failures** (contractor dependency): base rates from human/process table, 1.5x multiplier for bus factor = 1 (solo operator)
- **Platform reliability**: base rates from infrastructure/API tables, adjusted for Cloudflare serverless (0.3x infra failures) and known SLAs
- **AI failures**: base rates from application table, 0.5x for >80% test coverage
- **Contractor engagement**: estimated from managed service industry benchmarks (25-35% of contractors partially disengage within first quarter)

### Cascade Coupling Values

| Coupling Type | Probability | Used When |
|--------------|:-----------:|-----------|
| Hard | 70% | Sync dependency, no fallback (e.g., voicemail blocks forwarding) |
| Soft | 20% | Async or has fallback (e.g., KB gap → hallucination, has guardrails) |
| Observable | 5% | Monitoring/alert only (e.g., low volume → pipeline SMS alarm) |

### Correlation Groups (6 groups, 28 correlated FMs)

| Group | Members | Root Cause |
|-------|:-------:|-----------|
| disengaged_contractor | 9 | Contractor mentally checked out — doesn't interact with triggers |
| operator_overload | 6 | Solo operator exceeds sustainable client load |
| platform_down | 4 | External service provider outage |
| low_volume | 4 | Contractor has <15 leads/month |
| thin_kb | 3 | Knowledge base insufficiently populated at onboarding |
| bad_fit | 2 | Contractor signed despite not matching ICP |

---

## Guarantee Risk Deep-Dive

The user asked for specific modeling of every path to an unintended refund. Here are all paths identified:

### Layer 1 (30-Day Proof of Life: 5 QLE) — Refund Paths

| Path | Mechanism | Probability | Detection |
|------|-----------|:-----------:|:---------:|
| **G1-A: Zero lead volume** | Contractor has <5 inbound inquiries in 30 days. Volume extension formula applies but contractor may not know. | 8% | Visible in dashboard |
| **G1-B: Phone setup failure** | Voicemail intercepts calls, text-back never fires, leads never enter system. 30 days of silence despite real leads existing. | 5% | Detectable Day 1 if tested |
| **G1-C: AI quality failure** | System responds but responses are so bad that leads don't reply (0 two-way interactions). KB too thin, AI defers everything. | 3% | Visible in conversation logs |
| **G1-D: Compliance over-blocking** | Quiet hours + consent checks block too many responses. Leads get responses but outside engagement window. | 2% | Visible in scheduled queue |

### Layer 2 (90-Day Revenue Recovery: 1 cold-lead estimate OR $5K pipeline) — Refund Paths

| Path | Mechanism | Probability | Detection |
|------|-----------|:-----------:|:---------:|
| **G2-A: WON data missing** | System generated value but contractor never marked WON/LOST. Pipeline shows $0. Refund triggered on active client. | 5% | FM-61 — hardest to detect |
| **G2-B: Attribution dispute** | Contractor claims they would have closed lead anyway. Platform logs show system engagement but contractor disagrees. | 8% | FM-59 — policy says honor refund |
| **G2-C: Low volume + long sales cycle** | 10 leads/month × 3 months = 30 leads. None close within 90 days (normal for $80K basements). Extension formula helps but may not be enough. | 5% | Visible in pipeline |
| **G2-D: AI drove leads away** | System actively damaged opportunities through bad responses (hallucination, aggressive booking). Negative pipeline. | 2% | Visible in conversation logs + flags |
| **G2-E: Quiet hours lost leads** | After-hours leads went to competitor during 13h gap. System never had a chance. | 3% | Invisible — the lead never entered the system |

**G2-A is the most dangerous path** because the refund is undeserved — the system IS working, but the data to prove it doesn't exist because the contractor didn't mark outcomes. The existing probable-wins-nudge and stuck-estimate-nudge partially address this, but the bi-weekly call is the real mitigation. If the call is skipped (FM-54), this path opens wide.

---

## Operator Capacity Model

The user asked: at what client count do manual touchpoints exceed available hours?

### Per-Client Weekly Operator Hours (Post-Onboarding)

| Touchpoint | Frequency | Time per occurrence | Weekly hours |
|------------|:---------:|:-------------------:|:------------:|
| Smart Assist review (Week 2 only) | 3x/day for ~5 days | 5 min | 1.25h (Week 2 only) |
| AI quality monitoring | 2-3x/week | 10 min | 0.5h |
| Escalation handling | 2-5/week per client | 10 min | 0.5-0.8h |
| KB gap sprints | 1x/week | 15 min | 0.25h |
| Bi-weekly call + prep | Every 2 weeks | 40 min (10 prep + 30 call) | 0.33h |
| Revenue Leak Audit (onboarding only) | Once per client | 45 min | — |
| Report review | Every 2 weeks | 10 min | 0.08h |
| Miscellaneous (texts, adjustments) | Ad hoc | — | 0.25h |
| **Total post-onboarding** | | | **~2.0h/week** |

### Capacity Calculation

| Operator hours/week | Clients (steady state) | Clients (with onboarding) | Risk level |
|:-------------------:|:---------------------:|:-------------------------:|:----------:|
| 20h | 10 | 8 (2 onboarding) | Green — buffer exists |
| 25h | 12 | 10 | Yellow — no buffer |
| 30h | 15 | 12 | Red — quality degrades |
| 40h | 20 | 15 | Critical — FM-73 fires |

The OFFER-STRATEGY.md states a target of 45-60 min/week per client and caps new onboarding at 2/week. At 2h/week actual, the operator can sustainably handle **10 clients** at 20 hours/week. Beyond 10, the operator_overload cascade activates. At 15+ clients without help, every quality touchpoint degrades simultaneously.

**Week 2 is the bottleneck**: a client in Smart Assist mode requires 1.25 additional hours/week. With 2 new onboardings/week, the operator temporarily needs 2.5 extra hours during those weeks. If 3+ clients are simultaneously in Smart Assist, the operator hits capacity even at 8 total clients.

---

## Recommendations

Ordered by mitigation effectiveness score (risk reduction per unit effort).

### 1. Resolve quiet hours legal review (Effectiveness: 80, Effort: S)

**What**: Complete the legal review already flagged in OFFER-STRATEGY Part 10, Item #1. If inbound-reply exemption is confirmed, update `compliance-gateway.ts` to classify first responses to missed calls, form submissions, and inbound SMS as conversational (send immediately) vs. proactive outreach (queue for next window).

**Expected risk reduction**: FM-38 probability drops from 25% to 5%. RPN from 100 to 20. Eliminates the single highest-RPN failure mode.

**Cascade chains broken**: None directly, but removes the "invisible" path G2-E where leads never enter the system because they went to a competitor during the gap.

### 2. Build contractor engagement detection + auto-intervention (Effectiveness: 33.5, Effort: M)

**What**: Create a composite engagement score per client tracking: days since last EST trigger, days since last WON/LOST, KB gap response rate, booking confirmation response time. Surface in operator triage dashboard. When score drops below threshold for 14+ days, auto-create priority task for operator with the at-risk recovery script from playbook Section 1.5.

**Expected risk reduction**: disengaged_contractor correlation group delta drops from +32 to ~+12. FM-40 (20%→8%), FM-56 (15%→6%). Breaks CC-1 (Death Spiral).

**Cascade chains broken**: CC-1 (Disengaged Contractor Death Spiral) — the single highest-impact cascade in the system.

### 3. Make exclusion list a mandatory onboarding gate (Effectiveness: 32, Effort: S)

**What**: Add to onboarding quality gates: operator must confirm "exclusion list reviewed" before autonomous mode can be activated. Even if the list is empty, the confirmation ensures the conversation happened.

**Expected risk reduction**: FM-14 probability 5%→1%. RPN 40→8. Prevents the single highest-severity event (S=10) in the entire register.

**Cascade chains broken**: None — but this is a nuclear event prevention. One instance of texting a contractor's wife can terminate the relationship and generate negative word-of-mouth.

### 4. Define operator capacity trigger + cross-train backup (Effectiveness: 23.3, Effort: L)

**What**: At 8 active clients, begin hiring process for part-time ops support. Cross-train one person on: Smart Assist review, escalation handling (using playbook scripts), and bi-weekly call format. The playbook already documents every step — the backup person follows it.

**Expected risk reduction**: operator_overload correlation group delta drops from +18 to ~+5. Breaks CC-3 and CC-6.

**Cascade chains broken**: CC-3 (Operator Overload Cascade — 5 downstream failures), CC-6 (Solo Operator Failure — complete service interruption).

### 5. Add Day 25 billing reminder SMS (Effectiveness: 34, Effort: S)

**What**: Automated SMS on Day 25: "Your free month ends in 5 days. Billing starts [date] at $1,000/month. Questions? Reply to this message." Add to cron schedule.

**Expected risk reduction**: FM-05 probability 10%→2%, FM-63 probability 5%→1%. Prevents the surprise-charge path that leads to immediate cancellation requests.

**Cascade chains broken**: None directly — but removes a friction point that converts trial users to paying customers more smoothly.

---

## Appendix: Simulation Reproducibility

Script: `.scratch/fma-simulation.py`
Results: `.scratch/fma-simulation-results.json`
To reproduce: `python3 .scratch/fma-simulation.py`
To vary: change `RANDOM_SEED` or `N_SCENARIOS` in the script header.
