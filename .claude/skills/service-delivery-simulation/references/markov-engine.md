# Markov Engine — Shared Reference

Trajectory modeling for client lifecycle state transitions. Consumed by both the service-delivery simulation and multi-agent consensus skills. The Markov layer sits on top of the existing cascade model — it does not replace it.

---

## 1. State Space

Seven states representing a client's lifecycle position:

| Idx | State | Touchpoints | Description | Absorbing? |
|:---:|-------|-------------|-------------|:----------:|
| 0 | **Onboarding** | T0-T13 | Day 1 setup: payment, KB, phone, expectations | No |
| 1 | **Ramp** | T14-T17 | Quote reactivation, check-ins, Week 1 proving ground | No |
| 2 | **Smart Assist** | T18-T19 | Operator reviewing AI drafts, KB gap sprint | No |
| 3 | **Autonomous** | T20-T28 | AI runs solo, estimate follow-ups, reports, escalations | No |
| 4 | **At-Risk** | Any | Engagement decay, escalation-heavy, guarantee pressure | No |
| 5 | **Churned** | -- | Client cancelled | Yes |
| 6 | **Retained** | T29+ passing | Stable past 90-day guarantee, renewing | Semi |

**Time step:** 1 week. Matches the touchpoint map cadence (Day 1 onboarding, Day 3-4 check-in, Day 7 call, Week 2 Smart Assist, Week 3+ Autonomous).

### Absorbing state treatment

- **Churned** is fully absorbing (row = `[0,0,0,0,0,1,0]`)
- **Retained** is semi-absorbing — can transition back to At-Risk (seasonal cliff, operator neglect, festering tool gaps)
- For **fundamental matrix** computation (`(I-Q)^-1`): treat both Churned and Retained as absorbing. Use the 5x5 transient submatrix `Q = P[:5,:5]`. This gives clean absorption probabilities and expected time to absorption.
- For **trajectory tables** (`P^t`): use the full 7x7 matrix with Retained's back-transition. This shows realistic long-term behavior.

### Per-state economics

| State | Revenue/wk | Operator hrs/wk | Source |
|-------|:----------:|:----------------:|--------|
| Onboarding | $115 | 2.5 | touchpoint-map.md T3-T13 |
| Ramp | $115 | 1.5 | touchpoint-map.md T14-T17 |
| Smart Assist | $115 | 4.0 | touchpoint-map.md T18-T19 |
| Autonomous | $115 | 1.0 | touchpoint-map.md T20-T28 steady |
| At-Risk | $115 | 3.0 | touchpoint-map.md escalation-heavy |
| Churned | $0 | 0.0 | -- |
| Retained | $115 | 1.0 | touchpoint-map.md autonomous steady |

Revenue is flat across active states ($497/mo base). The differentiator is operator cost per state.

---

## 2. Auto-Detection Gate

### Classification

Before choosing the modeling approach, classify the user's question into one of three categories:

**STRUCTURAL** — "what breaks and why"
- Use cascade model only (existing simulation Steps 1-8)
- Output: bottleneck register, leverage analysis, segment viability

**TRAJECTORY** — "what happens over time"
- Use cascade model THEN Markov layer
- Output: state distributions by week, churn curves, LTV distributions, capacity bands (P10/P50/P90)

**HYBRID** — "what breaks AND what happens if we don't fix it"
- Full cascade + Markov
- Output: bottlenecks linked to their temporal consequences

### Trigger signals

| Category | Trigger words/phrases |
|----------|----------------------|
| Time-based | "over N months", "by month 3", "at 6 months", "timeline", "trajectory" |
| Probability | "churn risk", "likelihood", "probability", "confidence", "chance" |
| Distribution | "range", "best/worst case", "P10/P50/P90", "distribution", "variance" |
| Financial | "LTV", "lifetime value", "expected revenue", "ROI timeline", "payback period" |
| Capacity | "when does the operator break", "breaking point distribution", "collision risk" |
| Forecast | "forecast", "project", "predict", "expect", "what happens if" |

**Rule:** If NONE of these signals are present, use cascade only. If ANY are present, activate Markov layer.

### Signal table — common requests

| User request | Class | Why |
|-------------|:-----:|-----|
| "find bottlenecks", "stress test the offer" | STRUCTURAL | No temporal dimension |
| "spot check this persona" | STRUCTURAL | Single walkthrough, cascade sufficient |
| "what's our churn risk at 6 months" | TRAJECTORY | Temporal + probability |
| "expected LTV for this segment" | TRAJECTORY | Financial forecast |
| "capacity at 15 clients over time" | TRAJECTORY | Capacity + distribution |
| "which segments should we avoid" | HYBRID | Cascade for WHY, Markov for HOW BAD |
| "pre-mortem" | HYBRID | Structural + temporal together |
| "simulate delivery for [persona]" | STRUCTURAL | Unless "...over 6 months" appended |

---

## 3. Cascade-to-Transition Mapping

After walking touchpoints for an archetype (simulation Steps 2-4), translate cascade scores into transition probabilities.

### Input from cascade model

- Count of reds and yellows per journey phase (Onboarding touchpoints, Ramp touchpoints, etc.)
- Cascade chain activations (which of the 6 chains fired, how deep)
- Churn signal sum from `scoring-rubric.md`

### Base transition rates

Starting point before cascade adjustment:

| Transition | Probability |
|-----------|:-----------:|
| Forward (state N to N+1) | 0.75 |
| At-Risk from current state | 0.15 |
| Churn from current state | 0.05 |
| Stay in current state | 0.05 |

### Cascade adjustments

Each friction signal shifts probabilities:

| Condition | Forward | At-Risk | Churn | Stay |
|-----------|:-------:|:-------:|:-----:|:----:|
| Per red in this phase's touchpoints | -0.08 | +0.06 | +0.02 | -- |
| Per yellow in this phase's touchpoints | -0.03 | +0.03 | -- | -- |
| Per cascade chain activated | -0.05 | +0.03 | +0.02 | -- |

For the **At-Risk** row specifically (determines recovery vs churn):

| Condition | At-Risk to Retained | At-Risk to Churned | At-Risk stay |
|-----------|:-------------------:|:------------------:|:------------:|
| Churn signal sum > 12 | -0.10 | +0.10 | -- |
| Churn signal sum > 20 | -0.15 | +0.20 | -0.05 |

### Post-adjustment normalization

1. Apply all adjustments to base rates for each row
2. Clamp every probability to [0.01, 0.95]
3. Normalize each row to sum to 1.0
4. Verify Churned row is `[0,0,0,0,0,1,0]` (absorbing — never modify)

### Calibration status

These adjustment magnitudes are informed estimates derived from cascade-chain trigger frequencies and scoring-rubric churn weights. They have NOT been validated against real client data.

**The relative ordering is more trustworthy than the absolute values.** "The Referral King has higher churn than The Roofer" is reliable. "The Referral King churns at exactly 62%" is directional.

**Recalibration trigger:** After onboarding 5+ clients, recalibrate against observed state transitions. Track: actual weeks in each state, actual churn timing, actual operator hours per state.

---

## 4. Computation — Script Template

Write and execute this Python script, filling in the transition matrix from Section 3's mapping. If numpy is not available, skip to Section 5 (Fallback).

```python
import numpy as np
import json

# ---- Fill from cascade analysis ----
archetype_name = "FILL_ARCHETYPE_NAME"
states = ["Onboarding", "Ramp", "SmartAssist", "Autonomous", "AtRisk", "Churned", "Retained"]

# 7x7 transition matrix — fill from Section 3 mapping
P = np.array([
    # Onb   Ramp  Smart  Auto  AtRsk  Churn  Retain
    [0.00,  0.00, 0.00,  0.00, 0.00,  0.00,  0.00],  # Onboarding
    [0.00,  0.00, 0.00,  0.00, 0.00,  0.00,  0.00],  # Ramp
    [0.00,  0.00, 0.00,  0.00, 0.00,  0.00,  0.00],  # Smart Assist
    [0.00,  0.00, 0.00,  0.00, 0.00,  0.00,  0.00],  # Autonomous
    [0.00,  0.00, 0.00,  0.00, 0.00,  0.00,  0.00],  # At-Risk
    [0.00,  0.00, 0.00,  0.00, 0.00,  1.00,  0.00],  # Churned (absorbing)
    [0.00,  0.00, 0.00,  0.00, 0.00,  0.00,  0.00],  # Retained (semi)
])

revenue_per_week = 115      # $497/mo base
op_hours = [2.5, 1.5, 4.0, 1.0, 3.0, 0.0, 1.0]
n_clients = 1               # set >1 for portfolio mode
horizon_weeks = 26           # default 6 months
n_simulations = 2000

# ---- State distribution over time (P^t) ----
pi = np.array([1, 0, 0, 0, 0, 0, 0], dtype=float)
trajectory = []
for t in range(horizon_weeks + 1):
    trajectory.append({"week": t, **{s: round(float(v), 4) for s, v in zip(states, pi)}})
    if t < horizon_weeks:
        pi = pi @ P

# ---- Fundamental matrix (absorbing analysis) ----
Q = P[:5, :5]
R_abs = P[:5, 5:]
N_fund = np.linalg.inv(np.eye(5) - Q)
expected_weeks = N_fund.sum(axis=1)
absorption_probs = N_fund @ R_abs

# ---- Monte Carlo for LTV distribution ----
ltv_samples = []
for _ in range(n_simulations):
    state = 0
    ltv = 0.0
    for week in range(horizon_weeks):
        if state != 5:
            ltv += revenue_per_week
        state = int(np.random.choice(7, p=P[state]))
    ltv_samples.append(ltv)

ltv_arr = np.array(ltv_samples)
p10, p50, p90 = np.percentile(ltv_arr, [10, 50, 90])
base_mean_ltv = float(np.mean(ltv_arr))

# ---- Portfolio operator hours (if n_clients > 1) ----
portfolio_hours = None
if n_clients > 1:
    weekly_totals = np.zeros((n_simulations, horizon_weeks))
    for c in range(n_clients):
        for sim in range(n_simulations):
            state = 0
            for week in range(horizon_weeks):
                weekly_totals[sim, week] += op_hours[state]
                state = int(np.random.choice(7, p=P[state]))
    portfolio_hours = {}
    for wk in [0, 3, 7, 12, 25]:
        if wk < horizon_weeks:
            col = weekly_totals[:, wk]
            portfolio_hours[f"week_{wk+1}"] = {
                "p10": round(float(np.percentile(col, 10)), 1),
                "p50": round(float(np.percentile(col, 50)), 1),
                "p90": round(float(np.percentile(col, 90)), 1),
            }

# ---- Sensitivity analysis ----
sensitivities = {}
for i in range(5):
    for j in range(7):
        if P[i, j] > 0.05 and i != j:
            P_pert = P.copy()
            P_pert[i, j] *= 0.7
            P_pert[i] /= P_pert[i].sum()
            pert_ltvs = []
            for _ in range(n_simulations):
                state = 0
                ltv = 0.0
                for week in range(horizon_weeks):
                    if state != 5:
                        ltv += revenue_per_week
                    state = int(np.random.choice(7, p=P_pert[state]))
                pert_ltvs.append(ltv)
            delta = float(np.mean(pert_ltvs)) - base_mean_ltv
            if abs(delta) > 50:
                sensitivities[f"{states[i]}->{states[j]}"] = {
                    "current_prob": round(float(P[i, j]), 3),
                    "perturbed_prob": round(float(P_pert[i, j]), 3),
                    "delta_ltv": round(delta, 0),
                }

# ---- Output ----
result = {
    "archetype": archetype_name,
    "trajectory": [trajectory[i] for i in [0, 1, 4, 8, 13, 26] if i <= horizon_weeks],
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
    "sensitivities": dict(sorted(sensitivities.items(), key=lambda x: abs(x[1]["delta_ltv"]), reverse=True)),
}
if portfolio_hours:
    result["portfolio_hours"] = portfolio_hours

print(json.dumps(result, indent=2))
```

Run once per archetype. For a full simulation with Markov, run for each archetype that represents >5% of the profile set. For consensus pre-computation, run for all 10 archetype templates from `variation-axes.md`.

---

## 5. Fallback — Qualitative Trajectory Reasoning

If Python or numpy is unavailable, fall back to qualitative reasoning using the same state space and transition logic.

### Probability bands (replace exact numbers)

| Band | Probability range | Language |
|------|:-----------------:|---------|
| HIGH | >0.6 | "most profiles follow this path" |
| MEDIUM | 0.3-0.6 | "roughly even odds" |
| LOW | <0.3 | "happens but not the dominant path" |

### Qualitative process

1. For each archetype, walk through the state space and assign transition bands using the cascade adjustment rules directionally (more reds = lower forward band, higher at-risk band)
2. Identify the **dominant path** (highest-band forward chain) and **dominant failure path** (highest-band path to churned)
3. Estimate LTV in ranges: "likely $2K-$5K" rather than "P10=$994, P50=$2,388"
4. For capacity, describe collision scenarios narratively rather than P10/P50/P90 tables
5. For sensitivity, identify "which transition is the most load-bearing" as a qualitative judgment

### Fallback report language

Use the same section headers as the computational report but with narrative content:

```
### Absorption Analysis

The Referral King's dominant path is Onboarding -> Ramp -> At-Risk -> Churned. 
The LOW volume starvation chain activates for most profiles in this archetype, 
causing a HIGH probability stall at the Ramp stage. Expected retention is LOW.

Compared to The Roofer, whose dominant path runs straight through to Autonomous 
-> Retained with MEDIUM-HIGH probability at each forward transition.
```

The qualitative analysis still adds value over cascade-only — it structures temporal reasoning and identifies dominant lifecycle paths. The precision loss is acceptable given that the underlying matrices are pre-calibration estimates.

---

## 6. Consensus Integration

### When to activate

When the consensus skill's gate (Section 2) detects TRAJECTORY or HYBRID signals in the user's problem, run the Markov layer before spawning agents.

### Pre-agent computation

Run the service-delivery simulation with Markov for the 10 archetype templates from `variation-axes.md` (one cascade walk + one script run per archetype). This is fast — 10 lightweight simulations, not a full N=50 profile set.

### Shared context block

Include in every agent's prompt:

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

### Framing interpretation guide

Each agent's framing variation shapes HOW they interpret the shared data:

| Framing | Interpretation lens |
|---------|-------------------|
| Risk-averse | Weights P10 LTV. Flags archetypes with >50% churn. Recommends gating. |
| Growth-oriented | Weights P90 LTV. Focuses on sensitivity — "which fix unlocks the most upside?" |
| Contrarian | Challenges transition assumptions. "At-Risk->Retained assumes operator intervention — what if operator is at capacity?" |
| Resource-constrained | Focuses on operator hours distribution. "At P90, 12 clients puts us at 40.8 hrs." |
| First-principles | Questions the state space itself. "Is At-Risk one state or three different failure modes?" |
| User-empathy | Maps trajectories to contractor experience. "Week 4 is where 35% hit At-Risk — what does that feel like?" |
| Long-term | Focuses on Retained->At-Risk back-transition. "15% relapse compounds over 12 months." |
| Data-driven | Flags calibration status. "Trust the sensitivity ranking, not the absolute numbers." |
| Systems thinker | Traces second-order effects. "Fixing one archetype's path frees operator hours for all clients." |
| Neutral baseline | Balanced interpretation without a specific lens. |

### Effect on aggregation

Consensus/divergence/outlier buckets stay the same. Content quality improves:

- **Consensus** items are backed by shared data ("8/10 agree we should gate Referral Kings — data shows 62% churn")
- **Divergences** are genuine strategic splits, not numerical fabrication ("5 say fix Ramp->At-Risk first, 4 say Onboarding->At-Risk — both grounded in sensitivity analysis")
- **Outliers** become more interesting (contrarian challenging state space, systems thinker finding cross-archetype interactions)
