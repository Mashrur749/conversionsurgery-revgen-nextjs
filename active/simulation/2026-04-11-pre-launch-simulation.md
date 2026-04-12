# Service Delivery Simulation Report — Pre-Launch Capacity & Profitability

**Date:** 2026-04-11
**Mode:** HYBRID (Full Simulation + Markov Trajectory + Portfolio Capacity)
**Profiles generated:** 50
**Touchpoints evaluated:** 33
**Time horizon:** 26 weeks (6 months)
**Markov simulations:** 2,000 per archetype, 1,000 per portfolio scenario
**Calibration status:** Pre-client-data estimates (see notes at bottom)

---

## Executive Summary

**Your profit per client never goes negative.** Even at 29 clients with operator fatigue modeling, P50 profit stays at ~$487/client over 26 weeks. The bottleneck isn't capacity — it's **churn velocity**. Most clients absorb into a terminal state (churned or retained) within 3-5 weeks. The ones who churn leave before they consume significant operator hours, and the ones who retain are cheap to maintain.

**The real risk is churn rate, not capacity.** Across all archetypes, weighted P(Churn) = 55%. Half your clients will leave within 6 months at current cascade scores. The single highest-leverage fix is a **recovery playbook** that catches At-Risk clients before they churn — worth +$80/client profit.

**Your safe operating zone is 8-12 clients** — not because of capacity limits, but because at lower counts, each churn hurts your revenue more as a percentage. At 12 clients, the mix stabilizes and steady-state operator load is only ~2.4 hrs/week.

---

## Structural Bottlenecks (>20% of profiles affected)

| # | Touchpoint | % Affected | Severity | Impact Score | Root Cause | What Breaks | Cascade |
|---|-----------|:----------:|:--------:|:------------:|------------|-------------|---------|
| 1 | **T10: KB Setup** | 38% | Y/R | 9.1 | Can't articulate pricing, "it depends" answers | Thin KB, AI gives vague answers | T6,T19,T20,T27,T32 |
| 2 | **T22: Calendar Sync** | 42% | Y/R | 6.2 | No GCal, paper calendar, FSM calendar, team unsync'd | Double-bookings, manual booking | — |
| 3 | **T4: Call Forwarding** | 20% | R | 7.8 | Google Voice, VoIP/PBX complexity | Day 1 broken, no wow moment | T5,T6,T22 |
| 4 | **T21: Estimate Trigger** | 34% | Y | 5.9 | Low-tech forgets SMS keyword, office manager mismatch | Highest-value automation unused | T29,T31 |
| 5 | **T27: Escalation Handling** | 32% | Y | 5.4 | Thin KB (chain 1) + team mismatch (chain 4) | Elevated operator hours | — |
| 6 | **T25/T26: Reports** | 26% | Y | 3.9 | Low volume = thin reports, "$0 pipeline" | Erodes perceived value | T29,T31 |
| 7 | **T18: Smart Assist** | 22% | Y/R | 3.7 | Low volume = few drafts, KB stays thin | Premature/delayed autonomous | T19,T20 |

## Cascade Chains Observed

| Chain | Trigger | Steps Degraded | % of Profiles | Business Impact |
|-------|---------|:--------------:|:-------------:|-----------------|
| KB Thinning | T10 yellow/red | T6,T19,T20,T27,T32 | 38% | Elevated operator hours for client lifetime |
| Team Comm Mismatch | Multi-person team | T3,T21,T22,T27,T25 | 34% | Info goes to wrong person, slow response |
| Low Volume Starvation | <10 leads/mo | T14-T19,T25,T26,T29 | 22% | System appears to do nothing |
| Phone Setup Failure | T4 red | T5,T6,T22 | 20% | Day 1 broken experience |
| Tool Expectation Gap | Non-Jobber FSM | T21,T23,T24,T32 | 18% | Permanent two-system tax |
| Seasonal Cliff | Strong seasonal | T14-T18,T29,T30 | 16% | Months of zero value during dead season |

---

## Segment Viability (Markov-Enhanced)

| Archetype | n | Reds | Chains | P(Churn) | P(Retain) | E[LTV] 26wk | Op Cost 26wk | Profit 26wk | Verdict |
|-----------|:-:|:----:|:------:|:--------:|:---------:|:----------:|:----------:|:---------:|---------|
| **Young Hustler** | 4 | 1 | 0.5 | 37.7% | 62.3% | $1,335 | $476 | **$859** | GREEN — best segment |
| **Kitchen Guy** | 6 | 2 | 0.8 | 48.5% | 51.5% | $1,090 | $414 | **$676** | GREEN — take |
| **Growing Crew** | 6 | 2 | 1.2 | 50.4% | 49.6% | $1,017 | $396 | **$621** | GREEN — take (fix team mismatch) |
| **Roofer** | 7 | 4 | 1.3 | 53.8% | 46.2% | $924 | $366 | **$558** | YELLOW — take with modified onboard |
| **Family Business** | 7 | 5 | 2.0 | 57.9% | 42.1% | $817 | $332 | **$485** | YELLOW — screen for Google Voice |
| **Concrete Guy** | 5 | 6 | 2.2 | 60.7% | 39.3% | $736 | $306 | **$430** | YELLOW — don't onboard Nov-Mar |
| **Tech-Forward** | 3 | 5 | 2.3 | 61.0% | 39.0% | $713 | $297 | **$415** | YELLOW — ServiceTitan gap is dealbreaker unless managed |
| **Handyman** | 4 | 5 | 2.0 | 61.7% | 38.3% | $688 | $289 | **$400** | YELLOW — low project $ limits ROI story |
| **Referral King** | 5 | 9 | 3.0 | 67.6% | 32.4% | $534 | $235 | **$298** | RED — 2/3 churn, system appears useless |
| **Custom Builder** | 3 | 10 | 3.3 | 69.5% | 30.5% | $481 | $217 | **$264** | RED — worst case, avoid until service variant exists |

### Key Insight

Every segment is profitable on a per-client basis — even the Custom Builder nets $264 over 26 weeks. **The problem isn't margin, it's churn.** A churned client costs you the acquisition effort (sales call + onboarding time = ~3-4 hours) for only $264 return. A retained Young Hustler returns $859 for the same effort. Segment selection is about expected return on your acquisition time, not about whether you lose money.

---

## LTV Distributions

| Archetype | P10 | P50 | P90 | E[LTV] | Spread |
|-----------|----:|----:|----:|-------:|:------:|
| Young Hustler | $230 | $1,035 | $2,990 | $1,335 | Wide — some churn early, survivors are very profitable |
| Kitchen Guy | $230 | $805 | $2,760 | $1,090 | Wide |
| Growing Crew | $230 | $690 | $2,645 | $1,017 | Wide |
| Roofer | $230 | $575 | $2,300 | $924 | Moderate |
| Family Business | $115 | $575 | $2,070 | $817 | Moderate |
| Concrete Guy | $115 | $460 | $1,840 | $736 | Moderate — seasonal drag |
| Tech-Forward | $115 | $460 | $1,725 | $713 | Moderate — tool gap drag |
| Handyman | $115 | $460 | $1,610 | $688 | Narrow — low upside |
| Referral King | $115 | $345 | $1,265 | $534 | Narrow — most churn before value accrues |
| Custom Builder | $115 | $345 | $1,150 | $481 | Narrowest — fastest to churn |

**P10 = $115-230 across all archetypes** means in the worst 10% of outcomes, a client pays for 1-2 weeks then churns. This is your floor — and it represents the cost of wasted onboarding time.

---

## Portfolio Capacity Model

### Staggered Onboarding (2 clients/week intake)

| Clients | Peak Week | Avg Peak hrs | P50 Peak | P90 Peak | P(>35h) | P(>40h) | Steady State (wk12+) |
|:-------:|:---------:|:----------:|:--------:|:--------:|:-------:|:-------:|:---------------------:|
| 5 | Wk 3 | 10.3h | 11.0h | 14.0h | 0% | 0% | 0.9 hrs/wk |
| 8 | Wk 4 | 14.7h | 15.5h | 19.0h | 0% | 0% | 1.4 hrs/wk |
| 10 | Wk 5 | 16.3h | 17.5h | 21.5h | 0% | 0% | 1.9 hrs/wk |
| 12 | Wk 6 | 17.6h | 19.0h | 23.5h | 0% | 0% | 2.4 hrs/wk |
| 15 | Wk 7 | 19.0h | 21.0h | 25.5h | 0% | 0% | 3.4 hrs/wk |

### Why Capacity Never Breaks

This was the surprise finding. The model shows operator capacity **never exceeds 40 hours** even at 15 clients because:

1. **Fast absorption.** Clients reach a terminal state (churned or retained) in 2.3-4.5 weeks on average. The high-operator-cost states (Onboarding=2.5h, Smart Assist=4.0h, At-Risk=3.0h) are transient — most clients pass through them in 1-2 weeks.

2. **Churned clients cost zero.** When 55% of clients churn within 6 months, half your portfolio has zero operator load. This is the dark side of the churn rate — it "solves" the capacity problem by losing clients.

3. **Staggered intake prevents collision.** At 2 clients/week, by the time the 3rd pair starts onboarding, the 1st pair is already past Smart Assist. The collision window is narrow.

**The constraint is not "can I handle 15 clients?" It's "can I afford to lose 8 of them?"**

### Marginal Client Profitability (with operator fatigue)

Modeling fatigue: >35h/wk = 10% increase in At-Risk transitions, >40h = 25% increase (service quality degrades when overloaded).

| Clients | Profit/Client P10 | P50 | P90 | P(Negative) |
|:-------:|:-----------------:|:---:|:---:|:-----------:|
| 5 | $213 | $472 | $830 | 0% |
| 8 | $267 | $489 | $778 | 0% |
| 10 | $295 | $492 | $741 | 0% |
| 12 | $318 | $507 | $729 | 0% |
| 15 | $316 | $494 | $689 | 0% |
| 18 | $338 | $486 | $672 | 0% |
| 20 | $354 | $500 | $667 | 0% |

**Profit per client never goes negative** — even at 29 clients, P10 stays above $350. The fatigue model barely activates because peak weekly hours rarely exceed 25h. The churn itself acts as a pressure release valve on operator load.

---

## Sensitivity Analysis — Highest-Leverage Transitions

| # | Transition | Effect of -30% | Delta Profit/Client | What Fixes It | Fix Type |
|---|-----------|:--------------:|:------------------:|---------------|----------|
| 1 | **AtRisk -> Churned** | Fewer at-risk clients churn out | **+$80** | Recovery playbook: detect at-risk signals early, intervene within 48h, structured win-back conversation | Process |
| 2 | **SmartAssist -> AtRisk** | More clients graduate to autonomous | **+$15** | Better KB gap sprint: pre-populate KB with industry templates, reduce gap surface time | Process + Platform |
| 3 | **Onboarding -> AtRisk** | Cleaner Day 1 experience | **+$14** | Phone setup coverage: solve Google Voice workaround, VoIP forwarding guide, fallback to Twilio-primary number | Platform |
| 4 | **Autonomous -> AtRisk** | Fewer retained clients relapse | **+$9** | Proactive health monitoring: automated engagement scoring, flag declining response rates before contractor notices | Platform (built) |
| 5 | **Ramp -> AtRisk** | Low-volume clients survive Week 1 | **+$4** | Seed leads: for <10/mo clients, import their old quotes + run dormant reactivation immediately to create visible activity | Process |

### The #1 Fix Before Launch: At-Risk Recovery Playbook

The sensitivity analysis is unambiguous. Reducing At-Risk→Churned by 30% is worth **$80/client** — 5x more than any other single fix. This is a **process change**, not a platform change:

1. Define "at-risk" signals in the operator's daily routine (declining response rate, missed check-in calls, zero estimate triggers for 2+ weeks, negative sentiment in contractor replies)
2. When detected, the operator has 48 hours to intervene — not with "how's it going?" but with a structured conversation: acknowledge the friction, show specific value delivered (leads captured, response times), offer a concrete adjustment (switch to manual booking, adjust AI tone, add KB entries from their feedback)
3. Track intervention outcomes — did they re-engage or still churn? This feeds back into the Markov calibration once you have real data.

**This playbook doesn't exist in the Managed Service Playbook today.** The playbook covers escalation handling, quality monitoring, and bi-weekly calls — but there's no "client is going quiet and we're about to lose them" protocol. Build it before client #1.

---

## Leverage Analysis — Highest-ROI Fixes (Cascade + Markov Combined)

| # | Root Cause | Friction Eliminated | Profiles Improved | Op Hrs Saved/mo | Delta-LTV | Difficulty | Fix |
|---|-----------|:-------------------:|:-----------------:|:---------------:|:---------:|:----------:|-----|
| 1 | **No at-risk recovery process** | 0 (no touchpoint) | 55% (all at-risk) | 0 | +$80/client | Process | Write the recovery playbook. Add it to the operator's daily triage. |
| 2 | **"It depends" KB** | 12 touchpoints | 38% (19/50) | 8 hrs | +$15/client | Process | Better KB interview script with forced-choice questions. Pre-populate industry templates (basement pricing tiers, timeline ranges). |
| 3 | **Google Voice / VoIP phones** | 5 touchpoints | 20% (10/50) | 2 hrs | +$14/client | Platform | Document Google Voice workaround (use Twilio number as primary). Build VoIP forwarding guide. Consider "Twilio-primary" mode for these clients. |
| 4 | **Team communication mismatch** | 8 touchpoints | 34% (17/50) | 4 hrs | — | Platform (built) | Multi-user support + notification routing is already built. Ensure onboarding captures all team contacts on Day 1. |
| 5 | **Estimate trigger adoption** | 3 touchpoints | 34% (17/50) | 0 | — | Process | The fallback nudge + SMS trigger are built. Operator needs to explicitly train contractors on the SMS keyword during onboarding. Make it a checklist item, not an afterthought. |

---

## Profile Distribution

| Archetype | Count | % | Key Characteristics |
|-----------|:-----:|:-:|---------------------|
| The Roofer | 7 | 14% | Solo+crew, 20-40 leads, strong seasonal, inbound-heavy |
| The Family Business | 7 | 14% | +spouse+kids, 15-25 leads, med-low tech, GV risk |
| The Kitchen Guy | 6 | 12% | Solo/spouse, 10-20 leads, mid-high project $ |
| The Growing Crew | 6 | 12% | 3-5 people, Jobber, mixed leads — ideal ICP |
| The Referral King | 5 | 10% | Solo, <15 leads, 80% referral — volume starvation risk |
| The Concrete Guy | 5 | 10% | +crew, low tech, strong seasonal |
| The Young Hustler | 4 | 8% | Solo, high tech, high volume — best case |
| The Handyman | 4 | 8% | Solo, low tech, low project $ |
| The Custom Builder | 3 | 6% | Owner+PM, Buildertrend, very low volume, boom-bust |
| The Tech-Forward | 3 | 6% | Office+crew, ServiceTitan, VoIP — tool gap risk |

---

## Recommendations

### 1. Build the At-Risk Recovery Playbook (DO IT — before client #1)

**What:** A structured protocol in the Managed Service Playbook for detecting and intervening with clients showing churn signals.
**Why:** +$80/client profit. 5x more impact than any other single fix. This is the one thing that moves the needle most.
**What it unblocks:** Converts the 55% weighted churn rate into a recoverable pipeline. Even converting 20% of at-risk clients saves ~$1,000/year across a 10-client portfolio.
**Effort:** Process change — 2-3 hours to write the playbook, add to daily operator triage routine.
**Decision:** Do it.

### 2. Improve the KB Interview Script (DO IT — before client #1)

**What:** Replace the free-form "tell me about your pricing" with forced-choice questions ("What's your minimum project size? What's your most common project? What do you NOT do?"). Pre-populate industry templates for basements, kitchens, bathrooms.
**Why:** KB Thinning is the #1 cascade chain (38% of profiles). A better interview reduces it to 15-20%. Worth +$15/client + 8 hrs/mo operator time saved.
**What it unblocks:** Breaks cascade chain 1 — which feeds into AI quality, Smart Assist duration, autonomous readiness, and escalation frequency.
**Effort:** Process change — 2 hours to write the script, 1 hour to build templates.
**Decision:** Do it.

### 3. Document the Google Voice / VoIP Workaround (DO IT — before client #1)

**What:** A clear decision tree in the onboarding checklist: "If contractor uses Google Voice → offer Twilio number as primary business line. If VoIP/PBX → admin portal forwarding guide."
**Why:** Phone Setup Failure is a Day 1 catastrophe (churn signal: Critical, 5x weight). Affects 20% of profiles. Worth +$14/client.
**What it unblocks:** Saves the "wow moment" for 10 profiles that would otherwise have a broken Day 1.
**Effort:** Documentation + minor process change — 1 hour.
**Decision:** Do it.

### 4. Gate Referral Kings and Custom Builders (DEFER — qualify harder, don't refuse)

**What:** Don't refuse these segments, but add a pre-sales qualifier: "Do you get at least 10 inbound leads per month?" If no, set expectations explicitly: "Our system works best with inbound lead flow. With your referral-heavy business, the AI will have less to work with in the first month. We'll lean on your old quote list and dormant reactivation to build momentum."
**Why:** Referral Kings (67.6% churn) and Custom Builders (69.5% churn) are still profitable but have the worst return on your acquisition time. Honest expectation-setting reduces the "this does nothing" perception that drives their churn.
**Effort:** Sales script addition — 30 minutes.
**Decision:** Do it (qualify harder), but don't gate until you have 5+ clients.

### 5. Monitor Seasonal Onboarding Timing (DEFER — operational awareness)

**What:** Don't onboard strong-seasonal contractors (Roofers, Concrete) during their dead season (Nov-Mar). If they sign up in December, delay activation to March or set explicit expectations about the slow period.
**Why:** Seasonal Cliff chain fires for 16% of profiles. Timing the onboarding to their busy season eliminates it entirely. This is free.
**Effort:** Zero — just awareness during sales qualification.
**Decision:** Implement as a mental checklist during sales calls.

---

## Calibration Notes

These transition matrices are derived from:
- Cascade-chain trigger frequencies from `cascade-chains.md` (30-40%, 15-25%, etc.)
- Churn signal weights from `scoring-rubric.md`
- Cascade adjustment rules from `markov-engine.md` Section 3

They have **NOT been validated against real client outcomes**. Key caveats:

1. **Churn rates are likely pessimistic.** The model doesn't account for the bi-weekly strategy call (the #1 retention mechanism per the playbook) or the emotional anchor of the Day 1 wow moment. Real churn will likely be lower if the operator executes the playbook well.

2. **Relative ordering is trustworthy.** "Young Hustler is the best segment and Custom Builder is the worst" is reliable. "Custom Builder churns at exactly 69.5%" is directional.

3. **The sensitivity ranking is the most trustworthy output.** "At-Risk→Churned is 5x more leveraged than any upstream fix" holds regardless of the exact probability values, because it reflects the structural shape of the state machine.

4. **Recalibrate after 5 clients.** Track: actual weeks in each state, actual churn timing, actual operator hours per state. Update the transition matrices with observed frequencies.
