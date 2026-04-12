---
name: service-delivery-simulation
description: >
  Stochastic simulation for finding structural bottlenecks in managed service delivery before they hit real clients. Three modes: Full Simulation (N synthetic profiles through all touchpoints with cascade modeling), Spot Check (single persona walkthrough), and Portfolio Simulation (N clients sharing one operator to find scaling bottlenecks). Auto-detects when to activate Markov chain trajectory modeling for temporal questions (churn timelines, LTV distributions, capacity forecasts with P10/P50/P90 confidence bands). Surfaces friction statistically, weighted by business impact — revenue at risk, churn probability, operator hours. Use this skill whenever the user wants to stress-test their offer, find delivery gaps, simulate client onboarding scenarios, do a "pre-mortem" on service delivery, spot-check a specific contractor persona, test operator scaling limits, forecast churn risk or LTV, or asks questions like "what breaks when we onboard a contractor who...", "what gaps are we missing", "simulate delivery for...", "run a pre-mortem", "what happens when a 5-person crew signs up", "stress test the offer", "what breaks at 10 clients", "where's the operator bottleneck", "which client types should we avoid", "what's our churn risk over 6 months", "expected LTV by segment", or "when does the operator break at 15 clients". Also use when the user mentions "Monte Carlo", "delivery simulation", "service gaps", "friction analysis", "touchpoint audit", "scaling bottleneck", "portfolio stress test", "Markov", "trajectory", "churn forecast", or "LTV distribution".
---

# Service Delivery Simulation

Find structural bottlenecks in managed service delivery before real clients hit them. Instead of imagining one ideal client and hoping the service works for everyone, generate many realistic client profiles and walk each through every service touchpoint. Bottlenecks surface statistically — when 30% of profiles hit friction at the same step, that's a structural problem, not an edge case.

## Why this works

A single mental model of "the contractor" misses the variation that kills delivery. The solo operator with 8 leads/month experiences the service completely differently than the 5-person crew doing 60 leads/month on Jobber. Walking many profiles through every touchpoint reveals which steps break for which kinds of clients — and how often.

More importantly, friction compounds. A thin knowledge base on Day 1 doesn't just cause one yellow — it cascades: fewer gaps surfaced in Week 2, premature autonomous mode in Week 3, frequent escalations in Month 2, operator burnout by Month 3. This simulation models those cascade chains explicitly.

## Three modes

### Full Simulation
Generate N profiles (default 50), walk all touchpoints with cascade modeling, aggregate into a gap register weighted by business impact. Use when the offer changes, before a launch, or periodically to catch drift.

### Spot Check
User describes a specific persona. Walk that one profile through all touchpoints, model cascades, flag every friction point with business impact. Use for quick sanity checks or when evaluating a specific prospect.

### Portfolio Simulation
Model a portfolio of N clients (e.g., "what does my operator's week look like at 12 clients?"). Generates N profiles, computes per-client operator hours, identifies which touchpoints become unsustainable at scale. Use when planning growth, hiring, or deciding client caps.

---

## Execution

### Step 1: Load current service definition

Read these docs at runtime — the offer evolves, so never rely on cached knowledge:

1. `docs/business-intel/OFFER-STRATEGY.md` — what's promised (components, guarantees, pricing, onboarding timeline)
2. `docs/operations/02-MANAGED-SERVICE-PLAYBOOK.md` — how it's actually delivered (onboarding script, escalation handling, ongoing ops)
3. `docs/product/PLATFORM-CAPABILITIES.md` — what the platform can actually do right now

Skim each for: touchpoints, timelines, assumptions about the client, things the client must do, things the operator must do, and stated time-per-client estimates.

### Step 1.5: Markov Activation Gate

Read `references/markov-engine.md` Section 2 (Auto-detection gate). Classify the user's question:

- **STRUCTURAL** ("what breaks and why") — proceed with existing Steps 2-8 unchanged. Skip all Markov steps.
- **TRAJECTORY** ("what happens over time") — proceed with Steps 2-4 as normal (profiles, touchpoint walk, cascade scoring), then activate Markov steps 4M-6M before continuing to Steps 5-8.
- **HYBRID** ("what breaks AND what happens if we don't fix it") — full cascade + Markov. Run all steps including 4M-6M.

Trigger signals for TRAJECTORY/HYBRID: time-based ("over N months", "timeline"), probability ("churn risk", "likelihood"), distribution ("P10/P50/P90", "best/worst case"), financial ("LTV", "lifetime value"), capacity ("breaking point distribution"), forecast ("predict", "expect", "what happens if"). If NONE present, stay STRUCTURAL.

### Step 2: Generate profiles

Read `references/variation-axes.md` for the full axis definitions and correlation rules.

**Key principle: correlated variation.** Real contractors come in coherent archetypes, not random combinations. A solo operator with 60 leads/month is unrealistic. A 5-person crew using spreadsheets instead of any FSM tool is unlikely. The correlation rules in the reference file encode these real-world relationships.

For a **full simulation**, generate N profiles (user-specified or default 50). For a **spot check**, construct a single profile from the user's description and fill in unspecified axes with the most likely correlated values. For a **portfolio simulation**, generate N profiles (user-specified or default 12) representing a realistic client mix.

Each profile should be a compact record:

```
Profile #12: "Mid-size Jobber crew"
- Team: Owner + 2 crew leads + office manager
- Volume: 35 leads/month (60% inbound, 40% referral)
- Tech: Medium (uses Jobber, comfortable with apps)
- Tools: Jobber, Google Calendar
- Project value: $35K avg (kitchens, basements)
- Seasonality: Moderate (slow Dec-Feb)
- Current follow-up: Office manager calls once, then forgets
- Est. monthly revenue to CS: $497/mo base + estimated add-ons
```

### Step 3: Walk touchpoints with cascade modeling

Read `references/touchpoint-map.md` for the full touchpoint list with timing, dependencies, and degradation paths.
Read `references/cascade-chains.md` for the known compounding failure chains.

For each profile, walk through every touchpoint in chronological order. At each step:

1. **Check upstream dependencies.** If an upstream touchpoint scored yellow or red, apply the cascade penalty from `cascade-chains.md` before scoring this touchpoint. A yellow upstream shifts the baseline from green toward yellow; a red upstream shifts it toward red.

2. **Score this touchpoint for this profile:**
   - **Green** — works as designed, no adaptation needed
   - **Yellow** — works but needs adaptation (extra operator time, modified approach)
   - **Red** — breaks, doesn't apply, or creates a negative experience

3. **Estimate business impact** (read `references/scoring-rubric.md` for the impact framework):
   - **Operator hours:** How much extra time does this friction add per week/month?
   - **Revenue risk:** Does this friction reduce the client's perceived value? Could it cause churn?
   - **Churn signal strength:** Is this a "meh" friction or a "I'm canceling" friction?

The key question at each touchpoint is: **what does this specific contractor's situation — combined with any upstream failures — do to the assumption this touchpoint makes?**

Common assumption failures to watch for:
- Touchpoint assumes solo operator, but profile has a team
- Touchpoint assumes inbound leads, but profile is referral-heavy
- Touchpoint assumes smartphone comfort, but profile is low-tech
- Touchpoint assumes Google Calendar, but profile uses Outlook or paper
- Touchpoint assumes the contractor sees SMS notifications, but profile has an office manager handling comms
- Touchpoint assumes steady lead flow, but profile is highly seasonal
- Upstream touchpoint failed, but this touchpoint assumes it succeeded

### Step 4: Score, aggregate, and compute business impact

For each profile × touchpoint pair, record:
- **Color**: green / yellow / red (after cascade adjustment)
- **Friction note**: 1-sentence description of what goes wrong (yellow/red only)
- **Root cause**: which profile characteristic + which upstream failure (if any) causes the friction
- **Operator hours impact**: estimated additional minutes per occurrence
- **Churn signal**: none / weak / moderate / strong

Then aggregate across all profiles:

**Structural bottleneck threshold: any touchpoint that's yellow or red for >20% of profiles.**

Sort bottlenecks by **business impact score**, not just % affected:

```
Impact Score = (% affected) × (severity weight) × (journey position weight) × (revenue multiplier)
```

Where:
- Severity: red = 3, yellow = 1
- Journey position: earlier touchpoints get higher weight (a red at T4 poisons 15+ downstream touchpoints)
- Revenue multiplier: derived from the average project value of affected profiles

### Step 4M: Build transition matrices (TRAJECTORY/HYBRID only)

Read `references/markov-engine.md` Section 3 (Cascade-to-transition mapping).

For each archetype in the profile set, translate the cascade scores from Step 4 into a 7x7 transition matrix:

1. Start with the base transition rates (forward=0.75, at-risk=0.15, churn=0.05, stay=0.05)
2. Apply cascade adjustments: per red (-0.08 forward, +0.06 at-risk, +0.02 churn), per yellow (-0.03 forward, +0.03 at-risk), per chain (-0.05 forward, +0.03 at-risk, +0.02 churn)
3. Apply At-Risk row adjustments based on churn signal sum thresholds
4. Clamp all probabilities to [0.01, 0.95], normalize each row to sum to 1.0

### Step 5M: Execute Markov computation (TRAJECTORY/HYBRID only)

Read `references/markov-engine.md` Section 4 (Script template).

Write and execute the Python script, filling in the transition matrix from Step 4M. The script computes:
- State distribution over time (P^t for t=1 to horizon, default 26 weeks)
- Fundamental matrix — expected weeks to absorption, P(Churned) vs P(Retained)
- Monte Carlo LTV distribution (P10/P50/P90) with 2000 samples
- Sensitivity analysis — perturb each significant transition by -30%, measure delta-LTV
- Portfolio operator hours distribution (if Portfolio mode, n_clients > 1)

Run once per archetype. If Python/numpy is unavailable, fall back to qualitative trajectory reasoning per `references/markov-engine.md` Section 5.

### Step 6M: Integrate Markov output into report (TRAJECTORY/HYBRID only)

Add these sections to the report AFTER the Segment Viability section:

**Client Lifecycle Trajectories** — state distribution table per archetype (sampled weeks: 1, 4, 8, 13, 26)

**Absorption Analysis** — expected weeks, P(Churned), P(Retained), dominant path per archetype

**LTV Distribution** — P10, P50, P90, E[LTV], operator cost/wk per archetype

**Sensitivity Analysis** — top transitions ranked by |delta-LTV|, with current probability, perturbed probability, delta-LTV, and what fixes it

**Calibration Notes** — explicit statement that matrices are pre-client-data estimates. Relative ordering is trustworthy, absolute values are directional. Recalibrate after 5+ clients.

**Portfolio Capacity Distribution** (Portfolio mode only) — P10/P50/P90 operator hours per week, breaking point analysis across client counts, collision risk description.

When Markov results are available, also enhance the existing sections:
- **Leverage Analysis** (Step 5): add a delta-LTV column from the sensitivity analysis alongside the existing friction/profiles/difficulty ranking
- **Segment Viability** (Step 6): replace heuristic churn probability with Markov-derived P(Churned), add E[LTV] and expected absorption weeks

### Step 5: Compute leverage analysis

Group all friction by **root cause** rather than by touchpoint. For example:
- "No Google Calendar" causes reds at T22 and yellows at T17, T25
- "Low tech comfort" causes yellows at T2, T4, T5, T11, T21

For each root cause, compute:
- Total friction points eliminated if fixed
- Total profiles improved
- Estimated operator hours saved per month
- Implementation difficulty (platform change / process change / documentation change)

Rank by: **(friction eliminated × profiles improved) / implementation difficulty**

This answers: "If I could fix one thing, what should it be?"

### Step 6: Compute segment viability

For each archetype that appeared in the profile set:
- Total red count across all touchpoints
- Total cascade chain activations
- Estimated operator hours per week (base + friction overhead)
- Churn probability (based on red count in trust-critical touchpoints: T5, T6, T12, T17, T25)
- Estimated LTV (monthly revenue × predicted retention months)

Classify each archetype:
- **Green segment**: <3 reds, <2 cascade chains, standard operator load → take confidently
- **Yellow segment**: 3-6 reds, manageable with process adaptations → take with modified onboarding
- **Red segment**: >6 reds or >3 cascade chains or >2x operator load → avoid, or build a service variant first

### Step 7: Portfolio simulation (Portfolio mode only)

For portfolio simulation, after walking all profiles:

1. Sum operator hours across all clients by week:
   - Onboarding hours (Week 1): ~2-3 hrs per client
   - Smart Assist hours (Week 2-3): ~3-5 hrs per client (reviewing drafts)
   - Autonomous steady-state: ~1-2 hrs per client (health checks, escalations, reports)
   - Friction overhead: sum of all yellow/red operator-hours impacts

2. Model the operator's week:
   - Available hours: ~40 hrs/week (or user-specified)
   - Plot cumulative operator load as clients are added
   - Identify the **breaking point**: at what client count does load exceed capacity?
   - Identify **collision weeks**: when do multiple clients hit high-load phases simultaneously?

3. Flag the **operator bottleneck touchpoints**: which specific activities consume the most time at scale? (Usually: Smart Assist review, KB gap sprints, escalation handling, monthly health checks)

### Step 8: Output the report

**For Full Simulation:**

```markdown
# Service Delivery Simulation Report

**Profiles generated:** [N]
**Touchpoints evaluated:** [M]
**Structural bottlenecks found:** [count] (>20% affected)
**Cascade chains activated:** [count] unique chains across all profiles
**Highest-impact bottleneck:** [touchpoint] — [X]% affected, [impact score]

## Structural Bottlenecks (>20% of profiles affected)

| # | Touchpoint | % Affected | Severity | Impact Score | Root Cause | What Breaks | Cascade Effect |
|---|-----------|:----------:|:--------:|:------------:|------------|-------------|----------------|
| 1 | [name]    | 45%        | RED      | 8.7          | [cause]    | [friction]  | → T19, T20, T27 |
| 2 | ...       | ...        | ...      | ...          | ...        | ...         | ...            |

## Additional Friction Points (5-20%)

| # | Touchpoint | % Affected | Severity | Impact Score | Root Cause | What Breaks |
|---|-----------|:----------:|:--------:|:------------:|------------|-------------|

## Cascade Chains Observed

| Chain | Trigger | Steps Degraded | % of Profiles | Business Impact |
|-------|---------|:--------------:|:-------------:|-----------------|
| KB Thinning | T10 yellow/red | T19 → T20 → T27 | 35% | High escalation load, premature autonomy |
| Phone Setup Failure | T4 red | T5 → T6 | 15% | Onboarding wow moment destroyed |

## Leverage Analysis — Highest-ROI Fixes

| # | Root Cause | Friction Points Eliminated | Profiles Improved | Operator Hours Saved/mo | Difficulty | Fix |
|---|-----------|:--------------------------:|:-----------------:|:----------------------:|:----------:|-----|
| 1 | [cause]   | 12                         | 65%               | 8 hrs                  | Platform   | [what to build/change] |

## Segment Viability

| Archetype | Count | Reds | Cascades | Op. Hrs/wk | Churn Prob. | Est. LTV | Verdict |
|-----------|:-----:|:----:|:--------:|:----------:|:-----------:|:--------:|---------|
| The Roofer | 8 | 2 | 0 | 1.5 | Low | $5,964 | GREEN — take |
| The Referral King | 5 | 7 | 2 | 3.0 | High | $2,388 | RED — needs service variant |

## Profile Distribution

| Archetype | Count | % of sample | Key characteristics |
|-----------|:-----:|:-----------:|---------------------|

## Touchpoint Heatmap

[Table: each touchpoint as a row, green/yellow/red counts, cascade-adjusted]

## Recommendations

[Top 3-5 prioritized actions. Each must answer:]
1. **What to do** — specific change (build X, stop taking Y, modify process Z)
2. **Why it matters** — business impact in dollars or operator hours
3. **What it unblocks** — which cascade chains or segment viability issues it resolves
4. **Effort** — platform change / process change / documentation change
5. **Decision**: Do it / Defer / Investigate further
```

**For Spot Check:** skip aggregation, output the single profile walkthrough with cascade chains, business impact summary, and segment viability verdict for that archetype.

**For Portfolio Simulation:** include everything from Full Simulation plus:

```markdown
## Operator Capacity Model

**Clients modeled:** [N]
**Total operator hours/week (steady state):** [X] hrs
**Breaking point:** [N] clients (at [X] hrs/week)
**Collision risk:** [description of worst-case week]

### Operator Load by Phase

| Phase | Hours/Client/Week | At 5 Clients | At 10 Clients | At 15 Clients |
|-------|:-----------------:|:------------:|:-------------:|:-------------:|
| Onboarding (Wk 1) | 2.5 | 12.5 | 25.0 | 37.5 |
| Smart Assist (Wk 2-3) | 4.0 | 20.0 | 40.0 | 60.0 |
| Autonomous (steady) | 1.5 | 7.5 | 15.0 | 22.5 |
| Friction overhead | [varies] | [sum] | [sum] | [sum] |

### Bottleneck Activities at Scale

| Activity | Hours/Week at [N] Clients | % of Operator Time | Automatable? |
|----------|:-------------------------:|:------------------:|:------------:|
| Smart Assist review | ... | ... | Partially (faster KB) |
| Escalation handling | ... | ... | No |
| Monthly health checks | ... | ... | Yes (automated scoring) |

### Scaling Recommendations

[What to automate, what to hire for, what client cap to set, which segments to deprioritize]
```

---

## Composing with Consensus

This skill works well as input to `/stochastic-multi-agent-consensus`. To cross-validate findings:

1. Run the simulation once to get the gap register
2. Feed the gap register into consensus: "Here are [N] bottlenecks found by simulation. Poll 10 agents: which of these are real structural problems vs. theoretical, what gaps did the simulation miss, and which leverage fixes would you prioritize differently?"

This catches false positives (theoretical gaps that won't matter in practice), false negatives (real gaps the simulation's assumptions missed), and alternative prioritizations.

---

## Reference files

- `references/variation-axes.md` — Profile generation axes, value ranges, correlation rules, and archetype templates. Read before generating profiles.
- `references/touchpoint-map.md` — Complete touchpoint list with timing, dependencies, assumptions, and degradation paths. Read before walking profiles.
- `references/scoring-rubric.md` — Green/yellow/red criteria for each touchpoint category, plus business impact weights and cascade penalty rules. Read when scoring.
- `references/cascade-chains.md` — Known compounding failure paths with trigger conditions, degraded steps, and business impact. Read alongside touchpoint-map when walking profiles.
- `references/markov-engine.md` — Markov chain trajectory modeling: state space, auto-detection gate, cascade-to-transition mapping, Python script template, qualitative fallback, and consensus integration. Read when the Markov gate activates (Step 1.5). Also consumed by the consensus skill.
