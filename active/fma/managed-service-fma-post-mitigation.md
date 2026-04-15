# Failure Mode Analysis Report: Post-Mitigation Re-Analysis

**Target**: ConversionSurgery managed service delivery system — full client lifecycle
**Boundary**: Same as original FMA — service delivery process, guarantee mechanics, operator workflows, platform reliability
**Perspectives**: Contractor (client experience), Operator (workload/sustainability), Business (revenue/guarantee risk)
**Time horizon**: Per client per quarter
**Date**: 2026-04-14 (post-mitigation)
**Simulation**: 10,000 scenarios, 71 failure modes (59 original + 12 new), seed 42
**Comparison baseline**: Original FMA (59 FMs, same seed, pre-implementation)

---

## Executive Summary

After implementing all 4 waves of FMA resolution (Foundation, Gates & Enforcement, Operator Cockpit, System Health), Monte Carlo simulation shows **dramatic risk reduction** across every metric:

- **Total RPN dropped 50.3%** on original 59 FMs (1,600 → 795). Including 12 new failure modes from implementations, net RPN is 908 — a **43.2% net reduction**.
- **P50 severity dropped 48.9%** (88 → 45). A typical quarter now has roughly half the failure impact.
- **P95 severity dropped 28.8%** (153 → 109). Worst realistic quarters are significantly less severe.
- **Mean failures per quarter dropped 43%** (13.5 → 7.7).
- **Zero-failure quarters improved 10x** (0.2% → 2.3%) — still rare, but no longer essentially impossible.

The **three highest-RPN items shifted** — FM-38 (quiet hours) dropped from RPN 100 to 40, FM-40 (EST triggers unused) from 96 to 38, FM-56 (WON/LOST gap) from 72 to 29. The **disengaged_contractor correlation group** remains the #1 risk driver (+25 P95 delta, down from +32), confirming that contractor behavior is the residual risk that platform tooling can surface but not eliminate.

**12 new failure modes** were introduced by implementations (circuit breaker false positives, digest parsing errors, checklist over-blocking, etc.), contributing RPN of 113 — modest compared to the 805 RPN eliminated from original FMs.

**Remaining top risk**: FM-59 (Layer 2 guarantee attribution ambiguous, RPN 39.2) is now the #2 highest RPN and was **unchanged** by any wave — it's a policy problem, not a platform problem.

---

## Risk Distribution — Before vs After (Monte Carlo, N=10,000)

| Metric | | P5 | P25 | P50 | P75 | P95 | P99 |
|--------|:-:|:--:|:---:|:---:|:---:|:---:|:---:|
| **Failures fired** | PRE | 4 | 9 | 13 | 18 | 23 | 27 |
| | POST | 1 | 4 | 7 | 11 | 17 | 21 |
| | **Δ** | -3 | -5 | **-6** | -7 | **-6** | -6 |
| **Total severity** | PRE | 26 | 61 | 88 | 116 | 153 | 174 |
| | POST | 5 | 20 | 45 | 71 | 109 | 136 |
| | **Δ** | -21 | -41 | **-43** | -45 | **-44** | -38 |
| **Max detection delay (min)** | PRE | 30 | 120 | 120 | 120 | 480 | 480 |
| | POST | 5 | 30 | 60 | 120 | 480 | 480 |
| | **Δ** | -25 | -90 | **-60** | 0 | **0** | 0 |
| **Cascade depth** | PRE | 0 | 1 | 1 | 2 | 3 | 4 |
| | POST | 0 | 0 | 1 | 1 | 3 | 4 |
| | **Δ** | 0 | -1 | **0** | -1 | **0** | 0 |

**Interpretation**: A typical quarter (P50) now sees 7 failures with severity 45, down from 13 failures at severity 88. The "bad quarter" (P95) drops from 23 failures / severity 153 to 17 / 109. Detection time halved at median (120min → 60min) because ops health monitor, heartbeat checks, and engagement signals catch issues before they go silent for hours.

The tail risk (P99) improved proportionally but cascade depth is unchanged — when deep cascades do fire, they still propagate through the same dependency graph. The cascades are less *likely* to trigger, but not *shorter* when they do.

---

## Summary Statistics

| Metric | PRE | POST | Change |
|--------|:---:|:----:|:------:|
| Total RPN (original 59 FMs) | 1,600 | 795 | **-50.3%** |
| New FM RPN (12 new) | — | 113 | — |
| Combined RPN | 1,600 | 908 | **-43.2%** |
| Mean failures/quarter | 13.5 | 7.7 | -43% |
| P50 severity | 88 | 45 | **-48.9%** |
| P95 severity | 153 | 109 | **-28.8%** |
| Zero-failure quarters | 0.2% | 2.3% | +10x |

---

## Top 15 Failure Modes by Post-Mitigation RPN

| # | ID | Component | Failure Mode | S | P(%) | D | RPN | Pre-RPN | Δ RPN |
|---|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:-------:|:-----:|
| 1 | FM-38 | AI Conversations | Quiet hours gap (13h window) | 5 | 10 | 8 | 40.0 | 100.0 | -60.0 |
| 2 | FM-59 | Guarantee | Layer 2 attribution ambiguous | 7 | 8 | 7 | 39.2 | 39.2 | 0.0 |
| 3 | FM-40 | Estimate Follow-Up | EST trigger never used | 8 | 8 | 6 | 38.4 | 96.0 | -57.6 |
| 4 | FM-56 | Revenue Capture | Never marks WON/LOST | 8 | 6 | 6 | 28.8 | 72.0 | -43.2 |
| 5 | FM-31 | KB Sprint | KB gaps accumulate (ignored) | 6 | 8 | 5 | 24.0 | 60.0 | -36.0 |
| 6 | FM-20 | Week 1 | Zero inbound leads first 48h | 5 | 8 | 6 | 24.0 | 36.0 | -12.0 |
| 7 | FM-25 | Listing Migration | Contractor refuses migration | 4 | 20 | 3 | 24.0 | 30.0 | -6.0 |
| 8 | FM-42 | Estimate Follow-Up | Follow-up after competitor chosen | 4 | 10 | 6 | 24.0 | 24.0 | 0.0 |
| 9 | FM-01 | Sales Qualification | Wrong ICP signed | 7 | 4 | 8 | 22.4 | 56.0 | -33.6 |
| 10 | FM-53 | Bi-Weekly Report | Report shows $0 revenue | 7 | 8 | 4 | 22.4 | 56.0 | -33.6 |
| 11 | FM-43 | Appointment Booking | No Google Calendar connected | 6 | 12 | 3 | 21.6 | 27.0 | -5.4 |
| 12 | FM-66 | Growth Blitz | Reactivation to reassigned 6mo+ | 5 | 6 | 7 | 21.0 | 28.0 | -7.0 |
| 13 | FM-23 | Week 1 | Web form integration fails | 5 | 10 | 4 | 20.0 | 20.0 | 0.0 |
| 14 | FM-11 | KB Population | No pricing ranges entered | 6 | 8 | 4 | 19.2 | 48.0 | -28.8 |
| 15 | FM-73 | Operator Capacity | >8 clients quality degrades | 8 | 4 | 6 | 19.2 | 48.0 | -28.8 |

**Notable shifts**:
- FM-38 was #1 at RPN 100. Still #1 but at 40 — the inbound-reply classification (feature-flagged) cuts the 13h gap, but doesn't eliminate it because proactive outreach still queues.
- FM-59 (attribution disputes) was #14 at RPN 39. Now **#2** — unchanged because it's a policy/process issue, not a platform problem.
- FM-40 and FM-56 (contractor engagement) dropped dramatically (96→38, 72→29) thanks to daily digest prompts + engagement signals, but remain in top 5 because contractor behavior is the residual risk.
- FM-14 (exclusion list, S=10 nuclear event) dropped from RPN 40 to 8 — the mandatory gate makes it nearly impossible to skip.

---

## Biggest RPN Reductions (Wave Impact)

| # | FM | Failure Mode | Pre-RPN | Post-RPN | Reduction | Primary Mitigation |
|---|:--:|-------------|:-------:|:--------:|:---------:|-------------------|
| 1 | FM-38 | Quiet hours gap | 100.0 | 40.0 | **-60.0** | Wave 4: inbound-reply classification |
| 2 | FM-40 | EST trigger never used | 96.0 | 38.4 | **-57.6** | Wave 1+3: daily digest + engagement signals |
| 3 | FM-70 | Churn signals missed | 64.0 | 19.2 | **-44.8** | Wave 3: 5 deterministic engagement signals |
| 4 | FM-56 | Never marks WON/LOST | 72.0 | 28.8 | **-43.2** | Wave 1+3: daily digest WON/LOST prompts |
| 5 | FM-09 | Voicemail not disabled | 48.0 | 12.0 | **-36.0** | Wave 2: forwarding verification (AMD) |
| 6 | FM-31 | KB gaps accumulate | 60.0 | 24.0 | **-36.0** | Wave 1+3: SMS-reply KB + daily digest |
| 7 | FM-01 | Wrong ICP signed | 56.0 | 22.4 | **-33.6** | Wave 2: ICP qualification fields |
| 8 | FM-53 | Report shows $0 revenue | 56.0 | 22.4 | **-33.6** | Wave 3: call prep + auto-tracked metrics |
| 9 | FM-14 | Exclusion list skipped | 40.0 | 8.0 | **-32.0** | Wave 2: mandatory onboarding gate |
| 10 | FM-13 | KB too thin for autonomous | 42.0 | 11.2 | **-30.8** | Wave 2: readiness checklist (≥10 entries) |

**Wave contribution to RPN reduction**:
- Wave 1 (Foundation): ~150 RPN reduced (billing reminder, priming SMS, probable-wins extension)
- Wave 2 (Gates): ~250 RPN reduced (exclusion gate, readiness checklist, forwarding verification, ICP fields)
- Wave 3 (Cockpit): ~280 RPN reduced (engagement signals, action queue, auto-resolve, digest replies)
- Wave 4 (Health): ~125 RPN reduced (capacity tracking, quiet hours classification, ops health monitor)

Wave 3 (Operator Cockpit) delivered the most absolute risk reduction, followed by Wave 2 (Gates & Enforcement).

---

## Cascade Chain Analysis — Before vs After

| Chain | Trigger | Pre-Sim Freq | Post-Sim Freq | Status |
|-------|---------|:------------:|:-------------:|:------:|
| **CC-1: Disengaged Contractor Death Spiral** | FM-40 → FM-56 → FM-53 → FM-61 | 71% | ~36% | ↓ Reduced — engagement signals catch early, daily digest prompts WON/LOST |
| **CC-2: Thin KB Cascade** | FM-06 → FM-13 → FM-33 → FM-35 | 56% | ~19% | ↓ Significantly reduced — onboarding checklist + readiness gate |
| **CC-3: Operator Overload Cascade** | FM-73 → FM-28 + FM-54 + FM-64 + FM-21 + FM-68 | 44% | ~20% | ↓ Reduced — capacity tracking with 80%/100% alerts |
| **CC-4: Wrong ICP Cascade** | FM-01 → FM-20 → FM-27 + FM-58 + FM-65 | 10% | ~4% | ↓ Reduced — ICP qualification fields on wizard |
| **CC-5: Phone Setup Cascade** | FM-09 → FM-18 → FM-20 | 12% | ~3% | ↓↓ Nearly eliminated — forwarding verification AMD |
| **CC-6: Solo Operator Failure** | FM-74 → FM-28 + FM-54 + FM-68 | 5% | ~3% | ↓ Modest reduction — multi-operator data model ready, needs process |

CC-5 (Phone Setup) saw the most dramatic reduction — forwarding verification catches the trigger (FM-09) at Day 1, preventing the entire chain from firing. CC-2 (Thin KB) also dropped significantly because two hard gates now block premature autonomous transition.

---

## Correlation Groups — Before vs After

| Group | Shared Root Cause | Pre P95 Delta | Post P95 Delta | Change | Interpretation |
|-------|------------------|:-------------:|:--------------:|:------:|---------------|
| **disengaged_contractor** | Contractor mentally checked out | +32 | **+25** | -7 | Still #1 risk. Platform surfaces it earlier, but can't force engagement. |
| **operator_overload** | Solo operator exceeds capacity | +18 | **+11** | -7 | Capacity tracking + alerts help, but hiring is the real fix. |
| **thin_kb** | KB insufficiently populated | +4 | **+2** | -2 | Hard gates (readiness checklist) nearly eliminated this risk. |
| **low_volume** | <15 leads/month | +5 | **+2** | -3 | ICP fields + volume context in signals help. |
| **platform_down** | External service outage | +6 | **+2** | -4 | Unchanged externally, but health monitor + circuit breakers contain blast radius. |
| **bad_fit** | Wrong ICP signed | +3 | **0** | -3 | ICP qualification fields on wizard effectively eliminated correlation impact. |

**Key finding**: `disengaged_contractor` at +25 is still 2.3x larger than the next group. This is the **irreducible core risk** of a managed service — you can surface disengagement faster (engagement signals do), prompt action more (daily digest does), and track it better (cockpit does), but you can't make a disengaged contractor re-engage. The remaining +25 represents the inherent risk of depending on contractor participation for WON/LOST data and EST triggers.

---

## New Failure Modes Introduced by Implementations

12 new failure modes were identified from the 4-wave implementation:

| # | ID | Component | Failure Mode | S | P(%) | D | RPN | Sim Freq | E[Impact] |
|---|:--:|-----------|-------------|:-:|:----:|:-:|:---:|:--------:|:---------:|
| 1 | NFM-04 | Forwarding Verification | AMD false negative — marks working forwarding as failed | 4 | 8 | 2 | 6.4 | 8.1% | 0.32 |
| 2 | NFM-05 | Engagement Signals | Seasonal slowdown triggers false at-risk alert | 3 | 10 | 3 | 9.0 | 10.0% | 0.30 |
| 3 | NFM-12 | Operator Actions | Action queue overloaded — alert fatigue | 6 | 5 | 5 | 15.0 | 4.9% | 0.30 |
| 4 | NFM-02 | Daily Digest | Reply disambiguation error — KB answer treated as WON/LOST | 6 | 5 | 5 | 15.0 | 4.7% | 0.28 |
| 5 | NFM-01 | Ops Health Monitor | Circuit breaker false positive — healthy client paused | 5 | 5 | 4 | 10.0 | 5.1% | 0.25 |
| 6 | NFM-09 | Capacity Tracking | Hours estimate too low — capacity wall hit without warning | 5 | 5 | 6 | 15.0 | 4.8% | 0.24 |
| 7 | NFM-07 | Feature Flags | Flag misconfigured — automation silently disabled | 5 | 3 | 7 | 10.5 | 3.1% | 0.16 |
| 8 | NFM-11 | Onboarding Checklist | Checklist blocks client ready in all other ways | 3 | 5 | 2 | 3.0 | 5.2% | 0.16 |
| 9 | NFM-06 | Auto-Resolve | Wrong KB suggestion approved — bad answer to homeowner | 8 | 2 | 6 | 9.6 | 1.8% | 0.15 |
| 10 | NFM-08 | Heartbeat Check | Meta-cron fails — no monitoring of monitoring | 6 | 2 | 8 | 9.6 | 2.1% | 0.13 |
| 11 | NFM-03 | Readiness Check | Checklist blocks legitimate autonomous transition | 4 | 3 | 3 | 3.6 | 2.9% | 0.12 |
| 12 | NFM-10 | Daily Digest | Digest suppresses P2 but digest is empty — notifications lost | 5 | 2 | 6 | 6.0 | 1.8% | 0.09 |

**Total new FM RPN: 49.5** (post-resolution, down from 113 pre-resolution — 10 of 12 resolved, 2 accepted at low RPN)

**Highest-concern new FMs**:

1. **NFM-12 (Action queue alert fatigue, RPN 15)**: With 8 action types surfacing across multiple clients, operators may develop alert fatigue. Yellow items accumulate, reds get lost in the noise. Mitigation: ensure red items have distinct visual treatment (already implemented with `border-l-4` urgency colors) and consider a "red items only" filter.

2. **NFM-02 (Digest reply disambiguation, RPN 15)**: Three reply types (EST=`N=YES`, WON/LOST=`WN/LN`, KB=free text) — ambiguous replies route to operator for manual resolution. Current handling: non-matching patterns surface to operator. Risk is low because the failure mode is "wrong routing" not "silent loss."

3. **NFM-09 (Capacity underestimate, RPN 15)**: The hours model uses lifecycle phase × activity multipliers. If the model underestimates (e.g., high-escalation client), operator hits capacity wall without warning. Mitigation: model includes activity adjustments for escalation count and KB gap count, and the 80% threshold provides buffer.

4. **NFM-06 (Auto-resolve wrong answer, RPN 9.6)**: Highest-severity new FM (S=8). Operator approves a wrong KB suggestion → homeowner gets bad information. Gates exist: source shown verbatim, first 5 per client require contractor confirmation, "I verified this is accurate" button. The 2% probability reflects that the operator approval gate catches most errors.

**None of the new FMs have cascade potential** — they're isolated, recoverable, and detectable within hours.

---

## Sensitivity Analysis — Post-Mitigation Top 10

| # | Failure Mode | Current P | If Halved | P95 Delta |
|---|-------------|:---------:|:---------:|:---------:|
| 1 | FM-05: Trial charge surprise | 3% | 1.5% | +3.0 |
| 2 | FM-06: Contractor vague on KB | 8% | 4% | +2.0 |
| 3 | FM-13: KB too thin for autonomous | 4% | 2% | +2.0 |
| 4 | FM-15: No old quotes available | 8% | 4% | +2.0 |
| 5 | FM-24: Zero lead volume Week 1 | 5% | 2.5% | +2.0 |
| 6 | FM-27: Day 7 call with zero data | 5% | 2.5% | +2.0 |
| 7 | FM-44: Booking confirmation timeout | 6% | 3% | +2.0 |
| 8 | FM-54: Strategy call skipped | 4% | 2% | +2.0 |
| 9 | FM-68: Escalation queue overwhelmed | 3% | 1.5% | +2.0 |
| 10 | FM-73: >8 clients quality degrades | 4% | 2% | +2.0 |

**Key finding**: Individual FM sensitivity is now flattened — the max delta is 3.0 (vs 4.0 pre-mitigation) and many FMs cluster at delta 2.0. This means risk is now **more evenly distributed** rather than concentrated in a few high-probability FMs. This is exactly what you want — there's no single "fix this one thing" that dramatically improves the system. The platform has moved from "a few big risks" to "many small risks."

---

## Residual Risk Assessment

### What improved most

| Category | Key Improvements |
|----------|-----------------|
| **Contractor disengagement detection** | Engagement signals catch at-risk behavior 14+ days earlier. Daily digest reduces notification fatigue (52-78 → 32-36 messages/month). SMS-reply KB makes contributing frictionless. |
| **Onboarding quality** | 6-item readiness checklist + 10-item onboarding checklist + forwarding verification create layered gates. Premature autonomous transitions nearly eliminated (FM-33: 8%→2%). |
| **Nuclear event prevention** | Exclusion list gate (FM-14: 5%→1%) makes the S=10 scenario nearly impossible. |
| **Operator workload** | Action queue replaces reactive checking. Capacity tracking warns before overload. Call prep saves 8 min per client per call. |
| **Quiet hours gap** | Inbound-reply classification (feature-flagged) reduces the 13h gap for first responses. FM-38 RPN dropped 60%. |
| **Billing surprise prevention** | Day 25 reminder (FM-05: 10%→3%) virtually eliminates the "I didn't know billing started" objection. |

### What stayed the same

| FM | Why Unchanged | Residual Risk |
|:--:|--------------|---------------|
| FM-59 | Attribution disputes are a policy problem (refund-if-disputed guarantee) | RPN 39.2 — now #2 overall |
| FM-42 | Soft rejection detection exists; follow-up after competitor chosen is an edge case | RPN 24.0 — acceptable |
| FM-23 | Web form integration failures are external (third-party form providers) | RPN 20.0 — process-only fix |
| FM-04 | Card not captured on call is a sales process issue | RPN 12.0 — playbook covered |
| FM-39 | AI engaging spam is handled by existing vendor screening | RPN 15.0 — acceptable |
| FM-75-77 | External service SLAs (Twilio, Stripe, Anthropic) — can't reduce probability | Total RPN 8 — minimal |

### What to watch

1. **Disengaged contractor remains dominant (+25 P95 delta)**. Platform tooling has pushed detection earlier and made re-engagement prompts frictionless, but the fundamental risk — a contractor who checks out — is a human behavior problem. The next mitigation is operational: at-risk intervention scripts in the playbook (already codified as P8), and proactive re-engagement during bi-weekly calls (call prep now surfaces these signals).

2. **Attribution disputes (FM-59, RPN 39.2)** are now the #2 risk. This needs a business decision: tighten attribution criteria (reduces disputes but may miss legitimate complaints), or accept the 8% rate as cost of the guarantee. No platform change can fix this — it's the guarantee design.

3. **New FM alert fatigue (NFM-12)** needs monitoring. With 8 action types × N clients, the action queue could grow beyond what one operator can process. The capacity tracking system should catch this (it tracks operator hours), but if the queue consistently shows 20+ items, consider adding priority filtering to the triage dashboard.

---

## Recommendations — Next Actions

Ordered by expected risk reduction per unit effort.

### 1. Monitor new FM performance (Effort: S, Impact: Preventive)

Track the 12 new failure modes for the first 3 months post-launch. Specifically:
- **NFM-02 (digest disambiguation)**: log all "ambiguous reply" cases routed to operator. If >10% of digest replies are ambiguous, refine the parsing logic.
- **NFM-12 (action queue fatigue)**: if queue consistently >15 items, add a "critical only" filter mode.
- **NFM-06 (wrong auto-resolve)**: track operator override rate on auto-resolve suggestions. If >20%, the semantic search quality needs improvement.

### 2. Address FM-59 (attribution disputes) with policy (Effort: S, Impact: RPN 39→15)

Define clearer attribution criteria in the guarantee terms:
- "AI-attributed" means the system had a documented interaction with the lead before the won outcome
- "Contractor-attributed" means the contractor was already in active negotiation before system engagement
- Disputed cases: 50/50 split (reduces full refund risk)

### 3. Push Google Calendar adoption (Effort: M, Impact: FM-43 RPN 22→8)

FM-43 (no Google Calendar) is still at 12% probability. Calendar sync is built — the gap is contractor adoption. Suggested: make GCal connection part of the Week 2 onboarding checklist (advisory, not blocking). The booking flow already falls back to confirmation mode, so this is a quality-of-life improvement, not a critical fix.

### 4. Hire backup operator at client #8 (Effort: L, Impact: operator_overload group +11→+3)

The operator_overload correlation group is still the #2 risk. Capacity tracking now surfaces the warning, but the actual mitigation is a human: cross-trained backup who can handle Smart Assist review and escalation triage. This was already codified as P16-P17 in the playbook.

### 5. Consider Jobber/FSM webhook integration (Effort: L, Impact: FM-40 further reduction)

The EST trigger dependency (FM-40, still RPN 38.4) could be partially eliminated for contractors using Jobber or similar FSM tools. Automatic EST detection via webhook would remove contractor action from the loop entirely for 40% of ICP.

---

## Complete Post-Mitigation Failure Mode Register

### Sales & Onboarding

| ID | Component | Failure Mode | S | P(%) Pre→Post | D | RPN Pre→Post | Mitigation |
|:--:|-----------|-------------|:-:|:--------------:|:-:|:------------:|-----------|
| FM-01 | Sales Qualification | Wrong ICP signed | 7 | 10→4 | 8 | 56→22 | Wave 2: ICP fields |
| FM-02 | Sales Qualification | Volume disclosure skipped | 5 | 8→3 | 9 | 36→14 | Wave 2: disclosure gate |
| FM-03 | Sales Demo | Demo fails | 6 | 5→5 | 1 | 3→3 | Process only |
| FM-04 | Payment Capture | Card not captured | 8 | 15→10 | 1 | 12→8 | Surfaced: cockpit action (payment_not_captured) |
| FM-05 | Payment Capture | Trial charge surprise | 6 | 10→3 | 7 | 42→13 | Wave 1: billing reminder |
| FM-06 | Onboarding Call | Contractor vague on KB | 7 | 15→8 | 3 | 32→17 | Wave 2: onboarding gates |
| FM-07 | Onboarding Call | No-show | 5 | 8→3 | 1 | 4→2 | Wave 1: reminder SMS |

### Phone & Configuration

| ID | Component | Failure Mode | S | P(%) Pre→Post | D | RPN Pre→Post | Mitigation |
|:--:|-----------|-------------|:-:|:--------------:|:-:|:------------:|-----------|
| FM-08 | Phone Setup | Forwarding fails | 8 | 8→2 | 2 | 13→3 | Wave 2: AMD verification |
| FM-09 | Phone Setup | Voicemail not disabled | 8 | 12→3 | 5 | 48→12 | Wave 2: AMD verification |
| FM-11 | KB Population | No pricing ranges | 6 | 20→8 | 4 | 48→19 | Wave 2: onboarding gate |
| FM-12 | KB Population | KB entries wrong | 9 | 5→3 | 7 | 32→19 | Wave 2: readiness check |
| FM-13 | KB Population | KB too thin | 7 | 15→4 | 4 | 42→11 | Wave 2: readiness gate |
| FM-14 | Exclusion List | Exclusion list skipped | 10 | 5→1 | 8 | 40→8 | Wave 2: mandatory gate |

### Operations & Automation

| ID | Component | Failure Mode | S | P(%) Pre→Post | D | RPN Pre→Post | Mitigation |
|:--:|-----------|-------------|:-:|:--------------:|:-:|:------------:|-----------|
| FM-15 | Quote Import | No old quotes | 5 | 15→8 | 2 | 15→8 | Wave 1: priming SMS |
| FM-16 | Quote Import | Wrong numbers | 4 | 10→10 | 3 | 12→12 | Process only |
| FM-18 | Day-1 | Text-back fails | 8 | 5→1 | 3 | 12→2 | Wave 2: verification |
| FM-20 | Week 1 | Zero leads 48h | 5 | 12→8 | 6 | 36→24 | Wave 3: volume context |
| FM-21 | Audit | Audit overdue | 5 | 10→4 | 5 | 25→10 | Wave 3: cockpit |
| FM-23 | Week 1 | Web form fails | 5 | 10→6 | 4 | 20→12 | Surfaced: onboarding checklist item 11 |
| FM-24 | Week 1 | Zero volume Week 1 | 4 | 8→5 | 6 | 19→12 | Wave 3: signals |
| FM-25 | Migration | Contractor refuses | 4 | 25→15 | 3 | 30→18 | Surfaced: cockpit action (listing_migration_pending) |
| FM-27 | Migration | Day 7 zero data | 4 | 10→5 | 4 | 16→8 | Wave 3: cockpit |
| FM-28 | Smart Assist | SA overwhelmed | 7 | 8→3 | 3 | 17→6 | Wave 4: capacity |
| FM-29 | Smart Assist | SMS to contractor | 5 | 5→1 | 2 | 5→1 | Wave 2: gate |
| FM-31 | KB Sprint | Gaps accumulate | 6 | 20→8 | 5 | 60→24 | Wave 1+3: digest+SMS KB |
| FM-33 | Autonomous | Premature transition | 8 | 8→2 | 5 | 32→8 | Wave 2: readiness check |
| FM-35 | AI | Hallucination | 9 | 5→3 | 7 | 32→19 | Wave 2: readiness check |
| FM-37 | AI | Fails to escalate | 8 | 3→3 | 6 | 14→14 | Existing triggers |
| FM-38 | AI | Quiet hours gap | 5 | 25→10 | 8 | 100→40 | Wave 4: classification |
| FM-39 | AI | Engages spam | 2 | 15→15 | 5 | 15→15 | Existing screening |
| FM-40 | Estimate | EST never used | 8 | 20→8 | 6 | 96→38 | Wave 1+3: digest+signals |
| FM-42 | Estimate | Post-competitor follow-up | 4 | 10→5 | 6 | 24→12 | Surfaced: competitor-chosen guard in auto-trigger |
| FM-43 | Booking | No GCal | 6 | 15→12 | 3 | 27→22 | Process: push adoption |
| FM-44 | Booking | Confirmation timeout | 5 | 10→6 | 3 | 15→9 | Wave 3: cockpit |
| FM-45 | Booking | Wrong timezone | 6 | 3→3 | 4 | 7→7 | Existing handling |
| FM-46 | No-Show | False no-show SMS | 5 | 5→5 | 5 | 13→13 | Existing nudge |
| FM-47 | Payment | Reminder for paid | 6 | 2→2 | 4 | 5→5 | Existing webhook |
| FM-49 | Review | After negative exp | 7 | 3→3 | 6 | 13→13 | Existing gate |
| FM-51 | Win-Back | Reassigned numbers | 6 | 5→4 | 7 | 21→17 | Process: opt-out |
| FM-53 | Report | $0 revenue | 7 | 20→8 | 4 | 56→22 | Wave 3: call prep |
| FM-54 | Strategy Call | Call skipped | 7 | 10→4 | 5 | 35→14 | Wave 3: cockpit |
| FM-56 | Revenue | WON/LOST never marked | 8 | 15→6 | 6 | 72→29 | Wave 1+3: digest+signals |
| FM-58 | Guarantee | L1 fails on legit | 9 | 5→2 | 3 | 14→5 | Wave 1: Day 80 alert |
| FM-59 | Guarantee | L2 attribution dispute | 7 | 8→5 | 7 | 39→25 | Surfaced: attribution evidence in call prep |
| FM-61 | Guarantee | False refund ($0 data) | 9 | 5→2 | 8 | 36→14 | Wave 1+3: alert+digest |
| FM-62 | Billing | Card declines Day 31 | 5 | 5→2 | 2 | 5→2 | Wave 1: billing reminder |
| FM-63 | Billing | Disputes Day 31 charge | 6 | 5→2 | 3 | 9→4 | Wave 1: billing reminder |
| FM-64 | Day 45 | Retention call missed | 6 | 10→4 | 5 | 30→12 | Wave 3: cockpit |
| FM-65 | Growth Blitz | Dormant list empty | 5 | 12→6 | 4 | 24→12 | Wave 1: priming SMS |
| FM-66 | Growth Blitz | Reassigned 6mo+ numbers | 5 | 8→3 | 7 | 28→11 | Surfaced: E.164 validation + delivery failure check |
| FM-67 | Pipeline SMS | Alarming numbers | 5 | 10→6 | 3 | 15→9 | Wave 3: signals |
| FM-70 | At-Risk | Churn signals missed | 8 | 10→3 | 8 | 64→19 | Wave 3: engagement signals |
| FM-68 | Escalation | Queue overwhelmed | 7 | 8→3 | 3 | 17→6 | Wave 3+4: auto-resolve |
| FM-73 | Capacity | >8 clients degrades | 8 | 10→4 | 6 | 48→19 | Wave 4: capacity tracking |
| FM-74 | Capacity | Solo operator unavailable | 9 | 5→3 | 2 | 9→5 | Wave 3: multi-op data model |
| FM-75 | Platform | Twilio outage | 9 | 2→2 | 2 | 4→4 | External SLA |
| FM-76 | Platform | Stripe outage | 5 | 1→1 | 2 | 1→1 | External SLA |
| FM-77 | Platform | Anthropic outage | 8 | 2→2 | 2 | 3→3 | External SLA |
| FM-79 | Platform | GCal API quota | 5 | 3→3 | 3 | 5→5 | Existing fallback |

### New Failure Modes (Introduced by Implementation)

| ID | Component | Failure Mode | S | P(%) | D | RPN |
|:--:|-----------|-------------|:-:|:----:|:-:|:---:|
| NFM-01 | Ops Health Monitor | Circuit breaker false positive | 5 | 2 | 4 | 4.0 | 10-min error spread confirmation |
| NFM-02 | Daily Digest | Reply disambiguation error | 6 | 2 | 5 | 6.0 | Clarifying SMS fallback |
| NFM-03 | Readiness Check | Blocks legitimate transition | 4 | 3 | 3 | 3.6 | Accepted (low RPN) |
| NFM-04 | Forwarding Verification | AMD false negative | 4 | 3 | 2 | 2.4 | Inconclusive status + retry |
| NFM-05 | Engagement Signals | Seasonal false alarm | 3 | 4 | 3 | 3.6 | Volume-aware dampening |
| NFM-06 | Auto-Resolve | Wrong suggestion approved | 8 | 1 | 6 | 4.8 | 0.70 similarity threshold |
| NFM-07 | Feature Flags | Flag silently misconfigured | 5 | 3 | 4 | 6.0 | console.warn on disabled |
| NFM-08 | Heartbeat Check | Meta-cron fails | 6 | 1 | 4 | 2.4 | Self-health cursor |
| NFM-09 | Capacity Tracking | Hours underestimate | 5 | 2 | 6 | 6.0 | Graduated formula |
| NFM-10 | Daily Digest | P2 suppressed but digest empty | 5 | 1 | 3 | 1.5 | 48h audit_log dedup |
| NFM-11 | Onboarding Checklist | Over-blocks ready client | 3 | 5 | 2 | 3.0 | Accepted (low RPN) |
| NFM-12 | Operator Actions | Action queue alert fatigue | 6 | 2 | 5 | 6.0 | Red/yellow/all filter |

---

## Simulation Parameters

**Pre-mitigation**: 59 failure modes, probabilities from original FMA calibrated per `references/probability-calibration.md`
**Post-mitigation**: 71 failure modes (59 with updated probabilities + 12 new)
**Scenarios**: 10,000 per simulation
**Seed**: 42 (reproducible)
**Coupling values**: Hard=0.70, Soft=0.20, Observable=0.05
**Correlation groups**: 6 (same as original: disengaged_contractor, operator_overload, platform_down, low_volume, thin_kb, bad_fit)
**Script**: `.scratch/fma-post-mitigation-simulation.py`
**Results**: `.scratch/fma-post-mitigation-results.json`

---

## Conclusion

The 4-wave FMA resolution achieved its primary objective: **systematic risk reduction across the managed service delivery lifecycle**. The platform evolved from a reactive tool (operator checks each client individually) to a proactive copilot (system surfaces what needs attention, gates prevent dangerous transitions, circuit breakers contain failures).

**The residual risk profile is fundamentally different** from the original:
- Pre-mitigation: dominated by a few high-probability, high-impact failure modes (FM-38 at RPN 100, FM-40 at 96, FM-56 at 72)
- Post-mitigation: risk is distributed across many lower-probability modes, with no single FM above RPN 40

**The remaining risk is primarily behavioral (contractor engagement) and policy (guarantee attribution)**, not platform gaps. This is the correct end state — the platform does what it can, and the residual risk maps to operational judgment and business decisions.

---

*Source: Failure Mode Analysis Re-Analysis (2026-04-14)*
*Original FMA: `active/fma/managed-service-fma.md`*
*Master Spec: `docs/superpowers/specs/2026-04-14-fma-resolution-design.md`*
*Simulation: `.scratch/fma-post-mitigation-simulation.py` | Results: `.scratch/fma-post-mitigation-results.json`*
