# Markov Chain Integration — Service Delivery Simulation & Multi-Agent Consensus

**Date:** 2026-04-11
**Status:** Design approved, pending implementation
**Approach:** B — Shared Markov engine, both skills consume it
**Execution model:** Script-assisted computation with qualitative fallback

---

## Overview

Add Markov chain trajectory modeling to the service-delivery simulation and multi-agent consensus skills. The simulation already models structural bottlenecks via cascade scoring (green/yellow/red per profile x touchpoint). Markov chains add a temporal dimension: instead of "this archetype has 7 reds" (static), the model answers "this archetype has a 62% probability of churning by week 18, with an expected LTV of $2,150" (trajectory).

Both skills auto-detect when to activate the Markov layer based on whether the user's question is structural ("find bottlenecks") or temporal ("what's our churn risk over 6 months"). No new mode, no new flag — the skill makes the judgment call.

### What this is NOT

- Not a replacement for the cascade model — the Markov layer sits on top of it
- Not a data-driven predictive model — transition probabilities are informed estimates until calibrated against real client outcomes
- Not a separate skill or mode — it's an internal capability that activates when the question warrants it

---

## 1. State Space

Seven states representing a client's lifecycle position:

| State | Touchpoints | Description | Absorbing? |
|-------|-------------|-------------|:----------:|
| **Onboarding** | T0-T13 | Day 1 setup: payment, KB, phone, expectations | No |
| **Ramp** | T14-T17 | Quote reactivation, check-ins, Week 1 proving ground | No |
| **Smart Assist** | T18-T19 | Operator reviewing AI drafts, KB gap sprint | No |
| **Autonomous** | T20-T28 | AI runs solo, estimate follow-ups, reports, escalations | No |
| **At-Risk** | Any | Engagement decay, escalation-heavy, guarantee pressure | No |
| **Churned** | -- | Client cancelled | Yes |
| **Retained** | T29+ passing | Stable past 90-day guarantee, renewing | Semi |

**State indices:** Onboarding=0, Ramp=1, Smart Assist=2, Autonomous=3, At-Risk=4, Churned=5, Retained=6

### Absorbing state treatment

- **Churned** is fully absorbing — no outbound transitions
- **Retained** is semi-absorbing — can transition back to At-Risk (seasonal cliff, operator neglect, festering tool gaps)
- For fundamental matrix computation (`(I-Q)^-1`): treat BOTH Churned and Retained as absorbing (5x5 transient submatrix). This gives clean absorption probabilities and expected time to absorption.
- For trajectory tables (`P^t`): use the full 7x7 matrix with Retained's back-transition. This shows realistic long-term behavior.

Two computations, each using the matrix form appropriate for its question.

### Time step

One week. Matches the touchpoint map's natural cadence:
- Onboarding: Day 1 (< 1 week)
- Ramp: Days 1-7 (1 week)
- Smart Assist: Days 7-14 (1 week)
- Autonomous: Week 3+ (ongoing)
- Quarterly touchpoints (T29, T30, T31) modeled as events that can trigger state changes at the relevant week

---

## 2. Auto-Detection Gate

### Decision rule

Before choosing the modeling approach, classify the user's question:

1. **STRUCTURAL** — "what breaks and why"
   - Use cascade model only (existing Steps 1-6)
   - Output: bottleneck register, leverage analysis, segment viability

2. **TRAJECTORY** — "what happens over time"
   - Use cascade model THEN Markov layer (Steps 1-6, then Markov steps)
   - Output: state distributions by week, churn curves, LTV distributions, capacity bands (P10/P50/P90)

3. **HYBRID** — "what breaks AND what happens if we don't fix it"
   - Full cascade + Markov
   - Output: bottlenecks linked to their temporal consequences

### Trigger signals for TRAJECTORY/HYBRID

| Category | Trigger words/phrases |
|----------|----------------------|
| Time-based | "over N months", "by month 3", "at 6 months", "timeline", "trajectory" |
| Probability | "churn risk", "likelihood", "probability", "confidence", "chance" |
| Distribution | "range", "best/worst case", "P10/P50/P90", "distribution", "variance" |
| Financial | "LTV", "lifetime value", "expected revenue", "ROI timeline", "payback period" |
| Capacity | "when does the operator break", "breaking point distribution", "collision risk" |
| Forecast | "forecast", "project", "predict", "expect", "what happens if" |

**Rule:** If NONE of these signals are present, cascade only. If ANY are present, activate Markov layer.

### Signal table — common requests mapped

| User request | Classification | Why |
|-------------|:--------------:|-----|
| "find bottlenecks", "stress test the offer" | STRUCTURAL | No temporal dimension |
| "spot check this persona" | STRUCTURAL | Single walkthrough, cascade sufficient |
| "what's our churn risk at 6 months" | TRAJECTORY | Temporal + probability |
| "expected LTV for this segment" | TRAJECTORY | Financial forecast |
| "capacity at 15 clients over time" | TRAJECTORY | Capacity + distribution |
| "which segments should we avoid" | HYBRID | Cascade for WHY, Markov for HOW BAD |
| "pre-mortem" | HYBRID | Structural + temporal together |
| "simulate delivery for [persona]" | STRUCTURAL | Unless "...over 6 months" is added |

---

## 3. Cascade-to-Transition Mapping

The Markov layer does not invent transition probabilities from nothing. It derives them from the cascade model's output.

### Input from cascade model

After walking touchpoints for an archetype (existing Steps 2-4), the simulation has:
- Count of reds and yellows per journey phase (Onboarding touchpoints, Ramp touchpoints, etc.)
- Cascade chain activations (which of the 6 chains fired, how deep they went)
- Churn signal sum from the scoring rubric

### Base transition rates

Starting point before cascade adjustment:

```
Forward (state N -> state N+1):  0.75
At-Risk from any state:          0.15
Churn from any state:            0.05
Stay in current state:           0.05
```

### Cascade adjustments

Each friction signal shifts probabilities from the base rates:

| Condition | Forward | At-Risk | Churn | Stay |
|-----------|:-------:|:-------:|:-----:|:----:|
| Per red in this phase's touchpoints | -0.08 | +0.06 | +0.02 | -- |
| Per yellow in this phase's touchpoints | -0.03 | +0.03 | -- | -- |
| Per cascade chain activated | -0.05 | +0.03 | +0.02 | -- |
| Churn signal sum > 12 | -- | -- | -- | -- |
| Churn signal sum > 20 | -- | -- | -- | -- |

For At-Risk state specifically:

| Condition | At-Risk -> Retained | At-Risk -> Churned | At-Risk -> stay |
|-----------|:-------------------:|:------------------:|:---------------:|
| Churn signal sum > 12 | -0.10 | +0.10 | -- |
| Churn signal sum > 20 | -0.15 | +0.20 | -0.05 |

### Post-adjustment normalization

1. Apply all adjustments to base rates
2. Clamp every probability to [0.01, 0.95]
3. Normalize each row to sum to 1.0

### Calibration status

These adjustment magnitudes (-0.08 per red, +0.06 to At-Risk, etc.) are informed estimates based on cascade chain trigger frequencies and churn signal weights from the scoring rubric. They have NOT been validated against real client data.

**The relative ordering is more trustworthy than the absolute values.** "The Referral King has higher churn probability than The Roofer" is reliable. "The Referral King churns at exactly 62%" is directional, not precise.

**Recalibration trigger:** After onboarding 5+ clients, recalibrate matrices against observed state transitions. Track: actual weeks in each state, actual churn timing, actual operator hours per state.

---

## 4. Script-Assisted Computation

### The split between LLM and code

| Step | Executor | What |
|------|----------|------|
| Profile generation | LLM | Archetype selection, correlated axes, compact records |
| Touchpoint walk + cascade scoring | LLM | Green/yellow/red per profile x touchpoint |
| Build transition matrix | LLM | Apply Section 3 mapping rules to cascade scores |
| Matrix math | Python script | P^t, (I-Q)^-1, Monte Carlo, sensitivity |
| Interpret results | LLM | Read script output, write report, make recommendations |

### The script template

The skill instructs the agent to write and execute a Python script. The LLM fills in the transition matrix values and parameters:

```python
import numpy as np
import json

# ---- LLM fills these from cascade analysis ----
states = ["Onboarding", "Ramp", "SmartAssist", "Autonomous", "AtRisk", "Churned", "Retained"]

# Transition matrix (7x7) — one per archetype
P = np.array([
    # Onb   Ramp  Smart  Auto  AtRsk  Churn  Retain
    [0.00,  0.55, 0.00,  0.00, 0.35,  0.10,  0.00],  # Onboarding
    [0.00,  0.00, 0.40,  0.00, 0.45,  0.15,  0.00],  # Ramp
    [0.00,  0.00, 0.00,  0.50, 0.35,  0.15,  0.00],  # Smart Assist
    [0.00,  0.00, 0.00,  0.55, 0.20,  0.05,  0.20],  # Autonomous
    [0.00,  0.00, 0.10,  0.15, 0.30,  0.30,  0.15],  # At-Risk
    [0.00,  0.00, 0.00,  0.00, 0.00,  1.00,  0.00],  # Churned (absorbing)
    [0.00,  0.00, 0.00,  0.00, 0.15,  0.05,  0.80],  # Retained (semi)
])

revenue_per_week = 115      # $497/mo base
op_hours = [2.5, 1.5, 4.0, 1.0, 3.0, 0.0, 1.0]  # per state
n_clients = 1               # or N for portfolio
horizon_weeks = 26           # default 6 months
n_simulations = 2000

# ---- State distribution over time (P^t) ----
pi = np.array([1, 0, 0, 0, 0, 0, 0], dtype=float)
trajectory = [{"week": 0, **{s: round(v, 4) for s, v in zip(states, pi)}}]
for t in range(1, horizon_weeks + 1):
    pi = pi @ P
    trajectory.append({"week": t, **{s: round(v, 4) for s, v in zip(states, pi)}})

# ---- Fundamental matrix (absorbing analysis) ----
Q = P[:5, :5]               # 5x5 transient submatrix
R = P[:5, 5:]               # 5x2 absorption matrix
N_fund = np.linalg.inv(np.eye(5) - Q)
expected_weeks = N_fund.sum(axis=1)
absorption_probs = N_fund @ R  # columns: [P(Churned), P(Retained)]

# ---- Monte Carlo for LTV and operator hours distributions ----
ltv_samples = []
op_hour_trajectories = []

for _ in range(n_simulations):
    state = 0
    ltv = 0.0
    weekly_hours = []
    for week in range(horizon_weeks):
        if state != 5:  # not churned
            ltv += revenue_per_week
        weekly_hours.append(op_hours[state])
        state = np.random.choice(7, p=P[state])
    ltv_samples.append(ltv)
    op_hour_trajectories.append(weekly_hours)

ltv_arr = np.array(ltv_samples)
p10, p50, p90 = np.percentile(ltv_arr, [10, 50, 90])

# ---- Portfolio operator hours (if n_clients > 1) ----
portfolio_hours = None
if n_clients > 1:
    weekly_totals = np.zeros((n_simulations, horizon_weeks))
    for c in range(n_clients):
        for sim in range(n_simulations):
            state = 0
            for week in range(horizon_weeks):
                weekly_totals[sim, week] += op_hours[state]
                state = np.random.choice(7, p=P[state])
    portfolio_hours = {
        "p10": np.percentile(weekly_totals, 10, axis=0).tolist(),
        "p50": np.percentile(weekly_totals, 50, axis=0).tolist(),
        "p90": np.percentile(weekly_totals, 90, axis=0).tolist(),
    }

# ---- Sensitivity analysis ----
base_mean_ltv = float(np.mean(ltv_arr))
sensitivities = {}

for i in range(5):       # transient states only
    for j in range(7):
        if P[i, j] > 0.05 and i != j:
            P_pert = P.copy()
            P_pert[i, j] *= 0.7  # reduce transition by 30%
            P_pert[i] /= P_pert[i].sum()  # renormalize row

            pert_ltvs = []
            for _ in range(n_simulations):
                state = 0
                ltv = 0.0
                for week in range(horizon_weeks):
                    if state != 5:
                        ltv += revenue_per_week
                    state = np.random.choice(7, p=P_pert[state])
                pert_ltvs.append(ltv)

            delta = float(np.mean(pert_ltvs)) - base_mean_ltv
            if abs(delta) > 50:  # only report meaningful deltas
                sensitivities[f"{states[i]}->{states[j]}"] = {
                    "current_prob": round(float(P[i, j]), 3),
                    "perturbed_prob": round(float(P_pert[i, j]), 3),
                    "delta_ltv": round(delta, 0),
                }

# ---- Output ----
result = {
    "archetype": "LLM_FILLS_THIS",
    "trajectory": trajectory,
    "absorption": {
        "expected_weeks_from_onboarding": round(float(expected_weeks[0]), 1),
        "p_churned": round(float(absorption_probs[0, 0]), 3),
        "p_retained": round(float(absorption_probs[0, 1]), 3),
    },
    "ltv": {
        "p10": round(float(p10), 0),
        "p50": round(float(p50), 0),
        "p90": round(float(p90), 0),
        "mean": round(base_mean_ltv, 0),
    },
    "sensitivities": sensitivities,
}

if portfolio_hours:
    result["portfolio_hours"] = portfolio_hours

print(json.dumps(result, indent=2))
```

### Fallback: qualitative trajectory reasoning

If Python or numpy is unavailable, the skill falls back to qualitative reasoning:

1. Define the state space and dominant transition paths per archetype
2. Use **bands** instead of exact probabilities: high/medium/low probability of each transition
3. Reason about **best-case / likely / worst-case trajectories** narratively
4. Sensitivity analysis becomes: "which transition is the most load-bearing for this archetype?" as a qualitative judgment
5. Report uses the same section headers but with narrative descriptions instead of numerical tables

The fallback instruction in the skill:

```
If script execution fails or numpy is unavailable:

Fall back to QUALITATIVE trajectory reasoning. Use the same state space and 
transition logic, but express probabilities as bands:

  HIGH (>0.6): "most profiles follow this path"
  MEDIUM (0.3-0.6): "roughly even odds"  
  LOW (<0.3): "happens but not the dominant path"

For LTV, estimate in ranges: "likely $2K-5K" instead of "P10=$994, P50=$2,388".
For capacity, describe collision scenarios narratively instead of P10/P50/P90 tables.

The qualitative analysis is still valuable — it structures temporal reasoning that 
the cascade model alone cannot provide. The precision loss is acceptable given that 
the underlying matrices are pre-calibration estimates anyway.
```

---

## 5. Consensus Skill Integration

### The problem with current consensus on temporal questions

Without Markov grounding, each of the 10 consensus agents independently invents probability estimates. The risk-averse agent says "70% churn" while the growth agent says "30%." These numbers come from nowhere. The consensus aggregation treats fabricated numerical divergence as meaningful strategic disagreement.

### How it changes

When the consensus skill's gate detects temporal signals, it runs the service-delivery simulation with Markov layer ONCE before spawning agents. The Markov output becomes shared ground truth:

```
User asks temporal question
  -> Consensus gate detects temporal signals
  -> Run service-delivery simulation with Markov (single run)
  -> Markov output becomes shared context
  -> N agents each receive identical Markov data + their framing variation
  -> Agents interpret the SAME numbers through different lenses
  -> Aggregation captures interpretation divergence, not numerical fabrication
```

### Shared context block for agents

Each agent's prompt receives:

```
MARKOV TRAJECTORY DATA (shared across all agents — do not invent alternative numbers):

Archetype: [name]
  Expected absorption: [X] weeks
  Churned probability: [X]%  |  Retained probability: [X]%
  LTV distribution: P10=$[X]  P50=$[X]  P90=$[X]
  Highest-sensitivity transition: [from]->[to] (reducing by 30% improves LTV by $[X])

[... repeated for each archetype ...]

Use these numbers as given. Your role is to INTERPRET them through your analytical 
lens, not to question or replace them. Disagree on what to DO about them, not on 
what they ARE.
```

### How each framing variation interprets trajectory data

| Framing | Interpretation lens |
|---------|-------------------|
| Risk-averse | Weights P10 (worst case) LTV. Flags archetypes with >50% churn. Recommends gating. |
| Growth-oriented | Weights P90 (best case) LTV. Focuses on sensitivity — "which fix unlocks the most upside?" |
| Contrarian | Challenges transition assumptions. "At-Risk->Retained assumes operator intervention — what if operator is at capacity?" |
| Resource-constrained | Focuses on operator hours distribution. "At P90, 12 clients = 40.8 hrs — one bad week and we're underwater." |
| First-principles | Questions the state space. "Is At-Risk one state or three different failure modes?" |
| User-empathy | Maps trajectories to contractor experience. "Week 4 is where 35% hit At-Risk — what does that feel like?" |
| Long-term | Focuses on Retained->At-Risk back-transition. "15% relapse rate compounds over 12 months." |
| Data-driven | Flags calibration status. "These are pre-client-data estimates — trust the sensitivity ranking, not the absolute numbers." |
| Systems thinker | Traces second-order effects. "Fixing Ramp->At-Risk for Referral Kings frees operator hours for ALL clients." |
| Neutral baseline | Balanced interpretation without a specific lens. |

### What divergence means now

| Before (without Markov) | After (with Markov) |
|------------------------|---------------------|
| Agents disagree on what the numbers are | Agents agree on numbers, disagree on what they mean |
| "Churn is 70%" vs "churn is 30%" | "62% churn is unacceptable — gate this segment" vs "62% is fixable if we address Ramp->At-Risk" |
| Aggregation averages fabricated numbers | Aggregation surfaces genuine strategic disagreement |
| Consensus = mode of guesses | Consensus = dominant interpretation of shared data |

### When consensus does NOT use Markov

No temporal trigger signals = standard consensus flow, unchanged. The skill only activates the Markov layer when the question warrants it.

---

## 6. File Structure & Report Formats

### New and modified files

```
.claude/skills/
  service-delivery-simulation/
    SKILL.md                              <- MODIFIED
    references/
      variation-axes.md                   <- unchanged
      touchpoint-map.md                   <- unchanged
      cascade-chains.md                   <- unchanged
      scoring-rubric.md                   <- unchanged
      markov-engine.md                    <- NEW (shared reference)

  stochastic-multi-agent-consensus/
    SKILL.md                              <- MODIFIED
```

`markov-engine.md` lives inside service-delivery-simulation (where profiles and cascades originate). The consensus skill references it at `../service-delivery-simulation/references/markov-engine.md`.

### Contents of `markov-engine.md`

1. State space definition (7 states, absorbing behavior, indices)
2. Auto-detection gate (trigger words, STRUCTURAL/TRAJECTORY/HYBRID classification, signal table)
3. Cascade-to-transition mapping (base rates, adjustment table, clamping, normalization)
4. Python script template (with blanks for LLM to fill)
5. Fallback instructions (qualitative reasoning)
6. Operator hours per state (from touchpoint time budget)
7. Revenue per state ($115/wk for all active states)
8. Calibration notice (pre-client-data, recalibrate at 5+ clients)
9. Consensus agent context template and framing interpretation guide

### Changes to service-delivery-simulation SKILL.md

Insert Step 1.5 (Markov Activation Gate) after Step 1, before Step 2:

```
Step 1.5: MARKOV ACTIVATION GATE

Read references/markov-engine.md Section 2 (Auto-detection gate).
Classify the user's question as STRUCTURAL, TRAJECTORY, or HYBRID.

If STRUCTURAL -> proceed with existing Steps 2-8 unchanged.
If TRAJECTORY or HYBRID -> proceed with Steps 2-4 as normal, then:
  Step 4M: Build transition matrices from cascade scores (markov-engine.md Section 3)
  Step 5M: Execute computation script (markov-engine.md Section 4)
  Step 6M: Integrate Markov output into report
Then continue with Steps 5-8 incorporating Markov results.
```

Steps 5-6 enhanced when Markov active:
- Leverage analysis gains sensitivity column (delta-LTV per fix)
- Segment viability gains exact churn probability, expected absorption time, LTV P10/P50/P90

### Changes to stochastic-multi-agent-consensus SKILL.md

Insert into Step 1 (Parse the request):

```
After extracting the problem, check for temporal/probabilistic signals.
Read ../service-delivery-simulation/references/markov-engine.md Section 2.

If TRAJECTORY or HYBRID:
  1. Run service-delivery simulation with Markov layer ONCE using the archetype 
     templates from variation-axes.md (10 archetypes, one matrix each — not a 
     full N=50 profile simulation). This is fast: 10 cascade walks + 10 script runs.
  2. Include Markov output as shared context in every agent prompt
  3. Add instruction: "Use Markov data as given. Interpret, don't replace."

If no temporal signals -> standard consensus flow unchanged.
```

### Report format additions (Markov active only)

These sections appear AFTER the existing Segment Viability section. When Markov is NOT active, the report is identical to the current format.

#### Client Lifecycle Trajectories

```markdown
## Client Lifecycle Trajectories

**Time horizon:** [T] weeks | **Calibration status:** Pre-client-data estimates

### State Distribution Over Time

| Week | Onboard | Ramp | Smart | Auto | At-Risk | Churned | Retained |
|-----:|:-------:|:----:|:-----:|:----:|:-------:|:-------:|:--------:|
|    1 |  ...    | ...  | ...   | ...  |  ...    |  ...    |   ...    |

[One table per archetype with >5% of the profile set]

### Absorption Analysis

| Archetype | Expected Weeks | P(Churned) | P(Retained) | Dominant Path |
|-----------|:--------------:|:----------:|:-----------:|---------------|

### LTV Distribution

| Archetype | P10 | P50 | P90 | E[LTV] | Op Cost/wk (steady) |
|-----------|----:|----:|----:|-------:|:--------------------:|

### Sensitivity Analysis

| Transition | Current | Perturbed (-30%) | Delta-LTV | What Fixes It |
|------------|:-------:|:----------------:|----------:|---------------|

### Calibration Notes

Transition matrices are derived from cascade-chain trigger frequencies and 
scoring-rubric churn weights. NOT validated against real client outcomes. 
Relative ordering (which archetype is riskier, which fix has more leverage) 
is more trustworthy than absolute values.

Recalibrate after 5+ clients against observed state transitions.
```

#### Portfolio capacity additions (Portfolio + Markov active)

```markdown
## Operator Capacity Distribution

**Clients modeled:** [N] | **Capacity:** [X] hrs/week

| Week | P10 hrs | P50 hrs | P90 hrs | Status |
|-----:|--------:|--------:|--------:|--------|

### Breaking Point Analysis

| Client Count | P50 Peak | P90 Peak | P90 Exceeds Capacity? |
|:------------:|:--------:|:--------:|:---------------------:|

**Collision risk:** [description of worst-case simultaneous high-load scenario]
```

---

## Design Constraints & Decisions

| Decision | Rationale |
|----------|-----------|
| Auto-detect, not explicit mode | Matches existing skill philosophy: user describes the question, skill chooses the method |
| Script-assisted, not LLM-only math | LLMs cannot reliably do matrix inversion or Monte Carlo sampling |
| Qualitative fallback | Numpy may not be available; qualitative Markov reasoning still adds value over cascade-only |
| Shared reference file, not separate skill | Two consumers (simulation + consensus), not ten. Avoids premature abstraction. |
| Semi-absorbing Retained | Realistic (clients relapse), handled by using two different matrix forms for two different computations |
| Pre-client-data acknowledgment | Honest about calibration status; prevents false precision |
| Cascade model untouched | Markov sits on top — structural questions get the same answer they always got |
| Weekly time step | Matches touchpoint map cadence; fine-grained enough for the early states, not wastefully granular for steady-state |
| Revenue per state is flat ($115/wk) | Real differentiator is operator cost per state, not revenue per state |
