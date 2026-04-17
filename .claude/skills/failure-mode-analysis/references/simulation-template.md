# Monte Carlo Simulation Template

Use this as your starting template. Parameterize it with the failure modes, cascade rules, and correlation groups from your analysis.

## Full Script

```python
#!/usr/bin/env python3
"""
Failure Mode Monte Carlo Simulation
Parameterized template — fill in failure_modes, cascades, and correlations from FMEA.
"""

import numpy as np
from dataclasses import dataclass, field
from collections import defaultdict
import json
import sys

# ─── Configuration ───────────────────────────────────────────────

N_SCENARIOS = 10_000
RANDOM_SEED = 42  # for reproducibility — change per run if desired

# Coupling multipliers for cascade propagation
COUPLING = {
    'hard':       0.70,   # sync call, no fallback
    'soft':       0.20,   # async, has fallback
    'observable': 0.05,   # monitoring/alert dependency
}

# ─── Data Structures ────────────────────────────────────────────

@dataclass
class FailureMode:
    id: str
    component: str
    name: str
    severity: float           # 1-10
    probability: float        # 0.0-1.0 per time horizon
    detectability: float      # 1-10 (higher = harder to detect)
    correlation_group: str    # failures in same group fire together; '' = independent
    downstream: list = field(default_factory=list)  # [(target_fm_id, coupling_type)]
    
    @property
    def rpn(self) -> float:
        return self.severity * (self.probability * 10) * self.detectability

    @property
    def detection_delay_minutes(self) -> float:
        """Rough mapping: detectability score → estimated minutes to detect."""
        # 1=instant(0min), 5=monitoring(15min), 10=user-report(1440min/24hr)
        return {
            1: 0, 2: 1, 3: 5, 4: 10, 5: 15,
            6: 30, 7: 60, 8: 120, 9: 480, 10: 1440
        }.get(int(self.detectability), 60)


@dataclass
class ScenarioResult:
    failures_fired: int
    total_severity: float
    detection_delay_max: float      # worst detection time across fired failures
    detection_delay_mean: float
    cascade_depth: int              # longest cascade chain activated
    correlated_groups_fired: int
    fired_ids: list = field(default_factory=list)


# ─── PARAMETERIZE THIS SECTION ──────────────────────────────────
# Replace with actual failure modes from your FMEA (Steps 3-4)

failure_modes = [
    # Example — replace with real data:
    # FailureMode(
    #     id='FM-1',
    #     component='Auth Check',
    #     name='Session token expired mid-request',
    #     severity=4,
    #     probability=0.03,
    #     detectability=3,
    #     correlation_group='auth',
    #     downstream=[('FM-3', 'hard'), ('FM-5', 'soft')]
    # ),
]

# ─── Simulation Engine ──────────────────────────────────────────

def run_simulation(failure_modes: list[FailureMode], n_scenarios: int, seed: int) -> list[ScenarioResult]:
    rng = np.random.default_rng(seed)
    fm_lookup = {fm.id: fm for fm in failure_modes}
    results = []

    for _ in range(n_scenarios):
        fired = set()
        fired_groups = set()
        cascade_depth = 0

        # Phase 1: Independent + correlated failure sampling
        for fm in failure_modes:
            if fm.correlation_group and fm.correlation_group in fired_groups:
                # Correlated failure — already triggered by group
                fired.add(fm.id)
            elif rng.random() < fm.probability:
                fired.add(fm.id)
                if fm.correlation_group:
                    fired_groups.add(fm.correlation_group)

        # Phase 2: Cascade propagation (iterative until stable)
        depth = 0
        changed = True
        while changed:
            changed = False
            depth += 1
            new_fires = set()
            for fm_id in list(fired):
                fm = fm_lookup[fm_id]
                for downstream_id, coupling_type in fm.downstream:
                    if downstream_id not in fired:
                        cascade_p = COUPLING.get(coupling_type, 0.10)
                        if rng.random() < cascade_p:
                            new_fires.add(downstream_id)
                            changed = True
            fired |= new_fires
            if depth > 20:  # safety valve — prevent infinite loops
                break
        cascade_depth = depth - 1 if depth > 1 else 0

        # Phase 3: Impact aggregation
        total_severity = 0.0
        detection_delays = []
        for fm_id in fired:
            if fm_id in fm_lookup:
                fm = fm_lookup[fm_id]
                total_severity += fm.severity
                detection_delays.append(fm.detection_delay_minutes)

        results.append(ScenarioResult(
            failures_fired=len(fired),
            total_severity=total_severity,
            detection_delay_max=max(detection_delays) if detection_delays else 0,
            detection_delay_mean=np.mean(detection_delays) if detection_delays else 0,
            cascade_depth=cascade_depth,
            correlated_groups_fired=len(fired_groups),
            fired_ids=sorted(fired),
        ))

    return results


def compute_stats(values: list[float], label: str) -> dict:
    """Compute percentile distribution for a metric."""
    arr = np.array(values)
    return {
        'label': label,
        'mean': float(np.mean(arr)),
        'std': float(np.std(arr)),
        'p5': float(np.percentile(arr, 5)),
        'p25': float(np.percentile(arr, 25)),
        'p50': float(np.percentile(arr, 50)),
        'p75': float(np.percentile(arr, 75)),
        'p95': float(np.percentile(arr, 95)),
        'p99': float(np.percentile(arr, 99)),
        'max': float(np.max(arr)),
    }


def sensitivity_analysis(failure_modes: list[FailureMode], baseline_p95: float, n_scenarios: int, seed: int) -> list[dict]:
    """For each FM, halve probability and measure P95 severity delta."""
    sensitivities = []
    for target in failure_modes:
        modified = []
        for fm in failure_modes:
            if fm.id == target.id:
                modified.append(FailureMode(
                    id=fm.id, component=fm.component, name=fm.name,
                    severity=fm.severity, probability=fm.probability * 0.5,
                    detectability=fm.detectability, correlation_group=fm.correlation_group,
                    downstream=fm.downstream
                ))
            else:
                modified.append(fm)
        
        results = run_simulation(modified, n_scenarios, seed)
        mitigated_p95 = np.percentile([r.total_severity for r in results], 95)
        delta = baseline_p95 - mitigated_p95

        sensitivities.append({
            'fm_id': target.id,
            'fm_name': f"{target.component}: {target.name}",
            'original_p': target.probability,
            'halved_p': target.probability * 0.5,
            'baseline_p95': baseline_p95,
            'mitigated_p95': float(mitigated_p95),
            'delta_p95': float(delta),
            'rpn': target.rpn,
        })

    return sorted(sensitivities, key=lambda x: x['delta_p95'], reverse=True)


def correlation_sensitivity(failure_modes: list[FailureMode], baseline_p95: float, n_scenarios: int, seed: int) -> list[dict]:
    """Break each correlation group and measure P95 delta."""
    groups = set(fm.correlation_group for fm in failure_modes if fm.correlation_group)
    results_list = []

    for group in groups:
        modified = []
        for fm in failure_modes:
            if fm.correlation_group == group:
                modified.append(FailureMode(
                    id=fm.id, component=fm.component, name=fm.name,
                    severity=fm.severity, probability=fm.probability,
                    detectability=fm.detectability, correlation_group='',  # break correlation
                    downstream=fm.downstream
                ))
            else:
                modified.append(fm)

        results = run_simulation(modified, n_scenarios, seed)
        decorrelated_p95 = np.percentile([r.total_severity for r in results], 95)
        delta = baseline_p95 - decorrelated_p95

        member_ids = [fm.id for fm in failure_modes if fm.correlation_group == group]
        results_list.append({
            'group': group,
            'members': member_ids,
            'member_count': len(member_ids),
            'baseline_p95': baseline_p95,
            'decorrelated_p95': float(decorrelated_p95),
            'delta_p95': float(delta),
        })

    return sorted(results_list, key=lambda x: x['delta_p95'], reverse=True)


def failure_frequency(results: list[ScenarioResult], failure_modes: list[FailureMode]) -> list[dict]:
    """How often each FM fires across all scenarios."""
    fm_lookup = {fm.id: fm for fm in failure_modes}
    counts = defaultdict(int)
    for r in results:
        for fm_id in r.fired_ids:
            counts[fm_id] += 1

    freq = []
    for fm_id, count in counts.items():
        fm = fm_lookup.get(fm_id)
        if fm:
            freq.append({
                'fm_id': fm_id,
                'name': f"{fm.component}: {fm.name}",
                'fires': count,
                'frequency': count / len(results),
                'severity': fm.severity,
                'expected_impact': (count / len(results)) * fm.severity,
            })
    return sorted(freq, key=lambda x: x['expected_impact'], reverse=True)


# ─── Main ────────────────────────────────────────────────────────

def main():
    if not failure_modes:
        print("ERROR: No failure modes defined. Parameterize the failure_modes list.")
        sys.exit(1)

    print(f"Running {N_SCENARIOS:,} scenarios with {len(failure_modes)} failure modes...")
    print(f"Seed: {RANDOM_SEED}\n")

    # Run baseline simulation
    results = run_simulation(failure_modes, N_SCENARIOS, RANDOM_SEED)

    # Compute distributions
    metrics = {
        'failures_fired': compute_stats([r.failures_fired for r in results], 'Failures Fired'),
        'total_severity': compute_stats([r.total_severity for r in results], 'Total Severity Score'),
        'detection_delay_max': compute_stats([r.detection_delay_max for r in results], 'Max Detection Delay (min)'),
        'cascade_depth': compute_stats([r.cascade_depth for r in results], 'Cascade Depth'),
    }

    # Print distribution table
    print("=" * 90)
    print(f"{'Metric':<30} {'P5':>8} {'P25':>8} {'P50':>8} {'P75':>8} {'P95':>8} {'P99':>8}")
    print("-" * 90)
    for m in metrics.values():
        print(f"{m['label']:<30} {m['p5']:>8.1f} {m['p25']:>8.1f} {m['p50']:>8.1f} {m['p75']:>8.1f} {m['p95']:>8.1f} {m['p99']:>8.1f}")
    print("=" * 90)

    # Failure frequency
    print("\n--- Failure Frequency (top 10 by expected impact) ---")
    freq = failure_frequency(results, failure_modes)
    print(f"{'FM':<8} {'Name':<40} {'Freq':>8} {'Sev':>6} {'E[Impact]':>10}")
    for f in freq[:10]:
        print(f"{f['fm_id']:<8} {f['name'][:40]:<40} {f['frequency']:>7.1%} {f['severity']:>6.1f} {f['expected_impact']:>10.2f}")

    # Sensitivity analysis
    baseline_p95 = metrics['total_severity']['p95']
    print(f"\n--- Sensitivity Analysis (baseline P95 severity: {baseline_p95:.1f}) ---")
    sensitivities = sensitivity_analysis(failure_modes, baseline_p95, N_SCENARIOS, RANDOM_SEED)
    print(f"{'FM':<8} {'Name':<40} {'P':>8} {'P/2':>8} {'Delta P95':>10}")
    for s in sensitivities[:10]:
        print(f"{s['fm_id']:<8} {s['fm_name'][:40]:<40} {s['original_p']:>7.1%} {s['halved_p']:>7.1%} {s['delta_p95']:>+10.2f}")

    # Correlation sensitivity
    corr = correlation_sensitivity(failure_modes, baseline_p95, N_SCENARIOS, RANDOM_SEED)
    if corr:
        print(f"\n--- Correlation Group Sensitivity ---")
        print(f"{'Group':<20} {'Members':>8} {'Baseline P95':>14} {'Decorr P95':>12} {'Delta':>10}")
        for c in corr:
            print(f"{c['group']:<20} {c['member_count']:>8} {c['baseline_p95']:>14.1f} {c['decorrelated_p95']:>12.1f} {c['delta_p95']:>+10.2f}")

    # Zero-failure scenarios
    zero_failures = sum(1 for r in results if r.failures_fired == 0)
    print(f"\n--- Summary ---")
    print(f"Zero-failure scenarios: {zero_failures:,} / {N_SCENARIOS:,} ({zero_failures/N_SCENARIOS:.1%})")
    print(f"Mean failures per scenario: {metrics['failures_fired']['mean']:.2f}")
    print(f"P95 severity: {baseline_p95:.1f}")
    print(f"Worst single scenario: {metrics['total_severity']['max']:.1f} severity, {int(metrics['failures_fired']['max'])} failures")

    # Dump JSON for report integration
    output = {
        'config': {
            'n_scenarios': N_SCENARIOS,
            'seed': RANDOM_SEED,
            'n_failure_modes': len(failure_modes),
        },
        'distributions': metrics,
        'failure_frequency': freq,
        'sensitivity': sensitivities[:15],
        'correlation_sensitivity': corr,
        'summary': {
            'zero_failure_pct': zero_failures / N_SCENARIOS,
            'mean_failures': metrics['failures_fired']['mean'],
            'p95_severity': baseline_p95,
            'worst_severity': metrics['total_severity']['max'],
        }
    }
    
    with open('fma-simulation-results.json', 'w') as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nResults saved to fma-simulation-results.json")


if __name__ == '__main__':
    main()
```

## Usage

1. Copy this template to `.scratch/fma-simulation.py`
2. Fill in the `failure_modes` list with data from your FMEA Steps 3-5
3. Set `N_SCENARIOS` (10,000 default; 50,000 for architecture audits)
4. Run: `python3 .scratch/fma-simulation.py`
5. Read printed output + `fma-simulation-results.json` for report integration

## Interpreting Output

| Metric | What it means |
|--------|--------------|
| **P50 severity** | Typical scenario — what happens on a normal day/month |
| **P95 severity** | Worst realistic case — happens ~1 in 20 periods. Plan for this. |
| **P99 severity** | Catastrophic tail — happens ~1 in 100. Know it exists, don't over-optimize for it. |
| **Zero-failure %** | How often everything works perfectly. Below 50% means failures are routine. |
| **Sensitivity delta** | How much P95 improves if you halve one FM's probability. Bigger = higher leverage. |
| **Correlation delta** | How much P95 improves if you decorrelate a group. Big delta = single points of failure. |

## Extending the Template

### Add revenue impact
If you have per-failure-mode revenue estimates:
```python
# In FailureMode:
revenue_impact: float = 0.0  # $ lost per occurrence

# In ScenarioResult:
total_revenue_impact: float = 0.0

# In aggregation:
total_revenue_impact += fm.revenue_impact
```

### Add downtime modeling
```python
# In FailureMode:
downtime_minutes: float = 0.0  # service impact duration

# Aggregate per scenario:
# Max (not sum) — concurrent failures don't multiply downtime
downtime = max(fm.downtime_minutes for fm_id in fired if ...)
```

### Add time-to-recovery
```python
# In FailureMode:
mttr_minutes: float = 0.0  # mean time to recovery

# Sample actual recovery time with variation:
recovery = rng.exponential(fm.mttr_minutes)
```
