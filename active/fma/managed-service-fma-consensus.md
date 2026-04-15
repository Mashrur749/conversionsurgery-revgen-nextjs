# Failure Mode Analysis: Adversarial Red-Team Consensus Report

**Target**: ConversionSurgery managed service delivery system — post-mitigation re-analysis
**Method**: 8 independent adversarial reviewers, each read all source docs and spot-checked implementation code
**Consensus threshold**: 5+ of 8 reviewers agreeing = consensus finding; 4/8 = split; <4 = minority (dissent register)
**Date**: 2026-04-15
**Simulation**: 10,000 scenarios, seed 42, 76 failure modes (59 original + 12 NFMs + 5 consensus NEWFMs)
**Source**: 8 reviewer reports aggregated; simulation at `.scratch/fma-consensus-simulation.py`

---

## Executive Summary

The 8-reviewer adversarial red-team found the post-mitigation self-assessment **systematically overestimated probability reductions on behavioral failure modes** while underestimating the effectiveness of hard programmatic gates. Net effect:

- **Total RPN increased 32.5%** over self-scored: 792 (self) → 1,049 (consensus). Still a meaningful improvement from pre-mitigation (~1,600), but the claimed 50% reduction is closer to **34%**.
- **P95 severity increased 26%**: 50 (self) → 63 (consensus). The "worst realistic quarter" is moderately worse than self-scored.
- **5 new failure modes identified** by consensus (8/8 or 5+/8 agreement), adding 163 RPN. The largest is NEWFM-A (capacity tracking 40h ceiling, RPN 63) — a structural bug that undermines the entire operator capacity mitigation.
- **4 overestimated FMs** (8/8 consensus): FM-38 (15% not 10%), FM-40 (13% not 8%), FM-56 (10% not 6%), FM-70 (6% not 3%). Root cause: the self-scorer treated nudges (digest prompts) as equivalent to gates (hard blocks) for behavioral problems.
- **3 underestimated FMs** (7-8/8 consensus): FM-14 (0.5% not 1%), FM-09 (1.5% not 3%), FM-33 (0.8% not 2%). These hard programmatic gates are more effective than scored.

**The residual risk profile shifts**: the `disengaged_contractor` correlation group is even more dominant than self-scored (+25 → estimated +30), and a new cascade chain between volume dampening, digest dedup, and capacity tracking creates a seasonal blind spot that was not modeled.

---

## Consensus Overestimates

All 8 reviewers independently identified these probability reductions as overestimated. Consensus probabilities are medians of 8 reviewer estimates.

| FM | Failure Mode | Claimed P | Consensus P | N/8 | Rationale |
|:--:|-------------|:---------:|:-----------:|:---:|-----------|
| FM-38 | Quiet hours gap (13h window) | 10% | **15%** | 8/8 | Inbound-reply exemption is feature-flagged OFF by default. Legal review unconfirmed (spec 6.4 blocker). Until flag is enabled per-client, mitigation is inert. Proactive automations (estimate follow-ups, win-backs) still queue regardless. |
| FM-40 | EST trigger never used | 8% | **13%** | 8/8 | Daily digest prompts stale estimates but only for leads already in `estimate_sent` status. Root problem is contractor never flagging estimates in the first place — a behavioral dependency. Digest is a nudge, not a gate. Base rate for "runbook not followed" is 15% even with automation (calibration doc). |
| FM-56 | Never marks WON/LOST | 6% | **10%** | 8/8 | Same behavioral root as FM-40. Digest WON/LOST prompts only cover post-appointment leads (7+ days old). Leads that skip the appointment path are missed. 48h dedup limits each item to 1-2 digest appearances before suppression. No escalation for ignored prompts. |
| FM-70 | Churn signals missed | 3% | **6%** | 8/8 | Volume-aware dampening (`engagement-signals.ts:313-317`) caps EST and WON/LOST recency at yellow when lead count < 3/month. Conservative 4/5 flagging threshold. Disengaging contractor with low volume — the most dangerous pattern — is the exact scenario the dampening suppresses. Pull-based dashboard with no push notification. |
| FM-01 | Wrong ICP signed | 4% | **7%** | 5/8 | ICP qualification fields are disclosure gates, not rejection gates. Spec explicitly states low-volume contractors CAN be signed. Operator is the salesperson — incentive misalignment. No hard block in code prevents signing a bad-fit client. |

**Key pattern**: The self-scorer treated daily digest prompts and engagement signals as 60-70% probability reducers. The consensus found these are 30-40% reducers at best for behavioral failure modes. Nudges reduce awareness gaps, not behavioral gaps. The calibration doc's "runbook not followed" base rate of 15% with automation is the correct anchor, not the 5-8% post-scores.

---

## Consensus Underestimates

| FM | Failure Mode | Claimed P | Consensus P | N/8 | Rationale |
|:--:|-------------|:---------:|:-----------:|:---:|-----------|
| FM-14 | Exclusion list skipped (S=10 nuclear) | 1% | **0.5%** | 8/8 | Double-gated: onboarding checklist blocks Autonomous, readiness check blocks independently. Both are hard programmatic gates — no UI bypass. Only path is direct database manipulation. Closest calibration analog: "deploy to wrong env with CI/CD" at 0.1%. |
| FM-09 | Voicemail not disabled | 3% | **1.5%** | 8/8 | AMD forwarding verification runs automated test calls. Onboarding checklist hard-blocks Smart Assist until `forwardingVerificationStatus === 'passed'`. Operator action queue surfaces failures. Three layers of detection + hard gate. |
| FM-33 | Premature autonomous transition | 2% | **0.8%** | 7/8 | Readiness check has 5 critical gates (KB >= 10, pricing range, 30 reviewed interactions, exclusion list, business hours). All are database-verified, not self-reported. No bypass mechanism in the UI. The 2% score was overly conservative for a multi-condition hard block. |

**Key pattern**: Hard programmatic gates that check database state are more effective than the self-scorer credited. Double-gating (onboarding checklist + readiness check) multiplicatively reduces probability.

---

## Newly Identified Failure Modes

5 new failure modes reached consensus (5+/8 agreement). Deduplicated by root cause across all 8 reviewers.

### NEWFM-A: Capacity Tracking Hardcoded 40h Ceiling (8/8 consensus)

**Component**: `src/lib/services/capacity-tracking.ts:114` — `const maxCapacityHours = 40`

The capacity model assumes a 40h/week operator. The original FMA documents realistic capacity at 20-25h/week for managed service ops. At 10 clients (~20h actual), the system shows 50% utilization (green). The 80% yellow alert (32h) never triggers until 16+ clients — far beyond the documented capacity wall.

This directly undermines FM-73 mitigation. The capacity tracking system provides false safety rather than early warning.

| S | P(%) | D | RPN | Cascade | Correlation Group |
|:-:|:----:|:-:|:---:|---------|-------------------|
| 6 | 15 | 7 | **63.0** | → FM-73 (soft) | operator_overload |

**Fix**: Make `maxCapacityHours` configurable via agency settings (default: 25h). One-line code change, major risk reduction.

---

### NEWFM-B: Volume Dampening Masks Genuine Disengagement (8/8 consensus)

**Component**: `src/lib/services/engagement-signals.ts:313-317`

When `recentLeadCount < 3`, EST recency and WON/LOST recency are capped at yellow. This prevents false alarms during seasonal slowdowns, but also masks genuine disengagement during the exact period it is most likely to occur. A contractor going from 15 leads/month to 2 (pipeline shrinking because they stopped answering calls) gets their most telling signals dampened. With 2 of 5 signals capped, the 4/5 flagging threshold may never trigger.

This is a direct inversion of intent for CC-1 (Disengaged Contractor Death Spiral): the signal designed to catch disengagement is suppressed for the pattern disengagement exhibits.

| S | P(%) | D | RPN | Cascade | Correlation Group |
|:-:|:----:|:-:|:---:|---------|-------------------|
| 7 | 8 | 8 | **44.8** | → FM-70 (soft), FM-40 (obs) | disengaged_contractor |

**Fix**: Add a 6th signal: lead volume trend (declining volume over 60 days is yellow/red independent of absolute count). Or reduce the dampening threshold from 3 to 1 (only dampen when truly zero leads).

---

### NEWFM-C: Digest Dedup 48h Notification Blackout (6/8 consensus)

**Component**: `src/lib/services/contractor-digest.ts:27-28` — `DIGEST_DEDUP_HOURS = 48`

Once an item appears in a digest, it is excluded from the next digest for 48 hours via audit_log dedup. If the contractor ignores Tuesday's digest, the items disappear Wednesday, reappear Thursday. For daily digest users, ~30% of pending items are invisible on any given day. Combined with the 8-item cap (`MAX_DIGEST_ITEMS = 8`), high-activity clients may have WON/LOST prompts consistently displaced by KB gaps and estimate prompts (which are queried first in `buildDigest()`).

| S | P(%) | D | RPN | Cascade | Correlation Group |
|:-:|:----:|:-:|:---:|---------|-------------------|
| 5 | 8 | 6 | **24.0** | None | disengaged_contractor |

**Fix**: Reduce dedup to 24h, or add a "perpetually-unresolved" escalation after 3+ digest appearances without response.

---

### NEWFM-D: Auto-Resolve Semantic Search Returns Stale/Wrong KB Entries (7/8 consensus)

**Component**: `src/lib/services/auto-resolve.ts:15` — `MIN_SIMILARITY_THRESHOLD = 0.70`

The 0.70 cosine similarity threshold is permissive enough for semantically similar but factually different matches (e.g., "deck resurfacing pricing" matches "deck waterproofing pricing" at 0.75). No staleness check on matched KB entries — an entry created 6 months ago with outdated pricing could be suggested as a resolution. After 5 auto-resolves per client, `requiresContractorConfirmation` drops to false, reducing the gate. Over time, wrong auto-resolved entries accumulate in the KB, creating drift where future searches return fragmentary answers.

| S | P(%) | D | RPN | Cascade | Correlation Group |
|:-:|:----:|:-:|:---:|---------|-------------------|
| 7 | 4 | 6 | **16.8** | → NFM-06 (soft) | — |

**Fix**: Add `lastUpdated` staleness warning for KB entries > 90 days old. Increase threshold to 0.80. Flag entries created via auto-resolve differently from manual entries.

---

### NEWFM-E: Heartbeat Check Has No External Monitor (5/8 consensus)

**Component**: `src/lib/automations/heartbeat-check.ts:39-51`

The heartbeat writes its own cursor to `cronJobCursors` and checks all other cron cursors. Code comments say "makes staleness detectable by external monitors" but no external monitor exists. If the cron orchestrator itself fails, the heartbeat never runs, the cursor goes stale, and nobody notices. This is the "who watches the watchmen" problem. NFM-08 in the register acknowledged this but scored D=4 — the consensus finds D=8 because internal self-monitoring is architecturally incapable of detecting its own failure.

| S | P(%) | D | RPN | Cascade | Correlation Group |
|:-:|:----:|:-:|:---:|---------|-------------------|
| 6 | 3 | 8 | **14.4** | None | — |

**Also rescored NFM-08**: P increased from 1% to 3%, D increased from 4 to 8. RPN: 2.4 → 14.4.

**Fix**: Add an external uptime monitor (e.g., Cloudflare health check, BetterUptime, or a simple external cron that pings a health endpoint).

---

## Consensus Top 10 Risks (by consensus-adjusted RPN)

| # | FM | Description | S | P(%) | D | RPN | Corr Group | Status |
|---|:--:|------------|:-:|:----:|:-:|:---:|:----------:|--------|
| 1 | **NEWFM-A** | Capacity tracking 40h ceiling | 6 | 15 | 7 | **63.0** | operator_overload | NEW |
| 2 | **FM-40** | EST trigger never used | 8 | 13 | 6 | **62.4** | disengaged_contractor | Rescored ↑ |
| 3 | **FM-38** | Quiet hours gap | 5 | 15 | 8 | **60.0** | — | Rescored ↑ |
| 4 | **FM-56** | Never marks WON/LOST | 8 | 10 | 6 | **48.0** | disengaged_contractor | Rescored ↑ |
| 5 | **NEWFM-B** | Volume dampening masks disengagement | 7 | 8 | 8 | **44.8** | disengaged_contractor | NEW |
| 6 | **FM-01** | Wrong ICP signed | 7 | 7 | 8 | **39.2** | bad_fit | Rescored ↑ |
| 7 | **FM-70** | Churn signals missed | 8 | 6 | 8 | **38.4** | disengaged_contractor | Rescored ↑ |
| 8 | **FM-59** | Layer 2 attribution ambiguous | 7 | 5 | 7 | **24.5** | — | Unchanged |
| 9 | **FM-31** | KB gaps accumulate | 6 | 8 | 5 | **24.0** | thin_kb | Unchanged |
| 10 | **FM-20** | Zero leads first 48h | 5 | 8 | 6 | **24.0** | low_volume | Unchanged |

**Key shift from self-scored**: NEWFM-A (capacity ceiling) enters at #1 — it was not in the register at all. FM-40, FM-56, FM-70 all move up significantly. FM-59 (attribution disputes) drops from #2 to #8 because the behavioral FMs above it were underscored in the self-assessment.

---

## New Cascade Chains

### Chain: Seasonal Volume Drop → Signal Dampening → Missed Disengagement → Capacity Overload → Service Collapse

**Identified by**: 7 of 8 reviewers traced variants of this cascade. The specific chain below is the consensus synthesis.

**Step 1 — Trigger**: Contractor lead volume drops below 3/month (seasonal slowdown or early disengagement). Volume-aware dampening at `engagement-signals.ts:314` caps EST recency and WON/LOST recency at yellow.

**Step 2 — Signal suppression**: With 2 of 5 signals capped at yellow, the 4/5 flagging threshold is harder to reach. If the contractor still occasionally texts the system, signal 5 (contractor contact) stays green. Result: 3/5 non-green — below the flagging threshold. Client does NOT appear as at-risk.

**Step 3 — Digest goes thin or empty**: With few leads, there are few stale estimates and no post-appointment WON/LOST prompts to include. Digest items from prior cycles are 48h-deduped out. The contractor may receive empty or 1-item digests that don't prompt action.

**Step 4 — Capacity model shows green**: `capacity-tracking.ts:114` hardcodes 40h max. With no escalations and no KB gaps from this quiet client, the activity adjustment is near zero. The client shows 1.5h/week (autonomous base). Operator appears to have headroom. Takes on new clients.

**Step 5 — Spring volume spike**: All clients suddenly have leads. Operator now has 10+ clients at full activity. Real utilization exceeds 100% but capacity model shows 75%. The previously disengaged contractor has $0 WON/LOST data for the winter period.

**Step 6 — Guarantee deadline**: Day 90 evaluation finds $0 attributed pipeline. Day 80 alert fires, but with 10 days and an overloaded operator, recovery is impossible. False refund triggered.

**Combined severity**: This chain involves NEWFM-A (capacity) → NEWFM-B (dampening) → FM-70 (missed detection) → FM-40 (no EST) → FM-56 (no WON/LOST) → FM-53 ($0 report) → FM-61 (false refund). Terminal severity S=9.

**Estimated frequency**: ~10-15% per year for contractors in seasonal trades (concrete, roofing, landscaping in northern climates like Calgary). Not modeled in the 6 existing correlation groups because it requires 3 new implementations (volume dampening + digest dedup + capacity tracking) to interact in a specific temporal pattern.

---

## Monte Carlo Comparison

10,000 scenarios, seed 42. Three probability sets: pre-mitigation (original), post-mitigation (self-scored), consensus-adjusted.

| Metric | | P5 | P25 | P50 | P75 | P95 | P99 | Mean |
|--------|:-:|:--:|:---:|:---:|:---:|:---:|:---:|:----:|
| **Failures fired** | PRE | 2 | 5 | 7 | 9 | 14 | 16 | 7.4 |
| | POST | 1 | 2 | 3 | 5 | 8 | 10 | 3.6 |
| | **CONS** | **1** | **3** | **4** | **6** | **10** | **13** | **4.6** |
| | Δ C-P | +0 | +1 | +1 | +1 | +2 | +3 | +0.9 |
| **Total severity** | PRE | 14 | 30 | 44 | 61 | 91 | 110 | 47.2 |
| | POST | 2 | 11 | 19 | 30 | 50 | 68 | 21.7 |
| | **CONS** | **5** | **15** | **24** | **37** | **63** | **83** | **27.7** |
| | Δ C-P | +3 | +4 | +5 | +7 | **+13** | +15 | +6.0 |
| **Cascade depth** | PRE | 0 | 0 | 1 | 3 | 5 | 5 | 1.9 |
| | POST | 0 | 0 | 0 | 0 | 3 | 5 | 0.6 |
| | **CONS** | **0** | **0** | **0** | **1** | **5** | **5** | **0.9** |
| | Δ C-P | +0 | +0 | +0 | +1 | +2 | +0 | +0.3 |

**Interpretation**:

- **P95 severity**: Self-scored 50 → Consensus 63 (+26%). The "worst realistic quarter" is moderately worse than the self-assessment claimed. However, still significantly better than pre-mitigation (91), confirming the implementations DID deliver real risk reduction.
- **P50 severity**: Self-scored 19 → Consensus 24 (+26%). A typical quarter is slightly worse than self-scored but still ~46% better than pre-mitigation (44).
- **Mean failures/quarter**: 3.6 → 4.6 (+28%). About one additional failure per quarter on average.
- **Cascade depth at P95**: 3 → 5. The new cascade chain (seasonal dampening → capacity → death spiral) adds depth that wasn't modeled.

**Overall risk reduction (consensus-adjusted)**:
- Pre-mitigation total RPN: ~1,600
- Consensus-adjusted total RPN: ~1,049
- **True risk reduction: ~34%** (not the self-scored 50%)

---

## Dissent Register

Findings with < 5/8 agreement — noted for awareness but not adopted into consensus scores.

### Split Findings (4/8)

| Finding | Reviewers | Summary |
|---------|:---------:|---------|
| Action queue has no staleness eviction | R4, R6, R7, R1 | Items accumulate unboundedly; resolved items reappear until next page load. No persistence or acknowledgment mechanism. Potential RPNs: 12.8-25.0. |
| Digest reply race condition / mapping staleness | R1, R2, R3, R4 | Contractor replying to old digest gets routed via stale item-to-index mapping. Late replies (>48h) may map to wrong leads. Potential RPNs: 12.0-28.8. |

### Minority Findings (<4/8)

| Finding | Reviewers | Summary |
|---------|:---------:|---------|
| FM-25 (migration refusal) overestimated | R1 | 15% → 20%. Cockpit surfacing doesn't change contractor psychology. |
| FM-05 (trial charge) underestimated | R5 | 3% → 1.5%. Simple date-check cron is highly reliable. |
| Engagement signals stateless during onboarding | R6 | New clients show false-yellow for first 2 weeks (no baseline data). |
| Engagement signal query performance degrades | R3 | 8 parallel queries per client, no index on (clientId, status, updatedAt). |
| Circuit breaker single-automation blind spot | R3 | `distinctCount >= 3` misses chronic single-automation failures (depth not breadth). |
| Digest skip rate as 6th signal | R2 | Contractor replying "0" (skip all) to 3+ digests should trigger independent alert. |
| Double-counting escalation in capacity + signals + queue | R2 | Same KB gap surfaces in 3 systems, creating cognitive overload. |

---

## Recommendations

Ordered by consensus-adjusted risk reduction per effort. The top 3 are actionable code changes; the remaining 2 are process/policy.

### 1. Fix capacity tracking ceiling (Effort: S, Impact: NEWFM-A RPN 63 → ~10)

**What**: Change `maxCapacityHours` in `capacity-tracking.ts:114` from hardcoded `40` to a configurable value from agency settings (default: 25).

**Why**: This is the #1 consensus risk. Every reviewer flagged it. The 40h ceiling makes the entire capacity tracking system output wrong values for a solo operator working 20-25h/week on ops. One-line fix, largest single risk reduction available.

**Expected reduction**: NEWFM-A drops from RPN 63 to ~10 (P drops from 15% to ~2% with correct ceiling). FM-73 effective mitigation improves from negligible to meaningful.

### 2. Add volume-trend signal to engagement detection (Effort: S, Impact: NEWFM-B RPN 45 → ~15)

**What**: Add a 6th engagement signal: 60-day lead volume trend. Declining volume (e.g., 10 leads/month → 2 leads/month) triggers yellow/red independent of the absolute count dampening. Alternatively, reduce the dampening threshold from `recentLeadCount < 3` to `recentLeadCount < 1`.

**Why**: The volume-aware dampening masks the exact disengagement pattern CC-1 is designed to detect. A declining trend is a stronger signal than absolute low volume.

**Expected reduction**: NEWFM-B drops from RPN 45 to ~15. FM-70 detection effectiveness improves for seasonal/low-volume clients.

### 3. Reduce digest dedup window and add escalation (Effort: S, Impact: NEWFM-C RPN 24 → ~8)

**What**: Reduce `DIGEST_DEDUP_HOURS` from 48 to 24. Add a "perpetually-unresolved" escalation: if an item has been in 3+ digests without response, escalate to P1 (immediate send) or create an operator action item.

**Why**: 48h dedup creates a notification blackout where pending items are invisible every other day. Combined with the 8-item cap, WON/LOST prompts can be consistently displaced.

### 4. Enable inbound-reply exemption and complete legal review (Effort: M, Impact: FM-38 RPN 60 → ~30)

**What**: Complete the legal review for the inbound-reply quiet hours exemption. Once confirmed, enable the feature flag by default for new clients. The code is implemented and feature-flagged — this is a process/legal blocker, not an engineering task.

**Why**: FM-38 is #3 in the consensus ranking. Until the flag is enabled, the quiet hours mitigation claimed in the post-mitigation report is non-functional for most clients.

### 5. Address FM-59 attribution with policy (Effort: M, Impact: FM-59 RPN 25 → ~10)

**What**: Define clearer attribution criteria in guarantee terms. "AI-attributed" = system had documented interaction before won outcome. Disputed cases: 50/50 split rather than full refund.

**Why**: FM-59 is the highest-ranking FM that no code change can fix. The call-prep attribution evidence provides the data — the gap is policy.

---

## Simulation Parameters

| Parameter | Value |
|-----------|-------|
| Scenarios | 10,000 |
| Seed | 42 |
| Total failure modes | 76 (59 original + 12 NFMs + 5 consensus NEWFMs) |
| Coupling: hard | 0.70 |
| Coupling: soft | 0.20 |
| Coupling: observable | 0.05 |
| Correlation groups | 6 (disengaged_contractor, operator_overload, platform_down, low_volume, thin_kb, bad_fit) |
| Consensus threshold | 5/8 reviewers = adopted; 4/8 = split (dissent register); <4 = minority |
| Probability source | Median of 8 reviewer estimates for challenged FMs; self-scored for unchallenged FMs |
| Script | `.scratch/fma-consensus-simulation.py` |
| Results | `.scratch/fma-consensus-results.json` |

---

## Appendix: Complete Consensus-Adjusted RPN Changes

| FM | Description | P_self | P_cons | RPN_self | RPN_cons | Delta |
|:--:|------------|:------:|:------:|:--------:|:--------:|:-----:|
| FM-01 | Wrong ICP signed | 4% | 7% | 22.4 | 39.2 | +16.8 |
| FM-09 | Voicemail not disabled | 3% | 1.5% | 12.0 | 6.0 | -6.0 |
| FM-14 | Exclusion list skipped | 1% | 0.5% | 8.0 | 4.0 | -4.0 |
| FM-33 | Premature autonomous | 2% | 0.8% | 8.0 | 3.2 | -4.8 |
| FM-38 | Quiet hours gap | 10% | 15% | 40.0 | 60.0 | +20.0 |
| FM-40 | EST trigger never used | 8% | 13% | 38.4 | 62.4 | +24.0 |
| FM-56 | Never marks WON/LOST | 6% | 10% | 28.8 | 48.0 | +19.2 |
| FM-70 | Churn signals missed | 3% | 6% | 19.2 | 38.4 | +19.2 |
| NFM-08 | Meta-cron no external monitor | 1% | 3% | 4.8 | 14.4 | +9.6 |
| NEWFM-A | Capacity 40h ceiling | — | 15% | — | 63.0 | +63.0 |
| NEWFM-B | Volume dampening masks disengagement | — | 8% | — | 44.8 | +44.8 |
| NEWFM-C | Digest dedup 48h blackout | — | 8% | — | 24.0 | +24.0 |
| NEWFM-D | Auto-resolve KB drift | — | 4% | — | 16.8 | +16.8 |
| NEWFM-E | Heartbeat no external monitor | — | 3% | — | 14.4 | +14.4 |
| | | | | **Self total** | **Cons total** | **Net delta** |
| | | | | **791.9** | **1,048.9** | **+257.0** |

---

*Source: 8-reviewer adversarial red-team consensus (2026-04-15)*
*Original FMA: `active/fma/managed-service-fma.md`*
*Post-mitigation report: `active/fma/managed-service-fma-post-mitigation.md`*
*Resolution spec: `docs/superpowers/specs/2026-04-14-fma-resolution-design.md`*
