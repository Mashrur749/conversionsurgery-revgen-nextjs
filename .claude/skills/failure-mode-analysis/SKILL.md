---
name: failure-mode-analysis
description: >
  Systematic failure mode identification and statistical risk quantification for any system — code, architecture, process, integration, or workflow. Combines FMEA (Failure Mode and Effects Analysis) with Monte Carlo simulation to produce probability distributions, confidence intervals, and cascading failure chains instead of gut-feel risk lists. Use this skill whenever the user asks to analyze what could go wrong, find failure modes, do a pre-mortem, risk-assess a feature or system, stress-test an architecture, analyze reliability, find single points of failure, assess blast radius, or quantify risk. Also triggers on: "failure mode analysis", "FMEA", "what breaks if", "risk analysis", "pre-mortem", "what could go wrong", "blast radius", "failure cascade", "Monte Carlo risk", "reliability analysis", "fault tree", "single point of failure", "risk quantification", "failure scenarios", "what's the worst case", "how likely is X to fail", "risk matrix", "failure probability", "cascading failure", "fragility analysis", or "resilience audit". Use even when the user says something informal like "what are we missing", "where are the landmines", "what blows up", or "how confident are we this works" — these are failure mode questions in disguise.
---

# Failure Mode Analysis with Statistical Scenario Simulation

Identify every way a system can fail, score each failure's probability and impact, model how failures cascade through dependencies, then run Monte Carlo simulations to produce probability distributions instead of single-point estimates. The output is a statistically grounded risk register with confidence intervals, not a vibes-based list of concerns.

## Why single-point risk estimates mislead

Traditional risk assessment says "this has Medium probability and High impact." That's two humans agreeing on adjectives. It doesn't tell you:
- What's the 95th-percentile worst case?
- How do failures compound across dependencies?
- Which mitigation gives the biggest reduction in expected loss?
- What's the probability of simultaneous failures?

Monte Carlo simulation answers these by running thousands of scenarios with stochastic variation, producing distributions you can reason about with real confidence levels.

## Scope

This skill works on any target:

| Target Type | Examples |
|------------|---------|
| **Code** | API endpoint, auth flow, payment pipeline, data migration |
| **Architecture** | Microservice topology, database replication, cache layers |
| **Process** | Deployment pipeline, onboarding workflow, incident response |
| **Integration** | Third-party API dependency, webhook chain, OAuth flow |
| **Feature** | New feature launch, feature flag rollout, A/B test |
| **Infrastructure** | DNS, CDN, database, queue, cron jobs |

---

## Execution

### Step 1: Define the analysis target and boundaries

Extract from the user's request:

- **Target system**: What exactly are we analyzing?
- **Boundary**: Where does our analysis stop? (e.g., "Stripe's API itself is out of scope, but our integration with it is in scope")
- **Perspective**: Whose failures matter? (end-user, operator, developer, business)
- **Time horizon**: Over what period? (single request, per day, per month, per year)
- **Existing mitigations**: What's already in place? (retries, fallbacks, monitoring, alerts)

If the user is vague ("analyze the payment flow"), read the relevant code to establish boundaries yourself. Don't ask unless genuinely ambiguous.

**Codebase research:** If the target is code or architecture, read the actual implementation before hypothesizing failures. Grep for error handling patterns, try/catch blocks, timeout configurations, retry logic, and fallback paths. Real failure modes come from real code, not imagination.

### Step 2: Decompose into components

Break the target into discrete components that can independently fail. Each component should be:
- **Atomic enough** to have a single primary failure mode (or a small number)
- **Connected enough** to show dependency relationships

Build a **dependency graph** — which components depend on which others. This is critical for cascade modeling in Step 5.

Format:
```
Component Graph:
C1: [User Request] → C2: [Auth Check] → C3: [DB Query] → C4: [Business Logic] → C5: [Response]
                      C2 → C6: [Session Store]
                      C3 → C7: [Connection Pool] → C8: [Database]
                      C4 → C9: [External API] → C10: [Webhook Callback]
```

### Step 3: Identify failure modes (FMEA)

For each component, systematically identify failure modes. A failure mode is a specific way the component stops working correctly — not just "it breaks" but *how* it breaks.

**Failure mode categories** (check each for every component):

| Category | What to look for |
|----------|-----------------|
| **Crash** | Unhandled exception, OOM, null reference, type error |
| **Timeout** | Slow response, connection timeout, deadlock |
| **Data corruption** | Race condition, partial write, stale cache, schema mismatch |
| **Capacity** | Rate limit hit, pool exhaustion, queue overflow, disk full |
| **Logic** | Wrong branch taken, off-by-one, state machine stuck, edge case |
| **Dependency** | Upstream unavailable, API contract change, cert expiry, DNS failure |
| **Security** | Auth bypass, injection, SSRF, token leak, privilege escalation |
| **Configuration** | Wrong env var, missing secret, feature flag mismatch, stale config |
| **Observability** | Silent failure (no error logged), misleading metric, alert fatigue |

For each failure mode, record:

```
FM-[N]: [Component] — [Failure Mode Name]
  How it fails: [specific mechanism]
  Detection: [how/when would we know?]
  Current mitigation: [what's already in place, if anything]
  Blast radius: [what downstream components are affected]
```

**Thoroughness calibration**: For a focused analysis (single endpoint), aim for 15-30 failure modes. For a system-level analysis (full architecture), aim for 40-80. Don't pad with unlikely scenarios to hit a number, but don't stop at the obvious ones either — the value is in the non-obvious failures.

### Step 4: Score each failure mode

Score three dimensions for each failure mode on a 1-10 scale:

| Dimension | 1 (Low) | 5 (Medium) | 10 (High) |
|-----------|---------|------------|-----------|
| **Severity (S)** | Cosmetic issue, no data loss | Degraded UX, partial outage | Data loss, full outage, security breach |
| **Probability (P)** | < 0.1%/year, needs exotic trigger | 1-5%/month, happens under load | > 10%/month, happens routinely |
| **Detectability (D)** | Instant alert, auto-recovery | Detected in minutes by monitoring | Silent for hours/days, found by user report |

**Risk Priority Number (RPN)** = S x P x D (range: 1-1000)

Also assign a **probability estimate** as a decimal (e.g., 0.02 = 2% chance per time horizon). This feeds the Monte Carlo simulation. Use your best judgment informed by:
- Code quality (error handling, test coverage)
- Historical patterns (has this type of thing failed before in this codebase?)
- Architectural resilience (redundancy, retries, fallbacks)
- External dependency reliability (Stripe: 99.99%, random webhook: 95%)

Don't fake precision — round to the nearest order of magnitude. 1%, 5%, 10%, 25% are better than 3.7%.

Read `references/probability-calibration.md` for calibration guidance on common failure types.

### Step 5: Model cascading failures

Using the dependency graph from Step 2 and the failure modes from Step 3, trace how each failure propagates:

**Cascade rules:**
1. When component C_i fails, every component that depends on C_i has its failure probability increased
2. The increase depends on the **coupling tightness** between components:
   - **Hard dependency** (sync call, no fallback): downstream P → min(P + 0.7, 0.95)
   - **Soft dependency** (async, has fallback): downstream P → min(P + 0.2, 0.80)
   - **Observable dependency** (monitoring, alert): downstream P → min(P + 0.05, 0.50)
3. Cascades are transitive — if A → B → C, a failure in A can cascade through B to C
4. **Correlated failures**: some failure modes share root causes (e.g., "database is down" affects every component that queries it simultaneously, not independently)

Build a **cascade matrix** showing which failure modes trigger which downstream failures:

```
Cascade Chain CC-1: "Database connection pool exhaustion"
  Trigger: FM-7 (Connection Pool — capacity exceeded)
  → FM-3 (DB Query — timeout) [hard dep, P: 0.05 → 0.75]
  → FM-4 (Business Logic — stale data fallback) [soft dep, P: 0.02 → 0.22]
  → FM-10 (Webhook — retry queue fills) [hard dep, P: 0.01 → 0.71]
  Combined impact: Full request path degraded, webhooks delayed 10+ min
```

### Step 6: Monte Carlo simulation

Write and execute a Python script that simulates N scenarios (default 10,000). The script models:

1. **Independent failure sampling**: For each scenario, flip a weighted coin for each failure mode using its probability estimate
2. **Cascade propagation**: When a failure fires, adjust downstream probabilities per the cascade rules and re-sample
3. **Correlated failure groups**: Failures sharing a root cause fire together (not independently)
4. **Impact aggregation**: Sum the severity of all failures that fired in each scenario

**Script structure** (write to `.scratch/fma-simulation.py` and execute):

```python
import numpy as np
from dataclasses import dataclass

@dataclass
class FailureMode:
    id: str
    component: str
    name: str
    severity: float        # 1-10
    probability: float     # 0.0-1.0 per time horizon
    detectability: float   # 1-10 (higher = harder to detect)
    downstream: list       # [(fm_id, coupling_type)]
    correlation_group: str  # failures in same group fire together

# ... populate from Steps 3-5 ...

N_SCENARIOS = 10_000
results = []

for _ in range(N_SCENARIOS):
    fired = set()
    total_severity = 0
    total_detection_delay = 0
    
    # Phase 1: Independent failures
    for fm in failure_modes:
        if fm.correlation_group in fired_groups:
            fired.add(fm.id)  # correlated
        elif np.random.random() < fm.probability:
            fired.add(fm.id)
            fired_groups.add(fm.correlation_group)
    
    # Phase 2: Cascade propagation
    changed = True
    while changed:
        changed = False
        for fm in failure_modes:
            if fm.id in fired:
                for downstream_id, coupling in fm.downstream:
                    if downstream_id not in fired:
                        cascade_p = cascade_probability(coupling)
                        if np.random.random() < cascade_p:
                            fired.add(downstream_id)
                            changed = True
    
    # Phase 3: Impact aggregation
    for fm_id in fired:
        fm = lookup[fm_id]
        total_severity += fm.severity
        total_detection_delay += fm.detectability
    
    results.append({
        'failures_fired': len(fired),
        'total_severity': total_severity,
        'detection_delay_score': total_detection_delay,
        'cascade_chains_activated': count_chains(fired),
    })

# ... compute distributions, percentiles, print report ...
```

Read `references/simulation-template.md` for the full parameterized script template.

**Output from simulation:**

| Metric | P5 | P25 | P50 | P75 | P95 | P99 |
|--------|:--:|:---:|:---:|:---:|:---:|:---:|
| Failures fired per [horizon] | | | | | | |
| Total severity score | | | | | | |
| Detection delay score | | | | | | |
| Cascade chains activated | | | | | | |
| Estimated downtime (minutes) | | | | | | |
| Revenue impact ($) | | | | | | |

### Step 7: Sensitivity analysis

Identify which failure modes have the largest influence on outcomes. For each failure mode:

1. Halve its probability → rerun simulation → measure delta in P95 severity
2. Double its probability → rerun simulation → measure delta in P95 severity
3. Remove it entirely → rerun simulation → measure delta

Rank by **|delta P95 severity|**. This answers: "Which single failure mode, if mitigated, would most reduce our worst-case risk?"

Also run **correlation sensitivity**: for each correlated failure group, break the correlation (make them independent) and measure the delta. Correlated groups that significantly reduce P95 when broken are the highest-leverage architectural improvements.

### Step 8: Mitigation prioritization

For each failure mode in the top 10 by RPN or sensitivity rank:

1. **Proposed mitigation**: specific, actionable (not "add error handling" but "add retry with exponential backoff on Stripe API calls in `billing.ts:L45`")
2. **Expected probability reduction**: what does P become after mitigation?
3. **Implementation effort**: S/M/L
4. **Mitigation effectiveness score** = (RPN_before - RPN_after) / effort_weight

Rank mitigations by effectiveness score. This is the prioritized action list.

### Step 9: Output the report

Write to `active/fma/failure-mode-analysis.md` (create directory if needed):

```markdown
# Failure Mode Analysis Report

**Target**: [system/feature/process analyzed]
**Boundary**: [what's in/out of scope]  
**Time horizon**: [per request / per day / per month]
**Date**: [date]
**Simulation**: [N] scenarios

## Executive Summary

[3-5 sentences: what was analyzed, how many failure modes found, top risk,
 P95 worst case, highest-leverage mitigation]

## Risk Distribution (Monte Carlo, N=[scenarios])

| Metric | P5 | P25 | P50 (typical) | P75 | P95 (worst realistic) | P99 (catastrophic) |
|--------|:--:|:---:|:-------------:|:---:|:---------------------:|:------------------:|

**Interpretation**: In a typical [horizon], expect [P50 summary]. In the worst
realistic case (1 in 20 [horizons]), expect [P95 summary]. The catastrophic
tail (1 in 100) involves [P99 summary].

## Top 10 Failure Modes by Risk Priority

| # | ID | Component | Failure Mode | S | P | D | RPN | Probability | Cascade? |
|---|:--:|-----------|-------------|:-:|:-:|:-:|:---:|:-----------:|:--------:|

## Cascade Chains

| Chain | Trigger | Propagation Path | Combined Impact | Frequency (sim) |
|-------|---------|-----------------|-----------------|:---------------:|

## Sensitivity Analysis — Highest-Leverage Risks

| # | Failure Mode | Current P95 Impact | If Mitigated (P95) | Delta | Rank |
|---|-------------|:------------------:|:------------------:|:-----:|:----:|

## Correlation Groups

| Group | Shared Root Cause | Failure Modes | Impact if Decorrelated |
|-------|------------------|---------------|:---------------------:|

## Mitigation Priority Matrix

| # | Failure Mode | Mitigation | P Before → After | RPN Before → After | Effort | Effectiveness |
|---|-------------|-----------|:-----------------:|:------------------:|:------:|:-------------:|

## Complete Failure Mode Register

[Full table of all FM-[N] entries with details]

## Component Dependency Graph

[ASCII or structured representation from Step 2]

## Simulation Parameters

[Failure probabilities used, cascade coupling values, correlation groups,
 number of scenarios, random seed for reproducibility]

## Recommendations

[Top 3-5 actions, ordered by mitigation effectiveness score.
 Each includes: what to do, expected risk reduction, effort, and
 which cascade chains it breaks.]
```

---

## Modes

### Quick Scan
User says something like "quick risk check on X" or analysis target is a single component/endpoint. Reduce scope:
- 5-15 failure modes (skip exhaustive enumeration)
- Skip Monte Carlo — use RPN scoring only
- Skip sensitivity analysis
- Still identify cascade chains
- Output a condensed table, not the full report

### Deep Analysis (default)
Full execution of all steps. Use for features, integrations, or systems with multiple components.

### Architecture Audit
User asks about system-level resilience. Expand scope:
- Analyze cross-cutting concerns (auth, logging, config, secrets)
- Model infrastructure-level failures (DNS, CDN, DB, provider outage)
- Include **simultaneous failure scenarios** (what if Stripe AND Twilio are down?)
- Extended simulation: 50,000 scenarios
- Add a "single points of failure" section to the report

---

## Composing with other skills

### With stochastic-multi-agent-consensus
After generating the failure mode register, feed it to consensus:
> "Here are [N] failure modes with RPN scores. Poll 10 agents: which are we overestimating, which are we underestimating, what did we miss, and how would you reprioritize mitigations?"

This catches blind spots — the initial analysis is one perspective; consensus surfaces what it missed.

### With service-delivery-simulation
Service delivery simulation finds *structural* bottlenecks in the offer. Failure mode analysis finds *reliability* risks in the platform. Together:
1. Run service-delivery-simulation to find delivery gaps
2. Run failure-mode-analysis on the platform components that support each high-risk touchpoint
3. Cross-reference: delivery bottlenecks backed by fragile code are the highest priority

---

## Reference files

- `references/probability-calibration.md` — Base rate probability estimates for common failure types (API timeouts, DB failures, auth issues, etc.) to anchor scoring and avoid systematic over/under-estimation.
- `references/simulation-template.md` — Full parameterized Python script template for Monte Carlo simulation. Read before writing the simulation script — don't reinvent the wheel.
- `references/cascade-patterns.md` — Common cascade failure patterns in web applications (DB pool exhaustion chains, auth cascade, config propagation, etc.) to ensure completeness during Step 5.
